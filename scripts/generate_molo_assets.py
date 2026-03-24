#!/usr/bin/env python3
"""
Molo Studio UI asset'leri — Nano Banana 2 ile gerçek Molo referansından üretim.
Kullanım: python3 scripts/generate_molo_assets.py
"""

import os
import sys
import io
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from google import genai
from google.genai import types as gtypes
from config import REFERENCE_DIR, CHARACTER_LOCK_IMAGE

OUTPUT_DIR = Path(__file__).parent.parent / "studio" / "public" / "molo"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Referans görsel
MOLO_REF = REFERENCE_DIR / "ref-front-studio.png"

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

ref_data = open(MOLO_REF, "rb").read()
ref_part = gtypes.Part.from_bytes(data=ref_data, mime_type="image/png")

ASSETS = {
    "molo-peek": {
        "prompt": f"""{CHARACTER_LOCK_IMAGE}

Generate MOLO peeking from behind something — only the top half of the body visible (head, visor, eyes, hologram).
As if MOLO is hiding behind a wall or surface and curiously peeking over.
Expression: curious, playful, slightly mischievous — one eye slightly squinted.
Background: completely transparent / pure white (#FFFFFF).
Style: Same 3D render quality as reference. Clean, crisp edges.
Square format, 512x512px.
DO NOT add any other elements, text, or props.""",
        "size": (512, 512),
    },
    "molo-wave": {
        "prompt": f"""{CHARACTER_LOCK_IMAGE}

Generate MOLO in a friendly waving pose — one arm raised in a small, elegant wave gesture.
Full body visible, front-facing, direct eye contact.
Expression: warm, happy, welcoming — eyes are half-circle (happy eyes).
The hologram on top is glowing softly.
Background: completely transparent / pure white (#FFFFFF).
Style: Same 3D render quality as reference. Clean, crisp edges.
Square format, 512x512px.
DO NOT add any other elements, text, or props.""",
        "size": (512, 512),
    },
    "molo-thinking": {
        "prompt": f"""{CHARACTER_LOCK_IMAGE}

Generate MOLO in a thinking pose — one arm raised with hand near chin area, as if pondering.
Full body visible, front-facing, slightly tilted head.
Expression: thoughtful, curious — one eye slightly narrower, mouth flat/neutral.
A small "..." or thought bubble effect near the hologram (subtle).
Background: completely transparent / pure white (#FFFFFF).
Style: Same 3D render quality as reference. Clean, crisp edges.
Square format, 512x512px.
DO NOT add any other elements, text, or props.""",
        "size": (512, 512),
    },
    "molo-proud": {
        "prompt": f"""{CHARACTER_LOCK_IMAGE}

Generate MOLO in a proud, confident pose — chest puffed slightly, hands on hips or arms crossed.
Full body visible, front-facing, direct eye contact.
Expression: proud, smug, slightly mischievous — eyes half-closed (confident look), wide smile.
The hologram is glowing brighter than usual.
Background: completely transparent / pure white (#FFFFFF).
Style: Same 3D render quality as reference. Clean, crisp edges.
Square format, 512x512px.
DO NOT add any other elements, text, or props.""",
        "size": (512, 512),
    },
    "molo-surprised": {
        "prompt": f"""{CHARACTER_LOCK_IMAGE}

Generate MOLO with a surprised expression — eyes wider than normal (but still round!), mouth in a small "O" shape.
Full body visible, front-facing, slight lean back as if startled.
A small "!" near the hologram (subtle).
Background: completely transparent / pure white (#FFFFFF).
Style: Same 3D render quality as reference. Clean, crisp edges.
Square format, 512x512px.
DO NOT add any other elements, text, or props.""",
        "size": (512, 512),
    },
    "molo-worried": {
        "prompt": f"""{CHARACTER_LOCK_IMAGE}

Generate MOLO looking slightly worried or concerned — eyebrows (if any light lines) slightly drooped.
Full body visible, front-facing, slight head tilt.
Expression: worried but gentle — mouth slightly curved downward, eyes looking up.
Background: completely transparent / pure white (#FFFFFF).
Style: Same 3D render quality as reference. Clean, crisp edges.
Square format, 512x512px.
DO NOT add any other elements, text, or props.""",
        "size": (512, 512),
    },
    "molo-float": {
        "prompt": f"""{CHARACTER_LOCK_IMAGE}

Generate MOLO floating in space — full body, slightly rotated (very subtle 5-degree tilt).
The hologram on top is actively projecting a soft cyan glow upward.
A subtle shadow/reflection below as if floating above a surface.
Expression: calm, content, slightly dreamy.
Background: completely transparent / pure white (#FFFFFF).
Style: Same 3D render quality as reference. Clean, crisp edges, premium.
Vertical format, 400x560px.
DO NOT add any other elements, text, or props.""",
        "size": (400, 560),
    },
    "molo-loading": {
        "prompt": f"""{CHARACTER_LOCK_IMAGE}

Generate MOLO in a dynamic, energetic pose — slight forward lean, as if ready to go.
The hologram on top is pulsing/glowing with extra energy — bright cyan rings around it.
Full body visible, front-facing, direct eye contact.
Expression: alert, focused, slightly excited — eyes bright.
Background: completely transparent / pure white (#FFFFFF).
Style: Same 3D render quality as reference. Clean, crisp edges.
Square format, 256x256px. Small icon size.
DO NOT add any other elements, text, or props.""",
        "size": (256, 256),
    },
}


def generate_asset(name: str, spec: dict) -> bool:
    """Tek bir asset üret."""
    output_path = OUTPUT_DIR / f"{name}.png"
    print(f"\n{'='*50}")
    print(f"🎨 Üretiliyor: {name}")
    print(f"   Boyut: {spec['size']}")

    try:
        response = client.models.generate_content(
            model="gemini-3.1-flash-image-preview",
            contents=[spec["prompt"], ref_part],
            config=gtypes.GenerateContentConfig(
                response_modalities=["IMAGE", "TEXT"],
            ),
        )

        for part in response.candidates[0].content.parts:
            if hasattr(part, "inline_data") and part.inline_data:
                img = Image.open(io.BytesIO(part.inline_data.data))
                img = img.resize(spec["size"], Image.LANCZOS)
                img.save(str(output_path), "PNG")
                print(f"   ✅ Kaydedildi: {output_path}")
                return True

        print(f"   ❌ Görsel üretilemedi — metin yanıtı geldi")
        return False

    except Exception as e:
        print(f"   ❌ Hata: {e}")
        return False


def main():
    print("🤖 Molo Studio UI Asset Üretimi")
    print(f"   Referans: {MOLO_REF}")
    print(f"   Çıktı: {OUTPUT_DIR}")
    print(f"   Model: gemini-2.0-flash-exp (Nano Banana 2)")
    print(f"   Asset sayısı: {len(ASSETS)}")

    results = {}
    for name, spec in ASSETS.items():
        results[name] = generate_asset(name, spec)

    print(f"\n{'='*50}")
    print("📊 Sonuçlar:")
    for name, ok in results.items():
        status = "✅" if ok else "❌"
        print(f"   {status} {name}")

    success = sum(1 for v in results.values() if v)
    print(f"\n   {success}/{len(ASSETS)} başarılı")


if __name__ == "__main__":
    main()
