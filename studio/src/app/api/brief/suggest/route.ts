export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

const CATEGORIES: Record<string, { label: string; emoji: string; desc: string; examples: string }> = {
  trending: {
    label: "Güncel & Trend", emoji: "🔥",
    desc: "Sosyal medya trendleri, viral akımlar, mevsimsel içerikler",
    examples: "TikTok trendleri, sezonsal kampanyalar, viral challenge adaptasyonları, gündem yorumları, POV videoları",
  },
  educational: {
    label: "Eğitici", emoji: "📚",
    desc: "Diş sağlığı bilgilendirme, bakım ipuçları",
    examples: "Diş fırçalama teknikleri, çocuklara özel bakım, yanlış bilinen doğrular, FAQ videoları, bilgi hapları",
  },
  humor: {
    label: "Komedi & Şaka", emoji: "😂",
    desc: "Esprili, mizahi, scroll-durdurucu içerikler",
    examples: "Dişçi korkusu şakaları, Molo'nun günlük maceraları, komik durumlar, self-ironi, POV videoları, absürt karşılaştırmalar",
  },
  campaign: {
    label: "Kampanya & Tanıtım", emoji: "🎯",
    desc: "Klinik ve tedavi tanıtımı",
    examples: "İmplant, diş beyazlatma, ortodonti tanıtımı, yeni hizmetler, fiyat kampanyaları, before/after",
  },
  storytelling: {
    label: "Hikaye & Seri", emoji: "📖",
    desc: "Devam eden hikayeler, karakter gelişimi",
    examples: "Molo'nun günlüğü, hasta hikayeleri, klinik arkası, bir günüm serisi, beklenmedik olaylar",
  },
  seasonal: {
    label: "Mevsimsel & Özel Gün", emoji: "🗓️",
    desc: "Tatil, bayram, özel gün içerikleri",
    examples: "Ramazan, bayram, yılbaşı, okul başlangıcı, yaz tatili, dünya diş sağlığı günü, sevgililer günü, anneler günü",
  },
  interactive: {
    label: "Etkileşimli", emoji: "🎮",
    desc: "Anket, soru-cevap, quiz formatları",
    examples: "Doğru/yanlış quiz, bunu biliyor muydun, tahmin oyunu, yorum bırak formatı, this or that, tepki videoları",
  },
};

const PLATFORM_CONTEXT: Record<string, string> = {
  sosyal: `Sosyal Medya (TikTok, Instagram Reels, YouTube Shorts) - 9:16 dikey format.
    Hedef: Scroll durdurucu, dikkat çekici, kısa ve vurucu.
    Tarzlar: Trendler, behind-the-scenes, eğlenceli anlar, bilgi hapları, POV videoları.
    Süre: 15-30 saniye ideal.`,
  ekran: `Klinik Bekleme Salonu Ekranı - 16:9 yatay format.
    Hedef: Hastaları bilgilendiren, rahatlatıcı, profesyonel.
    Tarzlar: Tedavi tanıtımları, klinik turu, doktor tanıtımı, bakım ipuçları, FAQ.
    Süre: 30-60 saniye, sakin tempo.`,
  robot: `Robot Ekranı / Karşılama Robotu - 9:16 dikey format.
    Hedef: Hastaları karşılayan, etkileşimli, sıcak.
    Tarzlar: Hoş geldin mesajı, yönlendirme, çocuklara özel, günlük selamlama.
    Süre: 10-20 saniye.`,
  greenscreen: `Green Screen formatı — compositing için arka plan ayrıca eklenecek.
    Hedef: Esnek kullanım, farklı arka planlarla birleştirilebilir.
    Süre: İçeriğe göre değişken.`,
};

export async function POST(req: NextRequest) {
  try {
    const { contentType, lang, tone, existingTopics, category, selectedTrends } = await req.json();

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        configured: false,
        suggestions: [],
        message: "GOOGLE_API_KEY henüz yapılandırılmamış. Ayarlar sayfasından kontrol edin.",
      });
    }

    const platform = PLATFORM_CONTEXT[contentType] || PLATFORM_CONTEXT.sosyal;
    const langLabel = lang === "de" ? "Almanca (Almanya'daki Türk diş kliniği)" : "Türkçe";
    const today = new Date().toLocaleDateString("tr-TR", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    const existingText = existingTopics?.length
      ? `\nDaha önce üretilmiş konular (BUNLARI TEKRAR ÖNERME):\n${existingTopics.map((t: string) => `- ${t}`).join("\n")}`
      : "";

    // Kategori filtresi
    const catInfo = category && CATEGORIES[category]
      ? `\nSADECE "${CATEGORIES[category].label}" kategorisinden 6 öneri üret.\nKategori açıklaması: ${CATEGORIES[category].desc}\nÖrnek konular: ${CATEGORIES[category].examples}`
      : `\nTÜM kategorilerden karışık 8 öneri üret. Her önerinin hangi kategoriye ait olduğunu belirt.\nKategoriler: ${Object.entries(CATEGORIES).map(([k, v]) => `${v.emoji} ${v.label} (key: ${k})`).join(", ")}`;

    // Build trend context from user's selected trends
    let trendBlock = "";
    if (selectedTrends?.length > 0) {
      const trendList = selectedTrends.map((t: { name: string; description: string; platforms?: string[]; mascot_adaptation?: string }) =>
        `- ${t.name} (${t.platforms?.join(", ") || "TikTok"}): ${t.description}${t.mascot_adaptation ? `\n  Maskot uyarlama: ${t.mascot_adaptation}` : ""}`
      ).join("\n");
      trendBlock = `

KULLANICININ SEÇTİĞİ GÜNCEL TRENDLER (Perplexity ile gerçek zamanlı çekildi):
${trendList}

TÜM önerilerin bu seçilen trendlere dayanması ZORUNLU.
Her öneri, yukarıdaki trendlerden birini MOLO karakteriyle uyarlamalı.
trend_reference alanında hangi seçilen trende dayandığını yaz.`;
    }

    // ── Generate suggestions with trend context ──
    const prompt = `Sen İSTADENTAL diş kliniğinin maskotu MOLO için yaratıcı, viral potansiyelli TikTok içerik önerileri üreten bir yaratıcı direktörsün.

MOLO KARAKTERİ:
- Mavi-beyaz sevimli robot maskot, başında hologram konisi
- Çocuklar ve yetişkinler tarafından sevilen
- Komik, pozitif, sevecen ama premium kişilik
- Self-ironi yapabilir, hafif şakalar atabilir, güncel trendlere espirili yorum yapabilir
- İnsanları dışarıdan gözlemleyen bir robot bakış açısı
- ISTADENTAL logolu tişört giyer
- Almanya'daki Türk diş kliniğinin maskotu

BUGÜNÜN TARİHİ: ${today}
${trendBlock}

PLATFORM: ${platform}

DİL: ${langLabel}
TON: ${tone || "Eğlenceli"}
${catInfo}
${existingText}

KRİTİK — GÜNCEL TREND ENTEGRASYONU:
- Önerilerinin TÜMÜ güncel TikTok trendlerine, formatlarına veya viral içeriklere dayanmalı.
- Sadece "robot" veya "diş" temasına sıkışma — Duolingo baykuşunun yaptığı gibi KARAKTERİ her türlü trende sok.
- Duolingo owl nasıl "unhinged content", "threatening reminders", "office drama" yapıyorsa — MOLO da dental dışı trendlere girebilir.
- Global viral challenge varsa → MOLO versiyonunu öner (dental twist ile veya olmadan).
- Trending format varsa (POV, GRWM, storytime, "nobody:", greenscreen reaction) → MOLO ile adapte et.
- Trending sound/audio varsa → o ses üzerine MOLO içeriği öner.
- Marka maskot trendlerini TAKİP ET: Duolingo, Scrub Daddy, Nutter Butter, RyanAir ne yapıyorsa MOLO da yapabilir.
- İçeriklerin SADECE %30'u dental/sağlık olsun, %70'i GLOBAL trendlere adaptasyon olsun.
- Her öneride hangi SPESIFIK trende/formata/challenge'a dayandığını açıkça belirt.

YARATICILIK KURALLARI:
- Molo komik yorumlar yapabilir, self-ironi yapabilir, hafif şakalar atabilir
- Molo insanları "dışarıdan gözlemleyen sevimli robot" perspektifiyle yaklaşabilir
- Her öneri BENZERSİZ olmalı — birbirine benzeyen fikirler YASAK
- Hook'lar merak uyandırıcı, şok edici veya güldürücü olmalı — ilk 3 saniye scroll durdurmalı
- Diş kliniği bağlamını asla unutma — her içerik İstadental'e değer katmalı
- Klişe "diş fırçala" içerikleri yerine yaratıcı ve beklenmedik açılar bul
- Molo'nun robotluğunu avantaj olarak kullan
- Konsept açıklamaları SOMUT olmalı — ne olacağını net anlat, soyut kalma

Yanıtını SADECE şu JSON formatında ver, başka hiçbir şey yazma:
[
  {
    "title": "emoji + akılda kalıcı kısa başlık",
    "concept": "2-3 cümle yaratıcı ve SOMUT konsept açıklaması — ne olacak, neden ilginç",
    "trend_reference": "Bu önerinin dayandığı SPESIFIK TikTok trendi/formatı/challenge (ör: 'Duolingo unhinged content tarzı', 'POV formatı', 'trending sound XYZ')",
    "hook": "Videonun ilk 3 saniyesinde söylenecek scroll-durdurucu cümle (Almanca ise Almanca yaz)",
    "hook_alternatives": ["3 farklı scroll-stopper açılış cümlesi — soru, ifade, aksiyon"],
    "hashtags": ["5-8 hashtag: 2 branded (#MoloMobil #IstaDental), 3-4 trending topic, 1-2 engagement"],
    "caption": "TikTok'a yapıştırılmaya hazır caption metni (1-2 cümle + emoji)",
    "why": "Neden viral olabilir, hangi kitleye hitap eder, hangi duyguyu tetikler (detaylı, 1-2 cümle)",
    "category": "trending|educational|humor|campaign|storytelling|seasonal|interactive",
    "molo_attitude": "Molo'nun bu konudaki tavrı (2-3 kelime: şakacı, meraklı, şaşkın, bilgiç, heyecanlı, vs.)"
  }
]

Her öneri için MUTLAKA hashtags, hook_alternatives ve caption alanlarını doldur.
Hashtag'ler # ile başlamalı, Almanca/Türkçe karışık olabilir.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 1.1,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("Gemini API error:", response.status, err.slice(0, 500));
      return NextResponse.json({ error: `AI yanıt veremedi (${response.status})` }, { status: 502 });
    }

    const result = await response.json();
    let text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Strip markdown code fences
    text = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

    // Parse JSON array
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI yanıtı parse edilemedi", raw: text.slice(0, 200) }, { status: 500 });
    }

    try {
      const suggestions = JSON.parse(jsonMatch[0]);
      return NextResponse.json({ suggestions, categories: CATEGORIES });
    } catch {
      return NextResponse.json({ error: "JSON parse hatası", raw: text.slice(0, 200) }, { status: 500 });
    }
  } catch (error) {
    console.error("Suggest error:", error);
    return NextResponse.json({ error: "Öneri üretilemedi" }, { status: 500 });
  }
}
