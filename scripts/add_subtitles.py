"""
Molo İçerik Üretim Sistemi — Altyazı Oluşturucu

⚠️ ALTYAZI KURALI:
  - Almanca ses → İNGİLİZCE altyazı (tek dil, çift dilli DEĞİL)
  - Türkçe ses → İNGİLİZCE altyazı
  - İngilizce ses → altyazı YOK (veya isteğe bağlı)

Çeviri: Gemini API (google.genai)
Yakma: FFmpeg hardcoded subtitles
"""

import os
import sys
import json
import subprocess
from pathlib import Path
from datetime import datetime

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("⚠️ google-genai paketi yüklü değil. pip3 install google-genai")
    genai = None

# ─── Merkezi config'den import ───
from config import (
    BASE_DIR, FFMPEG, GEMINI_TEXT_MODEL,
    OUTPUT_WIDTH, OUTPUT_HEIGHT,
    CONTENT_TYPES, DEFAULT_CONTENT_TYPE
)


def translate_to_english(texts, source_lang="de"):
    """Gemini API ile İngilizce'ye çevir."""
    if genai is None:
        print("⚠️ google-genai yüklü değil. Manuel çeviri gerekli.")
        return texts
    
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("⚠️ GOOGLE_API_KEY bulunamadı.")
        return texts
    
    client = genai.Client(api_key=api_key)
    
    lang_names = {"de": "German", "tr": "Turkish", "en": "English"}
    source = lang_names.get(source_lang, source_lang)
    
    translations = []
    for text in texts:
        if source_lang == "en":
            translations.append(text)
            continue
        
        prompt = f"""Translate this {source} text to natural, concise English.
Return ONLY the translation. Keep it short and suitable for subtitles (max 2 lines).

Text: {text}"""
        
        try:
            response = client.models.generate_content(
                model=GEMINI_TEXT_MODEL,
                contents=prompt
            )
            translated = response.text.strip()
            translations.append(translated)
            print(f"  🔄 '{text[:35]}...' → '{translated[:35]}...'")
        except Exception as e:
            print(f"  ⚠️ Çeviri hatası: {e}")
            translations.append(text)
    
    return translations


def format_srt_time(seconds):
    """Saniyeyi SRT formatına çevir: HH:MM:SS,mmm"""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def create_srt(texts, timings, output_path):
    """
    SRT altyazı dosyası oluştur.
    
    Args:
        texts: çevrilmiş metin listesi
        timings: [(start, end), ...] saniye cinsinden
        output_path: .srt çıktı yolu
    """
    content = ""
    for i, (text, (start, end)) in enumerate(zip(texts, timings)):
        content += f"{i+1}\n{format_srt_time(start)} --> {format_srt_time(end)}\n{text}\n\n"
    
    Path(output_path).write_text(content, encoding="utf-8")
    print(f"✅ SRT: {output_path}")
    return str(output_path)


def get_duration(filepath):
    """FFmpeg ile dosya süresini al."""
    cmd = [FFMPEG, "-i", str(filepath), "-f", "null", "-"]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    for line in result.stderr.split('\n'):
        if 'Duration:' in line:
            time_str = line.split('Duration:')[1].split(',')[0].strip()
            h, m, s = time_str.split(':')
            return float(h)*3600 + float(m)*60 + float(s)
    return 5.0


def burn_subtitles(video_path, srt_path, output_path, content_type=None):
    """
    İngilizce altyazıyı videoya yak — content type'a göre optimize.
    
    Stil:
    - Modern sans-serif font (Arial Bold)
    - Beyaz text, yarı-saydam siyah arka plan kutusu
    - Alt-orta pozisyon, videoyla orantılı boyut
    - Content type'a göre MarginV ve FontSize ayarlanır
    """
    # SRT yolunu FFmpeg filtresine escape et
    srt_escaped = str(srt_path).replace(":", "\\:").replace("'", "\\'")
    
    # Content type'a göre boyut ve margin ayarla
    ct = CONTENT_TYPES.get(content_type, CONTENT_TYPES[DEFAULT_CONTENT_TYPE])
    # SRT force_style FontSize'ı video çözünürlüğüne göreli olarak ayarlar
    # Dikey (1080x1920): FontSize=8, MarginV=300
    # Yatay (1920x1080): FontSize=6, MarginV=60
    if ct['orientation'] == 'horizontal':
        font_size = 6
        margin_v = 60
    else:
        font_size = 8
        margin_v = 300
    
    style = (
        "FontName=Arial,"
        f"FontSize={font_size},"
        "Bold=1,"
        "PrimaryColour=&H00FFFFFF,"
        "OutlineColour=&H00000000,"
        "BackColour=&H99000000,"
        "BorderStyle=4,"
        "Outline=1,"
        "Shadow=0,"
        f"MarginV={margin_v},"
        "MarginL=15,"
        "MarginR=15,"
        "Alignment=2"
    )
    
    cmd = [
        FFMPEG, "-y",
        "-i", str(video_path),
        "-vf", f"subtitles={srt_escaped}:force_style='{style}'",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-c:a", "copy",
        str(output_path)
    ]
    
    print(f"\n🔤 İngilizce altyazı yakılıyor...")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode == 0:
            size_mb = os.path.getsize(output_path) / (1024*1024)
            print(f"✅ Altyazılı video: {output_path} ({size_mb:.1f} MB)")
            return str(output_path)
        else:
            print(f"❌ FFmpeg hatası:\n{result.stderr[-400:]}")
            return None
    except Exception as e:
        print(f"❌ Hata: {e}")
        return None


def process_project(project_dir, source_lang="de"):
    """
    Proje için tam altyazı pipeline'ı:
    1. scenes.json oku
    2. Metinleri İngilizce'ye çevir
    3. SRT oluştur (timing otomatik hesapla)
    4. Videoya yak
    
    Args:
        project_dir: proje klasörü yolu
        source_lang: ses dili ("de", "tr")
    """
    project = Path(project_dir)
    scenes_file = project / "scenes" / "scenes.json"
    draft_video = project / "draft" / next(
        (f.name for f in (project / "draft").iterdir() if f.suffix == ".mp4"),
        "draft.mp4"
    )
    
    if not scenes_file.exists():
        print(f"❌ scenes.json bulunamadı: {scenes_file}")
        return None
    if not draft_video.exists():
        print(f"❌ Draft video bulunamadı: {draft_video}")
        return None
    
    # Sahneleri oku
    with open(scenes_file) as f:
        scenes = json.load(f)
    
    texts = [s["text"] for s in scenes]
    
    # Çeviri (Almanca → İngilizce)
    if source_lang != "en":
        print(f"\n🌐 {source_lang.upper()} → EN çeviri...")
        en_texts = translate_to_english(texts, source_lang=source_lang)
    else:
        en_texts = texts
    
    # Timing hesapla — proje ses dosyalarından veya scenes.json'dan
    audio_dir = project / "audio"  # Pipeline formatı: projects/{id}/audio/scene_01.mp3
    project_name = project.name.split("_", 1)[1] if "_" in project.name else project.name
    
    # İçerik türünü brief.md'den oku
    content_type = None
    brief_path = project / "brief.md"
    if brief_path.exists():
        brief_text = brief_path.read_text(encoding="utf-8")
        for line in brief_text.split("\n"):
            stripped = line.strip()
            for marker in ["İçerik türü:", "içerik türü:", "content type:", "tür:"]:
                if marker.lower() in stripped.lower() or marker in stripped:
                    val = stripped.split(":", 1)[1].strip().lower()
                    if val in CONTENT_TYPES:
                        content_type = val
                    break
    
    timings = []
    current_time = 0.2  # İlk sahne için küçük gecikme
    
    for i, scene in enumerate(scenes, 1):
        # Önce proje audio dizininde ara (pipeline formatı)
        audio_file = audio_dir / f"scene_{i:02d}.mp3"
        if not audio_file.exists():
            # Fallback: eski _voices format
            legacy_dir = BASE_DIR / "_voices" / source_lang
            audio_file = legacy_dir / f"Molo_{source_lang}_{project_name}_s{i:02d}.mp3"
        
        if audio_file.exists():
            dur = get_duration(audio_file)
        else:
            dur = scene.get("end", 5.0) - scene.get("start", 0.0)
        
        end = current_time + dur
        timings.append((current_time, end - 0.2))
        current_time = end + 0.3  # 0.3s geçiş payı
    
    # SRT oluştur
    subs_dir = project / "subtitles"
    subs_dir.mkdir(exist_ok=True)
    srt_path = subs_dir / "subs_en.srt"
    create_srt(en_texts, timings, srt_path)
    
    # Videoya yak
    final_dir = project / "final"
    final_dir.mkdir(exist_ok=True)
    final_name = f"{project_name}_final.mp4"
    final_path = final_dir / final_name
    
    return burn_subtitles(draft_video, srt_path, final_path, content_type=content_type)


# ─── CLI ───
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Molo Altyazı — Tek Dil (Çeviri)")
    parser.add_argument("--project", type=str, help="Proje klasörü yolu")
    parser.add_argument("--video", type=str, help="Video dosyası (tek dosya modu)")
    parser.add_argument("--scenes-file", type=str, help="scenes.json yolu")
    parser.add_argument("--lang", type=str, default="de", help="Ses dili (de/tr)")
    parser.add_argument("--output", type=str, help="Çıktı video yolu")
    parser.add_argument("--srt-only", action="store_true", help="Sadece SRT oluştur")
    
    args = parser.parse_args()
    
    if args.project:
        # Proje modu — otomatik pipeline
        result = process_project(args.project, source_lang=args.lang)
        if result:
            print(f"\n🎬 Final video hazır: {result}")
    elif args.video and args.scenes_file:
        # Tek dosya modu
        with open(args.scenes_file) as f:
            scenes = json.load(f)
        
        texts = [s["text"] for s in scenes]
        en_texts = translate_to_english(texts, source_lang=args.lang) if args.lang != "en" else texts
        
        timings = []
        for s in scenes:
            timings.append((s.get("start", 0), s.get("end", 5)))
        
        srt_path = "/tmp/molo_subs_en.srt"
        create_srt(en_texts, timings, srt_path)
        
        if not args.srt_only:
            output = args.output or "/tmp/molo_subtitled.mp4"
            burn_subtitles(args.video, srt_path, output)
    else:
        parser.print_help()
