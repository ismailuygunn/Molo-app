"""
Molo İçerik Üretim Sistemi — Video Üretici (Kling API)
Referans görsel + prompt ile karakter-tutarlı video üretimi.
"""

import os
import sys
import json
import time
import jwt
import base64
import subprocess
import requests
from pathlib import Path
from datetime import datetime

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

# ─── Merkezi config'den import ───
from config import (
    BASE_DIR, REFERENCE_DIR, VIDEOS_DIR, ERROR_LOG, FFMPEG,
    KLING_MODEL, KLING_API_BASE, KLING_DURATION, OUTPUT_ASPECT,
    OUTPUT_WIDTH, OUTPUT_HEIGHT, OUTPUT_FPS,
    CHARACTER_RULES, get_normalize_filter
)


def get_kling_token():
    """Kling API JWT token oluştur."""
    access_key = os.getenv("KLING_API_ACCESS")
    secret_key = os.getenv("KLING_API_SECRET")
    
    if not access_key or not secret_key:
        print("❌ KLING_API_ACCESS veya KLING_API_SECRET .env'de bulunamadı!")
        sys.exit(1)
    
    now = int(time.time())
    payload = {
        "iss": access_key,
        "exp": now + 1800,  # 30 dakika
        "nbf": now - 5,
    }
    
    token = jwt.encode(payload, secret_key, algorithm="HS256",
                       headers={"alg": "HS256", "typ": "JWT"})
    return token


def validate_prompt(prompt, scene_num):
    """Prompt validasyonu — API çağrısından ÖNCE."""
    errors = []
    warnings = []
    
    forbidden = ["dances", "runs fast", "morphs", "cartoon style", "stretches", "bends"]
    for word in forbidden:
        if word.lower() in prompt.lower():
            errors.append(f"❌ Sahne {scene_num}: Yasak ifade bulundu: '{word}'")
    
    if "robotic" not in prompt.lower() and "stiff" not in prompt.lower():
        warnings.append(f"⚠️ Sahne {scene_num}: 'robotic' veya 'stiff' hareket kuralı eksik")
    
    if "ISTADENTAL" not in prompt and "istadental" not in prompt.lower():
        warnings.append(f"⚠️ Sahne {scene_num}: ISTADENTAL logosu prompt'ta belirtilmemiş")
    
    if len(prompt) < 50:
        warnings.append(f"⚠️ Sahne {scene_num}: Prompt çok kısa, detay ekle")
    
    return errors, warnings


def log_error(prompt, expected, actual, solution="Kontrol edilmeli"):
    """Hata günlüğüne yaz."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    entry = f"""
### ❌ Kling Video Hatası
- **Tarih:** {timestamp}
- **Araç:** Kling API
- **Prompt/Girdi:** `{prompt[:150]}...`
- **Beklenen:** {expected}
- **Gerçekleşen:** {actual}
- **Çözüm:** {solution}
- **Durum:** 🔄 Açık
"""
    with open(ERROR_LOG, "a") as f:
        f.write(entry)


def create_image_to_video(reference_image, scene_prompt, duration="5", 
                          aspect_ratio="9:16", last_frame_image=None, dry_run=False):
    """
    Kling Image-to-Video API ile video üret.
    
    Args:
        reference_image: Referans görsel dosya yolu (İLK KARE)
        scene_prompt: Sahne açıklaması
        duration: "5" veya "10" saniye
        aspect_ratio: "9:16" (dikey) veya "16:9" (yatay)
        last_frame_image: Son kare görseli (opsiyonel, sahne geçişleri için)
        dry_run: True ise validasyon + preview, API çağırmaz
    
    Returns:
        task_id (str) veya None
    """
    orientation = "Horizontal" if aspect_ratio == "16:9" else "Vertical"
    full_prompt = f"{CHARACTER_RULES}\n\n{scene_prompt}\n\nFormat: {orientation} {aspect_ratio}, cinematic lighting, dark blue atmospheric background."
    
    # ── Validasyon ──
    errors, warnings = validate_prompt(full_prompt, 1)
    
    print(f"\n{'='*50}")
    print("🔍 PROMPT VALIDASYONU")
    print(f"{'='*50}")
    print(f"\n📝 Prompt ({len(full_prompt)} karakter):")
    print(f"   {scene_prompt[:100]}...")
    print(f"🖼️ Referans: {reference_image}")
    print(f"⏱️ Süre: {duration}s | Format: {aspect_ratio}")
    
    if errors:
        for e in errors:
            print(f"\n{e}")
        print("\n❌ Kritik hata var! Prompt düzeltilmeli.")
        return None
    
    if warnings:
        for w in warnings:
            print(f"\n{w}")
    
    if dry_run:
        print("\n🏁 DRY RUN: Validasyon tamamlandı. API çağrısı yapılmadı.")
        print(f"\n📋 Tam prompt preview:\n{full_prompt}")
        return "DRY_RUN"
    
    # ── Onay ──
    print(f"\n💰 Kling API çağrısı yapılacak ({duration}s video)")
    confirm = input("Devam? (e/h): ").strip().lower()
    if confirm != "e":
        print("❌ İptal.")
        return None
    
    # ── API Çağrısı ──
    token = get_kling_token()
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
    
    # Referans görseli base64'e çevir (Kling API raw base64 bekler, data URI prefix OLMADAN)
    import base64
    with open(reference_image, "rb") as f:
        img_data = base64.b64encode(f.read()).decode("utf-8")
    
    # ⚠️ KESİN KURAL: Model DEĞİŞTİRİLMEZ!
    payload = {
        "model_name": KLING_MODEL,
        "image": img_data,
        "prompt": full_prompt,
        "duration": duration,
        "aspect_ratio": aspect_ratio,
    }
    
    # Son kare (first & last frame özelliği)
    if last_frame_image and os.path.exists(last_frame_image):
        with open(last_frame_image, "rb") as f:
            tail_data = base64.b64encode(f.read()).decode("utf-8")
        payload["image_tail"] = tail_data
        print(f"🔗 Son kare (image_tail): {last_frame_image}")
    
    print("\n🚀 Video üretimi başlatılıyor...")
    
    try:
        resp = requests.post(
            f"{KLING_API_BASE}/v1/videos/image2video",
            headers=headers,
            json=payload,
            timeout=60
        )
        if resp.status_code != 200:
            print(f"❌ API yanıtı ({resp.status_code}): {resp.text[:500]}")
        resp.raise_for_status()
        result = resp.json()
        
        task_id = result.get("data", {}).get("task_id")
        if task_id:
            print(f"✅ Video görevi oluşturuldu: {task_id}")
            print(f"⏳ Video hazırlanıyor... check_video_status('{task_id}') ile kontrol edin")
            return task_id
        else:
            error_msg = json.dumps(result, indent=2)
            print(f"❌ Beklenmeyen yanıt: {error_msg}")
            log_error(scene_prompt, "Video task_id", error_msg)
            return None
            
    except Exception as e:
        error_msg = str(e)
        print(f"❌ API hatası: {error_msg}")
        log_error(scene_prompt, "Video üretimi", error_msg)
        return None


def check_video_status(task_id):
    """Video üretim durumunu kontrol et ve indir."""
    token = get_kling_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        resp = requests.get(
            f"{KLING_API_BASE}/v1/videos/image2video/{task_id}",
            headers=headers,
            timeout=30
        )
        resp.raise_for_status()
        result = resp.json()
        
        data = result.get("data", {})
        status = data.get("task_status", "unknown")
        
        print(f"\n📊 Task: {task_id}")
        print(f"   Durum: {status}")
        
        if status == "succeed":
            videos = data.get("task_result", {}).get("videos", [])
            if videos:
                video_url = videos[0].get("url")
                print(f"   ✅ Video hazır: {video_url}")
                
                # İndir
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"molo_kling_{timestamp}.mp4"
                output_path = VIDEOS_DIR / filename
                
                download = input("İndirmek ister misiniz? (e/h): ").strip().lower()
                if download == "e":
                    print(f"   ⬇️ İndiriliyor...")
                    video_resp = requests.get(video_url, timeout=120)
                    with open(output_path, "wb") as f:
                        f.write(video_resp.content)
                    print(f"   ✅ Kaydedildi: {output_path}")
                    return str(output_path)
        
        elif status == "failed":
            error_msg = data.get("task_status_msg", "Bilinmeyen hata")
            print(f"   ❌ Başarısız: {error_msg}")
            log_error(f"task_id={task_id}", "Video", error_msg)
        
        else:
            print(f"   ⏳ Henüz hazır değil. Birkaç dakika sonra tekrar deneyin.")
        
        return None
        
    except Exception as e:
        print(f"❌ Status kontrol hatası: {e}")
        return None


# ─── CLI Modu ───
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Molo Kling Video Üretici")
    parser.add_argument("--reference", type=str, 
                        default=str(REFERENCE_DIR / "front.jpeg"),
                        help="Referans görsel yolu")
    parser.add_argument("--prompt", type=str, help="Sahne açıklaması")
    parser.add_argument("--duration", type=str, default="5", choices=["5", "10"])
    parser.add_argument("--format", type=str, default="9:16", choices=["9:16", "16:9"])
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--check", type=str, help="Task ID ile durum kontrolü")
    
    args = parser.parse_args()
    
    if args.check:
        check_video_status(args.check)
    elif args.prompt:
        create_image_to_video(
            reference_image=args.reference,
            scene_prompt=args.prompt,
            duration=args.duration,
            aspect_ratio=args.format,
            dry_run=args.dry_run
        )
    else:
        # Demo dry-run
        create_image_to_video(
            reference_image=str(REFERENCE_DIR / "front.jpeg"),
            scene_prompt="Molo stands facing the camera and slowly raises one hand in a gentle wave. The hologram cone on top is open and glowing steadily.",
            dry_run=True
        )
