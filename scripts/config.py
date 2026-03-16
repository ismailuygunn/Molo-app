"""
Molo İçerik Pipeline — Merkezi Konfigürasyon

⚠️ TÜM SABİTLER BURADA TANIMLANIR.
   Diğer scriptler bu dosyadan import eder.
   Bu değerleri değiştirmeden önce tüm ekiple konuşun.
"""

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
FFMPEG = "/Users/socialmedia/.local/bin/ffmpeg"

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
        "subtitle_margin_v": 550,     # alt kısımda
        "subtitle_fontsize": 42,
        "scene_direction": (
            "Vertical 9:16 social media format. "
            "MOLO centered, front-facing, symmetrical composition. "
            "Energetic, scroll-stopping, dynamic."
        ),
        "thumbnail": True,
    },
    "ekran": {
        "label": "📺 Klinik Ekranı",
        "width": 1920,
        "height": 1080,
        "aspect": "16:9",
        "kling_aspect": "16:9",
        "orientation": "horizontal",
        "subtitle_margin_v": 80,      # alttan yukarıda
        "subtitle_fontsize": 36,
        "scene_direction": (
            "Horizontal 16:9 wide clinic lobby screen format. "
            "MOLO can be positioned slightly off-center for a cinematic feel. "
            "Use wider framing to show more of the clinic environment. "
            "The character may interact with the environment — looking around, "
            "leaning on furniture, sitting on a dental chair, or waking up from a nap. "
            "Premium, warm, slightly humorous, like a living lobby host."
        ),
        "thumbnail": False,
    },
    "robot": {
        "label": "🤖 Robot Ekranı (Speedy Pixel)",
        "width": 1080,
        "height": 1920,
        "aspect": "9:16",
        "kling_aspect": "9:16",
        "orientation": "vertical",
        "subtitle_margin_v": 500,
        "subtitle_fontsize": 46,      # robottan okunsun diye biraz daha büyük
        "scene_direction": (
            "Vertical 9:16 robot display format for Saha Robotics Speedy Pixel. "
            "MOLO centered, front-facing, direct eye contact. "
            "Designed to be displayed on a mobile robot screen with speakers. "
            "Warm, welcoming, conversational — like greeting clinic visitors face-to-face. "
            "Close to medium-close framing preferred since robot screen is smaller."
        ),
        "thumbnail": False,
    },
}
DEFAULT_CONTENT_TYPE = "sosyal"

# ─── Model Kilitleri (⚠️ KESİN KURAL: DEĞİŞTİRİLMEZ) ───
KLING_MODEL = "kling-v3"
KLING_API_BASE = "https://api.klingai.com"
KLING_DURATION = "5"
KLING_MAX_PROMPT_CHARS = 2500  # ⚠️ API hard limit

GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview"  # Nano Banana 2
GEMINI_TEXT_MODEL = "gemini-2.5-flash"                  # Çeviri için

ELEVENLABS_MODEL = "eleven_multilingual_v2"

# ─── ElevenLabs Ses Yönlendirme Preset'leri ───
VOICE_PRESETS = {
    "energetic":   {"stability": 0.30, "similarity_boost": 0.80, "style": 0.70},
    "warm":        {"stability": 0.45, "similarity_boost": 0.80, "style": 0.55},
    "informative": {"stability": 0.55, "similarity_boost": 0.75, "style": 0.35},
    "excited":     {"stability": 0.25, "similarity_boost": 0.85, "style": 0.80},
    "calm":        {"stability": 0.65, "similarity_boost": 0.75, "style": 0.25},
    "playful":     {"stability": 0.35, "similarity_boost": 0.80, "style": 0.60},
    "mischievous": {"stability": 0.35, "similarity_boost": 0.85, "style": 0.65},
}

# ElevenLabs varsayılan ayarlar
VOICE_DEFAULT = {
    "stability": 0.50,
    "similarity_boost": 0.75,
    "style": 0.45,
}

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
COMPACT_LOCK = """Character identity locked to source image. Same face, eyes, mouth, body, proportions, blue-white colors, materials, silhouette, hologram. No redesign, no reinterpretation, no simplification, no childish or toy-like changes. Hologram shape/scale/placement must stay identical. Premium digital host, not cartoon."""

COMPACT_MOTION = """Movement: minimal, controlled, precise. Small upper-body motion only. Tiny head nods allowed. Front-facing, direct eye contact. No big turns, no bouncing, no elastic/rubbery motion, no wobble. Face stable throughout, no warping, no expression spikes. Lip sync: speech-driven only, moderate openings, no glow, no jitter. Gestures: very small and elegant only."""

# ─── FFmpeg Kalite Filtreleri ───
QUALITY_FILTERS = {
    "unsharp": "3:3:0.5",        # keskinlik
    "contrast": 1.05,
    "brightness": 0.02,
    "saturation": 1.1,
    "crf": 16,                    # (18 varsayılan, 16 daha yüksek kalite)
}

# ─── Final Video Yavaşlatma ───
# Konuşma çok hızlı hissediliyorsa, final videoya hafif slowdown uygulanır
# 0.88 = %12 yavaşlatma (doğal, rahat konuşma hızı)
AUDIO_SLOWDOWN = 0.88

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
THUMBNAIL_WIDTH = 1080
THUMBNAIL_HEIGHT = 1920

# ─── Kling Retry ───
KLING_MAX_PARALLEL = 3         # API paralel task limiti
KLING_RETRY_WAIT = 30          # retry arası bekleme (saniye)
KLING_MAX_RETRIES = 3          # max retry per scene

# ─── FFmpeg Yardımcı Fonksiyonlar ───
def get_normalize_filter(with_quality=False):
    """1080x1920 normalize + opsiyonel kalite filtreleri."""
    base = (
        f"scale={OUTPUT_WIDTH}:{OUTPUT_HEIGHT}:"
        f"force_original_aspect_ratio=decrease,"
        f"pad={OUTPUT_WIDTH}:{OUTPUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2:black,"
        f"setsar=1"
    )
    if with_quality:
        q = QUALITY_FILTERS
        base += (
            f",unsharp={q['unsharp']}"
            f",eq=contrast={q['contrast']}:brightness={q['brightness']}:saturation={q['saturation']}"
        )
    return base
