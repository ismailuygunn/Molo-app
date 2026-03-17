export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

// ─── Kategori Tanımları ───
const CATEGORIES: Record<string, { label: string; desc: string; examples: string }> = {
  trending: {
    label: "🔥 Güncel & Trend",
    desc: "Sosyal medya trendleri, viral akımlar, mevsimsel içerikler",
    examples: "TikTok trendleri, sezonsal kampanyalar, viral challenge'lar, gündem yorumları",
  },
  educational: {
    label: "📚 Eğitici",
    desc: "Diş sağlığı bilgilendirme, bakım ipuçları",
    examples: "Diş fırçalama teknikleri, çocuklara özel bakım, yanlış bilinen doğrular, FAQ",
  },
  humor: {
    label: "😂 Komedi & Şaka",
    desc: "Esprili, mizahi içerikler",
    examples: "Dişçi korkusu şakaları, Molo'nun günlük maceraları, komik durumlar, self-ironi",
  },
  campaign: {
    label: "🎯 Kampanya & Tanıtım",
    desc: "Klinik tanıtım, tedavi tanıtımı",
    examples: "İmplant, diş beyazlatma, ortodonti tanıtımı, fiyat kampanyaları, yeni hizmetler",
  },
  storytelling: {
    label: "📖 Hikaye & Seri",
    desc: "Devam eden hikayeler, karakter gelişimi",
    examples: "Molo'nun günlüğü, hasta hikayeleri, klinik arkası, bir günüm serisi",
  },
  seasonal: {
    label: "🗓️ Mevsimsel & Özel Gün",
    desc: "Tatil, bayram, özel gün içerikleri",
    examples: "Ramazan, bayram, yılbaşı, okul başlangıcı, yaz tatili, dünya diş sağlığı günü",
  },
  interactive: {
    label: "🎮 Etkileşimli",
    desc: "Anket, soru-cevap, quiz formatları",
    examples: "Doğru/yanlış quiz, bunu biliyor muydun, iki resim arasındaki fark, tahmin oyunu",
  },
};

// ─── Platform Bağlamları ───
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
};

export async function POST(req: NextRequest) {
  try {
    const { contentType, lang, tone, existingTopics, category } = await req.json();

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        configured: false,
        suggestions: [],
        categories: CATEGORIES,
        message: "GOOGLE_API_KEY henüz yapılandırılmamış. Ayarlar sayfasından kontrol edin.",
      });
    }

    const platform = PLATFORM_CONTEXT[contentType] || PLATFORM_CONTEXT.sosyal;
    const langLabel = lang === "de" ? "Almanca (Almanya'daki Türk diş kliniği)" : lang === "en" ? "İngilizce" : "Türkçe";
    const todayStr = new Date().toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

    const existingText = existingTopics?.length
      ? `\n\nDaha önce üretilmiş konular (BUNLARI TEKRAR ÖNERME):\n${existingTopics.map((t: string) => `- ${t}`).join("\n")}`
      : "";

    // Kategori seçimine göre talimat
    let categoryInstruction: string;
    let suggestionCount: number;
    if (category && CATEGORIES[category]) {
      const cat = CATEGORIES[category];
      categoryInstruction = `SADECE "${cat.label}" kategorisinden 6 öneri üret.
Kategori açıklaması: ${cat.desc}
Örnek konular: ${cat.examples}
Tüm önerilerin "category" alanı "${category}" olmalı.`;
      suggestionCount = 6;
    } else {
      const allCats = Object.entries(CATEGORIES)
        .map(([key, val]) => `- ${key}: ${val.label} — ${val.desc}. Örnekler: ${val.examples}`)
        .join("\n");
      categoryInstruction = `TÜM kategorilerden 1-2'şer öneri üret (toplam 8 öneri).
Kategoriler:\n${allCats}\n
Her önerinin "category" alanına uygun kategori key'ini yaz.`;
      suggestionCount = 8;
    }

    const prompt = `Sen İSTADENTAL diş kliniğinin maskotu MOLO için yaratıcı içerik önerileri üreten bir asistansın.

BUGÜNÜN TARİHİ: ${todayStr}
Güncel sosyal medya trendlerini ve viral formatları göz önünde bulundur. Mevsimsel ve güncel öneriler yap.

MOLO KARAKTERİ:
- Mavi-beyaz sevimli 3D robot maskot (60cm boyunda, kompakt)
- Başında hologram konisi, koyu lacivert metalik gövde
- Yuvarlak 3D küre gözler (açık mavi-beyaz), geniş siyanimit gülümseme
- Çocuklar ve yetişkinler tarafından sevilen
- ISTADENTAL logolu tişört giyer
- Molo komik yorumlar yapabilir, self-ironi yapabilir, hafif şakalar atabilir
- Ama asla kaba, ofansif veya marka imajını zedeleyici olmamalı

PLATFORM: ${platform}
DİL: ${langLabel}
TON: ${tone || "Eğlenceli ve Yaratıcı"}
${existingText}

${categoryInstruction}

KURALLAR:
- Her öneri benzersiz olmalı — birbirine benzeyen öneriler YASAK.
- Hook'lar merak uyandırıcı, şok edici veya güldürücü olmalı — ilk 3 saniyede scroll'u durdurmalı.
- Diş kliniği bağlamını asla unutma — her içerik İstadental'e değer katmalı.
- Molo'nun kişiliğini yansıt — sevecen, zeki, hafif şakacı, premium.

Yanıtını SADECE şu JSON formatında ver, başka hiçbir şey yazma (${suggestionCount} öneri):
[
  {
    "title": "emoji + akılda kalıcı başlık",
    "concept": "1-2 cümle konsept açıklaması",
    "hook": "Videonun ilk 3 saniyesinde söylenecek/gösterilecek cümle (scroll durdurucu)",
    "why": "Neden işe yarar — hangi kitleye hitap eder, viral potansiyeli nedir (detaylı)",
    "category": "kategori_key",
    "molo_attitude": "Molo bu konuda nasıl davranacak (şakacı/ciddi/heyecanlı/meraklı/vs.)"
  }
]`;

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
      return NextResponse.json({ error: "AI yanıtı parse edilemedi", raw: text.slice(0, 300) }, { status: 500 });
    }

    try {
      const suggestions = JSON.parse(jsonMatch[0]);
      return NextResponse.json({
        suggestions,
        categories: CATEGORIES,
        selectedCategory: category || null,
      });
    } catch {
      return NextResponse.json({ error: "JSON parse hatası", raw: text.slice(0, 300) }, { status: 500 });
    }
  } catch (error) {
    console.error("Suggest error:", error);
    return NextResponse.json({ error: "Öneri üretilemedi" }, { status: 500 });
  }
}

// Kategori listesini frontend'e sun
export async function GET() {
  return NextResponse.json({ categories: CATEGORIES });
}
