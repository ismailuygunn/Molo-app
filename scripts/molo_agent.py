#!/usr/bin/env python3
"""
Molo Content Agent — Otonom İçerik & Kurgu Agent'ı
═══════════════════════════════════════════════════

Kullanım:
  python3 scripts/molo_agent.py projects/2026-03-16_konu/brief.md
  python3 scripts/molo_agent.py projects/2026-03-16_konu/brief.md --dry-run

Akış:
  1. Brief okur → Gemini ile senaryo yazar
  2. Ses üretir → gerçek ses sürelerini ölçer
  3. Sürelere göre sahne sayısını ve Kling video planını belirler
  4. Onay bekler (kullanıcıya sunar)
  5. Sahne görselleri (Gemini Nano Banana 2)
  6. Video üretimi (Kling v3, kompakt promptlar <2500 char)
  7. Kurgu (stream_loop + kalite filtreleri + crossfade)
  8. Altyazı (ASS, DE→EN çeviri)
  9. Final slowdown (%5 yavaşlatma)
"""

import os
import sys
import json
import shutil
import time
import base64
import subprocess
import requests
import jwt
from pathlib import Path
from datetime import datetime

# ── Config import ──
sys.path.insert(0, str(Path(__file__).parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from config import (
    BASE_DIR, PROJECTS_DIR, REFERENCE_DIR, VOICES_DIR,
    FFMPEG, OUTPUT_WIDTH, OUTPUT_HEIGHT, OUTPUT_FPS,
    KLING_MODEL, KLING_API_BASE, KLING_DURATION, KLING_MAX_PROMPT_CHARS, KLING_CFG_SCALE,
    KLING_NEGATIVE_PROMPT,
    KLING_CFG_STUDIO, KLING_CFG_CLINIC, KLING_CFG_EXTERNAL,
    GEMINI_IMAGE_MODEL, GEMINI_TEXT_MODEL, ELEVENLABS_MODEL,
    VOICE_PRESETS, VOICE_DEFAULT, VOICE_PROFILES,
    CHARACTER_PERSONALITY, CHARACTER_IDENTITY_LOCK,
    CHARACTER_LOCK_IMAGE, HOLOGRAM_LOCK, LIGHTING_RULES, AVOID_LIST,
    COMPACT_VIDEO_LOCK, COMPACT_VIDEO_LOCK_EKRAN, COMPACT_VIDEO_LOCK_GS,
    FACE_CONSISTENCY_VIDEO_LOCK,
    CLINIC_ENV_BLOCK, STUDIO_ENV_BLOCK, EXTERNAL_ENV_BLOCK,
    QUALITY_FILTERS, AUDIO_SLOWDOWN, CROSSFADE_DURATION,
    SMART_SLOWDOWN_TARGET_WPS, SMART_SLOWDOWN_FAST_WPS, SMART_SLOWDOWN_SLOW_WPS,
    SMART_SLOWDOWN_MIN, SMART_SLOWDOWN_MAX,
    FREEZE_FRAME_MAX, FREEZE_FRAME_FADE, SCENE_BREATH_FADE,
    SUBTITLE_STYLES, DEFAULT_SUBTITLE_STYLE,
    TRANSITION_TYPES, DEFAULT_TRANSITION,
    BGM_VOLUME_DB, BGM_FADE_IN, BGM_FADE_OUT, BGM_DIR,
    THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT,
    KLING_MAX_PARALLEL, KLING_RETRY_WAIT, KLING_MAX_RETRIES,
    SCENE_PADDING,
    CONTENT_TYPES, DEFAULT_CONTENT_TYPE,
    MOLO_POSES, ENVIRONMENT_IMAGES,
    IMAGE_VARIANTS_COUNT,
    get_normalize_filter,
)
import random

# ── Aktif içerik türü profili (main'de set edilir) ──
_content_type_key = DEFAULT_CONTENT_TYPE
_ct = CONTENT_TYPES[DEFAULT_CONTENT_TYPE].copy()

from google import genai
from google.genai import types as gtypes


def gemini_with_retry(func, max_retries=3, delay=5):
    """Gemini API çağrısını exponential backoff ile tekrarla."""
    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            if attempt < max_retries - 1:
                wait = delay * (attempt + 1)
                print(f"   ⚠️ Gemini hatası (deneme {attempt+1}/{max_retries}): {e}")
                print(f"      {wait}s sonra tekrar deneniyor...")
                time.sleep(wait)
            else:
                print(f"   ❌ Gemini {max_retries} denemede de başarısız: {e}")
                raise

# ═══════════════════════════════════════
# İLERLEME TAKİBİ
# ═══════════════════════════════════════

_progress_path = None  # main() içinde set edilir

def _write_progress(step: str, progress: int, message: str = "",
                    is_error: bool = False, is_done: bool = False,
                    is_paused: bool = False):
    """Yapılandırılmış progress.json yaz — Studio UI tarafından okunur."""
    if _progress_path is None:
        return
    import json, datetime
    data = {
        "step": step,
        "progress": progress,
        "message": message,
        "isRunning": not is_done and not is_error and not is_paused,
        "isError": is_error,
        "isDone": is_done,
        "isPaused": is_paused,
        "updatedAt": datetime.datetime.now().isoformat(),
    }
    try:
        with open(_progress_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
    except Exception:
        pass  # Dosya yazılamazsa pipeline'ı durdurmayız


def _write_checkpoint(project_dir, step, completed_steps, **state):
    """Pipeline state'ini checkpoint.json'a yaz — resume için kullanılır."""
    import json, datetime
    data = {
        "step": step,
        "completed_steps": completed_steps,
        "updated_at": datetime.datetime.now().isoformat(),
    }
    data.update(state)
    path = Path(project_dir) / "checkpoint.json"
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception:
        pass


def _load_checkpoint(project_dir):
    """checkpoint.json varsa yükle, yoksa None döndür."""
    import json
    path = Path(project_dir) / "checkpoint.json"
    if not path.exists():
        return None
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _validate_files(file_list):
    """Dosya listesinden mevcut olanları döndür."""
    return [f for f in file_list if os.path.exists(f)]


# ═══════════════════════════════════════
# YARDIMCI FONKSİYONLAR
# ═══════════════════════════════════════

def get_audio_duration(filepath):
    """FFmpeg ile ses dosyası süresini saniye olarak döndürür."""
    r = subprocess.run([FFMPEG, "-i", str(filepath), "-f", "null", "-"],
                       capture_output=True, text=True)
    for line in r.stderr.split('\n'):
        if 'Duration:' in line:
            t = line.split('Duration:')[1].split(',')[0].strip()
            h, m, s = t.split(':')
            return float(h) * 3600 + float(m) * 60 + float(s)
    return 5.0


def get_kling_token():
    """Kling API JWT token oluşturur."""
    ak = os.getenv("KLING_API_ACCESS")
    sk = os.getenv("KLING_API_SECRET")
    now = int(time.time())
    payload = {"iss": str(ak), "exp": now + 1800, "nbf": now - 5, "iat": now}
    return jwt.encode(payload, sk, algorithm="HS256",
                      headers={"alg": "HS256", "typ": "JWT"})


def format_ass_time(seconds):
    """Saniyeyi ASS zaman formatına çevirir: H:MM:SS.CC"""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def wrap_subtitle(text, max_chars=45):
    """Uzun altyazıları satır kırarak böler."""
    if len(text) <= max_chars:
        return text
    words = text.split()
    lines = []
    current = ""
    for w in words:
        if len(current) + len(w) + 1 > max_chars and current:
            lines.append(current)
            current = w
        else:
            current = f"{current} {w}".strip() if current else w
    if current:
        lines.append(current)
    return "\\N".join(lines)


def split_into_subtitle_chunks(text, max_chars=80):
    """Uzun metni cümle bazlı altyazı parçalarına böl.
    
    Her parça max 2 satır, max ~80 karakter olacak şekilde.
    Bölme: cümle sonu (.!?) veya virgülden.
    """
    import re
    # Cümle bazlı böl
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    
    chunks = []
    current = ""
    for sent in sentences:
        if not sent.strip():
            continue
        # Eğer mevcut chunk + yeni cümle çok uzunsa, ayır
        combined = f"{current} {sent}".strip() if current else sent
        if len(combined) > max_chars and current:
            chunks.append(current.strip())
            current = sent
        else:
            current = combined
    if current.strip():
        chunks.append(current.strip())
    
    # Eğer hâlâ çok uzun parçalar varsa, virgülden böl
    final_chunks = []
    for chunk in chunks:
        if len(chunk) > max_chars:
            parts = chunk.split(', ')
            sub = ""
            for p in parts:
                combined = f"{sub}, {p}".strip(', ') if sub else p
                if len(combined) > max_chars and sub:
                    final_chunks.append(sub.strip())
                    sub = p
                else:
                    sub = combined
            if sub.strip():
                final_chunks.append(sub.strip())
        else:
            final_chunks.append(chunk)
    
    return final_chunks if final_chunks else [text]


# ═══════════════════════════════════════
# ADIM 1: BRİEF OKUMA & SENARYO ÜRETİMİ
# ═══════════════════════════════════════

def generate_script(brief_path, lang="de", max_scenes=4):
    """Brief dosyasını okur, Gemini ile senaryo üretir."""
    brief = Path(brief_path).read_text(encoding="utf-8")

    print("=" * 60)
    print("📝 ADIM 1: Senaryo Üretimi (Gemini)")
    print("=" * 60)
    print(f"   📄 Brief: {brief_path}")
    print(f"   🎬 Maks sahne: {max_scenes}")

    # Brief zenginleştirme — varsa özel alanları çıkar
    brief_extras = ""
    brief_lower = brief.lower()
    if "## hedef kitle" in brief_lower:
        print("   ✅ Brief: Hedef Kitle bulundu")
    else:
        print("   ⚠️ Brief: 'Hedef Kitle' eksik — zenginleştirilmiş brief önerilir")
    if "## ana mesaj" in brief_lower:
        print("   ✅ Brief: Ana Mesaj bulundu")
    else:
        print("   ⚠️ Brief: 'Ana Mesaj' eksik — zenginleştirilmiş brief önerilir")
    if "## senaryo" in brief_lower:
        print("   ✅ Brief: Senaryo İpuçları bulundu")

    # Ortam önerilerini brief konusuna göre seç
    from config import ENVIRONMENT_SUGGESTIONS, EMOTION_ARCS
    env_suggestions = ENVIRONMENT_SUGGESTIONS.get("general", [])
    for key in ENVIRONMENT_SUGGESTIONS:
        if key in brief_lower:
            env_suggestions = ENVIRONMENT_SUGGESTIONS[key]
            break

    # Duygu arcını ton'a göre seç
    emotion_arc = EMOTION_ARCS.get("energetic_opener", [])
    if "afacan" in brief_lower or "mischiev" in brief_lower:
        emotion_arc = EMOTION_ARCS["mischievous"]
    elif "rahatl" in brief_lower or "korku" in brief_lower or "reassur" in brief_lower:
        emotion_arc = EMOTION_ARCS["reassuring"]
    elif "bilgi" in brief_lower or "educat" in brief_lower:
        emotion_arc = EMOTION_ARCS["educational"]

    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

    lang_names = {"de": "German", "tr": "Turkish", "en": "English"}
    target_lang = lang_names.get(lang, lang)

    system_prompt = f"""You are the creative director for MOLO, İstadental's brand mascot.

{CHARACTER_PERSONALITY}

CONTENT FORMAT: {_ct['scene_direction']}

CREATIVE WRITING RULES:
- MOLO can make witty observations, gentle self-commentary ("Ben bir robotum ama bunu bile biliyorum!"), and situational humor
- Use conversational hooks: start scenes with curiosity triggers ("Wusstet ihr, dass..." / "Rate mal, was passiert wenn...")
- MOLO can break the fourth wall gently (looking at camera knowingly, addressing audience directly)
- Add micro-comedy: one small joke or clever observation per video — not forced, naturally woven into the content
- MOLO can reference pop culture lightly (without naming specific brands) and use relatable everyday scenarios
- Each scene should have an emotional arc: hook → content → punchline/takeaway
- The LAST word of each scene should feel satisfying (avoid trailing off)
- Vary sentence length: mix short punchy lines with flowing explanations
- MOLO can express genuine surprise, wonder, or playful confusion about human habits ("Wieso essen Menschen Eis direkt nach dem Zähneputzen? Das verstehe ich als Roboter nicht!")

AUDIENCE ENGAGEMENT:
- First 3 seconds are CRITICAL: Start with a question, surprising fact, or funny statement
- Include at least one "share-worthy" moment per video (something viewers would screenshot or quote)
- End with a memorable farewell that varies — not always the same goodbye

CRITICAL RULES FOR SCRIPT WRITING:
- The brief may be written in Turkish. Regardless of brief language, write scene texts in {target_lang}.
- For each scene, also provide 'text_tr' field with the Turkish translation of the scene text. This is for the content creator's reference only and will NOT be used in production.
- Generate EXACTLY {max_scenes} scenes. No more, no less.
- Each scene should be max ~80 words / ~8-12 seconds of speech
- First scene: energetic greeting (MOLO introduces topic)
- Middle scenes: informative content with subtle humor and personality
- Last scene: warm farewell with brand invitation ("Kommt vorbei" / "Besucht uns")
- MOLO can make small jokes, gently self-praise, quietly self-comment
- MOLO is warm, clever, slightly mischievous — but NEVER breaks brand seriousness
- MOLO is NOT a doctor — relay info simply, warmly, accessibly
- Keep scenes balanced in length — no scene should be 3x longer than another

ENVIRONMENT SELECTION RULES:
You must choose the most appropriate environment for EACH scene based on its content.
TYPES:
1. "clinic" — ONLY when scene takes place inside the dental clinic (welcoming patients,
   clinic tour, dental procedures). Uses real clinic reference photo.
2. "studio" — For abstract/brand scenes with no specific location (general dental tips,
   brand intro, meditation). Dark atmospheric studio.
3. Any specific real-world location — When content implies a place. Write a descriptive
   location name. Examples:
   - Istanbul topic → "istanbul_bosphorus" or "istanbul_sultanahmet"
   - School topic → "school_classroom"
   - Park/nature → "city_park" or "garden"
   - Morning routine → "modern_bathroom" or "family_kitchen"
When environment is NOT "clinic" and NOT "studio", you MUST include a "background_description"
field with 2-3 sentences describing the visual background (lighting, colors, details).

SUGGESTED ENVIRONMENTS for this content: {', '.join(env_suggestions)}
SUGGESTED EMOTION ARC across scenes: {' → '.join(emotion_arc)}

MOLO is always front-facing. Do not specify pose — reference image is selected automatically.

VOICE DIRECTION GUIDE:
- whisper: secrets, conspiracies, "let me tell you something" moments
- surprised: "did you know?!" hooks, genuine wonder
- mischievous: self-praise, gentle teasing, fourth-wall breaks
- playful: jokes, light moments
- energetic: openings, calls to action
- warm: farewells, reassuring content
- calm: dental anxiety reduction content
- informative: educational explanations
- excited: high energy reactions

AVAILABLE SHOT TYPES: wide (full body + environment visible), medium (waist up, balanced), medium-close (chest up, face prominent), close (head and shoulders, emotional emphasis)

SCENE VARIETY RULES:
- NO TWO SCENES should have the same environment. If scene 1 is clinic, scene 2 must be different.
- Each scene should have a different shot type. Progression: wide → medium → medium-close → close.
- Each scene should have a different emotion. No flat "warm and welcoming" repeated.
- At least one scene should use a real-world environment (not studio or clinic).
- Opening scene: WIDEST framing. Final scene: CLOSEST framing.

OUTPUT FORMAT — Return ONLY valid JSON, no markdown:
{{
  "title": "short content title",
  "scenes": [
    {{
      "scene": 1,
      "text": "what MOLO says in {target_lang}",
      "text_tr": "Aynı metnin Türkçe çevirisi (referans için)",
      "environment": "clinic",
      "background_description": "",
      "voice_direction": "energetic",
      "shot_type": "medium",
      "emotion_note": "excited greeting, slightly mischievous"
    }}
  ]
}}"""

    response = gemini_with_retry(lambda: client.models.generate_content(
        model=GEMINI_TEXT_MODEL,
        contents=f"Write a MOLO script based on this brief:\n\n{brief}",
        config=gtypes.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.8,
        )
    ))

    # JSON parse
    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    try:
        script = json.loads(text)
    except json.JSONDecodeError:
        print(f"   ❌ JSON parse hatası. Gemini çıktısı:\n{text[:500]}")
        sys.exit(1)

    scenes = script.get("scenes", [])

    # Sahne sayısı limiti
    if len(scenes) > max_scenes:
        print(f"   ⚠️ {len(scenes)} sahne üretildi → {max_scenes}'e kırpıldı")
        scenes = scenes[:max_scenes]
        # Sahne numaralarını yeniden düzenle
        for i, s in enumerate(scenes):
            s["scene"] = i + 1
        script["scenes"] = scenes

    print(f"   ✅ {len(scenes)} sahne üretildi: {script.get('title', '?')}")
    for s in scenes:
        print(f"      Sahne {s['scene']}: [{s['voice_direction']}] 🇩🇪 {s['text'][:60]}...")
        if s.get('text_tr'):
            print(f"                         🇹🇷 {s['text_tr'][:60]}...")

    return script


# ═══════════════════════════════════════
# ADIM 2: SES ÜRETİMİ (ÖNCELİKLİ)
# ═══════════════════════════════════════

def generate_voices(scenes, lang, project_name, project_dir=None):
    """Her sahne için ElevenLabs ses üretir, gerçek süreleri döndürür.
    project_dir verilirse, audio dosyalarını proje dizinine de kopyalar."""
    print("\n" + "=" * 60)
    print("🎤 ADIM 2: Ses Üretimi (Ses-Öncelikli Akış)")
    print("=" * 60)

    api_key = os.getenv("ELEVENLABS_API_KEY")
    profile_name = VOICE_PROFILES.get(lang)

    # Profil ID bul
    headers = {"xi-api-key": api_key}
    resp = requests.get("https://api.elevenlabs.io/v1/voices", headers=headers)
    voices = resp.json().get("voices", [])
    voice_id = None
    for v in voices:
        if v["name"] == profile_name:
            voice_id = v["voice_id"]
            break

    if not voice_id:
        print(f"   ❌ Ses profili bulunamadı: {profile_name}")
        sys.exit(1)

    print(f"   🎙️ Profil: {profile_name} ({voice_id})")

    voice_files = []
    durations = []

    for s in scenes:
        n = s["scene"]
        text = s["text"]
        direction = s.get("voice_direction", "warm")
        preset = VOICE_PRESETS.get(direction, VOICE_DEFAULT)

        output_file = VOICES_DIR / lang / f"Molo_{lang}_{project_name}_s{n:02d}.mp3"
        output_file.parent.mkdir(parents=True, exist_ok=True)

        payload = {
            "text": text,
            "model_id": ELEVENLABS_MODEL,
            "voice_settings": {
                "stability": preset["stability"],
                "similarity_boost": preset.get("similarity_boost", 0.80),
                "style": preset["style"],
                "speed": preset.get("speed", 1.0),
                "use_speaker_boost": True,
            }
        }

        for retry in range(3):
            resp = requests.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
                headers={"xi-api-key": api_key, "Content-Type": "application/json"},
                json=payload, timeout=60
            )
            if resp.status_code == 200:
                break
            elif resp.status_code in (429, 500, 502, 503, 504) and retry < 2:
                wait = 10 * (retry + 1)
                print(f"   ⚠️ Sahne {n}: HTTP {resp.status_code}, {wait}s sonra tekrar deneniyor...")
                time.sleep(wait)
                continue
            else:
                print(f"   ❌ Sahne {n}: HTTP {resp.status_code} — {resp.text[:200]}")
                sys.exit(1)

        if resp.status_code == 200:
            with open(output_file, "wb") as f:
                f.write(resp.content)
            # Proje audio dizinine de kopyala (Studio UI için)
            if project_dir:
                proj_audio = Path(project_dir) / "audio" / f"scene_{n:02d}.mp3"
                proj_audio.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(str(output_file), str(proj_audio))
            dur = get_audio_duration(output_file)
            durations.append(dur)
            voice_files.append(str(output_file))
            print(f"   ✅ Sahne {n}: {dur:.1f}s [{direction}] ({len(resp.content)} bytes)")
        else:
            print(f"   ❌ Sahne {n}: HTTP {resp.status_code} — {resp.text[:200]}")
            sys.exit(1)

    total = sum(durations)
    print(f"\n   📊 Toplam ses süresi: {total:.1f}s ({len(scenes)} sahne)")
    print(f"   📊 Ortalama sahne: {total/len(scenes):.1f}s")

    return voice_files, durations


# ═══════════════════════════════════════
# ADIM 3: ONAY MEKANİZMASI
# ═══════════════════════════════════════

def present_for_approval(script, durations, project_dir, auto_approve=False):
    """Senaryoyu ve süreleri terminalde sunar, onay bekler."""
    print("\n" + "=" * 60)
    print("📋 İÇERİK ONAYI")
    print("=" * 60)

    scenes = script["scenes"]
    total = sum(durations)
    kling_cost = len(scenes) * 10  # tahmini

    print(f"\n   📌 Başlık: {script.get('title', '?')}")
    print(f"   ⏱️  Toplam süre: {total:.1f}s ({len(scenes)} sahne)")
    print(f"   💰 Tahmini Kling kredisi: ~{kling_cost}")
    print()

    for i, s in enumerate(scenes):
        d = durations[i] if i < len(durations) else 0
        print(f"   ┌─ Sahne {s['scene']} [{s['voice_direction']}] ({d:.1f}s)")
        print(f"   │  🎤 \"{s['text']}\"")
        print(f"   │  📸 {s['environment']} | {s['molo_pose']} | {s['shot_type']}")
        print(f"   │  💭 {s.get('emotion_note', '-')}")
        print(f"   └─")
        print()

    # scenes.json kaydet
    scenes_json = project_dir / "scenes" / "scenes.json"
    scenes_json.parent.mkdir(parents=True, exist_ok=True)
    with open(scenes_json, "w", encoding="utf-8") as f:
        json.dump({"title": script.get("title"), "scenes": scenes,
                    "durations": durations, "total_duration": total}, f,
                   ensure_ascii=False, indent=2)
    print(f"   📄 scenes.json: {scenes_json}")

    if auto_approve:
        print("\n   ✅ Otomatik onay (--auto-approve)")
        return True

    answer = input("\n   Devam etmek istiyor musunuz? (e/h): ").strip().lower()
    return answer == "e"


# ═══════════════════════════════════════
# ADIM 4: SAHNE GÖRSELLERİ
# ═══════════════════════════════════════

QC_MIN_SCORE = 6       # Minimum kabul skoru (1-10)
QC_MAX_RETRIES = 2     # Maksimum yeniden deneme


def _score_image_quality(image_path, molo_ref_path, client):
    """Gemini ile üretilen görseli skorla. Döner: (overall_score, detail_dict) veya (10, {})."""
    try:
        parts = [
            gtypes.Part.from_bytes(data=open(molo_ref_path, "rb").read(), mime_type="image/jpeg"),
            gtypes.Part.from_bytes(data=open(image_path, "rb").read(), mime_type="image/png"),
        ]

        prompt = ('Compare the generated image (second) with the MOLO mascot reference (first). '
                  'Score 1-10 for each criterion with strict attention to facial consistency. '
                  'Return ONLY valid JSON, no explanation:\n'
                  '{"eye_shape_match": <int>, "eye_color_match": <int>, "eye_spacing_match": <int>, '
                  '"mouth_design_match": <int>, "visor_shape_match": <int>, '
                  '"hologram_presence": <int>, "body_proportions": <int>, "overall_quality": <int>}')

        resp = gemini_with_retry(lambda: client.models.generate_content(
            model=GEMINI_TEXT_MODEL,
            contents=[prompt] + parts,
        ))

        text = resp.text.strip()
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()

        scores = json.loads(text)
        overall = scores.get("overall_quality", 0)
        # Yüz skoru düşükse genel skoru da düşür
        face_scores = [scores.get("eye_shape_match", 0), scores.get("eye_color_match", 0),
                       scores.get("eye_spacing_match", 0), scores.get("mouth_design_match", 0),
                       scores.get("visor_shape_match", 0)]
        face_avg = sum(face_scores) / len(face_scores) if face_scores else 0
        if face_avg < 6:
            overall = min(overall, int(face_avg))
        return overall, scores
    except Exception as e:
        print(f"      ⚠️ QC skor hesaplanamadı: {e}")
        return 10, {}  # Hata durumunda geç


def generate_scene_images(scenes, project_dir):
    """Her sahne için premium identity-lock promptlarıyla Gemini görseli üretir.
    IMAGE_VARIANTS_COUNT kadar varyant uretir (v1, v2, ...) ve ilk varyanti ref.png olarak kaydeder."""
    print("\n" + "=" * 60)
    print("📸 ADIM 2: Sahne Görselleri (Nano Banana 2)")
    print("=" * 60)

    variant_count = IMAGE_VARIANTS_COUNT

    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
    image_files = []

    for s in scenes:
        n = s["scene"]
        env = s.get("environment", "clinic")
        shot = s.get("shot_type", "medium")
        emotion = s.get("emotion_note", "warm, welcoming")

        output = project_dir / "scenes" / f"scene_{n:02d}_ref.png"
        print(f"\n   ── Sahne {n}: {env} | {shot} ({variant_count} varyant)")

        # Molo referans görseli — ortam bazlı seçim (2 canonical referans)
        if env == "studio":
            molo_ref = MOLO_POSES["studio"]
        else:
            molo_ref = MOLO_POSES["front"]

        # Görüntüleri yükle
        images_to_send = [gtypes.Part.from_bytes(
            data=open(molo_ref, "rb").read(),
            mime_type="image/jpeg"
        )]

        # Ortam yönlendirme (clinic / studio / dış mekân)
        bg_desc = s.get("background_description", "")
        env_block = ""
        gs_reminder = ""
        if _ct.get("is_greenscreen", False):
            gs_reminder = (
                "\n\nCRITICAL: This is a GREEN SCREEN shoot. "
                "The ENTIRE background must be perfectly flat solid chroma green (#00B140). "
                "NO other background elements. NO shadows on the green. "
                "Only the MOLO character visible against uniform green.\n\n"
            )
        elif env == "clinic":
            env_ref = ENVIRONMENT_IMAGES.get("clinic")
            if env_ref and env_ref.exists():
                images_to_send.insert(0, gtypes.Part.from_bytes(
                    data=open(env_ref, "rb").read(),
                    mime_type="image/jpeg"
                ))
                print(f"      🏥 Klinik referansı eklendi: {env_ref.name}")
            env_block = """Also use the provided clinic background reference as the environmental base for this composition. The final image must clearly place MOLO inside that premium dental clinic environment. The clinic interior should remain visible, readable, and recognizable behind and around MOLO.
MOLO should appear naturally present in the clinic — standing on the clinic floor with correct perspective, matching the clinic's lighting direction and color temperature. The composite must feel photorealistic, as if MOLO physically exists in this space.
Do not let MOLO fill the entire frame. Do not crop MOLO too close. Do not make MOLO oversized relative to the clinic furniture."""
        elif env == "studio":
            env_block = """Dark atmospheric premium studio environment.
Background: deep dark blue gradient (#0D2847 to #1A3A5C) with subtle volumetric fog.
Floor: highly reflective mirror-like dark surface creating a soft reflection of MOLO.
Lighting: dramatic rim lighting from behind creating blue edge highlights, main soft key light from front-left, cyan glow from hologram cone.
Atmosphere: subtle particle effects and soft volumetric haze. No clinic elements, no outdoor elements, no props."""
        else:
            if not bg_desc:
                bg_desc = f"A photorealistic {env.replace('_', ' ')} setting with natural lighting and pleasant atmosphere"
            env_block = f"""Place MOLO in this specific real-world environment:
LOCATION: {env.replace('_', ' ').title()}
VISUAL DESCRIPTION: {bg_desc}
Generate the background ENTIRELY from this description — no reference photo is used.
MOLO's lighting must match the environment's natural lighting direction and color temperature.
MOLO should be proportionally sized (approximately 1 meter tall) relative to the surroundings.
The perspective must be consistent between MOLO and the background.
The environment must feel photorealistic and immediately recognizable as the described location.
Style: Premium photorealistic composite, like a luxury brand campaign shot on location."""
            print(f"      🌍 Dış mekân: {env} → prompt tabanlı arka plan")

        # Premium prompt oluştur
        image_rules = _ct.get('image_rules', '')
        prompt = f"""{gs_reminder}{CHARACTER_LOCK_IMAGE}

{env_block}

Create a {_ct['orientation']} {_ct['aspect']} frame. MOLO front-facing, direct eye contact, centered, symmetrical.
Framing: {shot} shot. Posture: upright, welcoming.
Expression: {emotion}

{_ct['scene_direction']}

{image_rules}

{AVOID_LIST}"""

        # ── Varyant bazli uretim ──
        variant_suffixes = [f"v{vi+1}" for vi in range(variant_count)]
        variant_prompts = []
        for vi in range(variant_count):
            if vi == 0:
                variant_prompts.append(prompt)
            else:
                variant_prompts.append(prompt + "\n\nAlternative composition: slightly different framing and pose variation.")

        first_variant_ok = False
        for vi, (v_suffix, v_prompt) in enumerate(zip(variant_suffixes, variant_prompts)):
            v_output = project_dir / "scenes" / f"scene_{n:02d}_{v_suffix}.png"
            print(f"      ── Varyant {v_suffix} ──")

            # ── Kalite kontrollü üretim (max QC_MAX_RETRIES + 1 deneme) ──
            best_score = 0
            best_output = None
            attempts = QC_MAX_RETRIES + 1

            for attempt in range(attempts):
                attempt_suffix = f" (deneme {attempt + 1}/{attempts})" if attempt > 0 else ""
                print(f"      🧠 Gemini üretimi {v_suffix}...{attempt_suffix}")

                response = gemini_with_retry(lambda p=v_prompt: client.models.generate_content(
                    model=GEMINI_IMAGE_MODEL,
                    contents=[p] + images_to_send,
                    config=gtypes.GenerateContentConfig(
                        response_modalities=["IMAGE", "TEXT"],
                    )
                ))

                # Görseli kaydet
                saved = False
                attempt_path = str(v_output).replace(".png", f"_try{attempt}.png") if attempt > 0 else str(v_output)

                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'inline_data') and part.inline_data:
                        from PIL import Image
                        import io
                        img = Image.open(io.BytesIO(part.inline_data.data))
                        if img.size != (_ct['width'], _ct['height']):
                            img = img.resize((_ct['width'], _ct['height']), Image.LANCZOS)

                        img.save(attempt_path, "PNG")
                        saved = True
                        break

                if not saved:
                    print(f"      ❌ Görsel üretilemedi {v_suffix} (deneme {attempt + 1})")
                    continue

                # ── Kalite skoru ──
                score, details = _score_image_quality(attempt_path, str(molo_ref), client)
                detail_str = ", ".join(f"{k}={v}" for k, v in details.items()) if details else "N/A"
                print(f"      🔍 QC {v_suffix}: {score}/10 ({detail_str})")

                if score > best_score:
                    best_score = score
                    best_output = attempt_path

                if score >= QC_MIN_SCORE:
                    break
                else:
                    print(f"      ⚠️ Sahne {n} {v_suffix}: kalite skoru düşük ({score}), tekrar deneniyor...")

            # En iyi sonucu varyant dosyasina tasi
            if best_output and best_output != str(v_output):
                import shutil
                shutil.copy2(best_output, str(v_output))
                for a in range(attempts):
                    try_path = str(v_output).replace(".png", f"_try{a}.png")
                    if os.path.exists(try_path):
                        os.remove(try_path)

            if best_output:
                qc_label = f"✅ QC={best_score}/10" if best_score >= QC_MIN_SCORE else f"⚠️ QC={best_score}/10 (en iyi)"
                print(f"      {qc_label} → {v_output.name}")
                # Ilk varyanti ref.png olarak da kaydet (varsayilan/fallback)
                if vi == 0:
                    import shutil
                    shutil.copy2(str(v_output), str(output))
                    first_variant_ok = True
            else:
                print(f"      ❌ Sahne {n} {v_suffix}: hiçbir deneme başarılı olmadı!")
                if vi == 0:
                    # Ilk varyant zorunlu — basarisizsa pipeline durur
                    sys.exit(1)

        if first_variant_ok:
            image_files.append(str(output))
        else:
            print(f"      ❌ Sahne {n}: hiçbir varyant başarılı olmadı!")
            sys.exit(1)

    return image_files


def regenerate_single_image(scene_index, project_dir):
    """Tek bir sahne görseli yeniden üret — UI'dan çağrılır (pause sırasında).

    Args:
        scene_index: 0-based sahne indeksi
        project_dir: Path — proje dizini

    Returns:
        str: yeni görsel yolu veya None
    """
    project_dir = Path(project_dir)
    scenes_file = project_dir / "scenes" / "scenes.json"
    if not scenes_file.exists():
        print(f"❌ scenes.json bulunamadı: {scenes_file}")
        return None

    with open(scenes_file) as f:
        scenes = json.load(f)

    if scene_index < 0 or scene_index >= len(scenes):
        print(f"❌ Geçersiz sahne indeksi: {scene_index} (toplam: {len(scenes)})")
        return None

    # Content type belirle
    ckpt = _load_checkpoint(project_dir)
    global _content_type_key, _ct
    if not hasattr(regenerate_single_image, "_initialized"):
        # Brief'ten content type oku
        brief_path = project_dir / "brief.md"
        ct_key = DEFAULT_CONTENT_TYPE
        if brief_path.exists():
            brief_text = brief_path.read_text(encoding="utf-8")
            import unicodedata
            for line in brief_text.split("\n"):
                nf = unicodedata.normalize("NFKD", line).casefold().strip()
                if ("erik t" in nf and ":" in nf) or "content type:" in nf:
                    val = line.split(":", 1)[1].strip().lower()
                    if val in CONTENT_TYPES:
                        ct_key = val
                        break
        _content_type_key = ct_key
        _ct = CONTENT_TYPES[ct_key].copy()
        regenerate_single_image._initialized = True

    # Tek sahneyi yeniden üret
    print(f"\n🔄 Sahne {scene_index + 1} görseli yeniden üretiliyor...")
    result = generate_scene_images([scenes[scene_index]], project_dir)

    if result:
        new_path = str(result[0])
        # Checkpoint güncelle
        if ckpt and ckpt.get("image_files"):
            img_files = list(ckpt["image_files"])
            if scene_index < len(img_files):
                img_files[scene_index] = new_path
                completed = list(ckpt.get("completed_steps", []))
                _write_checkpoint(project_dir, "images", completed,
                                  script=ckpt.get("script"),
                                  voice_files=ckpt.get("voice_files"),
                                  durations=ckpt.get("durations"),
                                  image_files=img_files)
                print(f"   ✅ Checkpoint güncellendi: sahne {scene_index + 1}")
        return new_path

    print(f"   ❌ Sahne {scene_index + 1} yeniden üretilemedi")
    return None


# ═══════════════════════════════════════
# ADIM 5: VİDEO ÜRETİMİ (Kling v3)
# ═══════════════════════════════════════

def build_video_prompt(scene):
    """Sahne için <2500 char kompakt video prompt'u oluşturur. İçerik türüne duyarlı."""
    shot = scene.get("shot_type", "medium")
    emotion = scene.get("emotion_note", "warm, premium, welcoming")
    voice_dir = scene.get("voice_direction", "warm")
    is_gs = _ct.get("is_greenscreen", False)
    is_ekran = _ct.get("orientation") == "horizontal" and not is_gs

    if is_gs:
        # Green screen modu
        lock = COMPACT_VIDEO_LOCK_GS

        orientation = _ct.get("orientation", "vertical")
        if orientation == "horizontal":
            framing = f"Horizontal {_ct['aspect']} green screen composition. MOLO positioned at left-third for compositing flexibility."
        elif orientation == "square":
            framing = f"Square {_ct['aspect']} green screen composition. MOLO centered, filling 60-70% of frame."
        else:
            framing = f"Vertical {_ct['aspect']} green screen composition. MOLO centered, symmetrical, front-facing."

        scene_block = f"""{framing}

{_ct['scene_direction']}

{_ct.get('video_prompt_boost', '')}

Performance mood: {emotion}. Voice direction: {voice_dir}.
Character acting: warm, precise, premium, slightly robotic, controlled.

CRITICAL GREEN SCREEN RULES:
- Background: MUST be perfectly flat solid chroma green (#00B140)
- No shadows on green. No gradient. No particles. No fog.
- No floor. No reflections. No props. No environmental elements.
- Green must fill every pixel of background uniformly.
- Only MOLO character visible against the green.

Avoid: {shot} angle changes, background color variation, shadow on green, any non-green background element, floor reflection, ambient particles, green spill on character, changing MOLO's face/hologram/proportions, elastic motion, cartoon effects."""

    elif is_ekran:
        # Premium yatay ekran formatı
        lock = COMPACT_VIDEO_LOCK_EKRAN
        scene_block = f"""Scene: Premium horizontal {shot} commercial scene. {_ct['scene_direction']}

{_ct.get('video_prompt_boost', '')}

Performance mood: {emotion}. Voice direction: {voice_dir}.
MOLO clearly visible with elegant negative space. The setting must feel clean, expensive, calm, and editorial, like a luxury brand commercial.
Overall tone: quiet visual humor, luxury editorial commercial, premium mascot, subtle futuristic wit, controlled robotic elegance.

Avoid: changing MOLO's face/hologram/proportions, sloppy pose, childish comedy, cartoon effects, busy background, visible clinic clutter, random props, toy-like rendering, generic AI styling, or anything that reduces elegance and luxury-brand credibility."""
    else:
        # Dikey format (sosyal/robot)
        lock = COMPACT_VIDEO_LOCK
        scene_block = f"""Premium front-facing {shot} {voice_dir} performance. MOLO centered, symmetrical, directly facing camera.

{_ct['scene_direction']}

{_ct.get('video_prompt_boost', '')}

Performance mood: {emotion}. The character should embody this emotion through subtle facial cues and minimal body language. No exaggeration.

Acting: warm, precise, premium, slightly robotic, controlled, direct. Not childish, not theatrical, not silly.

Avoid: side angle, 3/4 view, oversized mascot, cartoon wobble, arm flailing, face morphing, exaggerated smile, toy rendering, asymmetric framing, bouncing, elastic motion."""

    full = f"{lock}\n\n{scene_block}"

    if len(full) > KLING_MAX_PROMPT_CHARS:
        original_len = len(full)
        # Truncation priority: Avoid block first, then video_prompt_boost content
        # NEVER truncate the lock or emotion/acting direction
        avoid_marker = "Avoid:"
        boost_content = _ct.get('video_prompt_boost', '')

        if avoid_marker in scene_block:
            # Step 1: Try truncating the Avoid block
            parts = scene_block.rsplit(avoid_marker, 1)
            content_part = parts[0].rstrip()
            avoid_part = avoid_marker + parts[1]

            # First try: remove Avoid block entirely
            test_full = f"{lock}\n\n{content_part}"
            if len(test_full) <= KLING_MAX_PROMPT_CHARS:
                # Avoid block removal is enough, try to keep as much as possible
                remaining = KLING_MAX_PROMPT_CHARS - len(test_full) - 2  # -2 for \n\n
                if remaining > 0:
                    truncated_avoid = avoid_part[:remaining].rstrip()
                    scene_block = f"{content_part}\n\n{truncated_avoid}"
                else:
                    scene_block = content_part
            else:
                # Step 2: Also truncate video_prompt_boost content from scene_block
                if boost_content and boost_content in content_part:
                    content_part = content_part.replace(boost_content, '').strip()
                overhead = len(lock) + 4  # +4 for \n\n separators
                max_content = KLING_MAX_PROMPT_CHARS - overhead
                if len(content_part) > max_content:
                    content_part = content_part[:max_content].rstrip()
                scene_block = content_part
        else:
            # No Avoid block — truncate content directly
            overhead = len(lock) + 4
            max_content = KLING_MAX_PROMPT_CHARS - overhead
            if len(scene_block) > max_content:
                scene_block = scene_block[:max_content].rstrip()

        full = f"{lock}\n\n{scene_block}"
        print(f"   ⚠️ Prompt kırpıldı: {original_len} → {len(full)} char")

    return full


def _submit_kling_task(scene, ref_path, scene_duration="5", total_scenes=1):
    """Tek bir Kling task'ı submit eder. (task_id, scene_num) döndürür.
    scene_duration: '5' veya '10' — ses süresine göre akıllı seçim.
    total_scenes: toplam sahne sayısı — cfg_scale seçimi için."""
    n = scene["scene"]
    prompt = build_video_prompt(scene)
    if len(prompt) > KLING_MAX_PROMPT_CHARS:
        print(f"   Sahne {n}: {len(prompt)} char ❌ FAZLA")
        return None, n

    # Ortam bazlı cfg_scale
    env = scene.get("environment", "studio")
    if env == "studio":
        cfg = KLING_CFG_STUDIO
    elif env == "clinic":
        cfg = KLING_CFG_CLINIC
    else:
        cfg = KLING_CFG_EXTERNAL

    img_b64 = base64.b64encode(open(ref_path, "rb").read()).decode()
    token = get_kling_token()
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}

    # Green screen ek negatif prompt
    neg = KLING_NEGATIVE_PROMPT
    if _ct.get("is_greenscreen", False):
        neg += (", background color change, background gradient, shadow on green, "
                "floor reflection, any non-green background, particles, fog, smoke, "
                "environmental props, furniture, walls, floor texture, ambient light on background")

    payload = {
        "model_name": KLING_MODEL, "image": img_b64,
        "prompt": prompt, "negative_prompt": neg,
        "duration": scene_duration, "aspect_ratio": _ct['kling_aspect'],
        "cfg_scale": cfg,
    }
    resp = requests.post(f"{KLING_API_BASE}/v1/videos/image2video",
                         headers=headers, json=payload, timeout=60)
    rj = resp.json()
    if resp.status_code == 200:
        tid = rj.get("data", {}).get("task_id")
        return tid, n
    else:
        msg = rj.get("message", str(rj))
        return None, n


def _wait_kling_task(tid, scene_num, out_path, max_attempts=40, poll_interval=10):
    """Tek bir Kling task'ını bekler ve indirir. Timeout: max_attempts × poll_interval saniye."""
    timeout_secs = max_attempts * poll_interval
    for attempt in range(max_attempts):
        token = get_kling_token()
        try:
            resp = requests.get(f"{KLING_API_BASE}/v1/videos/image2video/{tid}",
                               headers={"Authorization": f"Bearer {token}"}, timeout=30)
            rj = resp.json()
        except Exception as e:
            print(f"   ⚠️ Sahne {scene_num}: API bağlantı hatası ({e}), tekrar deneniyor...")
            time.sleep(poll_interval)
            continue
        status = rj.get("data", {}).get("task_status", "?")
        if status == "succeed":
            videos = rj.get("data", {}).get("task_result", {}).get("videos", [])
            if videos:
                vid = requests.get(videos[0]["url"], timeout=120)
                with open(out_path, "wb") as f:
                    f.write(vid.content)
                return True
            return False
        elif status == "failed":
            msg = rj.get("data", {}).get("task_status_msg", "Bilinmeyen hata")
            print(f"   ❌ Sahne {scene_num}: Kling failed — {msg}")
            return False
        else:
            elapsed = attempt * poll_interval
            if attempt % 4 == 0:
                remaining = timeout_secs - elapsed
                print(f"   ⏳ Sahne {scene_num}: {status}... ({elapsed}s / max {timeout_secs}s, {remaining}s kaldı)")
            time.sleep(poll_interval)
    print(f"   ⏰ Sahne {scene_num}: TIMEOUT — {timeout_secs}s içinde tamamlanamadı")
    return False


def _choose_kling_duration(audio_duration):
    """Ses süresine göre Kling video süresi seç.
    Slowdown ve padding sonrası gerçek hedef süreyi hesaplar.
    - Hedef ≤ 5.5s → 5s Kling
    - Hedef > 5.5s → 10s Kling
    """
    # Gerçek hedef: ses + padding, slowdown uygulanmış
    effective = (audio_duration + SCENE_PADDING) / AUDIO_SLOWDOWN
    if effective <= 5.5:
        return "5"
    return "10"


def generate_videos(scenes, image_files, project_dir, durations=None):
    """Her sahne için Kling v3 video üretir. Akıllı süre seçimi + Kuyruk + Retry.
    durations: ses süreleri listesi (varsa per-scene Kling duration seçimi yapılır)."""
    print("\n" + "=" * 60)
    print(f"🎬 ADIM 5: Video Üretimi ({KLING_MODEL}) — Akıllı Süre + Kuyruk + Retry")
    print("=" * 60)

    # Per-scene Kling duration seçimi
    scene_durations = {}
    for i, s in enumerate(scenes):
        n = s["scene"]
        if durations and i < len(durations) and durations[i] > 0:
            sd = _choose_kling_duration(durations[i])
            scene_durations[n] = sd
            print(f"   Sahne {n}: ses={durations[i]:.1f}s → Kling {sd}s")
        else:
            scene_durations[n] = KLING_DURATION
            print(f"   Sahne {n}: varsayılan → Kling {KLING_DURATION}s")

    # Tüm sahneleri kuyruğa al
    queue = list(range(len(scenes)))  # index listesi
    results = {}  # scene_num → file_path

    for retry_round in range(KLING_MAX_RETRIES + 1):
        if not queue:
            break

        if retry_round > 0:
            print(f"\n   🔄 Retry #{retry_round}: {len(queue)} sahne kaldı")
            time.sleep(KLING_RETRY_WAIT)

        # Batch olarak gönder (max KLING_MAX_PARALLEL)
        batches = [queue[i:i+KLING_MAX_PARALLEL] for i in range(0, len(queue), KLING_MAX_PARALLEL)]
        failed_this_round = []

        for batch in batches:
            # Submit batch
            active = []
            for idx in batch:
                s = scenes[idx]
                n = s["scene"]
                ref = image_files[idx]
                sd = scene_durations.get(n, KLING_DURATION)
                tid, sn = _submit_kling_task(s, ref, scene_duration=sd, total_scenes=len(scenes))
                if tid:
                    out = project_dir / "scenes" / f"scene_{n:02d}.mp4"
                    s_env = s.get("environment", "studio")
                    cfg_used = KLING_CFG_STUDIO if s_env == "studio" else (KLING_CFG_CLINIC if s_env == "clinic" else KLING_CFG_EXTERNAL)
                    active.append((tid, n, str(out), idx))
                    print(f"   Sahne {n}: {len(build_video_prompt(s))} char | {sd}s | cfg={cfg_used} ({s_env}) → Task={tid}")
                else:
                    print(f"   Sahne {n}: ❌ submit başarısız")
                    failed_this_round.append(idx)
                time.sleep(1)

            # Batch'i bekle
            if active:
                print(f"\n   ⏳ Batch bekliyor ({len(active)} task)...")
                for tid, sn, out, idx in active:
                    ok = _wait_kling_task(tid, sn, out)
                    if ok:
                        size = os.path.getsize(out) / (1024*1024)
                        kling_dur = scene_durations.get(sn, "5")
                        print(f"   ✅ Sahne {sn}: {size:.1f} MB | Kling {kling_dur}s")
                        results[sn] = out
                    else:
                        print(f"   ❌ Sahne {sn}: başarısız")
                        failed_this_round.append(idx)

            # Bir sonraki batch öncesi bekle
            if len(batches) > 1:
                time.sleep(5)

        queue = failed_this_round

    # Sıralı çıktı
    video_files = []
    for s in scenes:
        n = s["scene"]
        if n in results:
            video_files.append(results[n])

    print(f"\n   📊 {len(video_files)}/{len(scenes)} video hazır")
    return video_files


# ═══════════════════════════════════════
# ADIM 5b: VİDEO KALİTE KONTROL (opsiyonel)
# ═══════════════════════════════════════

def check_video_consistency(video_files, scenes, project_dir):
    """Video karelerini Molo referansıyla karşılaştır. Tutarlılık skorları döndürür.
    Pipeline'ı durdurmaz — sadece uyarı verir ve skorları scenes.json'a kaydeder."""
    print("\n" + "=" * 60)
    print("🔍 ADIM 5b: Video Karakter Tutarlılık Kontrolü")
    print("=" * 60)

    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
    quality_scores = {}
    tmp_dir = project_dir / "draft" / "_qc_frames"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    for i, vf in enumerate(video_files):
        n = scenes[i]["scene"] if i < len(scenes) else i + 1
        pose = scenes[i].get("molo_pose", "front") if i < len(scenes) else "front"

        # Molo referans
        molo_ref = MOLO_POSES.get(pose, MOLO_POSES["front"])

        # FFmpeg ile ilk ve son kareyi çıkar
        first_frame = str(tmp_dir / f"s{n:02d}_first.png")
        last_frame = str(tmp_dir / f"s{n:02d}_last.png")

        # İlk kare
        subprocess.run([
            FFMPEG, "-y", "-i", vf, "-vframes", "1", "-q:v", "2", first_frame
        ], capture_output=True, text=True)

        # Son kare
        subprocess.run([
            FFMPEG, "-y", "-sseof", "-0.1", "-i", vf, "-vframes", "1", "-q:v", "2", last_frame
        ], capture_output=True, text=True)

        if not os.path.exists(first_frame):
            print(f"   Sahne {n}: ⚠️ Kare çıkarılamadı, atlanıyor")
            continue

        # Gemini'ye gönder
        try:
            parts = [
                gtypes.Part.from_bytes(data=open(str(molo_ref), "rb").read(), mime_type="image/jpeg"),
            ]
            if os.path.exists(first_frame):
                parts.append(gtypes.Part.from_bytes(data=open(first_frame, "rb").read(), mime_type="image/png"))
            if os.path.exists(last_frame):
                parts.append(gtypes.Part.from_bytes(data=open(last_frame, "rb").read(), mime_type="image/png"))

            prompt = ('Image 1 is the MOLO mascot reference. Images 2-3 are video frames. '
                      'Compare the character in the frames to the reference. '
                      'IMPORTANT: The eyes and mouth must match the reference EXACTLY in size and shape. '
                      'If the video shows enlarged/oversized eyes, distorted features, or proportions different from reference, score those categories LOW. '
                      'Score each category 1-10. Return ONLY valid JSON:\n'
                      '{"face_shape": <int>, "eye_design": <int>, "hologram": <int>, '
                      '"body_proportions": <int>, "color_palette": <int>, "consistency": <int>}')

            resp = gemini_with_retry(lambda: client.models.generate_content(
                model=GEMINI_TEXT_MODEL,
                contents=[prompt] + parts,
            ))

            text = resp.text.strip()
            if "```" in text:
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip()

            scores = json.loads(text)
            overall = scores.get("consistency", 0)
            quality_scores[n] = overall

            detail_str = ", ".join(f"{k}={v}" for k, v in scores.items())
            if overall < 5:
                print(f"   Sahne {n}: ⚠️ Düşük tutarlılık ({overall}/10) — {detail_str}")
            else:
                print(f"   Sahne {n}: ✅ {overall}/10 ({detail_str})")

        except Exception as e:
            print(f"   Sahne {n}: ⚠️ Skor hesaplanamadı: {e}")
            quality_scores[n] = -1

    # Geçici dosyaları temizle
    import shutil
    shutil.rmtree(str(tmp_dir), ignore_errors=True)

    # scenes.json'a kaydet
    scenes_json = project_dir / "scenes" / "scenes.json"
    if scenes_json.exists():
        try:
            with open(scenes_json, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                data["quality_scores"] = quality_scores
            elif isinstance(data, list):
                data = {"scenes": data, "quality_scores": quality_scores}
            with open(scenes_json, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"\n   📁 Skorlar kaydedildi: {scenes_json}")
        except Exception as e:
            print(f"\n   ⚠️ scenes.json güncelenemedi: {e}")

    avg = sum(v for v in quality_scores.values() if v > 0) / max(1, sum(1 for v in quality_scores.values() if v > 0))
    print(f"   📊 Ortalama tutarlılık: {avg:.1f}/10")

    return quality_scores


# ═══════════════════════════════════════
# ADIM 6: KURGU & EFEKT
# ═══════════════════════════════════════

def calculate_scene_speeds(scenes, durations):
    """Her sahne için konuşma hızına göre akıllı slowdown hesapla.
    Döner: [speed_1, speed_2, ...] — her sahne için 0.75-1.0 arası."""
    print("\n   🧠 Akıllı Slowdown Analizi:")
    speeds = []
    for i, s in enumerate(scenes):
        text = s.get("text", "")
        word_count = len(text.split())
        dur = durations[i] if i < len(durations) else 3.0

        if dur <= 0:
            speeds.append(AUDIO_SLOWDOWN)
            continue

        wps = word_count / dur

        if wps > SMART_SLOWDOWN_FAST_WPS:
            speed = SMART_SLOWDOWN_TARGET_WPS / wps
            speed = max(SMART_SLOWDOWN_MIN, min(SMART_SLOWDOWN_MAX, speed))
        elif wps < SMART_SLOWDOWN_SLOW_WPS:
            speed = 1.0
        else:
            speed = AUDIO_SLOWDOWN

        speeds.append(round(speed, 3))
        label = "🐢 yavaşlat" if speed < AUDIO_SLOWDOWN else ("⏩ atla" if speed == 1.0 else "📏 varsayılan")
        print(f"      Sahne {i+1}: {word_count} kelime / {dur:.1f}s = {wps:.1f} wps → speed={speed:.3f} {label}")

    return speeds


def compose_edit(video_files, voice_files, durations, project_dir, project_name,
                 crf=None, scene_speeds=None):
    """Ses-video eşleştir, kalite filtrele. Merged sahne dosyaları listesi döndürür.
    4 kademeli akıllı senkronizasyon:
      1. Video ≥ hedef → trim
      2. Video < hedef, fark ≤ FREEZE_FRAME_MAX → tpad (son kare dondur)
      3. Video × 2 ≥ hedef → pingpong reverse
      4. Fallback → stream_loop
    scene_speeds: None (global slowdown) veya [speed_1, speed_2, ...] (per-scene slowdown)."""
    print("\n" + "=" * 60)
    print("🎬 ADIM 6: Per-Scene Merge (Video + Ses)")
    print("=" * 60)

    num = min(len(video_files), len(voice_files))
    encode_args = [
        "-c:v", "libx264", "-preset", "slow",
        "-crf", str(crf or QUALITY_FILTERS["crf"]),
        "-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart",
        "-c:a", "aac", "-b:a", "192k", "-r", str(OUTPUT_FPS),
    ]

    merged = []
    for i in range(num):
        n = i + 1
        out = str(project_dir / "draft" / f"s{n:02d}_final.mp4")
        dur = durations[i]
        vf = get_normalize_filter(with_quality=True, content_type=_content_type_key)

        # Video süresini ölç
        video_dur = get_audio_duration(video_files[i])

        # Sahne bazlı slowdown
        speed = scene_speeds[i] if scene_speeds and i < len(scene_speeds) else None
        if speed and speed < 1.0:
            pad_dur = (dur / speed) + SCENE_PADDING
        else:
            pad_dur = dur + SCENE_PADDING

        # Freeze-frame farkı
        freeze_gap = pad_dur - video_dur

        spd_info = f", speed={speed:.3f}" if (speed and speed < 1.0) else ""
        print(f"   Sahne {n}: video={video_dur:.1f}s, ses={dur:.1f}s, hedef={pad_dur:.1f}s, fark={freeze_gap:+.1f}s{spd_info}")

        # Slowdown filter eklentileri
        slow_vf = f",setpts={1/speed}*PTS" if (speed and speed < 1.0) else ""
        slow_af = f"atempo={speed}," if (speed and speed < 1.0) else ""

        # Per-scene nefes fade-out (ses sonuna yumuşak fade)
        breath_af = f"afade=t=out:st={max(0, dur - SCENE_BREATH_FADE):.2f}:d={SCENE_BREATH_FADE}"
        audio_filter = f"[1:a]{slow_af}{breath_af}[a]"

        success = False

        # ── Kademe 1: Video yeterli → trim ──
        if video_dur >= pad_dur:
            cmd = [
                FFMPEG, "-y",
                "-i", video_files[i],
                "-i", voice_files[i],
                "-filter_complex", f"[0:v]{vf}{slow_vf}[v];{audio_filter}",
                "-map", "[v]", "-map", "[a]",
            ] + encode_args + ["-t", str(pad_dur), out]
            r = subprocess.run(cmd, capture_output=True, text=True)
            if r.returncode == 0:
                actual_dur = get_audio_duration(out)
                print(f"   ✅ Sahne {n}: {actual_dur:.1f}s (trim ✂️{spd_info})")
                merged.append(out)
                success = True

        # ── Kademe 2: Freeze-frame (tpad) — fark ≤ FREEZE_FRAME_MAX ──
        if not success and 0 < freeze_gap <= FREEZE_FRAME_MAX:
            freeze_vf = f"[0:v]{vf}{slow_vf},tpad=stop=-1:stop_duration={freeze_gap:.2f}[v]"
            cmd = [
                FFMPEG, "-y",
                "-i", video_files[i],
                "-i", voice_files[i],
                "-filter_complex", f"{freeze_vf};{audio_filter}",
                "-map", "[v]", "-map", "[a]",
            ] + encode_args + ["-t", str(pad_dur), out]
            r = subprocess.run(cmd, capture_output=True, text=True)
            if r.returncode == 0:
                actual_dur = get_audio_duration(out)
                print(f"   ✅ Sahne {n}: {actual_dur:.1f}s (freeze-frame ❄️ +{freeze_gap:.1f}s{spd_info})")
                merged.append(out)
                success = True
            else:
                print(f"   ⚠️ Sahne {n}: tpad başarısız, sonraki kademeye geçiliyor...")

        # ── Kademe 3: Pingpong reverse ──
        if not success and video_dur * 2 >= pad_dur:
            pingpong_vf = f"[0:v]split[fwd][rev];[rev]reverse[r];[fwd][r]concat=n=2:v=1:a=0,{vf}{slow_vf}[v]"
            cmd = [
                FFMPEG, "-y",
                "-i", video_files[i],
                "-i", voice_files[i],
                "-filter_complex", f"{pingpong_vf};{audio_filter}",
                "-map", "[v]", "-map", "[a]",
            ] + encode_args + ["-t", str(pad_dur), out]
            r = subprocess.run(cmd, capture_output=True, text=True)
            if r.returncode == 0:
                actual_dur = get_audio_duration(out)
                print(f"   ✅ Sahne {n}: {actual_dur:.1f}s (pingpong 🔄{spd_info})")
                merged.append(out)
                success = True

        # ── Kademe 4: Stream loop (son çare) ──
        if not success:
            loop_count = min(2, max(1, int(pad_dur / max(video_dur, 1)) + 1))
            cmd = [
                FFMPEG, "-y",
                "-stream_loop", str(loop_count - 1), "-i", video_files[i],
                "-i", voice_files[i],
                "-filter_complex", f"[0:v]{vf}{slow_vf}[v];{audio_filter}",
                "-map", "[v]", "-map", "[a]",
            ] + encode_args + ["-t", str(pad_dur), out]
            r = subprocess.run(cmd, capture_output=True, text=True)
            if r.returncode == 0:
                actual_dur = get_audio_duration(out)
                print(f"   ✅ Sahne {n}: {actual_dur:.1f}s (stream_loop x{loop_count}{spd_info})")
                merged.append(out)
            else:
                print(f"   ❌ Sahne {n}: {r.stderr[-200:]}")

    if len(merged) < 1:
        print("   ❌ Hiç sahne birleştirilemedi!")
        return None

    print(f"\n   ✅ {len(merged)} sahne birleştirildi")
    return merged


# ═══════════════════════════════════════
# ADIM 7: ALTYAZI (ASS)
# ═══════════════════════════════════════

def add_subtitles(draft_path, scenes, durations, project_dir, project_name, lang="de",
                  font_size=None, margin_v=None):
    """İngilizce çeviri + ASS altyazı dosyası oluştur. ASS dosya yolunu döndürür."""
    print("\n" + "=" * 60)
    print("🔤 ADIM 7: Altyazı Çeviri + ASS Üretimi")
    print("=" * 60)

    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

    # Çeviri
    lang_names = {"de": "German", "tr": "Turkish", "en": "English"}
    source = lang_names.get(lang, lang)
    texts = [s["text"] for s in scenes]
    if lang == "en":
        translations = texts
        print("   ℹ️ Kaynak dil İngilizce — çeviri atlandı")
    else:
        translations = []
        for text in texts:
            resp = gemini_with_retry(lambda: client.models.generate_content(
                model=GEMINI_TEXT_MODEL,
                contents=f"Translate this {source} text to English. Return ONLY the translation:\n\n{text}"
            ))
            tr = resp.text.strip()
            print(f"   🔄 '{text[:35]}...' → '{tr[:35]}...'")
            translations.append(tr)

    # ASS oluştur
    ass_path = project_dir / "subtitles" / "subs_en.ass"
    ass_path.parent.mkdir(parents=True, exist_ok=True)

    # Altyazı stili
    ss = SUBTITLE_STYLES.get(DEFAULT_SUBTITLE_STYLE, SUBTITLE_STYLES["premium"])

    ass = f"""[Script Info]
Title: {project_name}
ScriptType: v4.00+
PlayResX: {_ct['width']}
PlayResY: {_ct['height']}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{ss['fontname']},{font_size if font_size is not None else _ct['subtitle_fontsize']},{ss['primary_color']},&H000000FF,{ss['outline_color']},{ss['back_color']},{'-1' if ss['bold'] else '0'},0,0,0,100,100,{ss['spacing']},0,{ss['border_style']},{ss['outline']},{ss['shadow']},2,20,20,{margin_v if margin_v is not None else _ct['subtitle_margin_v']},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    cum = 0.3  # İlk altyazı için okuma gecikmesi
    for i, (tr, dur) in enumerate(zip(translations, durations)):
        chunks = split_into_subtitle_chunks(tr, max_chars=45)
        chunk_count = len(chunks)
        total_words = sum(len(c.split()) for c in chunks)

        for j, chunk in enumerate(chunks):
            # Kelime bazlı süre hesabı (karakter yerine)
            word_count = len(chunk.split())
            word_ratio = word_count / total_words if total_words > 0 else 1.0 / chunk_count
            chunk_dur = max(1.5, dur * word_ratio)  # Minimum 1.5s gösterim

            # Okuma gecikmesi (chunk başına 0.3s)
            start = cum + 0.3
            end = start + chunk_dur - 0.1
            wrapped = wrap_subtitle(chunk)
            ass += f"Dialogue: 0,{format_ass_time(start)},{format_ass_time(end)},Default,,0,0,0,,{wrapped}\n"
            cum = end + 0.15  # Chunk arası kısa geçiş

        cum += 0.5  # Sahneler arası boşluk (0.35 → 0.5)

    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(ass)
    print(f"   ✅ ASS: {ass_path}")

    return str(ass_path)


# ═══════════════════════════════════════
# BGM MİKSLEME (compose_edit'ten çağrılır)
# ═══════════════════════════════════════

def _mix_bgm(draft_path, total_duration, project_dir, project_name):
    """Draft videoya arka plan müziği ekler (varsa)."""
    bgm_files = list(BGM_DIR.glob("*.mp3")) + list(BGM_DIR.glob("*.wav")) + list(BGM_DIR.glob("*.m4a"))
    if not bgm_files:
        print(f"\n   🎵 BGM: _bgm/ dizini boş, müzik eklenmedi")
        return draft_path

    bgm = random.choice(bgm_files)
    print(f"\n   🎵 BGM: {bgm.name}")

    bgm_out = str(project_dir / "draft" / f"{project_name}_bgm.mp4")
    fade_out_start = max(0, total_duration - BGM_FADE_OUT)

    # Müzik: volume düşür + fade in/out
    bgm_filter = (
        f"[1:a]volume={BGM_VOLUME_DB}dB,"
        f"afade=t=in:st=0:d={BGM_FADE_IN},"
        f"afade=t=out:st={fade_out_start:.1f}:d={BGM_FADE_OUT}[bgm];"
        f"[0:a][bgm]amix=inputs=2:duration=first[aout]"
    )

    cmd = [
        FFMPEG, "-y", "-i", draft_path, "-i", str(bgm),
        "-filter_complex", bgm_filter,
        "-map", "0:v", "-map", "[aout]",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        "-shortest", bgm_out
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode == 0:
        print(f"   ✅ BGM eklendi ({BGM_VOLUME_DB}dB, fade {BGM_FADE_IN}s/{BGM_FADE_OUT}s)")
        return bgm_out
    else:
        print(f"   ⚠️ BGM başarısız: {r.stderr[-150:]}")
        return draft_path


# ═══════════════════════════════════════
# ADIM 8: FİNAL COMPOSE (Crossfade + Sub + Slowdown)
# ═══════════════════════════════════════

def compose_final(merged_scenes, ass_path, project_dir, project_name,
                  crossfade=None, transition=None, speed=None):
    """Crossfade + Altyazı + Slowdown + BGM'ı TEK FFmpeg encode ile final video yap.
    4 encode yerine 2 encode: per-scene merge (encode 1) + bu fonksiyon (encode 2)."""
    print("\n" + "=" * 60)
    print("🎬 ADIM 8: Final Compose (Crossfade + Altyazı + Slowdown)")
    print("=" * 60)

    final_path = str(project_dir / "final" / f"{project_name}_final.mp4")
    (project_dir / "final").mkdir(parents=True, exist_ok=True)

    fade = crossfade if crossfade is not None else CROSSFADE_DURATION
    user_transition = transition if transition is not None else DEFAULT_TRANSITION
    slowdown = speed if speed is not None else AUDIO_SLOWDOWN
    transitions = [user_transition] * (len(merged_scenes) - 1)

    # Merged sahnelerin gerçek sürelerini ölç
    actual_durations = [get_audio_duration(f) for f in merged_scenes]
    sc_count = len(merged_scenes)

    # ── Inputs ──
    inputs = []
    for s in merged_scenes:
        inputs.extend(["-i", s])

    # ── Video filter chain: xfade → ass → setpts ──
    vf_parts = []
    cum_offset = 0
    prev = "[0:v]"

    if sc_count == 1:
        xfade_out = "[0:v]"
    else:
        for i in range(1, sc_count):
            cum_offset += actual_durations[i - 1] - fade
            is_last = (i == sc_count - 1)
            out_label = "[xout]" if is_last else f"[v{i:02d}]"
            tr = transitions[i - 1] if i - 1 < len(transitions) else DEFAULT_TRANSITION
            vf_parts.append(
                f"{prev}[{i}:v]xfade=transition={tr}:duration={fade}:offset={cum_offset:.2f}{out_label}"
            )
            prev = out_label
        xfade_out = "[xout]"

    # ASS overlay + slowdown
    slowdown_pts = 1.0 / slowdown
    ass_escaped = str(ass_path).replace("\\", "/").replace(":", "\\:") if ass_path else None

    if ass_path and os.path.exists(ass_path):
        vf_parts.append(f"{xfade_out}ass={ass_escaped},setpts={slowdown_pts:.4f}*PTS[outv]")
    else:
        vf_parts.append(f"{xfade_out}setpts={slowdown_pts:.4f}*PTS[outv]")

    # ── Audio filter chain: acrossfade → atempo ──
    if sc_count == 1:
        af = f"[0:a]atempo={slowdown}[outa]"
    elif sc_count == 2:
        af = (f"[0:a][1:a]acrossfade=d={fade}:c1=tri:c2=tri[acat];"
              f"[acat]atempo={slowdown}[outa]")
    else:
        # Zincirleme acrossfade: 3+ sahne
        af_parts = []
        prev_a = "[0:a]"
        for i in range(1, sc_count):
            is_last = (i == sc_count - 1)
            out_a = "[acat]" if is_last else f"[a{i:02d}]"
            af_parts.append(f"{prev_a}[{i}:a]acrossfade=d={fade}:c1=tri:c2=tri{out_a}")
            prev_a = out_a
        af_parts.append(f"[acat]atempo={slowdown}[outa]")
        af = ";".join(af_parts)

    # ── Birleştirilmiş filter_complex ──
    fg = ";".join(vf_parts) + ";" + af

    cmd = [FFMPEG, "-y"] + inputs + [
        "-filter_complex", fg,
        "-map", "[outv]", "-map", "[outa]",
        "-c:v", "libx264", "-preset", "slow",
        "-crf", str(QUALITY_FILTERS["crf"]),
        "-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart",
        "-c:a", "aac", "-b:a", "192k",
        "-r", str(OUTPUT_FPS),
        final_path
    ]

    print(f"   🔧 Tek encode: crossfade({fade}s) + ASS + slowdown({slowdown}x)")
    print(f"   📄 {sc_count} sahne → {final_path}")

    r = subprocess.run(cmd, capture_output=True, text=True)

    if r.returncode != 0:
        print(f"   ⚠️ Birleşik render başarısız, fallback deniyor...")
        print(f"   stderr: {r.stderr[-300:]}")

        # Fallback: crossfade olmadan concat + sub + slow
        concat_f = str(project_dir / "draft" / "concat.txt")
        with open(concat_f, "w") as f:
            for s in merged_scenes:
                f.write(f"file '{s}'\n")

        fallback_vf = f"ass={ass_escaped},setpts={slowdown_pts:.4f}*PTS" if (ass_path and os.path.exists(ass_path)) else f"setpts={slowdown_pts:.4f}*PTS"

        cmd2 = [
            FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", concat_f,
            "-vf", fallback_vf,
            "-af", f"atempo={slowdown}",
            "-c:v", "libx264", "-preset", "slow",
            "-crf", str(QUALITY_FILTERS["crf"]),
            "-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart",
            "-c:a", "aac", "-b:a", "192k",
            "-r", str(OUTPUT_FPS),
            final_path
        ]
        r2 = subprocess.run(cmd2, capture_output=True, text=True)
        if r2.returncode == 0:
            print(f"   ✅ Fallback başarılı (concat + sub + slow)")
        else:
            print(f"   ❌ Fallback da başarısız: {r2.stderr[-200:]}")
            return None
    else:
        trs = ', '.join(transitions[:sc_count - 1])
        print(f"   ✅ Final render (xfade: {trs})")

    # BGM ekleme (-c:v copy, encode yok)
    total_dur = get_audio_duration(final_path)
    final_path = _mix_bgm(final_path, total_dur, project_dir, project_name)

    dur = get_audio_duration(final_path)
    size = os.path.getsize(final_path) / (1024 * 1024)
    print(f"   📁 {final_path}")
    print(f"   ⏱️  {dur:.1f}s | 💾 {size:.1f} MB")

    return final_path


# ═══════════════════════════════════════
# ADIM 9: OTOMATİK THUMBNAIL
# ═══════════════════════════════════════

def generate_thumbnail(final_path, project_dir, project_name, title="", scenes=None):
    """Gemini Nano Banana 2 ile yaratıcı, sosyal medyaya uygun thumbnail üretir."""
    print("\n" + "=" * 60)
    print("🖼️ ADIM 9: Yaratıcı Thumbnail (Gemini)")
    print("=" * 60)

    thumb_dir = project_dir / "final"
    thumb_dir.mkdir(parents=True, exist_ok=True)
    thumb_path = str(thumb_dir / f"{project_name}_thumbnail.png")

    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

    # Molo referans görseli (front-wave — en enerjik poz)
    molo_ref = MOLO_POSES.get("front-wave", MOLO_POSES["front"])
    images_to_send = [gtypes.Part.from_bytes(
        data=open(molo_ref, "rb").read(),
        mime_type="image/jpeg"
    )]

    # Klinik arka planı
    env_ref = ENVIRONMENT_IMAGES.get("clinic")
    if env_ref and env_ref.exists():
        images_to_send.insert(0, gtypes.Part.from_bytes(
            data=open(env_ref, "rb").read(),
            mime_type="image/jpeg"
        ))

    # Yaratıcı thumbnail prompt'u — content type'a göre boyut
    orient = "vertical 9:16" if _ct['orientation'] == 'vertical' else "horizontal 16:9"
    prompt = f"""{CHARACTER_IDENTITY_LOCK}

Create a STUNNING, eye-catching {orient} social media thumbnail for a video titled "{title}".

This must feel like a PREMIUM social media cover — the kind that makes people stop scrolling.

Design requirements:
- MOLO is the hero of the image, positioned prominently with a dynamic, engaging expression
- Use the clinic environment from the reference as background but make it CINEMATIC — dramatic lighting, depth of field, light flares
- Add visual ENERGY: subtle light rays, bokeh particles, or soft holographic glow effects around MOLO
- The composition must be bold, clean, and impactful — like a movie poster, not a screenshot
- MOLO should look excited, curious, and slightly mischievous — as if about to share something amazing
- The framing should leave space at top and bottom for potential text overlay (but do NOT add any text)
- Colors should pop: rich blues, warm highlights, premium contrast
- The overall feel should be: premium, energetic, inviting, modern, scroll-stopping

DO NOT add any text, titles, subtitles, watermarks, or overlays to the image.
DO NOT make MOLO look childish, flat, or toy-like.

{HOLOGRAM_LOCK}

{LIGHTING_RULES}

{AVOID_LIST}"""

    print(f"   🧠 Gemini thumbnail üretimi...")

    try:
        response = gemini_with_retry(lambda: client.models.generate_content(
            model=GEMINI_IMAGE_MODEL,
            contents=[prompt] + images_to_send,
            config=gtypes.GenerateContentConfig(
                response_modalities=["IMAGE", "TEXT"],
            )
        ))

        for part in response.candidates[0].content.parts:
            if hasattr(part, 'inline_data') and part.inline_data:
                from PIL import Image
                import io
                img = Image.open(io.BytesIO(part.inline_data.data))
                thumb_w = _ct.get('thumbnail_w', THUMBNAIL_WIDTH)
                thumb_h = _ct.get('thumbnail_h', THUMBNAIL_HEIGHT)
                if img.size != (thumb_w, thumb_h):
                    img = img.resize((thumb_w, thumb_h), Image.LANCZOS)
                img.save(thumb_path, "PNG")
                print(f"   ✅ Thumbnail: {thumb_path} ({img.size[0]}x{img.size[1]})")
                return thumb_path

        print("   ❌ Gemini görsel üretmedi")
    except Exception as e:
        print(f"   ⚠️ Gemini hatası: {str(e)[:100]}")

    # Fallback: videodan kare al
    print("   🔄 Fallback: videodan kare alınıyor...")
    dur = get_audio_duration(final_path)
    cmd = [FFMPEG, "-y", "-ss", str(dur * 0.15), "-i", final_path,
           "-frames:v", "1",
           "-vf", f"scale={THUMBNAIL_WIDTH}:{THUMBNAIL_HEIGHT}",
           thumb_path]
    subprocess.run(cmd, capture_output=True, text=True)
    if os.path.exists(thumb_path):
        print(f"   ✅ Thumbnail (fallback): {thumb_path}")
        return thumb_path

    return None


# ═══════════════════════════════════════
# ANA AKŞ
# ═══════════════════════════════════════

def main():
    if len(sys.argv) < 2:
        print("Kullanım: python3 molo_agent.py <brief.md> [--dry-run] [--auto-approve] [--resume]")
        print("Örnek:    python3 molo_agent.py projects/2026-03-16_konu/brief.md")
        sys.exit(1)

    brief_path = Path(sys.argv[1])
    dry_run = "--dry-run" in sys.argv
    auto_approve = "--auto-approve" in sys.argv
    resume = "--resume" in sys.argv

    if not brief_path.exists():
        print(f"❌ Brief bulunamadı: {brief_path}")
        sys.exit(1)

    # Proje dizini brief'in parent'ı
    project_dir = brief_path.parent
    project_name = project_dir.name.split("_", 1)[1] if "_" in project_dir.name else project_dir.name

    # Gerekli dizinleri oluştur
    for d in ["scenes", "audio", "draft", "final", "subtitles"]:
        (project_dir / d).mkdir(parents=True, exist_ok=True)

    # Dili brief'ten oku ya da varsayılan de
    brief_text = brief_path.read_text(encoding="utf-8")
    lang = "de"
    # Dil lookup tablosu — emoji, tam ad, kısa kod destekli
    _lang_map = {
        "de": "de", "deutsch": "de", "almanca": "de", "german": "de", "🇩🇪": "de",
        "tr": "tr", "türkçe": "tr", "turkish": "tr", "🇹🇷": "tr",
        "en": "en", "english": "en", "ingilizce": "en", "🇬🇧": "en", "🇺🇸": "en",
    }
    if "dil:" in brief_text.lower() or "language:" in brief_text.lower():
        for line in brief_text.split("\n"):
            ll = line.lower().strip()
            if "dil:" in ll or "language:" in ll:
                raw = line.split(":", 1)[1].strip().lower()
                # Emoji ve boşlukları temizle, lookup'tan bul
                for key, code in _lang_map.items():
                    if key in raw:
                        lang = code
                        break
                else:
                    # Fallback: ilk 2 ASCII karakter
                    ascii_part = "".join(c for c in raw if c.isascii() and c.isalpha())[:2]
                    if ascii_part:
                        lang = ascii_part

    # İçerik türü oku — Turkish İ/i handling
    global _ct, _content_type_key
    content_type = DEFAULT_CONTENT_TYPE
    for line in brief_text.split("\n"):
        # Check original line (not lowercased) for Turkish-safe matching
        stripped = line.strip()
        # Match variations: "İçerik türü:", "içerik türü:", "Içerik türü:", "content type:", "tür:"
        is_content_line = False
        for marker in ["İçerik türü:", "içerik türü:", "Içerik türü:", "icerik turu:", "content type:", "tür:"]:
            if marker.lower() in stripped.lower() or marker in stripped:
                is_content_line = True
                break
        if is_content_line:
            val = stripped.split(":", 1)[1].strip().lower()
            if val in CONTENT_TYPES:
                content_type = val

    # Green screen boyut tespiti
    if content_type.startswith("greenscreen"):
        gs_size = "dikey"  # varsayılan
        for line in brief_text.split("\n"):
            ll = line.lower().strip()
            if any(m in ll for m in ["boyut:", "size:", "format:"]):
                val = line.split(":", 1)[1].strip().lower()
                if val in ["yatay", "horizontal", "16:9", "landscape"]:
                    gs_size = "yatay"
                elif val in ["kare", "square", "1:1"]:
                    gs_size = "kare"
                elif val in ["dikey", "vertical", "9:16", "portrait"]:
                    gs_size = "dikey"

        # Doğru greenscreen profilini seç
        if gs_size == "yatay":
            content_type = "greenscreen-yatay"
        elif gs_size == "kare":
            content_type = "greenscreen-kare"
        else:
            content_type = "greenscreen"  # dikey (varsayılan)

        print(f"   🟢 Green Screen modu: {gs_size} ({CONTENT_TYPES[content_type]['width']}x{CONTENT_TYPES[content_type]['height']})")

    _content_type_key = content_type
    _ct = CONTENT_TYPES[content_type].copy()

    # Maksimum sahne sayısı oku (varsayılan 4)
    max_scenes = 4
    for line in brief_text.split("\n"):
        ll = line.lower().strip()
        if any(m in ll for m in ["maksimum sahne:", "max_scenes:", "max sahne:", "sahne sayısı:"]):
            try:
                val = int(line.split(":", 1)[1].strip())
                if 1 <= val <= 10:
                    max_scenes = val
            except (ValueError, IndexError):
                pass

    # Akıllı yavaşlatma oku (varsayılan kapalı)
    smart_slowdown = False
    quality_check = False
    for line in brief_text.split("\n"):
        ll = line.lower().strip()
        if any(m in ll for m in ["akıllı yavaşlatma:", "smart_slowdown:", "smart slowdown:"]):
            val = line.split(":", 1)[1].strip().lower()
            smart_slowdown = val in ["evet", "yes", "true", "1", "on"]
        if any(m in ll for m in ["kalite kontrol:", "quality_check:", "quality check:"]):
            val = line.split(":", 1)[1].strip().lower()
            quality_check = val in ["evet", "yes", "true", "1", "on"]

    # Progress tracking başlat
    global _progress_path
    _progress_path = str(project_dir / "progress.json")

    print("╔══════════════════════════════════════╗")
    print("║  MOLO CONTENT AGENT                  ║")
    print("║  Otonom İçerik & Kurgu                ║")
    print("╚══════════════════════════════════════╝")
    print(f"\n   📄 Brief: {brief_path}")
    print(f"   📁 Proje: {project_dir}")
    print(f"   🌍 Dil: {lang}")
    print(f"   🎬 İçerik: {_ct['label']} ({_ct['width']}x{_ct['height']})")
    print(f"   🐢 Slowdown: {'akıllı (per-scene)' if smart_slowdown else f'{AUDIO_SLOWDOWN}x (global)'}")
    print(f"   🎬 Maks sahne: {max_scenes}")

    if dry_run:
        print(f"\n   🏃 DRY RUN — API çağrısı yapılmayacak")

    _write_progress("starting", 5, "Pipeline başlatılıyor...")

    # ── Checkpoint/Resume ──
    ckpt = _load_checkpoint(project_dir) if resume else None
    completed = list(ckpt.get("completed_steps", [])) if ckpt else []
    if ckpt and completed:
        print(f"   🔄 RESUME: {len(completed)} adım atlanacak: {', '.join(completed)}")

    try:
        # ── ADIM 1: Senaryo ──
        if "script" in completed and ckpt.get("script"):
            script = ckpt["script"]
            scenes = script["scenes"]
            print(f"   ⏩ Senaryo atlandı (checkpoint — {len(scenes)} sahne)")
        else:
            _write_progress("script", 10, "Senaryo üretiliyor...")
            script = generate_script(brief_path, lang, max_scenes=max_scenes)
            scenes = script["scenes"]
            if "script" not in completed:
                completed.append("script")
            _write_checkpoint(project_dir, "script", completed, script=script)
        _write_progress("script", 15, f"{len(scenes)} sahne üretildi")

        if dry_run:
            print("\n   🏃 DRY RUN tamamlandı. Senaryo üretildi, API çağrısı yok.")
            _write_progress("done", 100, "DRY RUN tamamlandı", is_done=True)
            return

        # ── ADIM 2: Görseller (GORSEL-ONCELIKLI) ──
        if "images" in completed and ckpt.get("image_files"):
            image_files = _validate_files(ckpt["image_files"])
            if len(image_files) == len(ckpt["image_files"]):
                print(f"   ⏩ Görseller atlandı (checkpoint — {len(image_files)} dosya)")
            else:
                print(f"   ⚠️ {len(ckpt['image_files']) - len(image_files)} görsel eksik, yeniden üretiliyor...")
                completed = [s for s in completed if s != "images"]
                _write_progress("images", 20, "Sahne görselleri üretiliyor...")
                image_files = generate_scene_images(scenes, project_dir)
                completed.append("images")
                _write_checkpoint(project_dir, "images", completed,
                                  script=script,
                                  image_files=[str(f) for f in image_files])
        else:
            _write_progress("images", 20, "Sahne görselleri üretiliyor...")
            image_files = generate_scene_images(scenes, project_dir)
            if "images" not in completed:
                completed.append("images")
            _write_checkpoint(project_dir, "images", completed,
                              script=script,
                              image_files=[str(f) for f in image_files])
        _write_progress("images", 40, f"{len(image_files)} görsel hazır")

        # ── ADIM 2.5: Görsel İnceleme Duraklatması ──
        # Pipeline burada durur — kullanıcı varyantları inceler, seçim yapar
        # Studio UI'dan "Devam Et" butonuna basılınca .pipeline.resume dosyası oluşturulur
        if "voice" not in completed:  # Eğer voice checkpoint'i yoksa duraklat
            import time as _time
            resume_file = project_dir / ".pipeline.resume"
            # Önceki resume sinyalini temizle
            if resume_file.exists():
                resume_file.unlink()

            _write_progress("review_images", 40,
                            f"⏸️ {len(image_files)} görsel hazır — varyant seçimi bekleniyor",
                            is_paused=True)
            print(f"\n   ⏸️ DURAKLATILDI — Görsel varyantlarını inceleyin:")
            for img in image_files:
                print(f"      📸 {img}")
            print(f"   Studio UI'dan 'Devam Et' butonuna basın veya:")
            print(f"   touch {resume_file}")
            print(f"   komutuyla devam edin.\n")

            while not resume_file.exists():
                _time.sleep(1)
                # SIGTERM ile durdurulmuş olabilir
                if _progress_path:
                    try:
                        with open(_progress_path, "r") as _pf:
                            _pd = json.load(_pf)
                            if _pd.get("isError"):
                                print("   🛑 Pipeline durduruldu.")
                                sys.exit(0)
                    except Exception:
                        pass

            # Resume sinyali geldi — devam et
            resume_file.unlink(missing_ok=True)
            # image_files checkpoint'tan yeniden yükle (regenerate edilmiş olabilir)
            ckpt_refresh = _load_checkpoint(project_dir)
            if ckpt_refresh and ckpt_refresh.get("image_files"):
                refreshed = _validate_files(ckpt_refresh["image_files"])
                if len(refreshed) == len(image_files):
                    image_files = refreshed
                    print(f"   🔄 Güncel görseller yüklendi (checkpoint)")

            # ── Approval.json oku: kullanıcı varyant seçimlerini uygula ──
            approval_path = project_dir / "scenes" / "approval.json"
            if approval_path.exists():
                import shutil
                with open(approval_path, 'r') as f:
                    approval_data = json.load(f)
                # Seçilen varyantları canonical ref.png'ye kopyala
                for scene_key, sel in approval_data.items():
                    scene_num = int(scene_key)
                    variant = sel.get("selectedVariant", "v1")
                    src = project_dir / "scenes" / f"scene_{scene_num:02d}_{variant}.png"
                    dst = project_dir / "scenes" / f"scene_{scene_num:02d}_ref.png"
                    if src.exists():
                        shutil.copy2(str(src), str(dst))
                        print(f"   ✅ Sahne {scene_num}: {variant} → ref.png")
                # Sahne verilerini approval flag'leriyle güncelle
                for s in scenes:
                    sk = str(s['scene'])
                    if sk in approval_data:
                        s['withMolo'] = approval_data[sk].get('withMolo', True)
                        s['frameRole'] = approval_data[sk].get('frameRole', 'first')
                print(f"   ✅ Varyant seçimleri uygulandı (approval.json)")
            else:
                print(f"   ℹ️ approval.json bulunamadı — varsayılan varyantlar (v1) kullanılıyor")

            _write_progress("images", 42, "Görsel onaylandı — ses üretimine geçiliyor...")
            print(f"\n   ▶️ Devam ediliyor — ADIM 3: Ses Üretimi")

        # ── ADIM 3: Ses üretimi ──
        if "voice" in completed and ckpt.get("voice_files"):
            voice_files = _validate_files(ckpt["voice_files"])
            durations = ckpt.get("durations", [])
            if len(voice_files) == len(ckpt["voice_files"]):
                print(f"   ⏩ Ses üretimi atlandı (checkpoint — {len(voice_files)} dosya)")
            else:
                print(f"   ⚠️ {len(ckpt['voice_files']) - len(voice_files)} ses dosyası eksik, yeniden üretiliyor...")
                completed = [s for s in completed if s != "voice"]
                _write_progress("voice", 45, "Ses üretimi başlıyor...")
                voice_files, durations = generate_voices(scenes, lang, project_name, project_dir)
                completed.append("voice")
                _write_checkpoint(project_dir, "voice", completed,
                                  script=script, voice_files=voice_files, durations=durations,
                                  image_files=[str(f) for f in image_files])
        else:
            _write_progress("voice", 45, "Ses üretimi başlıyor...")
            voice_files, durations = generate_voices(scenes, lang, project_name, project_dir)
            if "voice" not in completed:
                completed.append("voice")
            _write_checkpoint(project_dir, "voice", completed,
                              script=script, voice_files=voice_files, durations=durations,
                              image_files=[str(f) for f in image_files])
        _write_progress("voice", 55, f"{len(voice_files)} ses dosyası hazır")

        # ── ADIM 4: Videolar ──
        if "videos" in completed and ckpt.get("video_files"):
            video_files = _validate_files(ckpt["video_files"])
            if len(video_files) == len(ckpt["video_files"]):
                print(f"   ⏩ Videolar atlandı (checkpoint — {len(video_files)} dosya)")
            else:
                print(f"   ⚠️ {len(ckpt['video_files']) - len(video_files)} video eksik, yeniden üretiliyor...")
                completed = [s for s in completed if s != "videos"]
                _write_progress("videos", 60, "Video üretimi başlıyor (Kling API)...")
                video_files = generate_videos(scenes, image_files, project_dir, durations=durations)
                completed.append("videos")
                _write_checkpoint(project_dir, "videos", completed,
                                  script=script, voice_files=voice_files, durations=durations,
                                  image_files=[str(f) for f in image_files],
                                  video_files=[str(f) for f in video_files])
        else:
            _write_progress("videos", 60, "Video üretimi başlıyor (Kling API)...")
            video_files = generate_videos(scenes, image_files, project_dir, durations=durations)
            if "videos" not in completed:
                completed.append("videos")
            _write_checkpoint(project_dir, "videos", completed,
                              script=script, voice_files=voice_files, durations=durations,
                              image_files=[str(f) for f in image_files],
                              video_files=[str(f) for f in video_files])
        _write_progress("videos", 80, f"{len(video_files)}/{len(scenes)} video hazır")

        if len(video_files) < len(scenes):
            print(f"\n   ⚠️ {len(video_files)}/{len(scenes)} video hazır — devam ediliyor")

        # ── ADIM 4b: Video Kalite Kontrol (opsiyonel) ──
        if quality_check and "quality_check" not in completed:
            _write_progress("quality_check", 81, "Video tutarlılık kontrolü...")
            check_video_consistency(video_files, scenes, project_dir)
            completed.append("quality_check")
        elif quality_check:
            print(f"   ⏩ Kalite kontrol atlandı (checkpoint)")

        # Sahne bazlı slowdown hesapla (smart_slowdown aktifse)
        scene_speeds = None
        if smart_slowdown:
            scene_speeds = calculate_scene_speeds(scenes, durations)

        # ── ADIM 5: Per-Scene Merge ──
        if "edit" in completed and ckpt.get("merged_scenes"):
            merged_scenes = _validate_files(ckpt["merged_scenes"])
            if len(merged_scenes) == len(ckpt["merged_scenes"]):
                print(f"   ⏩ Per-scene merge atlandı (checkpoint — {len(merged_scenes)} dosya)")
            else:
                print(f"   ⚠️ {len(ckpt['merged_scenes']) - len(merged_scenes)} merge eksik, yeniden oluşturuluyor...")
                completed = [s for s in completed if s != "edit"]
                _write_progress("edit", 82, "Per-scene merge oluşturuluyor...")
                merged_scenes = compose_edit(video_files, voice_files, durations, project_dir, project_name, scene_speeds=scene_speeds)
                if not merged_scenes:
                    raise RuntimeError("Per-scene merge başarısız")
                completed.append("edit")
                _write_checkpoint(project_dir, "edit", completed,
                                  script=script, voice_files=voice_files, durations=durations,
                                  image_files=[str(f) for f in image_files],
                                  video_files=[str(f) for f in video_files],
                                  merged_scenes=merged_scenes)
        else:
            _write_progress("edit", 82, "Per-scene merge oluşturuluyor...")
            merged_scenes = compose_edit(video_files, voice_files, durations, project_dir, project_name, scene_speeds=scene_speeds)
            if not merged_scenes:
                raise RuntimeError("Per-scene merge başarısız")
            if "edit" not in completed:
                completed.append("edit")
            _write_checkpoint(project_dir, "edit", completed,
                              script=script, voice_files=voice_files, durations=durations,
                              image_files=[str(f) for f in image_files],
                              video_files=[str(f) for f in video_files],
                              merged_scenes=merged_scenes)
        _write_progress("edit", 85, f"{len(merged_scenes)} sahne merge edildi")

        # ── ADIM 6: Altyazı (sadece ASS üretimi) ──
        if "subtitles" in completed and ckpt.get("ass_path") and os.path.exists(ckpt["ass_path"]):
            ass_path = ckpt["ass_path"]
            print(f"   ⏩ Altyazı atlandı (checkpoint)")
        else:
            _write_progress("subtitles", 87, "Altyazı çevirisi yapılıyor...")
            ass_path = add_subtitles(None, scenes, durations, project_dir, project_name, lang)
            if "subtitles" not in completed:
                completed.append("subtitles")
            _write_checkpoint(project_dir, "subtitles", completed,
                              script=script, voice_files=voice_files, durations=durations,
                              image_files=[str(f) for f in image_files],
                              video_files=[str(f) for f in video_files],
                              merged_scenes=merged_scenes, ass_path=ass_path)
        _write_progress("subtitles", 90, "ASS altyazı hazır")

        # ── ADIM 7: Final Compose (crossfade + altyazı + slowdown — TEK encode) ──
        if "final" in completed and ckpt.get("final") and os.path.exists(ckpt["final"]):
            final = ckpt["final"]
            print(f"   ⏩ Final compose atlandı (checkpoint)")
        else:
            _write_progress("final", 92, "Final render (crossfade + altyazı + slowdown)...")
            final_speed = 1.0 if smart_slowdown else None  # Per-scene slowdown zaten uygulandı
            final = compose_final(merged_scenes, ass_path, project_dir, project_name, speed=final_speed)
            if not final:
                raise RuntimeError("Final compose başarısız")
            if "final" not in completed:
                completed.append("final")
            _write_checkpoint(project_dir, "final", completed,
                              script=script, voice_files=voice_files, durations=durations,
                              merged_scenes=merged_scenes, ass_path=ass_path, final=final)
        _write_progress("final", 96, "Final video hazır")

        # ── ADIM 8: Thumbnail (şartlı) ──
        if _ct.get('thumbnail', False):
            if "thumbnail" in completed:
                print(f"   ⏩ Thumbnail atlandı (checkpoint)")
            else:
                _write_progress("thumbnail", 98, "Thumbnail üretiliyor...")
                title = script.get("title", project_name)
                generate_thumbnail(final, project_dir, project_name, title)
                if "thumbnail" not in completed:
                    completed.append("thumbnail")
        else:
            print(f"\n   🖼️ Thumbnail atlandı ({_ct['label']} için gerekli değil)")

        # ── BİTTİ ──
        _write_checkpoint(project_dir, "done", completed)
        print("\n" + "═" * 60)
        print("🎉 MOLO CONTENT AGENT — TAMAMLANDI!")
        if os.path.exists(final):
            dur = get_audio_duration(final)
            size = os.path.getsize(final) / (1024 * 1024)
            print(f"   📁 {final}")
            print(f"   ⏱️  {dur:.1f}s | 💾 {size:.1f} MB | {_ct['label']}")
        print("═" * 60)
        _write_progress("done", 100, "Pipeline başarıyla tamamlandı!", is_done=True)

    except KeyboardInterrupt:
        print("\n   ⛔ Pipeline kullanıcı tarafından durduruldu.")
        _write_checkpoint(project_dir, "interrupted", completed)
        _write_progress("error", 0, "Kullanıcı tarafından durduruldu", is_error=True)
        sys.exit(130)
    except Exception as e:
        print(f"\n   ❌ Pipeline hatası: {e}")
        import traceback
        traceback.print_exc()
        _write_checkpoint(project_dir, "error", completed, error=str(e)[:500])
        _write_progress("error", 0, f"Hata: {str(e)[:200]}", is_error=True)
        sys.exit(1)


# ═══════════════════════════════════════
# RENDER MODE — Edit Bay'den çağrılır
# ═══════════════════════════════════════

def render_from_config(config_path: str):
    """Edit Bay render: config JSON oku → compose_edit → add_subtitles → compose_final.
    render/route.ts bu fonksiyonu --render-config ile çağırır."""
    import unicodedata
    from glob import glob

    config_path = Path(config_path)
    if not config_path.exists():
        print(f"❌ Config bulunamadı: {config_path}")
        sys.exit(1)

    config = json.loads(config_path.read_text())
    project_dir = config_path.parent
    project_name = project_dir.name.split("_", 1)[1] if "_" in project_dir.name else project_dir.name

    # Load scenes
    scenes_json = project_dir / "scenes" / "scenes.json"
    if not scenes_json.exists():
        print("❌ scenes.json bulunamadı")
        sys.exit(1)

    data = json.loads(scenes_json.read_text())
    scenes = data["scenes"] if isinstance(data, dict) else data
    durations = data.get("durations", []) if isinstance(data, dict) else []

    # Set content type from brief (Turkish İ safe)
    global _ct, _content_type_key
    ct_key = "sosyal"
    brief_path = project_dir / "brief.md"
    if brief_path.exists():
        brief_text = brief_path.read_text()
        for line in brief_text.splitlines():
            nf = unicodedata.normalize("NFKD", line).casefold().strip()
            if ("erik t" in nf and ":" in nf) or "content type:" in nf:
                val = line.split(":", 1)[1].strip().lower()
                if val in CONTENT_TYPES:
                    ct_key = val
                    print(f"   Brief content type: {val}")

    _content_type_key = ct_key
    _ct = CONTENT_TYPES.get(ct_key, CONTENT_TYPES["sosyal"]).copy()
    print(f"   Content type: {ct_key} ({_ct['width']}x{_ct['height']})")

    # Detect language from brief
    lang = "de"
    if brief_path.exists():
        _lang_map = {
            "de": "de", "deutsch": "de", "almanca": "de", "german": "de",
            "tr": "tr", "türkçe": "tr", "turkish": "tr",
            "en": "en", "english": "en", "ingilizce": "en",
        }
        for line in brief_text.splitlines():
            ll = line.lower().strip()
            if "dil:" in ll or "language:" in ll:
                raw = line.split(":", 1)[1].strip().lower()
                for key, code in _lang_map.items():
                    if key in raw:
                        lang = code
                        break
        print(f"   Dil: {lang}")

    # Collect existing scene videos and audio
    video_files = sorted(glob(str(project_dir / "scenes" / "*.mp4")))
    voice_files = sorted(glob(str(project_dir / "audio" / "*.mp3")))

    if not video_files:
        print("❌ Video dosyası bulunamadı")
        sys.exit(1)

    # Log source video dimensions (debug)
    try:
        probe = subprocess.run(
            [FFMPEG, "-i", video_files[0], "-f", "null", "-"],
            capture_output=True, text=True, timeout=5)
        for line in probe.stderr.split('\n'):
            if 'Video:' in line and 'Stream' in line:
                import re
                match = re.search(r'(\d{3,4})x(\d{3,4})', line)
                if match:
                    src_w, src_h = int(match.group(1)), int(match.group(2))
                    print(f"   Kaynak video: {src_w}x{src_h}")
                    break
    except Exception as e:
        print(f"   Video boyut okunamadı: {e}")

    print(f"   {len(video_files)} video, {len(voice_files)} ses dosyası")
    print(f"   Config: crossfade={config.get('crossfade')}, slowdown={config.get('slowdown')}, "
          f"crf={config.get('crf')}, transition={config.get('transition')}")

    # Step 1: Per-scene merge (Encode 1)
    merged_scenes = compose_edit(video_files, voice_files, durations, project_dir, project_name,
                                 crf=config.get("crf"))
    if not merged_scenes:
        print("❌ Compose edit başarısız")
        sys.exit(1)
    print(f"   ✅ {len(merged_scenes)} sahne birleştirildi")

    # Step 2: Generate ASS subtitles (no encode)
    ass_path = None
    if config.get("addSubtitles", True):
        try:
            ass_path = add_subtitles(None, scenes, durations, project_dir, project_name, lang,
                                     font_size=config.get("fontSize"),
                                     margin_v=config.get("marginV"))
            if ass_path and os.path.exists(ass_path):
                print(f"   ✅ ASS altyazı: {ass_path}")
            else:
                print("   ⚠️ Altyazı oluşturulamadı, altyazısız devam ediliyor")
                ass_path = None
        except Exception as e:
            print(f"   ⚠️ Altyazı hatası: {e}")
            ass_path = None

    # Step 3: Final compose — crossfade + subtitles + slowdown (Encode 2)
    final = compose_final(merged_scenes, ass_path, project_dir, project_name,
                          crossfade=config.get("crossfade"),
                          transition=config.get("transition"),
                          speed=config.get("slowdown"))
    if not final:
        print("❌ Final compose başarısız")
        sys.exit(1)
    print(f"   ✅ Final: {final}")
    print("Render complete!")


if __name__ == "__main__":
    if "--render-config" in sys.argv:
        idx = sys.argv.index("--render-config")
        if idx + 1 >= len(sys.argv):
            print("Kullanım: python3 molo_agent.py --render-config <config.json>")
            sys.exit(1)
        render_from_config(sys.argv[idx + 1])
    else:
        main()
