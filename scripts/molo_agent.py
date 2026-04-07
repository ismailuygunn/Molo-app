#!/usr/bin/env python3
"""
Molo Content Agent — İçerik Üretim Agent'ı
═══════════════════════════════════════════

Kullanım:
  python3 scripts/molo_agent.py projects/2026-03-16_konu/brief.md
  python3 scripts/molo_agent.py projects/2026-03-16_konu/brief.md --dry-run

Akış:
  1. Brief okur → Gemini ile senaryo yazar
  2. Sahne görselleri üretir (Gemini)
  3. Ses üretir (ElevenLabs)
"""

import os
import sys
import json
import shutil
import time
import base64
import subprocess
import requests
from pathlib import Path
from datetime import datetime

# ── Config import ──
sys.path.insert(0, str(Path(__file__).parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from config import (
    BASE_DIR, PROJECTS_DIR, REFERENCE_DIR, VOICES_DIR,
    FFMPEG,
    GEMINI_IMAGE_MODEL, GEMINI_TEXT_MODEL, ELEVENLABS_MODEL,
    VOICE_PRESETS, VOICE_DEFAULT, VOICE_PROFILES,
    CHARACTER_PERSONALITY, CHARACTER_IDENTITY_LOCK,
    CHARACTER_LOCK_IMAGE, HOLOGRAM_LOCK, LIGHTING_RULES, AVOID_LIST,
    CLINIC_ENV_BLOCK, STUDIO_ENV_BLOCK, EXTERNAL_ENV_BLOCK,
    CONTENT_TYPES, DEFAULT_CONTENT_TYPE,
    MOLO_POSES, ENVIRONMENT_IMAGES,
    IMAGE_VARIANTS_COUNT,
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

    def _validate_script_quality(scenes, max_scenes):
        """Post-generation quality checks on script."""
        issues = []

        # Check scene count
        if len(scenes) != max_scenes:
            issues.append(f"Expected {max_scenes} scenes, got {len(scenes)}")

        # Check required fields
        required = ["scene", "text", "environment", "voice_direction", "shot_type", "emotion_note"]
        for s in scenes:
            missing = [f for f in required if not s.get(f)]
            if missing:
                issues.append(f"Scene {s.get('scene', '?')}: missing {', '.join(missing)}")

        # Check environment variety
        envs = [s.get("environment", "") for s in scenes]
        if len(set(envs)) < len(envs) * 0.5:  # More than half are same
            issues.append(f"Low environment variety: {envs}")

        # Add word count and estimated duration to each scene
        for s in scenes:
            text = s.get("text", "")
            wc = len(text.split())
            s["word_count"] = wc
            # ~2.5 words/sec for German, ~3 words/sec for Turkish
            s["estimated_duration_s"] = round(wc / 2.5, 1)

            if wc > 100:
                issues.append(f"Scene {s.get('scene', '?')}: {wc} words (max ~80)")

        return issues

    temperatures = [0.8, 0.9, 1.0]
    script = None
    for attempt_num, temp in enumerate(temperatures):
        response = gemini_with_retry(lambda t=temp: client.models.generate_content(
            model=GEMINI_TEXT_MODEL,
            contents=f"Write a MOLO script based on this brief:\n\n{brief}",
            config=gtypes.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=t,
            )
        ))

        # JSON parse with robust cleanup
        raw_text = response.text.strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1] if "\n" in raw_text else raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text.rsplit("```", 1)[0]
        if raw_text.startswith("json"):
            raw_text = raw_text[4:].strip()
        raw_text = raw_text.strip()

        try:
            script = json.loads(raw_text)
            break  # Parse succeeded
        except json.JSONDecodeError:
            if attempt_num < len(temperatures) - 1:
                print(f"   ⚠️ JSON parse hatası (deneme {attempt_num+1}/3, sıcaklık={temp}). Tekrar deneniyor...")
            else:
                print(f"   ❌ JSON parse hatası (3 denemede başarısız). Gemini çıktısı:\n{raw_text[:500]}")
                sys.exit(1)

    scenes = script.get("scenes", [])

    # Post-generation quality checks
    issues = _validate_script_quality(scenes, max_scenes)
    if issues:
        print(f"   ⚠️ Script quality issues: {'; '.join(issues)}")

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
    total_scenes = len(scenes)

    for i, s in enumerate(scenes):
        _write_progress("voice", 55 + (i * 30 // total_scenes), f"Sahne {i+1}/{total_scenes} ses üretiliyor...")
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
        print(f"   ⚠️ QC scoring failed: {e}")
        return 5, {}  # Return below-threshold score instead of bypassing


def generate_scene_images(scenes, project_dir):
    """Her sahne için premium identity-lock promptlarıyla Gemini görseli üretir.
    IMAGE_VARIANTS_COUNT kadar varyant uretir (v1, v2, ...) ve ilk varyanti ref.png olarak kaydeder."""
    print("\n" + "=" * 60)
    print("📸 ADIM 2: Sahne Görselleri (Nano Banana 2)")
    print("=" * 60)

    variant_count = IMAGE_VARIANTS_COUNT

    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
    image_files = []
    total_scenes = len(scenes)

    for i, s in enumerate(scenes):
        n = s["scene"]
        env = s.get("environment", "clinic")
        shot = s.get("shot_type", "medium")
        emotion = s.get("emotion_note", "warm, welcoming")

        output = project_dir / "scenes" / f"scene_{n:02d}_ref.png"
        _write_progress("images", 20 + (i * 20 // total_scenes), f"Sahne {i+1}/{total_scenes} görsel üretiliyor...")
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
        variant_additions = [
            "Alternative composition: use rule-of-thirds framing instead of centered. Different lighting angle — slightly warmer/cooler tone.",
            "Different perspective: slightly lower camera angle. More dramatic rim lighting, slightly wider framing.",
        ]
        for vi in range(variant_count):
            if vi == 0:
                variant_prompts.append(prompt)
            else:
                extra = variant_additions[min(vi - 1, len(variant_additions) - 1)]
                variant_prompts.append(prompt + f"\n\n{extra}")

        first_variant_ok = False
        variant_scores = []  # Collect (score, details) per variant
        for vi, (v_suffix, v_prompt) in enumerate(zip(variant_suffixes, variant_prompts)):
            v_output = project_dir / "scenes" / f"scene_{n:02d}_{v_suffix}.png"
            print(f"      ── Varyant {v_suffix} ──")

            # ── Kalite kontrollü üretim (max QC_MAX_RETRIES + 1 deneme) ──
            best_score = 0
            best_output = None
            best_details = {}
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
                    best_details = details

                if score >= QC_MIN_SCORE:
                    break
                else:
                    print(f"      ⚠️ Sahne {n} {v_suffix}: kalite skoru düşük ({score}), tekrar deneniyor...")
                    _write_progress("images", 20 + (i * 20 // total_scenes), f"Sahne {i+1}/{total_scenes} kalite kontrol (deneme {attempt+1}/{attempts})...")

            # En iyi sonucu varyant dosyasina tasi
            if best_output and best_output != str(v_output):
                import shutil
                shutil.copy2(best_output, str(v_output))
                for a in range(attempts):
                    try_path = str(v_output).replace(".png", f"_try{a}.png")
                    if os.path.exists(try_path):
                        os.remove(try_path)

            if best_output:
                variant_scores.append((best_score, best_details))
                qc_label = f"✅ QC={best_score}/10" if best_score >= QC_MIN_SCORE else f"⚠️ QC={best_score}/10 (en iyi)"
                print(f"      {qc_label} → {v_output.name}")
                # Ilk varyanti ref.png olarak da kaydet (varsayilan/fallback)
                if vi == 0:
                    import shutil
                    shutil.copy2(str(v_output), str(output))
                    first_variant_ok = True
            else:
                variant_scores.append((0, {}))
                print(f"      ❌ Sahne {n} {v_suffix}: hiçbir deneme başarılı olmadı!")
                if vi == 0:
                    # Ilk varyant zorunlu — basarisizsa pipeline durur
                    sys.exit(1)

        # Write QC scores for this scene
        qc_path = project_dir / "scenes" / "qc_scores.json"
        try:
            existing_qc = json.loads(qc_path.read_text()) if qc_path.exists() else {}
        except Exception:
            existing_qc = {}
        existing_qc[f"scene_{n:02d}"] = {
            f"v{vi+1}": {"score": score, "details": det}
            for vi, (score, det) in enumerate(variant_scores)
        }
        qc_path.write_text(json.dumps(existing_qc, indent=2, ensure_ascii=False))

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
    for d in ["scenes", "audio"]:
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

    # Progress tracking başlat
    global _progress_path
    _progress_path = str(project_dir / "progress.json")

    print("╔══════════════════════════════════════╗")
    print("║  MOLO CONTENT AGENT                  ║")
    print("║  İçerik Üretim                        ║")
    print("╚══════════════════════════════════════╝")
    print(f"\n   📄 Brief: {brief_path}")
    print(f"   📁 Proje: {project_dir}")
    print(f"   🌍 Dil: {lang}")
    print(f"   🎬 İçerik: {_ct['label']} ({_ct['width']}x{_ct['height']})")
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

        # ── ADIM 1.5: Senaryo İnceleme Duraklatması ──
        # Pipeline burada durur — kullanıcı sahne metinlerini inceler/düzenler
        # Studio UI'dan "Devam Et" butonuna basılınca .pipeline.resume dosyası oluşturulur
        # Düzenleme yapıldıysa scenes/script_edit.json dosyasına yazılır
        # Frontend endpoint: POST /api/pipeline/edit-script → script_edit.json yazar
        if "images" not in completed:  # Görseller henüz üretilmediyse duraklat
            import time as _time
            resume_file = project_dir / ".pipeline.resume"
            script_edit_file = project_dir / "scenes" / "script_edit.json"

            # scenes.json'u erken yaz — UI gösterebilsin / düzenleyebilsin
            scenes_dir = project_dir / "scenes"
            scenes_dir.mkdir(parents=True, exist_ok=True)
            scenes_json_path = scenes_dir / "scenes.json"
            with open(scenes_json_path, "w", encoding="utf-8") as f:
                json.dump({"title": script.get("title", ""), "scenes": scenes, "lang": lang},
                          f, ensure_ascii=False, indent=2)

            # Önceki resume sinyalini temizle
            if resume_file.exists():
                resume_file.unlink()

            _write_progress("review_script", 18,
                            f"⏸️ {len(scenes)} sahne hazır — senaryo inceleme bekleniyor",
                            is_paused=True)
            print(f"\n   ⏸️ SENARYO İNCELEME — {len(scenes)} sahne:")
            for s in scenes:
                print(f"      Sahne {s['scene']}: [{s.get('voice_direction','?')}] {s['text'][:80]}...")
            print(f"   Studio UI'dan senaryoyu düzenleyip 'Devam Et' butonuna basın.\n")

            # Resume sinyali bekle
            while not resume_file.exists():
                _time.sleep(1)
                # Pipeline durdurulmuş olabilir
                if _progress_path:
                    try:
                        with open(_progress_path, "r") as _pf:
                            _pd = json.load(_pf)
                            if _pd.get("isError"):
                                print("   🛑 Pipeline durduruldu.")
                                sys.exit(0)
                    except Exception:
                        pass

            # Resume sinyali geldi
            resume_file.unlink(missing_ok=True)

            # Kullanıcı senaryoyu düzenlediyse script_edit.json'dan yükle
            if script_edit_file.exists():
                try:
                    with open(script_edit_file, "r", encoding="utf-8") as f:
                        edited = json.load(f)
                    if edited.get("scenes"):
                        scenes = edited["scenes"]
                        script["scenes"] = scenes
                        print(f"   ✏️ Düzenlenmiş senaryo yüklendi ({len(scenes)} sahne)")
                        # Checkpoint'u düzenlenmiş senaryo ile güncelle
                        _write_checkpoint(project_dir, "script", completed, script=script)
                except Exception as e:
                    print(f"   ⚠️ Script edit okunamadı: {e}")

            _write_progress("script", 20,
                            "Senaryo onaylandı — görsel üretimine geçiliyor...")
            print(f"\n   ▶️ Devam ediliyor — ADIM 2: Görsel Üretimi")

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

        # Update scenes.json with durations
        scenes_json_path = project_dir / "scenes" / "scenes.json"
        try:
            scenes_data = json.loads(scenes_json_path.read_text(encoding="utf-8"))
            if isinstance(scenes_data, dict):
                scenes_data["durations"] = durations
                scenes_data["total_duration"] = sum(durations) if durations else 0
                scenes_json_path.write_text(json.dumps(scenes_data, ensure_ascii=False, indent=2), encoding="utf-8")
                print(f"   📝 scenes.json güncellendi (durations eklendi)")
        except Exception as e:
            print(f"   ⚠️ scenes.json güncellenemedi: {e}")

        # ── BİTTİ ──
        _write_checkpoint(project_dir, "done", completed,
                          script=script, voice_files=voice_files, durations=durations,
                          image_files=[str(f) for f in image_files])
        print("\n" + "═" * 60)
        print("🎉 MOLO CONTENT AGENT — TAMAMLANDI!")
        print(f"   📄 {len(scenes)} sahne | 🎙️ {len(voice_files)} ses | 🖼️ {len(image_files)} görsel")
        total_dur = sum(durations) if durations else 0
        print(f"   ⏱️  Toplam ses süresi: {total_dur:.1f}s")
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


if __name__ == "__main__":
    main()
