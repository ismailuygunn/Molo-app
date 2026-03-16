export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

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
    const { contentType, lang, tone, existingTopics } = await req.json();

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GOOGLE_API_KEY tanımlı değil" }, { status: 500 });
    }

    const platform = PLATFORM_CONTEXT[contentType] || PLATFORM_CONTEXT.sosyal;
    const langLabel = lang === "de" ? "Almanca (Almanya'daki Türk diş kliniği)" : "Türkçe";
    const existingText = existingTopics?.length
      ? `\n\nDaha önce üretilmiş konular (BUNLARI TEKRAR ÖNERME):\n${existingTopics.map((t: string) => `- ${t}`).join("\n")}`
      : "";

    const prompt = `Sen İSTADENTAL diş kliniğinin maskotu MOLO için yaratıcı içerik önerileri üreten bir asistansın.

MOLO KARAKTERİ:
- Mavi-beyaz sevimli robot maskot
- Başında hologram konisi var
- Çocuklar ve yetişkinler tarafından sevilen
- Komik, pozitif, sevecen kişilik
- ISTADENTAL logolu tişört giyer

PLATFORM: ${platform}

DİL: ${langLabel}
TON: ${tone || "Eğlenceli"}
${existingText}

Şimdi 6 adet yaratıcı, viral potansiyelli, özgün içerik önerisi üret. Her öneri için:
1. Kısa ve akılda kalıcı bir başlık (emoji ile)
2. 1-2 cümlelik konsept açıklaması
3. Neden bu platformda işe yarayacağını belirten kısa not

Yanıtını SADECE şu JSON formatında ver, başka hiçbir şey yazma:
[
  {
    "title": "başlık",
    "concept": "konsept açıklaması",
    "why": "neden işe yarar"
  }
]`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 1.0,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("Gemini API error:", err);
      return NextResponse.json({ error: "AI yanıt veremedi" }, { status: 502 });
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI yanıtı parse edilemedi", raw: text }, { status: 500 });
    }

    const suggestions = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Suggest error:", error);
    return NextResponse.json({ error: "Öneri üretilemedi" }, { status: 500 });
  }
}
