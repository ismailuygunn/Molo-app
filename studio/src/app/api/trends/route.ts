export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

const PERPLEXITY_API = "https://api.perplexity.ai/chat/completions";

/**
 * GET /api/trends
 * Perplexity API (sonar model) ile güncel TikTok/Reels/Shorts trendlerini çeker.
 * Fallback: Gemini 2.5 Flash (training data, güncel olmayabilir).
 */
export async function GET() {
  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY;

  if (!perplexityKey && !googleKey) {
    return NextResponse.json({
      error: "API key yapılandırılmamış",
      configured: false,
      trends: [],
    });
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const trendPrompt = `What are the top 10 viral trends on TikTok, Instagram Reels, and YouTube Shorts RIGHT NOW (this week, ${today})?

For each trend provide:
1. Trend name (specific, not generic)
2. Which platforms it's trending on
3. What it is (1-2 sentences, be specific about the format/challenge)
4. How a cute blue robot brand mascot character (like Duolingo owl) could adapt this trend
5. Whether it's rising, at peak, or declining
6. Related hashtags
7. Format type (challenge, skit, pov, grwm, reaction, storytime, duet, sound, meme, dance)

Include a MIX of:
- Viral challenges and dances
- Popular video formats (POV, GRWM, storytime, "nobody:", greenscreen)
- Trending sounds/audios currently being used
- Brand mascot content strategies (what Duolingo owl, Scrub Daddy, Nutter Butter, RyanAir are doing)
- Meme formats and templates
- Any health/dental related viral content

Return ONLY a valid JSON object with this exact structure:
{
  "trends": [
    {
      "name": "specific trend name",
      "platforms": ["tiktok", "reels", "shorts"],
      "description": "What this trend is and how it works",
      "mascot_adaptation": "How a brand mascot robot character could do this",
      "virality": "rising",
      "hashtags": ["#hashtag1", "#hashtag2"],
      "format_type": "challenge"
    }
  ]
}`;

  // ── Try Perplexity first (real-time web search) ──
  if (perplexityKey) {
    try {
      const res = await fetch(PERPLEXITY_API, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${perplexityKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            {
              role: "system",
              content: "You are a social media trend analyst. Always return valid JSON. Be specific about trend names — not generic descriptions.",
            },
            {
              role: "user",
              content: trendPrompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 4000,
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || "";
        const parsed = parseJson(text);
        if (parsed?.trends?.length) {
          return NextResponse.json({
            ...parsed,
            fetched_at: new Date().toISOString(),
            source: "perplexity",
            configured: true,
          });
        }
      }
    } catch {
      // Perplexity failed, try fallback
    }
  }

  // ── Fallback: Gemini 2.5 Flash (training data) ──
  if (googleKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: trendPrompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 4000 },
          }),
          signal: AbortSignal.timeout(20000),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const parsed = parseJson(text);
        if (parsed?.trends?.length) {
          return NextResponse.json({
            ...parsed,
            fetched_at: new Date().toISOString(),
            source: "gemini-fallback",
            configured: true,
            _note: "Gemini bilgisine dayalı, gerçek zamanlı olmayabilir",
          });
        }
      }
    } catch {
      // Both failed
    }
  }

  return NextResponse.json({
    error: "Trend verisi alınamadı",
    trends: [],
    configured: !!perplexityKey,
  }, { status: 500 });
}

function parseJson(text: string): { trends: unknown[] } | null {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) cleaned = cleaned.split("\n").slice(1).join("\n");
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, cleaned.lastIndexOf("```"));
  if (cleaned.startsWith("json")) cleaned = cleaned.slice(4).trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* */ }
    }
    return null;
  }
}
