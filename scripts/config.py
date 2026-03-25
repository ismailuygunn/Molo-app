"""
Molo İçerik Pipeline — Merkezi Konfigürasyon

⚠️ TÜM SABİTLER BURADA TANIMLANIR.
   Diğer scriptler bu dosyadan import eder.
   Bu değerleri değiştirmeden önce tüm ekiple konuşun.
"""

import shutil
from pathlib import Path

# ─── Dizinler ───
BASE_DIR = Path(__file__).parent.parent
REFERENCE_DIR = BASE_DIR / "_reference"
VOICES_DIR = BASE_DIR / "_voices"
VIDEOS_DIR = BASE_DIR / "_videos-raw"
PROJECTS_DIR = BASE_DIR / "projects"
CONFIG_DIR = BASE_DIR / "_config"
ERROR_LOG = CONFIG_DIR / "error-log.md"

# ─── Araçlar ───
FFMPEG = shutil.which("ffmpeg") or "/usr/bin/ffmpeg"

# ─── Video Çıktı Formatı (varsayılan — content type ile override edilir) ───
OUTPUT_WIDTH = 1080
OUTPUT_HEIGHT = 1920
OUTPUT_FPS = 24
OUTPUT_ASPECT = "9:16"

# ─── İçerik Türü Profilleri ───
# Brief'te "İçerik türü: sosyal | ekran | robot" ile seçilir
CONTENT_TYPES = {
    "sosyal": {
        "label": "📱 Sosyal Medya",
        "width": 1080,
        "height": 1920,
        "aspect": "9:16",
        "kling_aspect": "9:16",
        "orientation": "vertical",
        "is_greenscreen": False,
        "subtitle_margin_v": 550,
        "subtitle_fontsize": 42,
        "scene_direction": (
            "Vertical 9:16 social media format. "
            "MOLO centered, front-facing, symmetrical composition. "
            "Lively, scroll-stopping, dynamic."
        ),
        "video_prompt_boost": (
            "Create an eye-catching, lively vertical video. "
            "Dynamic energy, punchy visual rhythm. "
            "The character must command attention within the first second. "
            "Bold, vibrant, high-contrast lighting. "
            "Every frame must feel like an engaging social media moment."
        ),
        "image_rules": (
            "Bold close framing. MOLO fills 60-70% of vertical frame. "
            "Strong eye contact, expressive pose. "
            "Background: dramatic dark studio with blue volumetric fog and rim lighting. "
            "The image must feel like a bold social media visual."
        ),
        "thumbnail": True,
        "thumbnail_w": 1080,
        "thumbnail_h": 1920,
    },
    "ekran": {
        "label": "📺 Klinik Ekranı",
        "width": 1920,
        "height": 1080,
        "aspect": "16:9",
        "kling_aspect": "16:9",
        "orientation": "horizontal",
        "is_greenscreen": False,
        "subtitle_margin_v": 80,
        "subtitle_fontsize": 36,
        "scene_direction": (
            "Horizontal 16:9 wide clinic lobby screen format. "
            "MOLO can be positioned slightly off-center for a cinematic feel. "
            "Use wider framing to show more of the clinic environment. "
            "The character may interact with the environment — looking around, "
            "leaning on furniture, sitting on a dental chair, or waking up from a nap. "
            "Premium, warm, slightly humorous, like a living lobby host."
        ),
        "video_prompt_boost": (
            "Wide cinematic composition for a premium lobby display. "
            "The character should feel naturally integrated into the clinic environment, not floating. "
            "Elegant negative space, balanced framing, soft warm lighting. "
            "The video must feel like a polished brand commercial, calm and editorial. "
            "Camera: stable, no shake, no dramatic zoom. Subtle ambient motion only."
        ),
        "image_rules": (
            "Wide horizontal composition. MOLO occupies 40-50% of frame. "
            "Significant negative space for cinematic feel. "
            "Background: warm premium clinic interior or minimal studio. "
            "The image must feel like a polished campaign still."
        ),
        "thumbnail": False,
        "thumbnail_w": 1920,
        "thumbnail_h": 1080,
    },
    "robot": {
        "label": "🤖 Robot Ekranı (Speedy Pixel)",
        "width": 1080,
        "height": 1920,
        "aspect": "9:16",
        "kling_aspect": "9:16",
        "orientation": "vertical",
        "is_greenscreen": False,
        "subtitle_margin_v": 500,
        "subtitle_fontsize": 46,
        "scene_direction": (
            "Vertical 9:16 robot display format for Saha Robotics Speedy Pixel. "
            "MOLO centered, front-facing, direct eye contact. "
            "Designed to be displayed on a mobile robot screen with speakers. "
            "Warm, welcoming, conversational — like greeting clinic visitors face-to-face. "
            "Close to medium-close framing preferred since robot screen is smaller."
        ),
        "video_prompt_boost": (
            "Close conversational framing optimized for small robot display screen. "
            "Direct eye contact, warm personal presence, slightly robotic charm. "
            "The character should feel like they are talking directly to the viewer. "
            "Intimate, friendly, reliable. Like a gentle host greeting you at the door."
        ),
        "image_rules": (
            "Close-up to medium-close framing. MOLO fills 70-80% of vertical frame. "
            "Strong direct eye contact — must feel personal and intimate. "
            "Background: soft, warm, slightly blurred clinic. "
            "The image must feel welcoming and conversational."
        ),
        "thumbnail": False,
        "thumbnail_w": 1080,
        "thumbnail_h": 1920,
    },
    "greenscreen": {
        "label": "🟢 Green Screen (Dikey)",
        "width": 1080,
        "height": 1920,
        "aspect": "9:16",
        "kling_aspect": "9:16",
        "orientation": "vertical",
        "is_greenscreen": True,
        "subtitle_margin_v": 550,
        "subtitle_fontsize": 42,
        "scene_direction": (
            "Vertical 9:16 green screen studio shoot. "
            "CRITICAL: Background must be a perfectly uniform, solid, bright chroma green (#00B140). "
            "No shadows on the green background. No gradients. No fog. No floor. No props. "
            "MOLO is the only visible element. Green extends to all edges with zero variation. "
            "Professional studio lighting on character only — no light spill on green."
        ),
        "video_prompt_boost": (
            "Chroma key ready professional studio shoot. "
            "Perfectly flat, evenly lit, solid green (#00B140) background filling the ENTIRE frame edge to edge. "
            "MOLO centered, front-facing. Soft key lighting on character, fill light to eliminate all shadows. "
            "No floor reflections. No shadow cast on green surface. No ambient particles. "
            "The green must remain PERFECTLY UNIFORM frame to frame — ready for live chroma key extraction."
        ),
        "image_rules": (
            "MOLO centered on perfectly flat solid chroma green (#00B140) background. "
            "No shadows on background. No gradient. No floor visible. No reflections. No props. "
            "Studio key light from front-left, fill light from front-right. "
            "Character edges must be clean and sharp against the green — no green spill on character. "
            "The background must be pixel-perfect uniform green for chroma key."
        ),
        "thumbnail": False,
        "thumbnail_w": 1080,
        "thumbnail_h": 1920,
    },
    "greenscreen-yatay": {
        "label": "🟢 Green Screen (Yatay)",
        "width": 1920,
        "height": 1080,
        "aspect": "16:9",
        "kling_aspect": "16:9",
        "orientation": "horizontal",
        "is_greenscreen": True,
        "subtitle_margin_v": 80,
        "subtitle_fontsize": 36,
        "scene_direction": (
            "Horizontal 16:9 green screen studio shoot. "
            "CRITICAL: Background must be a perfectly uniform, solid, bright chroma green (#00B140). "
            "No shadows on the green background. No gradients. No fog. No floor. No props. "
            "MOLO can be positioned slightly off-center or left-third for compositing flexibility. "
            "Professional studio lighting on character only — no light spill on green."
        ),
        "video_prompt_boost": (
            "Chroma key ready professional horizontal studio shoot. "
            "Perfectly flat, evenly lit, solid green (#00B140) background filling the ENTIRE frame edge to edge. "
            "MOLO positioned for compositing flexibility. Soft key lighting on character, fill light to eliminate all shadows. "
            "No floor reflections. No shadow cast on green surface. No ambient particles. "
            "The green must remain PERFECTLY UNIFORM frame to frame — ready for live chroma key extraction."
        ),
        "image_rules": (
            "MOLO on perfectly flat solid chroma green (#00B140) background, positioned slightly off-center. "
            "No shadows on background. No gradient. No floor visible. No reflections. No props. "
            "Studio key light from front-left, fill light from front-right. Wide horizontal framing. "
            "Character edges must be clean and sharp against the green — no green spill on character. "
            "The background must be pixel-perfect uniform green for chroma key."
        ),
        "thumbnail": False,
        "thumbnail_w": 1920,
        "thumbnail_h": 1080,
    },
    "greenscreen-kare": {
        "label": "🟢 Green Screen (Kare)",
        "width": 1080,
        "height": 1080,
        "aspect": "1:1",
        "kling_aspect": "1:1",
        "orientation": "square",
        "is_greenscreen": True,
        "subtitle_margin_v": 200,
        "subtitle_fontsize": 38,
        "scene_direction": (
            "Square 1:1 green screen studio shoot. "
            "CRITICAL: Background must be a perfectly uniform, solid, bright chroma green (#00B140). "
            "No shadows on the green background. No gradients. No fog. No floor. No props. "
            "MOLO centered and filling 60-70% of frame. "
            "Professional studio lighting on character only — no light spill on green."
        ),
        "video_prompt_boost": (
            "Chroma key ready professional square studio shoot. "
            "Perfectly flat, evenly lit, solid green (#00B140) background filling the ENTIRE frame edge to edge. "
            "MOLO centered, filling 60-70% of frame. Soft key lighting on character, fill light to eliminate all shadows. "
            "No floor reflections. No shadow cast on green surface. No ambient particles. "
            "The green must remain PERFECTLY UNIFORM frame to frame — ready for live chroma key extraction."
        ),
        "image_rules": (
            "MOLO centered on perfectly flat solid chroma green (#00B140) background, filling 60-70% of square frame. "
            "No shadows on background. No gradient. No floor visible. No reflections. No props. "
            "Studio key light from front-left, fill light from front-right. "
            "Character edges must be clean and sharp against the green — no green spill on character. "
            "The background must be pixel-perfect uniform green for chroma key."
        ),
        "thumbnail": False,
        "thumbnail_w": 1080,
        "thumbnail_h": 1080,
    },
}
DEFAULT_CONTENT_TYPE = "sosyal"

# ─── Model Kilitleri (⚠️ KESİN KURAL: DEĞİŞTİRİLMEZ) ───
KLING_MODEL = "kling-v3"                     # ⚠️ En son model — asla düşürülmez
KLING_API_BASE = "https://api.klingai.com"
KLING_DURATION = "5"
KLING_CFG_SCALE = 0.7                         # Prompt'a bağlılık (0-1, 0.5 default, 0.7 sıkı)
KLING_NEGATIVE_PROMPT = "triangular eyes, angular eyes, eye shape change, eye size change, face morphing, face distortion, asymmetric face, mouth cavity, teeth visible, tongue visible, extra limbs, blurry, low quality, watermark, text overlay, toy-like, bouncing, jittery, flickering, ghost features"
# DEPRECATED: sahne pozisyonu yerine ortam bazli CFG kullanin (asagida)
KLING_CFG_FIRST_LAST = 0.8                    # İlk ve son sahne — karakter tutarlılığı
KLING_CFG_MIDDLE = 0.7                        # Orta sahneler — biraz yaratıcılık

# ─── Ortam Bazli CFG (sahne pozisyonu yerine ortam bazli) ───
KLING_CFG_STUDIO = 0.8      # studio = siki referans takibi
KLING_CFG_CLINIC = 0.75     # klinik = orta
KLING_CFG_EXTERNAL = 0.65   # dis mekan = yaratici ozgurluk
KLING_MAX_PROMPT_CHARS = 2500  # ⚠️ API hard limit

# ─── Görsel Variant Sistemi ───
IMAGE_VARIANTS_COUNT = 2       # Her sahne için üretilecek alternatif görsel sayısı (1-3)

# ─── Molo'suz Sahne Prompt'u ───
ENVIRONMENT_ONLY_PROMPT = """Generate a photorealistic environment scene WITHOUT any character.
The scene should be empty — ready for text overlay or character compositing later.
{env_description}
Style: Clean, well-lit, cinematic. High resolution, crisp edges.
DO NOT include any character, mascot, robot, or person in the scene."""

# ─── Kling Frame Mode ───
KLING_FRAME_MODE_FIRST = "first_frame"   # varsayılan — görsel ilk kare olarak kullanılır
KLING_FRAME_MODE_LAST = "last_frame"     # kullanıcı seçimi — görsel son kare olarak

GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview"  # Nano Banana 2
GEMINI_TEXT_MODEL = "gemini-2.5-flash"                  # Çeviri için

ELEVENLABS_MODEL = "eleven_multilingual_v2"

# ─── ElevenLabs Ses Yönlendirme Preset'leri ───
VOICE_PRESETS = {
    "energetic":   {"stability": 0.30, "similarity_boost": 0.80, "style": 0.70, "speed": 1.05},
    "warm":        {"stability": 0.45, "similarity_boost": 0.80, "style": 0.55, "speed": 0.95},
    "informative": {"stability": 0.55, "similarity_boost": 0.75, "style": 0.35, "speed": 1.00},
    "excited":     {"stability": 0.25, "similarity_boost": 0.85, "style": 0.80, "speed": 1.10},
    "calm":        {"stability": 0.65, "similarity_boost": 0.75, "style": 0.25, "speed": 0.90},
    "playful":     {"stability": 0.35, "similarity_boost": 0.80, "style": 0.60, "speed": 1.00},
    "mischievous": {"stability": 0.35, "similarity_boost": 0.85, "style": 0.65, "speed": 1.00},
    "whisper":     {"stability": 0.55, "similarity_boost": 0.90, "style": 0.40, "speed": 0.85},
    "surprised":   {"stability": 0.20, "similarity_boost": 0.80, "style": 0.85, "speed": 1.15},
}

# ElevenLabs varsayılan ayarlar
VOICE_DEFAULT = {
    "stability": 0.50,
    "similarity_boost": 0.75,
    "style": 0.45,
    "speed": 1.00,
}

# ─── Altyazı Stilleri ───
SUBTITLE_STYLES = {
    "premium": {
        "fontname": "Montserrat",
        "bold": True,
        "outline": 2,
        "shadow": 1,
        "border_style": 1,           # 1=outline+shadow, 3=opaque box
        "primary_color": "&H00FFFFFF",
        "outline_color": "&H40000000",  # Yarı-saydam siyah
        "back_color": "&H80000000",     # Yarı-saydam arka plan
        "spacing": 1,
    },
    "minimal": {
        "fontname": "Arial",
        "bold": True,
        "outline": 1,
        "shadow": 0,
        "border_style": 4,
        "primary_color": "&H00FFFFFF",
        "outline_color": "&H00000000",
        "back_color": "&H96000000",
        "spacing": 0,
    },
}
DEFAULT_SUBTITLE_STYLE = "premium"

# ─── Brief Şablonu ───
BRIEF_TEMPLATE = """# [Konu Başlığı]

Konu: [Ne hakkında]
Dil: de|tr|en
İçerik türü: sosyal|ekran|robot|greenscreen
Ton: [Enerji + duygu — örn. "Afacan, meraklı"]

## Hedef Kitle
[Kim izleyecek? Yaş, durum — örn. "diş hekimi korkusu olan yetişkinler"]

## Ana Mesaj
[1 cümle — videonun tek çıkarımı]

## Senaryo İpuçları
- [Molo ne yapabilir? örn. "kameraya fısıldayabilir"]
- [Hangi ortamlar? örn. "banyo aynası önü, klinik bekleme"]
- [Espri tarzı? örn. "kendini övme, insan alışkanlıklarını sorgulama"]

## Kaçınılacaklar
- [örn. "çok ciddi olmasın", "tıbbi terim kullanmasın"]
"""

# ─── Senaryo Çeşitliliği ───
AVAILABLE_SHOTS = {
    "wide": "Full body + environment visible, establishes location",
    "medium": "Waist up, balanced character and environment",
    "medium-close": "Chest up, face prominent, conversational",
    "close": "Head and shoulders, emotional emphasis",
}

ENVIRONMENT_SUGGESTIONS = {
    "dental_care": ["modern_bathroom", "family_kitchen", "school_classroom", "clinic"],
    "introduction": ["studio", "city_park", "clinic_lobby"],
    "seasonal": ["snowy_street", "beach", "autumn_park"],
    "food_related": ["family_kitchen", "ice_cream_shop", "supermarket"],
    "fear_reduction": ["cozy_living_room", "child_bedroom", "clinic"],
    "general": ["studio", "clinic", "city_park", "modern_living_room"],
}

EMOTION_ARCS = {
    "energetic_opener": ["curious surprise", "building excitement", "confident delivery", "warm invitation"],
    "educational": ["friendly curiosity", "focused explanation", "playful aside", "proud conclusion"],
    "reassuring": ["gentle greeting", "empathetic acknowledgment", "calm explanation", "warm encouragement"],
    "mischievous": ["sneaky curiosity", "cheeky reveal", "proud self-praise", "warm wink farewell"],
}

# ─── Molo Karakter Kişiliği (İçerik/senaryo üretiminde kullanılır) ───
CHARACTER_PERSONALITY = """MOLO is İstadental's brand mascot and digital host. Small, blue, attentive, intelligent, and slightly robotic. Charming but never childish. Lively, modern, and memorable.

Personality: warm, observant, slightly mischievous, controlled, attentive, slightly hyperactive, trustworthy, slightly robotic. Notices details, makes clever remarks, has humor but is never a clown. Can make small jokes, gently self-praise, quietly self-comment — but never breaks brand seriousness.

Speaking style: bright, fluid, clean, slightly playful. Reassuring when needed, explanatory when needed, mischievous when appropriate. Always clear, trustworthy, brand-appropriate. Never too chatty, too sweet, too childish, or too corporate.

Role: welcomes visitors, eases first-moment tension, makes the experience warmer and more human, gives the brand a living face. NOT a doctor — does not diagnose or give medical advice, but can relay doctor-approved information in simpler, more relaxed language."""

# ─── Molo Karakter Kimlik Kilidi (Prompt'lara otomatik eklenir) ───

# ─── YENi: Tek parca gorsel kilidi (eski 6 blogu birlestir) ───
CHARACTER_LOCK_IMAGE = """Copy MOLO exactly from the reference image.
- Same face, same ROUND eye shape and size, same curved mouth, same visor proportions
- Same body, blue-white colors, materials, silhouette, hologram cone on top
- Eyes: ROUND — never triangular or angular. If unsure, make SMALLER.
- Mouth: subtle smile. No teeth, no tongue, no cavity.
- Face clear and readable for lip-sync animation.
- Hologram: identical to reference — same shape, scale, placement.
Lighting: soft, warm, realistic. Materials: polished but not plastic.
Maximum resolution, crisp edges, detailed textures.
DO NOT: enlarge eyes, reshape face, add accessories, redesign hologram, make toy-like."""

# DEPRECATED: eski gorsel kilidi — geriye uyumluluk icin CHARACTER_LOCK_IMAGE'a alias
CHARACTER_IDENTITY_LOCK = CHARACTER_LOCK_IMAGE

# Video promptlara eklenen hareket kuralları
CHARACTER_MOVEMENT_RULES = """Movement rules:
- movement must be minimal, controlled, and precise
- use only small upper-body motion
- use only tiny head adjustments
- direct eye contact should be maintained most of the time
- the head should remain mostly front-facing
- only subtle micro-nods or very slight micro-tilts are allowed
- no big turns, no side-facing motion, no strong leaning
- no drifting, no bouncing, no rubbery or elastic body movement
- no cartoon wobble, no exaggerated shoulder movement

Facial animation rules:
- natural blinking — eyes close to half-circle shape as seen in reference
- expressive eyes with movable pupils, exactly as seen in reference
- slight robotic timing
- stable face structure throughout
- no sudden expression spikes, no exaggerated smile stretching
- no cheek distortion, no face morphing, no eye warping

Lip sync rules:
- the mouth must move only according to the speech audio
- mouth movement must be restrained and realistic, moderate opening only
- no oversized mouth openings, no inner mouth glow
- no facial glow spikes during speech, no extra teeth appearing
- no distorted tongue or mouth cavity, no lip jitter
- keep the mouth shape stable and premium

Gesture rules:
- if any gesture happens, it must be very small and elegant
- no arm flailing, no theatrical gestures, no child-like waving"""

# DEPRECATED: hologram kilidi — artik CHARACTER_LOCK_IMAGE icinde
HOLOGRAM_LOCK = """The hologram on top of MOLO's head must remain exactly identical to the reference design in shape, placement, material logic, scale, geometry, and visual language. No variation is allowed. The hologram must not become a different device, must not be enlarged, and must not be simplified."""

# Genel yasaklar (hem gorsel hem video)
AVOID_LIST = """Avoid: side angle, profile, extreme close-up, oversized mascot, extra props,
childish proportions, toy rendering, visual clutter, asymmetric framing,
triangular or angular eyes, redesigned hologram."""

# DEPRECATED: lip-sync blogu — artik CHARACTER_LOCK_IMAGE icinde
LIPSYNC_READINESS = CHARACTER_LOCK_IMAGE

# DEPRECATED: aydinlatma blogu — artik CHARACTER_LOCK_IMAGE icinde
LIGHTING_RULES = CHARACTER_LOCK_IMAGE

# Eski uyumluluk icin CHARACTER_RULES (video promptlara eklenir)
CHARACTER_RULES = f"""{CHARACTER_LOCK_IMAGE}

{CHARACTER_MOVEMENT_RULES}"""

# ─── Referans Görseller ───
# Sadece 2 canonical referans — tutarlılık için tek kaynak
MOLO_POSES = {
    "front":          REFERENCE_DIR / "ref-front-studio.png",  # PRIMARY — tüm sahneler
    "studio":         REFERENCE_DIR / "ref-front-dark.png",     # studio/dark ortam için
    "front-close":    REFERENCE_DIR / "front-close.png",        # detay referansı
    "front-wave":     REFERENCE_DIR / "front-wave.jpg",         # selamlama pozu (opsiyonel)
    "front-3q":       REFERENCE_DIR / "ref-front-3q.png",       # 3/4 açı (opsiyonel)
    "side-run":       REFERENCE_DIR / "side-run-1.jpg",         # yandan yürüyüş (opsiyonel)
}
DEFAULT_MOLO_POSE = "front"

# Önerilen pozlar — UI'da seçenek olarak sunulur
POSE_LABELS = {
    "front": "Önden (Standart)",
    "studio": "Studio (Koyu)",
    "front-close": "Yakın Plan",
    "front-wave": "El Sallama",
    "front-3q": "3/4 Açı",
    "side-run": "Yandan Yürüyüş",
}

# Not: Eski referanslar fiziksel olarak _reference/ dizininde duruyor
# front-vertical.png, front-close.png, front-fiverr.png,
# front-wave.jpg, ref-front-3q.png, side-run-1.jpg, side-run-2.jpg

ENVIRONMENT_IMAGES = {
    "clinic":     REFERENCE_DIR / "clinic-photo.JPG",
    "background": REFERENCE_DIR / "background-empty.jpg",
    "fog":        REFERENCE_DIR / "distant-fog.jpg",
}

# ─── Ses Profilleri ───
VOICE_PROFILES = {
    "de": "Molo DE v2>",
    "tr": "Molo-tr",
}

# ─── Kling Kompakt Video Prompt Bloklari (2500 char limit) ───

# YENi: Tek parca dikey video kilidi (eski COMPACT_LOCK + COMPACT_MOTION + COMPACT_FACE_LOCK)
COMPACT_VIDEO_LOCK = """Character locked to reference: same face, round eyes, mouth, body,
blue-white colors, hologram. No redesign. 3D robot host, not cartoon.
Eyes: ROUND throughout — never triangular or angular. Same size as reference.
Movement: minimal, controlled, robotic. Small upper-body only. Front-facing, eye contact.
No bouncing, elastic motion, wobble. Face stable — no morphing, warping, expression spikes.
Lip sync: speech-driven, moderate openings. No glow, no jitter.
Gestures: very small and elegant only."""

# YENi: Tek parca ekran video kilidi (eski COMPACT_LOCK_EKRAN + COMPACT_MOTION_EKRAN)
COMPACT_VIDEO_LOCK_EKRAN = """Character locked to reference: same face, round eyes, mouth, body,
blue-white colors, hologram. No redesign. 3D robot host in horizontal commercial scene.
Eyes: ROUND throughout — never triangular or angular. Same size as reference.
Movement: minimal, controlled, robotic. Small upper-body only. Elegant negative space.
No bouncing, elastic motion, wobble. Face stable — no morphing, warping, expression spikes.
Lip sync: speech-driven, moderate openings. No glow, no jitter.
Camera: horizontal composition, balanced framing, no dramatic motion.
Lighting: soft warm studio, subtle shadows, polished material. No harsh contrast."""

# YENi: Tek parca green screen video kilidi (eski COMPACT_LOCK_GS + COMPACT_MOTION_GS)
COMPACT_VIDEO_LOCK_GS = """Character: MOLO — compact dental robot. Dark navy-blue body. Face exactly as reference — same ROUND eye size/shape, same mouth. Hologram cone on top glowing cyan. NOT a cartoon. Clean 3D-rendered robot.
BACKGROUND: MUST be perfectly flat solid chroma green (#00B140). No exceptions.
Eyes: ROUND throughout — never triangular or angular. Same size as reference.
Movement: minimal, controlled, robotic. Small 2-5cm movements only. No bouncing, no elastic.
Character stays in place. Background must remain perfectly static uniform green throughout."""

# DEPRECATED: eski kompakt bloklar — geriye uyumluluk icin alias
COMPACT_LOCK = COMPACT_VIDEO_LOCK
COMPACT_MOTION = ""  # artik COMPACT_VIDEO_LOCK icinde birlesik
COMPACT_LOCK_EKRAN = COMPACT_VIDEO_LOCK_EKRAN
COMPACT_MOTION_EKRAN = ""  # artik COMPACT_VIDEO_LOCK_EKRAN icinde birlesik
COMPACT_LOCK_GS = COMPACT_VIDEO_LOCK_GS
COMPACT_MOTION_GS = ""  # artik COMPACT_VIDEO_LOCK_GS icinde birlesik

# DEPRECATED: yuz anatomisi kilidi — artik CHARACTER_LOCK_IMAGE icinde
FACE_ANATOMY_LOCK = CHARACTER_LOCK_IMAGE


# ─── Video Yüz Animasyon Kilidi (kare-kare tutarlılık) ───
FACE_CONSISTENCY_VIDEO_LOCK = """FACE CONSISTENCY DURING ANIMATION:
- Face must match reference in EVERY frame — no reinterpretation
- Eye SIZE and SHAPE must stay IDENTICAL frame-to-frame — eyes are ROUND, never triangular or angular
- Eye proportions must not change — do not enlarge or reshape mid-animation
- If eyes start round in frame 1, they MUST remain round in every subsequent frame
- Mouth shape must return to same neutral position between words
- Visor size/shape/darkness must not change
- No face morphing, stretching, warping during movement
- No flickering, no asymmetric sizing, no ghost features
- No face elements drifting position on visor"""


# DEPRECATED: kompakt yuz kilidi — artik COMPACT_VIDEO_LOCK icinde
COMPACT_FACE_LOCK = ""  # icerik artik COMPACT_VIDEO_LOCK bloklarina dahil

# ─── Sahne Ortam Prompt Blokları ───
CLINIC_ENV_BLOCK = """Also use the provided clinic background reference as the environmental base for this composition. The final image must clearly place MOLO inside that premium dental clinic environment. The clinic interior should remain visible, readable, and recognizable behind and around MOLO.

MOLO should appear naturally present in the clinic — standing on the clinic floor with correct perspective, matching the clinic's lighting direction and color temperature. The composite must feel photorealistic, as if MOLO physically exists in this space.

Do not let MOLO fill the entire frame. Do not crop MOLO too close. Do not make MOLO oversized relative to the clinic furniture."""


STUDIO_ENV_BLOCK = """Create a dark atmospheric premium studio environment for this scene.

Background: deep dark blue gradient (#0D2847 to #1A3A5C) with subtle volumetric fog.
Floor: highly reflective mirror-like dark surface creating a soft reflection of MOLO.
Lighting: dramatic rim lighting from behind creating blue edge highlights on MOLO's body, with a main soft key light from front-left. A cool cyan glow emanates upward from MOLO's hologram cone.
Atmosphere: subtle particle effects and soft volumetric haze for depth.

This is a controlled studio environment — no clinic elements, no outdoor elements, no props."""


EXTERNAL_ENV_BLOCK = """Generate a photorealistic background environment based on this description:

LOCATION: {environment}
VISUAL DESCRIPTION: {background_description}

MOLO must be naturally placed in this real-world environment. The background must be generated ENTIRELY from the description above — no reference photo is used for the background.

CRITICAL INTEGRATION RULES:
- MOLO's lighting must match the environment's natural lighting direction, color temperature, and intensity
- MOLO's shadow must be consistent with the environment's light source
- MOLO should be proportionally sized (approximately 1 meter tall) relative to the surroundings
- The perspective and camera angle must be consistent between MOLO and the background
- The environment should feel photorealistic and naturally inhabited
- DO NOT make the background look like a cheap composite or green screen cutout
- The environment should be immediately recognizable as the described location

Style: Premium photorealistic composite — a high-quality 3D character naturally placed in a real-world environment, like a luxury brand campaign shot on location."""

# DEPRECATED: gorsel kalite kilidi — artik CHARACTER_LOCK_IMAGE icinde
IMAGE_QUALITY_LOCK = CHARACTER_LOCK_IMAGE

# ─── FFmpeg Kalite Filtreleri ───
QUALITY_FILTERS = {
    "unsharp": "3:3:0.5",        # keskinlik
    "contrast": 1.05,
    "brightness": 0.02,
    "saturation": 1.1,
    "crf": 16,                    # (18 varsayılan, 16 daha yüksek kalite)
    "pix_fmt": "yuv420p",
    "profile": "high",
    "movflags": "+faststart",
    "preset": "slow",
}

# ─── Final Video Yavaşlatma ───
# Konuşma çok hızlı hissediliyorsa, final videoya hafif slowdown uygulanır
# 0.88 = %12 yavaşlatma (doğal, rahat konuşma hızı)
AUDIO_SLOWDOWN = 0.88

# ─── Gorsel Varyant Sayisi ───
# Kullaniciya kac alternatif gorselden secim yaptirmak istiyoruz
IMAGE_VARIANTS_COUNT = 2

# ─── Akıllı Sahne Bazlı Slowdown ───
# Konuşma hızına göre her sahneye farklı yavaşlatma
SMART_SLOWDOWN_TARGET_WPS = 2.5   # Hedef: 2.5 kelime/saniye (rahat dinleme)
SMART_SLOWDOWN_FAST_WPS = 3.0     # Bu üstü → yavaşlatılır
SMART_SLOWDOWN_SLOW_WPS = 2.0     # Bu altı → dokunulmaz (speed=1.0)
SMART_SLOWDOWN_MIN = 0.75         # Minimum speed (max %25 yavaşlatma)
SMART_SLOWDOWN_MAX = 1.0          # Maximum speed (hızlandırma yok)

# ─── Crossfade ───
CROSSFADE_DURATION = 0.7

# ─── Sahne Arası Nefes Boşluğu ───
# Her sahne sonuna eklenen sessiz uzatma (son kare dondurulur)
SCENE_PADDING = 0.4    # saniye — sahne sonunda nefes alanı

# ─── Freeze-Frame (Son Kare Dondurma) ───
# Video kısa kaldığında son kareyi dondurarak uzatır (tpad filtresi)
# Pingpong/loop'a göre çok daha doğal — karakter "dinliyormuş" gibi görünür
FREEZE_FRAME_MAX = 3.0      # Max freeze süresi (saniye) — bundan sonra pingpong/loop kullan
FREEZE_FRAME_FADE = 0.3     # Freeze'e geçişte "stillness" fade süresi

# ─── Per-Scene Nefes Boşluğu ───
# Ses sonundaki yumuşak fade-out — sahneler arası keskin kesilme hissini azaltır
SCENE_BREATH_FADE = 0.2     # saniye

# ─── Sahne Geçiş Tipleri ───
# FFmpeg xfade desteklenen geçişler
TRANSITION_TYPES = [
    "fade",           # standart fade (varsayılan)
    "fadeblack",      # siyah üzerinden fade
    "fadewhite",      # beyaz üzerinden fade
    "dissolve",       # yumuşak dissolve
    "wipeleft",       # soldan sil
    "wiperight",      # sağdan sil
    "wipeup",         # alttan sil
    "wipedown",       # üstten sil
    "slideleft",      # sola kaydir
    "slideright",     # sağa kaydir
    "slideup",        # yukarı kaydir
    "slidedown",      # aşağı kaydir
]
DEFAULT_TRANSITION = "fade"

# ─── Arka Plan Müziği ───
BGM_VOLUME_DB = -22           # konuşmaya göre çok düşük (-22dB)
BGM_FADE_IN = 1.5             # giriş fade (saniye)
BGM_FADE_OUT = 2.0            # çıkış fade (saniye)
BGM_DIR = BASE_DIR / "_bgm"   # müzik dosyaları dizini

# ─── Otomatik Thumbnail (Gemini Nano Banana 2) ───
# Thumbnail boyutları content-type'dan alınır: _ct['thumbnail_w'], _ct['thumbnail_h']
THUMBNAIL_WIDTH = 1080   # varsayılan (sosyal)
THUMBNAIL_HEIGHT = 1920  # varsayılan (sosyal)

# ─── Kling Retry ───
KLING_MAX_PARALLEL = 3         # API paralel task limiti
KLING_RETRY_WAIT = 30          # retry arası bekleme (saniye)
KLING_MAX_RETRIES = 3          # max retry per scene

# ─── FFmpeg Yardımcı Fonksiyonlar ───
def get_normalize_filter(with_quality=False, content_type=None):
    """Normalize filter — content type'a göre doğru boyut kullanır.
    Green screen modunda renk düzeltme atlanır ve pad rengi chroma green olur."""
    if content_type and content_type in CONTENT_TYPES:
        ct = CONTENT_TYPES[content_type]
        w, h = ct["width"], ct["height"]
    else:
        w, h = OUTPUT_WIDTH, OUTPUT_HEIGHT

    # Green screen için pad rengi chroma green, renk düzeltme yok
    is_gs = content_type and CONTENT_TYPES.get(content_type, {}).get("is_greenscreen", False)
    pad_color = "color=0x00B140" if is_gs else "black"

    base = (
        f"scale={w}:{h}:"
        f"force_original_aspect_ratio=decrease:flags=lanczos,"
        f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:{pad_color},"
        f"setsar=1"
    )

    if is_gs:
        return base  # unsharp/contrast/brightness/saturation yeşili bozar

    if with_quality:
        q = QUALITY_FILTERS
        base += (
            f",unsharp={q['unsharp']}"
            f",eq=contrast={q['contrast']}:brightness={q['brightness']}:saturation={q['saturation']}"
        )
    return base
