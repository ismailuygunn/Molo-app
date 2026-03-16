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
    KLING_MODEL, KLING_API_BASE, KLING_DURATION, KLING_MAX_PROMPT_CHARS,
    GEMINI_IMAGE_MODEL, GEMINI_TEXT_MODEL, ELEVENLABS_MODEL,
    VOICE_PRESETS, VOICE_DEFAULT, VOICE_PROFILES,
    CHARACTER_PERSONALITY, CHARACTER_IDENTITY_LOCK,
    HOLOGRAM_LOCK, LIPSYNC_READINESS, LIGHTING_RULES, AVOID_LIST,
    COMPACT_LOCK, COMPACT_MOTION,
    QUALITY_FILTERS, AUDIO_SLOWDOWN, CROSSFADE_DURATION,
    TRANSITION_TYPES, DEFAULT_TRANSITION,
    BGM_VOLUME_DB, BGM_FADE_IN, BGM_FADE_OUT, BGM_DIR,
    THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT,
    KLING_MAX_PARALLEL, KLING_RETRY_WAIT, KLING_MAX_RETRIES,
    SCENE_PADDING,
    CONTENT_TYPES, DEFAULT_CONTENT_TYPE,
    MOLO_POSES, ENVIRONMENT_IMAGES,
    get_normalize_filter,
)
import random

# ── Aktif içerik türü profili (main'de set edilir) ──
_content_type_key = DEFAULT_CONTENT_TYPE
_ct = CONTENT_TYPES[DEFAULT_CONTENT_TYPE].copy()

from google import genai
from google.genai import types as gtypes

# ═══════════════════════════════════════
# İLERLEME TAKİBİ
# ═══════════════════════════════════════

_progress_path = None  # main() içinde set edilir

def _write_progress(step: str, progress: int, message: str = "",
                    is_error: bool = False, is_done: bool = False):
    """Yapılandırılmış progress.json yaz — Studio UI tarafından okunur."""
    if _progress_path is None:
        return
    import json, datetime
    data = {
        "step": step,
        "progress": progress,
        "message": message,
        "isRunning": not is_done and not is_error,
        "isError": is_error,
        "isDone": is_done,
        "updatedAt": datetime.datetime.now().isoformat(),
    }
    try:
        with open(_progress_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
    except Exception:
        pass  # Dosya yazılamazsa pipeline'ı durdurmayız


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


# ═══════════════════════════════════════
# ADIM 1: BRİEF OKUMA & SENARYO ÜRETİMİ
# ═══════════════════════════════════════

def generate_script(brief_path, lang="de"):
    """Brief dosyasını okur, Gemini ile senaryo üretir."""
    brief = Path(brief_path).read_text(encoding="utf-8")

    print("=" * 60)
    print("📝 ADIM 1: Senaryo Üretimi (Gemini)")
    print("=" * 60)
    print(f"   📄 Brief: {brief_path}")

    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

    lang_names = {"de": "German", "tr": "Turkish", "en": "English"}
    target_lang = lang_names.get(lang, lang)

    system_prompt = f"""You are the creative director for MOLO, İstadental's brand mascot.

{CHARACTER_PERSONALITY}

CONTENT FORMAT: {_ct['scene_direction']}

CRITICAL RULES FOR SCRIPT WRITING:
- Write the script in {target_lang}
- Each scene should be max ~80 words / ~8-12 seconds of speech
- First scene: energetic greeting (MOLO introduces topic)
- Middle scenes: informative content with subtle humor and personality
- Last scene: warm farewell with brand invitation ("Kommt vorbei" / "Besucht uns")
- MOLO can make small jokes, gently self-praise, quietly self-comment
- MOLO is warm, clever, slightly mischievous — but NEVER breaks brand seriousness
- MOLO is NOT a doctor — relay info simply, warmly, accessibly
- Keep scenes balanced in length — no scene should be 3x longer than another

AVAILABLE ENVIRONMENTS: clinic (with clinic photo background), studio (soft blurred background)
AVAILABLE POSES: front (neutral speaking), front-wave (greeting/farewell)
AVAILABLE VOICE DIRECTIONS: energetic, warm, informative, playful, mischievous, calm, excited
AVAILABLE SHOT TYPES: medium (full body, environment visible), medium-close (upper body, face prominent), close-medium (face focus, lip-sync priority)

OUTPUT FORMAT — Return ONLY valid JSON, no markdown:
{{
  "title": "short content title",
  "scenes": [
    {{
      "scene": 1,
      "text": "what MOLO says in {target_lang}",
      "environment": "clinic",
      "molo_pose": "front-wave",
      "voice_direction": "energetic",
      "shot_type": "medium",
      "emotion_note": "excited greeting, slightly mischievous"
    }}
  ]
}}"""

    response = client.models.generate_content(
        model=GEMINI_TEXT_MODEL,
        contents=f"Write a MOLO script based on this brief:\n\n{brief}",
        config=gtypes.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.8,
        )
    )

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
    print(f"   ✅ {len(scenes)} sahne üretildi: {script.get('title', '?')}")
    for s in scenes:
        print(f"      Sahne {s['scene']}: [{s['voice_direction']}] {s['text'][:60]}...")

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
                "use_speaker_boost": True,
            }
        }

        resp = requests.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
            headers={"xi-api-key": api_key, "Content-Type": "application/json"},
            json=payload, timeout=30
        )

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

def generate_scene_images(scenes, project_dir):
    """Her sahne için premium identity-lock promptlarıyla Gemini görseli üretir."""
    print("\n" + "=" * 60)
    print("📸 ADIM 4: Sahne Görselleri (Nano Banana 2)")
    print("=" * 60)

    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
    image_files = []

    for s in scenes:
        n = s["scene"]
        env = s.get("environment", "clinic")
        pose = s.get("molo_pose", "front")
        shot = s.get("shot_type", "medium")
        emotion = s.get("emotion_note", "warm, premium, welcoming")

        output = project_dir / "scenes" / f"scene_{n:02d}_ref.png"
        print(f"\n   ── Sahne {n}: {env} | {pose} | {shot}")

        # Molo referans görseli
        molo_ref = MOLO_POSES.get(pose, MOLO_POSES["front"])
        if not molo_ref.exists():
            print(f"      ⚠️ Poz bulunamadı: {pose}, front kullanılıyor")
            molo_ref = MOLO_POSES["front"]

        # Görüntüleri yükle
        images_to_send = [gtypes.Part.from_bytes(
            data=open(molo_ref, "rb").read(),
            mime_type="image/jpeg"
        )]

        # Klinik arka planı varsa ekle
        env_ref = ENVIRONMENT_IMAGES.get(env)
        env_block = ""
        if env_ref and env_ref.exists():
            images_to_send.insert(0, gtypes.Part.from_bytes(
                data=open(env_ref, "rb").read(),
                mime_type="image/jpeg"
            ))
            env_block = f"""Also use the provided clinic background reference as the environmental base for this composition. The final image must clearly place MOLO inside that premium clinic environment, and the clinic should remain visible and readable as part of the scene. Do not let MOLO fill the entire frame. Do not crop MOLO too close. Do not make MOLO oversized."""

        # Premium prompt oluştur
        orient_text = "horizontal wide" if _ct['orientation'] == 'horizontal' else "vertical"
        prompt = f"""{CHARACTER_IDENTITY_LOCK}

{env_block}

Create a {_ct['orientation']} {_ct['aspect']} premium digital-host frame for a clinic screen. MOLO must be directly facing the camera, making clear direct eye contact, positioned in the center of the frame, with a symmetrical, screen-friendly composition.

{_ct['scene_direction']}

The framing should be a {shot} shot. The posture must be upright, open, welcoming, and stable.

Expression and mood: {emotion}

{LIPSYNC_READINESS}

{HOLOGRAM_LOCK}

{LIGHTING_RULES}

Important composition rules:
- MOLO must be front-facing and centered
- MOLO must not fill the entire frame
- the environment must remain visible in the background
- the mouth area must be clean and readable for lip-sync
- the face must remain symmetrical and stable
- the image must feel designed for a {orient_text} digital display host

{AVOID_LIST}"""

        print(f"      🧠 Gemini üretimi...")

        # Gemini çağrısı
        response = client.models.generate_content(
            model=GEMINI_IMAGE_MODEL,
            contents=[prompt] + images_to_send,
            config=gtypes.GenerateContentConfig(
                response_modalities=["IMAGE", "TEXT"],
            )
        )

        # Görseli kaydet
        saved = False
        for part in response.candidates[0].content.parts:
            if hasattr(part, 'inline_data') and part.inline_data:
                from PIL import Image
                import io
                img = Image.open(io.BytesIO(part.inline_data.data))
                # 1080x1920 zorunlu resize
                if img.size != (_ct['width'], _ct['height']):
                    img = img.resize((_ct['width'], _ct['height']), Image.LANCZOS)
                img.save(str(output), "PNG")
                print(f"      ✅ {output.name} ({img.size[0]}x{img.size[1]})")
                image_files.append(str(output))
                saved = True
                break

        if not saved:
            print(f"      ❌ Görsel üretilemedi!")
            sys.exit(1)

    return image_files


# ═══════════════════════════════════════
# ADIM 5: VİDEO ÜRETİMİ (Kling v3)
# ═══════════════════════════════════════

def build_video_prompt(scene):
    """Sahne için <2500 char kompakt video prompt'u oluşturur."""
    shot = scene.get("shot_type", "medium")
    emotion = scene.get("emotion_note", "warm, premium, welcoming")
    voice_dir = scene.get("voice_direction", "warm")

    # Sahne-özel performance bloğu
    scene_block = f"""Premium front-facing {shot} {voice_dir} performance. MOLO centered, symmetrical, directly facing camera.

{_ct['scene_direction']}

Performance mood: {emotion}. The character should embody this emotion through subtle facial cues and minimal body language. No exaggeration.

Acting: warm, precise, premium, slightly robotic, controlled, direct. Not childish, not theatrical, not silly.

Avoid: side angle, 3/4 view, oversized mascot, cartoon wobble, arm flailing, face morphing, exaggerated smile, toy rendering, asymmetric framing, bouncing, elastic motion."""

    full = f"{COMPACT_LOCK}\n\n{COMPACT_MOTION}\n\n{scene_block}"

    if len(full) > KLING_MAX_PROMPT_CHARS:
        # Truncate scene block if needed
        excess = len(full) - KLING_MAX_PROMPT_CHARS + 50
        scene_block = scene_block[:-excess]
        full = f"{COMPACT_LOCK}\n\n{COMPACT_MOTION}\n\n{scene_block}"

    return full


def _submit_kling_task(scene, ref_path):
    """Tek bir Kling task'ı submit eder. (task_id, scene_num) döndürür."""
    n = scene["scene"]
    prompt = build_video_prompt(scene)
    if len(prompt) > KLING_MAX_PROMPT_CHARS:
        print(f"   Sahne {n}: {len(prompt)} char ❌ FAZLA")
        return None, n

    img_b64 = base64.b64encode(open(ref_path, "rb").read()).decode()
    token = get_kling_token()
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
    payload = {
        "model_name": KLING_MODEL, "image": img_b64,
        "prompt": prompt, "duration": KLING_DURATION, "aspect_ratio": _ct['kling_aspect'],
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


def _wait_kling_task(tid, scene_num, out_path):
    """Tek bir Kling task'ını bekler ve indirir."""
    for attempt in range(40):
        token = get_kling_token()
        resp = requests.get(f"{KLING_API_BASE}/v1/videos/image2video/{tid}",
                           headers={"Authorization": f"Bearer {token}"}, timeout=30)
        rj = resp.json()
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
            return False
        else:
            if attempt % 4 == 0:
                print(f"   ⏳ Sahne {scene_num}: {status}... ({attempt*10}s)")
            time.sleep(10)
    return False


def generate_videos(scenes, image_files, project_dir):
    """Her sahne için Kling v3 video üretir. Kuyruk + retry mekanizmalı."""
    print("\n" + "=" * 60)
    print(f"🎬 ADIM 5: Video Üretimi ({KLING_MODEL}) — Kuyruk + Retry")
    print("=" * 60)

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
                tid, sn = _submit_kling_task(s, ref)
                if tid:
                    out = project_dir / "scenes" / f"scene_{n:02d}.mp4"
                    active.append((tid, n, str(out), idx))
                    print(f"   Sahne {n}: {len(build_video_prompt(s))} char → Task={tid}")
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
                        print(f"   ✅ Sahne {sn}: {size:.1f} MB")
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
# ADIM 6: KURGU & EFEKT
# ═══════════════════════════════════════

def compose_edit(video_files, voice_files, durations, project_dir, project_name):
    """Ses-video eşleştir, kalite filtrele, crossfade, final yap."""
    print("\n" + "=" * 60)
    print("🎬 ADIM 6: Kurgu & Efekt")
    print("=" * 60)

    num = min(len(video_files), len(voice_files))

    # 6a: Her sahne: ping-pong reverse loop + kalite filtre + ses birleştir
    merged = []
    for i in range(num):
        n = i + 1
        out = str(project_dir / "draft" / f"s{n:02d}_final.mp4")
        dur = durations[i]
        vf = get_normalize_filter(with_quality=True, content_type=_content_type_key)

        # Ping-pong: video ters-düz loop ile daha doğal animasyon
        # [0:v]split → normal + tersine → concat → loop
        pingpong_vf = f"[0:v]split[fwd][rev];[rev]reverse[r];[fwd][r]concat=n=2:v=1:a=0,loop=-1:size=9999,{vf}[v]"

        # Sahne padding: ses bittikten sonra son kareyi SCENE_PADDING kadar dondur
        # -shortest yerine ses + padding kadar keş
        pad_dur = durations[i] + SCENE_PADDING

        cmd = [
            FFMPEG, "-y",
            "-i", video_files[i],
            "-i", voice_files[i],
            "-filter_complex", pingpong_vf,
            "-map", "[v]", "-map", "1:a",
            "-c:v", "libx264", "-preset", "medium",
            "-crf", str(QUALITY_FILTERS["crf"]),
            "-c:a", "aac", "-b:a", "192k", "-r", str(OUTPUT_FPS),
            "-t", str(pad_dur),
            "-shortest", out
        ]

        # Fallback: ping-pong başarısız olursa stream_loop kullan
        r_pp = subprocess.run(cmd, capture_output=True, text=True)
        if r_pp.returncode != 0:
            # Fallback to stream_loop
            cmd = [
                FFMPEG, "-y",
                "-stream_loop", "-1", "-i", video_files[i],
                "-i", voice_files[i],
                "-filter_complex", f"[0:v]{vf}[v]",
                "-map", "[v]", "-map", "1:a",
                "-c:v", "libx264", "-preset", "medium",
                "-crf", str(QUALITY_FILTERS["crf"]),
                "-c:a", "aac", "-b:a", "192k", "-r", str(OUTPUT_FPS),
                "-t", str(pad_dur),
                "-shortest", out
            ]
            r = subprocess.run(cmd, capture_output=True, text=True)
            if r.returncode == 0:
                actual_dur = get_audio_duration(out)
                print(f"   ✅ Sahne {n}: {actual_dur:.1f}s (stream_loop fallback)")
                merged.append(out)
            else:
                print(f"   ❌ Sahne {n}: {r.stderr[-200:]}")
        else:
            actual_dur = get_audio_duration(out)
            print(f"   ✅ Sahne {n}: {actual_dur:.1f}s (ping-pong 🏓)")
            merged.append(out)

    if len(merged) < 2:
        print("   ❌ Yetersiz sahne!")
        return None

    # 6b: Crossfade (rastgele geçiş tipleriyle)
    draft = str(project_dir / "draft" / f"{project_name}_draft.mp4")

    # Her sahne geçişi için farklı transition tipi seç
    transitions = []
    available = [t for t in TRANSITION_TYPES if t != DEFAULT_TRANSITION]
    transitions.append(DEFAULT_TRANSITION)  # ilk geçiş her zaman fade
    for _ in range(len(merged) - 2):
        transitions.append(random.choice(available))
    if len(merged) > 2:
        transitions.append(DEFAULT_TRANSITION)  # son geçiş de fade
    fade = CROSSFADE_DURATION

    # Dinamik offset hesaplama
    actual_durations = [get_audio_duration(f) for f in merged]

    if len(merged) == 2:
        o1 = actual_durations[0] - fade
        inputs = []
        for s in merged:
            inputs.extend(["-i", s])
        tr = transitions[0] if transitions else DEFAULT_TRANSITION
        fg = (f"[0:v][1:v]xfade=transition={tr}:duration={fade}:offset={o1:.2f}[outv];"
              f"[0:a][1:a]concat=n=2:v=0:a=1[outa]")
        cmd = [FFMPEG, "-y"] + inputs + ["-filter_complex", fg,
               "-map", "[outv]", "-map", "[outa]",
               "-c:v", "libx264", "-preset", "medium",
               "-crf", str(QUALITY_FILTERS["crf"]),
               "-c:a", "aac", "-b:a", "192k", draft]
    elif len(merged) == 3:
        o1 = actual_durations[0] - fade
        o2 = o1 + actual_durations[1] - fade
        inputs = []
        for s in merged:
            inputs.extend(["-i", s])
        tr1 = transitions[0] if len(transitions) > 0 else DEFAULT_TRANSITION
        tr2 = transitions[1] if len(transitions) > 1 else DEFAULT_TRANSITION
        fg = (f"[0:v][1:v]xfade=transition={tr1}:duration={fade}:offset={o1:.2f}[v01];"
              f"[v01][2:v]xfade=transition={tr2}:duration={fade}:offset={o2:.2f}[outv];"
              f"[0:a][1:a][2:a]concat=n=3:v=0:a=1[outa]")
        cmd = [FFMPEG, "-y"] + inputs + ["-filter_complex", fg,
               "-map", "[outv]", "-map", "[outa]",
               "-c:v", "libx264", "-preset", "medium",
               "-crf", str(QUALITY_FILTERS["crf"]),
               "-c:a", "aac", "-b:a", "192k", draft]
    else:
        # 4+ sahne: zincirleme xfade
        inputs = []
        for s in merged:
            inputs.extend(["-i", s])

        fg_parts = []
        audio_parts = []
        cum_offset = 0
        prev = "[0:v]"

        for i in range(1, len(merged)):
            cum_offset += actual_durations[i - 1] - fade
            out_label = f"[v{i:02d}]" if i < len(merged) - 1 else "[outv]"
            tr = transitions[i-1] if i-1 < len(transitions) else DEFAULT_TRANSITION
            fg_parts.append(
                f"{prev}[{i}:v]xfade=transition={tr}:duration={fade}:offset={cum_offset:.2f}{out_label}"
            )
            prev = out_label

        for i in range(len(merged)):
            audio_parts.append(f"[{i}:a]")

        fg = ";".join(fg_parts) + ";" + "".join(audio_parts) + f"concat=n={len(merged)}:v=0:a=1[outa]"

        cmd = [FFMPEG, "-y"] + inputs + ["-filter_complex", fg,
               "-map", "[outv]", "-map", "[outa]",
               "-c:v", "libx264", "-preset", "medium",
               "-crf", str(QUALITY_FILTERS["crf"]),
               "-c:a", "aac", "-b:a", "192k", draft]

    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"   ⚠️ Crossfade başarısız, concat deniyor...")
        concat_f = str(project_dir / "draft" / "concat.txt")
        with open(concat_f, "w") as f:
            for s in merged:
                f.write(f"file '{s}'\n")
        cmd2 = [FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", concat_f,
                "-c:v", "libx264", "-crf", str(QUALITY_FILTERS["crf"]),
                "-c:a", "aac", draft]
        subprocess.run(cmd2, capture_output=True, text=True)
        print(f"   ✅ Draft (concat)")
    else:
        trs = ', '.join(transitions[:len(merged)-1])
        print(f"   ✅ Draft (crossfade: {trs})")

    total = get_audio_duration(draft)
    size = os.path.getsize(draft) / (1024 * 1024)
    print(f"   📁 {size:.1f} MB, {total:.1f}s")

    # 6c: Arka plan müziği (BGM)
    draft = _mix_bgm(draft, total, project_dir, project_name)

    return draft


# ═══════════════════════════════════════
# ADIM 7: ALTYAZI (ASS)
# ═══════════════════════════════════════

def add_subtitles(draft_path, scenes, durations, project_dir, project_name, lang="de"):
    """İngilizce çeviri + ASS altyazı + final oluştur."""
    print("\n" + "=" * 60)
    print("🔤 ADIM 7: Altyazı (DE → EN)")
    print("=" * 60)

    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

    # Çeviri
    texts = [s["text"] for s in scenes]
    translations = []
    for text in texts:
        resp = client.models.generate_content(
            model=GEMINI_TEXT_MODEL,
            contents=f"Translate this German text to English. Return ONLY the translation:\n\n{text}"
        )
        tr = resp.text.strip()
        print(f"   🔄 '{text[:35]}...' → '{tr[:35]}...'")
        translations.append(tr)

    # ASS oluştur
    ass_path = project_dir / "subtitles" / "subs_en.ass"
    ass_path.parent.mkdir(parents=True, exist_ok=True)

    ass = f"""[Script Info]
Title: {project_name}
ScriptType: v4.00+
PlayResX: {_ct['width']}
PlayResY: {_ct['height']}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,{_ct['subtitle_fontsize']},&H00FFFFFF,&H000000FF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,4,0,0,2,20,20,{_ct['subtitle_margin_v']},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    cum = 0.2
    for i, (tr, dur) in enumerate(zip(translations, durations)):
        start = cum
        end = cum + dur
        wrapped = wrap_subtitle(tr)
        ass += f"Dialogue: 0,{format_ass_time(start)},{format_ass_time(end)},Default,,0,0,0,,{wrapped}\n"
        cum = end + 0.5

    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(ass)
    print(f"   ✅ ASS: {ass_path}")

    # Altyazı yak
    sub_path = str(project_dir / "draft" / f"{project_name}_subtitled.mp4")
    cmd = [FFMPEG, "-y", "-i", draft_path,
           "-vf", f"ass={ass_path}",
           "-c:v", "libx264", "-preset", "medium",
           "-crf", str(QUALITY_FILTERS["crf"]),
           "-c:a", "copy", sub_path]
    r = subprocess.run(cmd, capture_output=True, text=True)

    if r.returncode == 0:
        print(f"   ✅ Altyazılı draft: {sub_path}")
    else:
        print(f"   ❌ Altyazı yakma hatası")
        return draft_path

    return sub_path


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
# ADIM 8: FİNAL SLOWDOWN
# ═══════════════════════════════════════

def apply_slowdown(input_path, project_dir, project_name):
    """Final videoya hafif yavaşlatma uygular."""
    print("\n" + "=" * 60)
    print(f"🐢 ADIM 8: Final Slowdown ({AUDIO_SLOWDOWN}x = %{int((1-AUDIO_SLOWDOWN)*100)} yavaşlatma)")
    print("=" * 60)

    final = str(project_dir / "final" / f"{project_name}_final.mp4")
    (project_dir / "final").mkdir(parents=True, exist_ok=True)

    speed = AUDIO_SLOWDOWN
    cmd = [
        FFMPEG, "-y", "-i", input_path,
        "-filter_complex",
        f"[0:v]setpts={1/speed}*PTS[v];[0:a]atempo={speed}[a]",
        "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-preset", "medium",
        "-crf", str(QUALITY_FILTERS["crf"]),
        "-c:a", "aac", "-b:a", "192k",
        "-r", str(OUTPUT_FPS),
        final
    ]

    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode == 0:
        dur = get_audio_duration(final)
        size = os.path.getsize(final) / (1024 * 1024)
        print(f"   ✅ Final: {final}")
        print(f"   📁 {size:.1f} MB, {dur:.1f}s")
        return final
    else:
        print(f"   ⚠️ Slowdown başarısız, kopyalanıyor...")
        import shutil
        shutil.copy2(input_path, final)
        return final


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

    # Yaratıcı thumbnail prompt'u
    prompt = f"""{CHARACTER_IDENTITY_LOCK}

Create a STUNNING, eye-catching vertical 9:16 social media thumbnail for a video titled "{title}".

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
        response = client.models.generate_content(
            model=GEMINI_IMAGE_MODEL,
            contents=[prompt] + images_to_send,
            config=gtypes.GenerateContentConfig(
                response_modalities=["IMAGE", "TEXT"],
            )
        )

        for part in response.candidates[0].content.parts:
            if hasattr(part, 'inline_data') and part.inline_data:
                from PIL import Image
                import io
                img = Image.open(io.BytesIO(part.inline_data.data))
                if img.size != (THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT):
                    img = img.resize((THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT), Image.LANCZOS)
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
        print("Kullanım: python3 molo_agent.py <brief.md> [--dry-run] [--auto-approve]")
        print("Örnek:    python3 molo_agent.py projects/2026-03-16_konu/brief.md")
        sys.exit(1)

    brief_path = Path(sys.argv[1])
    dry_run = "--dry-run" in sys.argv
    auto_approve = "--auto-approve" in sys.argv

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
    if "dil:" in brief_text.lower() or "language:" in brief_text.lower():
        for line in brief_text.split("\n"):
            if "dil:" in line.lower():
                lang = line.split(":", 1)[1].strip().lower()[:2]
            elif "language:" in line.lower():
                lang = line.split(":", 1)[1].strip().lower()[:2]

    # İçerik türü oku
    global _ct, _content_type_key
    content_type = DEFAULT_CONTENT_TYPE
    for line in brief_text.split("\n"):
        ll = line.lower().strip()
        if "İçerik türü:" in ll or "içerik türü:" in ll or "content type:" in ll or "tür:" in ll:
            val = line.split(":", 1)[1].strip().lower()
            if val in CONTENT_TYPES:
                content_type = val
    _content_type_key = content_type
    _ct = CONTENT_TYPES[content_type].copy()

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
    print(f"   🐢 Slowdown: {AUDIO_SLOWDOWN}x")

    if dry_run:
        print(f"\n   🏃 DRY RUN — API çağrısı yapılmayacak")

    _write_progress("starting", 5, "Pipeline başlatılıyor...")

    try:
        # ── ADIM 1: Senaryo ──
        _write_progress("script", 10, "Senaryo üretiliyor...")
        script = generate_script(brief_path, lang)
        scenes = script["scenes"]
        _write_progress("script", 15, f"{len(scenes)} sahne üretildi")

        if dry_run:
            print("\n   🏃 DRY RUN tamamlandı. Senaryo üretildi, API çağrısı yok.")
            _write_progress("done", 100, "DRY RUN tamamlandı", is_done=True)
            return

        # ── ADIM 2: Ses üretimi (SES-ÖNCELİKLİ) ──
        _write_progress("voice", 20, "Ses üretimi başlıyor...")
        voice_files, durations = generate_voices(scenes, lang, project_name, project_dir)
        _write_progress("voice", 30, f"{len(voice_files)} ses dosyası hazır")

        # ── ADIM 3: Onay ──
        _write_progress("approval", 32, "İçerik onayı bekleniyor...")
        if not present_for_approval(script, durations, project_dir, auto_approve=auto_approve):
            print("\n   🛑 İptal edildi.")
            _write_progress("idle", 0, "Kullanıcı tarafından iptal edildi")
            sys.exit(0)
        _write_progress("approval", 35, "İçerik onaylandı")

        # ── ADIM 4: Görseller ──
        _write_progress("images", 38, "Sahne görselleri üretiliyor...")
        image_files = generate_scene_images(scenes, project_dir)
        _write_progress("images", 50, f"{len(image_files)} görsel hazır")

        # ── ADIM 5: Videolar ──
        _write_progress("videos", 52, "Video üretimi başlıyor (Kling API)...")
        video_files = generate_videos(scenes, image_files, project_dir)
        _write_progress("videos", 70, f"{len(video_files)}/{len(scenes)} video hazır")

        if len(video_files) < len(scenes):
            print(f"\n   ⚠️ {len(video_files)}/{len(scenes)} video hazır — devam ediliyor")

        # ── ADIM 6: Kurgu ──
        _write_progress("edit", 72, "Kurgu oluşturuluyor...")
        draft = compose_edit(video_files, voice_files, durations, project_dir, project_name)
        if not draft:
            raise RuntimeError("Kurgu başarısız — draft oluşturulamadı")
        _write_progress("edit", 80, "Draft montaj hazır")

        # ── ADIM 7: Altyazı ──
        _write_progress("subtitles", 82, "Altyazılar ekleniyor...")
        subtitled = add_subtitles(draft, scenes, durations, project_dir, project_name, lang)
        _write_progress("subtitles", 88, "Altyazılı video hazır")

        # ── ADIM 8: Final Slowdown ──
        _write_progress("slowdown", 90, "Final slowdown uygulanıyor...")
        final = apply_slowdown(subtitled, project_dir, project_name)
        _write_progress("slowdown", 93, "Slowdown tamamlandı")

        # ── ADIM 9: Thumbnail (şartlı) ──
        if _ct.get('thumbnail', False):
            _write_progress("thumbnail", 95, "Thumbnail üretiliyor...")
            title = script.get("title", project_name)
            generate_thumbnail(final, project_dir, project_name, title)
        else:
            print(f"\n   🖼️ Thumbnail atlandı ({_ct['label']} için gerekli değil)")

        # ── BİTTİ ──
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
        _write_progress("error", 0, "Kullanıcı tarafından durduruldu", is_error=True)
        sys.exit(130)
    except Exception as e:
        print(f"\n   ❌ Pipeline hatası: {e}")
        import traceback
        traceback.print_exc()
        _write_progress("error", 0, f"Hata: {str(e)[:200]}", is_error=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
