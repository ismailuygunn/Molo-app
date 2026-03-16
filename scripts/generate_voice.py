"""
Molo İçerik Üretim Sistemi — ElevenLabs Ses Üretici
Sahne bazlı TTS üretimi, maliyet koruması ile.
"""

import os
import json
import sys
from pathlib import Path
from datetime import datetime

# Load environment
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

try:
    from elevenlabs import ElevenLabs
except ImportError:
    print("❌ 'elevenlabs' paketi yüklü değil. Yüklemek için:")
    print("   pip install elevenlabs python-dotenv")
    sys.exit(1)

# ─── Merkezi config'den import ───
from config import (
    BASE_DIR, VOICES_DIR, ERROR_LOG,
    ELEVENLABS_MODEL, VOICE_PRESETS, VOICE_DEFAULT, VOICE_PROFILES
)

VOICES = VOICE_PROFILES


def get_client():
    """ElevenLabs client oluştur."""
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        print("❌ ELEVENLABS_API_KEY .env dosyasında bulunamadı!")
        sys.exit(1)
    return ElevenLabs(api_key=api_key)


def find_voice_id(client, voice_name):
    """Ses profili ID'sini bul."""
    voices = client.voices.get_all()
    for voice in voices.voices:
        if voice.name == voice_name:
            return voice.voice_id
    return None


def validate_text(text, scene_num):
    """Metin validasyonu — API çağrısından ÖNCE kontrol."""
    errors = []
    
    if len(text) > 500:
        errors.append(f"⚠️ Sahne {scene_num}: Metin çok uzun ({len(text)} karakter). Max 250 önerilir.")
    
    if "..." in text:
        errors.append(f"⚠️ Sahne {scene_num}: '...' kullanma! Virgül veya nokta kullan.")
    
    if text.count("!") > 3:
        errors.append(f"⚠️ Sahne {scene_num}: Çok fazla ünlem. Tonlama bozulabilir.")
    
    if not text.strip():
        errors.append(f"❌ Sahne {scene_num}: Boş metin!")
    
    return errors


def log_error(tool, prompt, expected, actual, solution):
    """Hata günlüğüne yaz."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    entry = f"""
### ❌ ElevenLabs Ses Hatası
- **Tarih:** {timestamp}
- **Araç:** {tool}
- **Prompt/Girdi:** `{prompt[:100]}...`
- **Beklenen:** {expected}
- **Gerçekleşen:** {actual}
- **Çözüm:** {solution}
- **Durum:** 🔄 Açık
"""
    with open(ERROR_LOG, "a") as f:
        f.write(entry)
    print(f"📝 Hata günlüğüne kaydedildi: {ERROR_LOG}")


def generate_voice(scenes, lang="de", project_name=None, dry_run=False):
    """
    Sahne bazlı ses üretimi.
    
    Args:
        scenes: list of dict — [{"scene": 1, "text": "Hallo!", "emotion": "happy"}, ...]
        lang: "de", "tr", "en"
        project_name: proje adı (dosya isimlendirme için)
        dry_run: True ise sadece validasyon yapar, API çağırmaz
    
    Returns:
        list of file paths
    """
    # ── Validasyon (ücretsiz) ──
    print(f"\n{'='*50}")
    print(f"🔍 VALIDASYON — {len(scenes)} sahne, dil: {lang}")
    print(f"{'='*50}\n")
    
    all_errors = []
    for scene in scenes:
        errors = validate_text(scene["text"], scene["scene"])
        all_errors.extend(errors)
        print(f"  Sahne {scene['scene']}: \"{scene['text'][:60]}...\" ✅" if not errors 
              else f"  Sahne {scene['scene']}: {'; '.join(errors)}")
    
    if all_errors:
        print(f"\n⚠️ {len(all_errors)} uyarı bulundu. Düzeltin ve tekrar deneyin.")
        if any("❌" in e for e in all_errors):
            print("❌ Kritik hata var, devam edilemiyor!")
            return []
    
    if dry_run:
        print("\n🏁 DRY RUN tamamlandı. API çağrısı yapılmadı. Token harcanmadı.")
        return []
    
    # ── Onay iste ──
    print(f"\n💰 API çağrısı yapılacak: {len(scenes)} ses dosyası")
    confirm = input("Devam etmek istiyor musunuz? (e/h): ").strip().lower()
    if confirm != "e":
        print("❌ İptal edildi.")
        return []
    
    # ── API çağrısı ──
    client = get_client()
    voice_name = VOICES.get(lang)
    if not voice_name:
        print(f"❌ Bilinmeyen dil: {lang}")
        return []
    
    voice_id = find_voice_id(client, voice_name)
    if not voice_id:
        print(f"❌ Ses profili bulunamadı: {voice_name}")
        print("Mevcut profiller:")
        voices = client.voices.get_all()
        for v in voices.voices:
            print(f"  - {v.name} ({v.voice_id})")
        return []
    
    output_dir = VOICES_DIR / lang
    output_dir.mkdir(parents=True, exist_ok=True)
    
    generated_files = []
    project_tag = project_name or datetime.now().strftime("%Y%m%d")
    
    for scene in scenes:
        scene_num = scene["scene"]
        filename = f"Molo_{lang}_{project_tag}_s{scene_num:02d}.mp3"
        output_path = output_dir / filename
        
        print(f"\n🎙️ Sahne {scene_num} üretiliyor...")
        
        try:
            # Sahne bazlı ses yönlendirmesi
            vd = scene.get("voice_direction", {})
            if isinstance(vd, str):
                # Preset adı ("energetic", "warm", vb.)
                settings = VOICE_PRESETS.get(vd, VOICE_DEFAULT).copy()
                print(f"  🎭 Ses yönlendirmesi: {vd} (stability={settings['stability']}, style={settings['style']})")
            elif isinstance(vd, dict) and vd:
                # Özel değerler
                settings = {
                    "stability": vd.get("stability", VOICE_DEFAULT["stability"]),
                    "similarity_boost": vd.get("similarity_boost", VOICE_DEFAULT["similarity_boost"]),
                    "style": vd.get("style", VOICE_DEFAULT["style"]),
                }
                note = vd.get("note", "")
                print(f"  🎭 Ses yönlendirmesi: özel (stability={settings['stability']}, style={settings['style']}) {note}")
            else:
                settings = VOICE_DEFAULT.copy()
            
            audio = client.text_to_speech.convert(
                voice_id=voice_id,
                text=scene["text"],
                model_id=ELEVENLABS_MODEL,
                voice_settings=settings
            )
            
            # Audio generator'dan bytes'a çevir
            audio_bytes = b""
            for chunk in audio:
                audio_bytes += chunk
            
            with open(output_path, "wb") as f:
                f.write(audio_bytes)
            
            print(f"  ✅ {filename} ({len(audio_bytes)} bytes)")
            generated_files.append(str(output_path))
            
        except Exception as e:
            error_msg = str(e)
            print(f"  ❌ Hata: {error_msg}")
            log_error(
                tool="ElevenLabs",
                prompt=scene["text"],
                expected=f"Sahne {scene_num} ses dosyası",
                actual=f"Hata: {error_msg}",
                solution="Kontrol edilmeli"
            )
    
    print(f"\n{'='*50}")
    print(f"✅ Tamamlandı: {len(generated_files)}/{len(scenes)} dosya üretildi")
    print(f"📁 Konum: {output_dir}")
    print(f"{'='*50}")
    
    return generated_files


# ─── CLI Modu ───
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Molo ElevenLabs Ses Üretici")
    parser.add_argument("--scenes-file", type=str, help="Sahne JSON dosyası yolu")
    parser.add_argument("--lang", type=str, default="de", choices=["de", "tr", "en"])
    parser.add_argument("--project", type=str, help="Proje adı")
    parser.add_argument("--dry-run", action="store_true", help="Sadece validasyon, API çağrısı yok")
    parser.add_argument("--text", type=str, help="Tek sahne için hızlı metin")
    
    args = parser.parse_args()
    
    if args.text:
        scenes = [{"scene": 1, "text": args.text}]
    elif args.scenes_file:
        with open(args.scenes_file) as f:
            scenes = json.load(f)
    else:
        # Demo
        scenes = [
            {"scene": 1, "text": "Hallo! Ich bin Molo, euer Zahnfreund bei Istadental."},
            {"scene": 2, "text": "Heute zeige ich euch, wie ihr eure Zähne richtig pflegt."},
            {"scene": 3, "text": "Bis bald, euer Molo!"},
        ]
    
    generate_voice(scenes, lang=args.lang, project_name=args.project, dry_run=args.dry_run)
