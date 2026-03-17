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
            "Energetic, scroll-stopping, dynamic."
        ),
        "video_prompt_boost": (
            "Create a premium scroll-stopping vertical video. "
            "Dynamic energy, punchy visual rhythm. "
            "The character must command attention within the first second. "
            "Bold, vibrant, high-contrast lighting. "
            "Every frame must feel like a social media hero shot."
        ),
        "image_rules": (
            "Bold close framing. MOLO fills 60-70% of vertical frame. "
            "Strong eye contact, expressive pose. "
            "Background: dramatic dark studio with blue volumetric fog and rim lighting. "
            "The image must feel like a premium TikTok/Reels thumbnail."
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
            "The video must feel like a luxury brand commercial, calm and editorial. "
            "Camera: stable, no shake, no dramatic zoom. Subtle ambient motion only."
        ),
        "image_rules": (
            "Wide horizontal composition. MOLO occupies 40-50% of frame. "
            "Significant negative space for cinematic feel. "
            "Background: warm premium clinic interior or minimal studio. "
            "The image must feel like a luxury campaign still."
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
KLING_NEGATIVE_PROMPT = "face morphing, face distortion, asymmetric face, round eyes, oval eyes, human eyes, dot eyes, eye color change, eye size change, eye spacing change, mouth cavity, teeth visible, tongue visible, 3D mouth opening, biological mouth, asymmetric mouth, visor size change, visor shape change, extra limbs, blurry, low quality, watermark, text overlay, childish cartoon, toy-like, plastic glow, oversized mouth, inner mouth glow, elastic body, rubbery motion, bouncing, jittery, flickering, artifacts, ghost face features, duplicate eyes, face element drift"
KLING_CFG_FIRST_LAST = 0.8                    # İlk ve son sahne — karakter tutarlılığı
KLING_CFG_MIDDLE = 0.7                        # Orta sahneler — biraz yaratıcılık
KLING_MAX_PROMPT_CHARS = 2500  # ⚠️ API hard limit

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

# ─── Molo Karakter Kişiliği (İçerik/senaryo üretiminde kullanılır) ───
CHARACTER_PERSONALITY = """MOLO is İstadental's brand mascot and digital host. Small, blue, attentive, intelligent, and slightly robotic. Charming but never childish. Premium, modern, and memorable.

Personality: warm, observant, slightly mischievous, controlled, attentive, slightly hyperactive, trustworthy, slightly robotic. Notices details, makes clever remarks, has humor but is never a clown. Can make small jokes, gently self-praise, quietly self-comment — but never breaks brand seriousness.

Speaking style: bright, fluid, clean, slightly playful. Reassuring when needed, explanatory when needed, mischievous when appropriate. Always clear, trustworthy, brand-appropriate. Never too chatty, too sweet, too childish, or too corporate.

Role: welcomes visitors, eases first-moment tension, makes the experience warmer and more human, gives the brand a living face. NOT a doctor — does not diagnose or give medical advice, but can relay doctor-approved information in simpler, more relaxed language."""

# ─── Molo Karakter Kimlik Kilidi (Prompt'lara otomatik eklenir) ───

# Görsel promptlara eklenen karakter kilidi
CHARACTER_IDENTITY_LOCK = """Use the referenced MOLO mascot exactly as the fixed and locked character identity. Preserve the exact same face design, exact same eye shape, exact same mouth design, exact same body proportions, exact same blue-and-white color palette, exact same materials, exact same silhouette, and especially the exact same hologram unit on top of the head. Do not redesign the character, do not reinterpret the character, do not simplify the character, and do not make the character more childish, more toy-like, or more cartoonish."""

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
- subtle blinking only
- soft intelligent eye expression with slight playful warmth
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

# Hologram kilidi (hem görsel hem video)
HOLOGRAM_LOCK = """The hologram on top of MOLO's head must remain exactly identical to the reference design in shape, placement, material logic, scale, geometry, and visual language. No variation is allowed. The hologram must not become a different device, must not be enlarged, and must not be simplified."""

# Genel yasaklar (hem görsel hem video)
AVOID_LIST = """Avoid: oversized mascot filling the frame, side angle, 3/4 angle, profile angle, extreme close-up, cropped face, hidden mouth, exaggerated smile, extra props, extra people, random floating UI, new accessories, redesigned hologram, childish proportions, toy-like rendering, overly glossy plastic surfaces, asymmetrical framing, clutter, visual chaos, or anything that reduces premium realism."""

# Lip-sync hazırlık bloğu (görsel promptlarda)
LIPSYNC_READINESS = """MOLO's facial area must be extremely clear and readable for later talking animation. The mouth area must be unobstructed, centered, and easy to animate. The eyes must be clearly visible and expressive, but not exaggerated. The expression should feel warm, intelligent, slightly playful, slightly robotic, premium, and welcoming. The character should feel like a sophisticated brand mascot, not a children's cartoon and not a cheap toy."""

# Aydınlatma ve malzeme (tüm promptlarda)
LIGHTING_RULES = """The lighting should feel high-end, cinematic, soft, and premium, but realistic. The character should integrate naturally into the space. Avoid flat toy lighting, overexposed glow, or over-stylized cartoon shading. The materials should feel polished but not overly glossy or plastic."""

# Eski uyumluluk için CHARACTER_RULES (video promptlara eklenir)
CHARACTER_RULES = f"""{CHARACTER_IDENTITY_LOCK}

{CHARACTER_MOVEMENT_RULES}

{HOLOGRAM_LOCK}

{AVOID_LIST}"""

# ─── Referans Görseller ───
MOLO_POSES = {
    "front":          REFERENCE_DIR / "front-vertical.png",
    "front-close":    REFERENCE_DIR / "front-close.png",
    "front-wave":     REFERENCE_DIR / "front-wave.jpg",
    "front-vertical": REFERENCE_DIR / "front-vertical.png",
    "front-fiverr":   REFERENCE_DIR / "front-fiverr.png",
    "side-run-1":     REFERENCE_DIR / "side-run-1.jpg",
    "side-run-2":     REFERENCE_DIR / "side-run-2.jpg",
}

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

# ─── Kling Kompakt Prompt Blokları (2500 char limit) ───
COMPACT_LOCK = """Character identity locked to source image. Same face, eyes, mouth, body, proportions, blue-white colors, materials, silhouette, hologram. No redesign, no reinterpretation, no simplification, no childish or toy-like changes. Hologram shape/scale/placement must stay identical. Premium digital host, not cartoon.

Face anatomy lock: diamond-shaped cyan (#00D4FF) eyes on dark visor — same shape, size, spacing, color in every frame. Mouth: thin cyan LED line on visor surface, opens to small oval during speech (max 30% of eye height). No round eyes, no mouth cavity, no teeth, no face morphing, no asymmetric features. Visor proportions constant."""

COMPACT_MOTION = """Movement: minimal, controlled, precise. Small upper-body motion only. Tiny head nods allowed. Front-facing, direct eye contact. No big turns, no bouncing, no elastic/rubbery motion, no wobble. Face stable throughout, no warping, no expression spikes. Lip sync: speech-driven only, moderate openings, no glow, no jitter. Gestures: very small and elegant only."""

# ─── Ekran (Yatay 16:9) Premium Prompt Blokları ───
COMPACT_LOCK_EKRAN = """Animate the referenced MOLO mascot in a premium horizontal commercial scene. Keep the character fully locked to the reference: same face, same eyes, same mouth design, same body proportions, same blue-white colors, same materials, same silhouette, and the exact same hologram unit on top of the head. Do not redesign or alter MOLO in any way.

Face anatomy lock: diamond-shaped cyan (#00D4FF) eyes on dark visor — same shape, size, spacing, color in every frame. Mouth: thin cyan LED line on visor surface, opens to small oval during speech (max 30% of eye height). No round eyes, no mouth cavity, no teeth, no face morphing, no asymmetric features. Visor proportions constant."""

COMPACT_MOTION_EKRAN = """Motion rules: very small, precise, premium movement. Slightly robotic timing. No elastic body motion, no cartoon wobble, no exaggerated rocking, no big gestures, no panic flailing, no drifting, no unstable physics.
Face rules: no face morphing, no cheek distortion, no eye warping, no sudden expression spikes, no random facial glow, no lighting flicker on mouth or eyes.
Mouth rules: if silent keep mouth naturally closed and stable. If speech added mouth moves only with dialogue. No mouth glow, no oversized openings, no distorted jaw, no weird inner-mouth artifacts.
Camera: horizontal composition, balanced premium framing, elegant negative space, no dramatic camera motion, no shaky movement, no chaotic zoom.
Lighting: soft premium studio lighting, warm off-white luxury tone, subtle sculptural shadows, polished material definition, no harsh contrast, no cheap plastic shine."""

# ─── Green Screen Kompakt Prompt Blokları ───
COMPACT_LOCK_GS = """Character: MOLO — compact dental mascot robot. Dark navy-blue metallic body. Cyan glowing diamond-shaped eyes. Open hologram cone on top glowing cyan. Short, rounded, not more than 60cm tall. NOT a real person. Not a cartoon. Premium 3D-rendered robot with clean, studio-quality appearance. BACKGROUND: MUST be perfectly flat solid chroma green (#00B140). No exceptions."""

COMPACT_MOTION_GS = """Motion: Minimal, controlled, robotic. Small 2-5cm movements only. No bouncing, no elastic motion, no exaggerated gestures. Subtle head tilt, gentle hand wave, slight body lean — all micro-movements. Character stays in place — no walking, no jumping, no large position changes. BACKGROUND: Must remain perfectly static uniform green throughout entire duration."""

# ─── Yüz Anatomisi Kilidi (göz/ağız/vizör tutarlılığı) ───
FACE_ANATOMY_LOCK = """MOLO FACE ANATOMY — ABSOLUTE LOCK (must match reference exactly):

EYE DESIGN:
- Shape: two horizontally-oriented diamond/rhombus shapes, slightly rounded at corners
- Color: bright cyan-teal (#00D4FF) with soft inner glow
- Size: each eye occupies approximately 15% of the visor width
- Position: horizontally centered on the visor, vertically positioned in the upper 40% of the visor area
- Spacing: the gap between the two eyes is approximately equal to the width of one eye
- Expression: default is calm, alert, slightly warm — achieved by keeping the diamond shape symmetrical with very subtle upward tilt at outer corners
- The eyes must NEVER change shape, size, color, spacing, or position between frames or scenes
- No round eyes, no oval eyes, no anime eyes, no human eyes, no dot eyes
- No eye glow spikes, no eye color shifts, no eye size changes during animation

MOUTH DESIGN:
- Shape: a gentle curved line forming a subtle smile, positioned in the lower 30% of the visor
- Style: thin LED-like illuminated line, NOT a 3D mouth cavity
- Color: same cyan-teal as eyes (#00D4FF) or very slightly lighter
- Width: approximately 60% of the distance between both eyes' outer edges
- The mouth is a SURFACE ELEMENT on the visor, not a hole or opening in the character's face
- During speech: the mouth line opens to a small oval, maximum opening height is 30% of eye height
- The mouth must NEVER become a full open circle, must NEVER show teeth, must NEVER show tongue
- Must NEVER have a 3D mouth cavity, internal glow, or biological mouth features
- No exaggerated smile stretch, no frown deeper than reference neutral, no asymmetric mouth

VISOR (FACE PANEL):
- Shape: wide, rounded-rectangle dark translucent panel on the front of the head
- Color: very dark blue-black (#0A1628) with subtle transparency
- The visor contains ONLY the eyes and mouth — no other elements
- Visor proportions relative to head must remain constant
- The visor must NEVER become smaller, larger, rounder, or more square than reference"""


# ─── Video Yüz Animasyon Kilidi (kare-kare tutarlılık) ───
FACE_CONSISTENCY_VIDEO_LOCK = """FACE CONSISTENCY DURING ANIMATION — ABSOLUTE RULES:

Frame-to-frame face stability:
- The eye shape must remain IDENTICAL in every single frame of the video
- The eye spacing must remain IDENTICAL in every single frame
- The eye color (#00D4FF cyan) must remain constant — no color shifting
- The mouth baseline shape must return to the same neutral position between words
- The visor size, shape, and darkness must not change at any point
- The face must not morph, stretch, compress, or warp during any movement

Prohibited face artifacts:
- No frame where eyes become round, oval, or dot-shaped
- No frame where mouth becomes a full circle or shows internal glow
- No frame where visor changes size or transparency
- No frame where eye spacing changes
- No flickering of facial elements
- No asymmetric eye sizing (one eye larger than the other)
- No ghost/duplicate facial features
- No face elements sliding or drifting position on the visor"""


# ─── Kompakt Yüz Kilidi (Kling 2500 char limiti için kısa versiyon) ───
COMPACT_FACE_LOCK = """Face lock: diamond-shaped cyan (#00D4FF) eyes on dark visor, exactly matching reference. Eyes stay identical shape/size/spacing/color in every frame. Mouth: thin cyan LED smile line on visor surface, max 30% of eye height when open. No round eyes, no mouth cavity, no teeth, no tongue, no face morphing, no eye warping, no glow spikes, no asymmetric features. Visor proportions constant throughout."""

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

# ─── Görsel Kalite Kilidi (Gemini üretim kalitesi) ───
IMAGE_QUALITY_LOCK = """Quality preservation rules:
- Render at maximum resolution and sharpness. Every edge must be crisp and well-defined.
- No compression artifacts, no blur, no noise, no soft focus.
- Material textures must be detailed and visible (metallic reflections, surface scratches, translucent visor).
- Color accuracy must be preserved — no washed out colors, no oversaturation.
- The final image must look like a high-end 3D render, not a compressed web image."""

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
        f"force_original_aspect_ratio=decrease,"
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
