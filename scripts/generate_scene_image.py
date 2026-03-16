"""
Molo İçerik Üretim Sistemi — Sahne Görseli Oluşturucu
Gemini API ile sahne ortamına göre başlangıç görseli üretir.

Ortam tipleri:
  - studio:  Doğrudan referans görseli kullan (varsayılan koyu stüdyo ortam)
  - clinic:  Klinik fotoğrafı + Molo referansı → Gemini ile birleştir
  - outdoor: Molo referansı + mekan açıklaması → Gemini ile oluştur
  - custom:  Kullanıcının sağladığı görseli kullan

⚠️ KESİN KURAL: Klinik sahnelerinde MUTLAKA _reference/clinic-photo.JPG kullanılır.
   Asla sıfırdan klinik görseli üretilmez veya harici kaynak kullanılmaz.
"""

import os
import sys
import json
import base64
import shutil
import subprocess
from pathlib import Path
from datetime import datetime

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("❌ google-genai paketi yüklü değil!")
    print("   pip3 install google-genai")
    genai = None

# ─── Merkezi config'den import ───
from config import (
    BASE_DIR, REFERENCE_DIR, FFMPEG,
    GEMINI_IMAGE_MODEL, OUTPUT_WIDTH, OUTPUT_HEIGHT,
    ENVIRONMENT_IMAGES, MOLO_POSES, get_normalize_filter,
    CONTENT_TYPES, DEFAULT_CONTENT_TYPE
)


def _format_line(content_type):
    """Content type'a göre format satırı döndür."""
    ct = CONTENT_TYPES.get(content_type, CONTENT_TYPES[DEFAULT_CONTENT_TYPE])
    w, h = ct["width"], ct["height"]
    aspect = ct["aspect"]
    orient = "Horizontal" if ct["orientation"] == "horizontal" else "Vertical"
    return f"Format: {orient} {aspect} composition ({w}x{h})"

# ─── Gemini sahne üretim promptları ───
SCENE_PROMPTS = {
    "clinic": """You are given two images:
1. A real dental clinic interior photo (the environment)
2. A 3D robotic mascot character named "Molo" (the character)

Generate a NEW high-quality image that places Molo INSIDE this exact dental clinic.
Molo should be standing on the clinic floor, facing the camera, in the foreground.
The clinic environment behind Molo should look exactly like the provided clinic photo.

CRITICAL RULES:
- Molo must look EXACTLY like the reference: tooth-shaped body, royal blue & white colors,
  "ISTADENTAL" text on chest, dark visor with blue glowing eyes, holographic cone on top
- Molo must be proportionally sized (about 1 meter tall relative to the clinic)
- The clinic background must match the provided photo — same furniture, colors, lighting
- Molo should have a small, friendly wave pose
- Style: Photorealistic composite, the 3D character placed naturally in the real clinic
- Lighting on Molo should match the clinic's lighting direction
- {format_line}
- Camera: Eye-level, medium shot, Molo centered""",

    "studio": """You are given a reference image of a 3D robotic mascot character named "Molo".

Generate a NEW high-quality scene image of Molo in a dark atmospheric studio environment.

CRITICAL RULES:
- Molo must look EXACTLY like the reference: tooth-shaped molar body, royal blue (#2B5EA7)
  and white colors, "ISTADENTAL" text on the white chest panel, dark translucent visor with
  two glowing cyan-blue eyes and a gentle LED smile, holographic inverted-cone projector on
  top emitting cyan-blue glow, short blue robotic arms with 3-fingered hands, two tooth-root legs
- The hologram cone on top MUST be open and glowing with bright cyan-blue light
- Molo stands on a highly reflective dark surface (mirror-like black floor)
- Background: Dark atmospheric environment with deep blue volumetric fog and subtle particle effects
- Dramatic rim lighting from behind creates blue edge highlights on Molo's body
- A cool cyan glow emanates from the hologram cone, casting light upward
- Style: 3D photorealistic render, Pixar-quality, cinematic
- {format_line}
- Camera: Eye-level, medium shot, Molo centered, shallow depth of field""",

    "outdoor": """You are given a reference image of a 3D robotic mascot character named "Molo".

Generate a NEW high-quality image placing Molo in this outdoor location: {location}

Molo should be standing at the location, facing the camera, in a natural composition.

CRITICAL RULES:
- Molo must look EXACTLY like the reference: tooth-shaped body, royal blue & white colors,
  "ISTADENTAL" text on chest, dark visor with blue glowing eyes, holographic cone on top
- The outdoor environment should be recognizable as {location}
- Molo should be proportionally sized relative to the surroundings
- Style: Photorealistic composite, 3D character in real environment
- {format_line}
- Camera: Eye-level or slight low angle, medium shot, Molo centered
- Time of day: Golden hour / pleasant lighting""",
}


def init_gemini():
    """Gemini API client başlat (görsel üretim modeli)."""
    if genai is None:
        print("❌ google-genai paketi yüklü değil!")
        return None
    
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("❌ GOOGLE_API_KEY .env'de bulunamadı!")
        return None
    
    return genai.Client(api_key=api_key)


def load_image_for_gemini(image_path):
    """Görseli Gemini API için Part olarak yükle."""
    with open(image_path, "rb") as f:
        data = f.read()
    
    ext = Path(image_path).suffix.lower()
    mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}
    mime_type = mime_map.get(ext, "image/jpeg")
    
    return types.Part.from_bytes(data=data, mime_type=mime_type)


def generate_scene_image(environment, reference_image, output_path,
                         environment_detail=None, custom_prompt=None,
                         content_type=None):
    """
    Sahne ortamına göre başlangıç görseli oluştur.
    
    Args:
        environment: "studio" | "clinic" | "outdoor:istanbul" | "custom"
        reference_image: Molo referans görseli adı (ör: "front-wave.jpg") veya tam yol
        output_path: Üretilen görselin kaydedileceği yol
        environment_detail: Ek mekan detayı (ör: "istiklal caddesi")
        custom_prompt: Özel prompt (environment="custom" için)
        content_type: "sosyal" | "ekran" | "robot" — boyut/oryantasyonu belirler
    
    Returns:
        str: Üretilen görsel dosya yolu veya None
    """
    # Referans görseli çöz
    if Path(reference_image).exists():
        ref_path = Path(reference_image)
    else:
        ref_path = REFERENCE_DIR / reference_image
        if not ref_path.exists():
            # Poz adı olarak dene
            ref_path = MOLO_POSES.get(reference_image)
            if not ref_path or not ref_path.exists():
                print(f"❌ Referans görseli bulunamadı: {reference_image}")
                return None
    
    # Ortam tipine göre işle
    env_type = environment.split(":")[0] if ":" in environment else environment
    
    # ⚠️ KURAL: Studio sahnelerinde de referans görselden yeni sahne üretilir (kopyalama yok!)
    # Tüm sahne tipleri Gemini üzerinden geçer.
    
    # ── CUSTOM: Kullanıcının sağladığı görseli kullan ──
    if env_type == "custom" and environment_detail:
        custom_path = Path(environment_detail)
        if custom_path.exists():
            print(f"🎬 Custom görsel kullanılıyor: {custom_path.name}")
            shutil.copy2(custom_path, output_path)
            return str(output_path)
        else:
            print(f"❌ Custom görsel bulunamadı: {environment_detail}")
            return None
    
    # ── CLINIC / STUDIO / OUTDOOR: Gemini ile oluştur ──
    client = init_gemini()
    if client is None:
        return None
    
    if env_type == "clinic":
        # ⚠️ KESİN KURAL: Klinik görseli _reference/clinic-photo.JPG'den alınır
        clinic_path = ENVIRONMENT_IMAGES["clinic"]
        if not clinic_path.exists():
            print(f"❌ Klinik fotoğrafı bulunamadı: {clinic_path}")
            return None
        
        print(f"🏥 Klinik sahnesi oluşturuluyor...")
        print(f"   📷 Klinik: {clinic_path.name}")
        print(f"   🤖 Molo: {ref_path.name}")
        
        clinic_img = load_image_for_gemini(clinic_path)
        molo_img = load_image_for_gemini(ref_path)
        prompt = SCENE_PROMPTS["clinic"].format(format_line=_format_line(content_type))
        
        if environment_detail:
            prompt += f"\n\nAdditional context: {environment_detail}"
        
        contents = [prompt, clinic_img, molo_img]
        
    elif env_type == "studio":
        print(f"🎬 Studio sahnesi oluşturuluyor (Gemini ile yeni görsel)...")
        print(f"   🤖 Molo: {ref_path.name}")
        
        molo_img = load_image_for_gemini(ref_path)
        prompt = SCENE_PROMPTS["studio"].format(format_line=_format_line(content_type))
        
        if environment_detail:
            prompt += f"\n\nAdditional scene context: {environment_detail}"
        
        contents = [prompt, molo_img]
        
    elif env_type == "outdoor":
        location = environment_detail or environment.split(":", 1)[1] if ":" in environment else "a city street"
        
        print(f"🌆 Outdoor sahne oluşturuluyor: {location}")
        print(f"   🤖 Molo: {ref_path.name}")
        
        molo_img = load_image_for_gemini(ref_path)
        prompt = SCENE_PROMPTS["outdoor"].format(location=location, format_line=_format_line(content_type))
        
        contents = [prompt, molo_img]
    else:
        print(f"❌ Bilinmeyen ortam tipi: {environment}")
        return None
    
    # Gemini'ye gönder (response_modalities ile görsel çıktı iste)
    try:
        print(f"   🧠 Gemini görsel üretimi...")
        response = client.models.generate_content(
            model=GEMINI_IMAGE_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE", "TEXT"],
            )
        )
        
        # Sonucu kaydet — inline_data içinde görsel gelir
        if response.candidates and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if part.inline_data:
                    img_data = part.inline_data.data
                    mime = part.inline_data.mime_type or "image/png"
                    ext = ".png" if "png" in mime else ".jpg"
                    raw_path = str(output_path).rsplit('.', 1)[0] + "_raw" + ext
                    final_path = str(output_path).rsplit('.', 1)[0] + ext
                    with open(raw_path, "wb") as f:
                        f.write(img_data)
                    
                    # Normalize to correct dimensions for content type
                    ct = CONTENT_TYPES.get(content_type, CONTENT_TYPES[DEFAULT_CONTENT_TYPE])
                    target_w, target_h = ct["width"], ct["height"]
                    norm_cmd = [
                        FFMPEG, "-y", "-i", raw_path,
                        "-vf", get_normalize_filter(content_type=content_type),
                        final_path
                    ]
                    r = subprocess.run(norm_cmd, capture_output=True, text=True)
                    if r.returncode == 0:
                        os.remove(raw_path)
                        print(f"   ✅ Sahne görseli kaydedildi: {final_path} ({target_w}x{target_h})")
                    else:
                        # Resize başarısız → ham görseli kullan
                        shutil.move(raw_path, final_path)
                        print(f"   ⚠️ Resize yapılamadı, ham görsel kullanılıyor: {final_path}")
                    return final_path
        
        print(f"   ❌ Gemini yanıtında görsel bulunamadı")
        try:
            if response.text:
                print(f"   Yanıt: {response.text[:200]}")
        except:
            pass
        return None
        
    except Exception as e:
        print(f"   ❌ Gemini hatası: {e}")
        return None


# ─── CLI ───
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Molo Sahne Görseli Oluşturucu")
    parser.add_argument("--environment", "-e", type=str, required=True,
                        help="Ortam tipi: studio, clinic, outdoor:istanbul, custom")
    parser.add_argument("--reference", "-r", type=str, default="front-wave.jpg",
                        help="Molo referans görseli adı veya yolu")
    parser.add_argument("--output", "-o", type=str, required=True,
                        help="Çıktı dosya yolu")
    parser.add_argument("--detail", "-d", type=str, default=None,
                        help="Ek ortam detayı (ör: 'istiklal caddesi')")
    
    args = parser.parse_args()
    
    result = generate_scene_image(
        environment=args.environment,
        reference_image=args.reference,
        output_path=args.output,
        environment_detail=args.detail,
        content_type=getattr(args, 'content_type', None)
    )
    
    if result:
        print(f"\n✅ Başarılı: {result}")
    else:
        print(f"\n❌ Sahne görseli oluşturulamadı!")
        sys.exit(1)
