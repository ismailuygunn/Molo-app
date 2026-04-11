export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

/**
 * GET /api/trends
 * Gemini + Google Search grounding ile güncel TikTok/Reels/Shorts trendlerini çeker.
 * Fallback: Gemini (training data, güncel olmayabilir).
 */
export async function GET() {
  const googleKey = process.env.GOOGLE_API_KEY;

  if (!googleKey) {
    return NextResponse.json({
      error: "API key yapılandırılmamış",
      configured: false,
      trends: [],
    });
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const trendPrompt = `Top 10 viral trends on TikTok, Instagram Reels, YouTube Shorts RIGHT NOW (${today}).

For each trend provide (keep each field SHORT — 1 sentence max):
- name: specific trend name
- platforms: which platforms ["tiktok","reels","shorts"]
- description: 1 sentence about the format/challenge
- mascot_adaptation: 1 sentence — how a cute blue robot brand mascot (like Duolingo owl) could adapt it
- virality: "rising" | "peak" | "declining"
- hashtags: 2-4 related hashtags
- format_type: challenge|skit|pov|grwm|reaction|storytime|duet|sound|meme|dance

MIX of: viral challenges, popular formats (POV, GRWM, storytime, greenscreen), trending sounds, brand mascot strategies (Duolingo, Scrub Daddy, RyanAir), meme templates.

Return ONLY valid JSON — no markdown, no prose:
{"trends":[{"name":"x","platforms":["tiktok"],"description":"x","mascot_adaptation":"x","virality":"rising","hashtags":["#x"],"format_type":"challenge"}]}`;

  // ── Primary: Gemini + Google Search grounding (real-time web search) ──
  try {
    const res = await fetch(
      `${GEMINI_API}?key=${googleKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: "You are a social media trend analyst. Always return valid JSON. Be specific about trend names — not generic descriptions. Keep descriptions concise (max 1 sentence each)." }],
          },
          contents: [{ parts: [{ text: trendPrompt }] }],
          tools: [{ googleSearch: {} }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 16000 },
        }),
        signal: AbortSignal.timeout(45000),
      }
    );

    if (res.ok) {
      const data = await res.json();
      // Grounded responses can have multiple parts — concatenate all text parts
      const parts = data.candidates?.[0]?.content?.parts || [];
      const text = parts
        .map((p: { text?: string }) => p.text || "")
        .join("");
      const parsed = parseJson(text);
      if (parsed?.trends?.length) {
        return NextResponse.json({
          ...parsed,
          fetched_at: new Date().toISOString(),
          source: "gemini-grounded",
          configured: true,
        });
      }
      console.error("Grounded parse failed. finishReason:", data.candidates?.[0]?.finishReason, "text length:", text.length);
    } else {
      console.error("Grounded search HTTP error:", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("Grounded search exception:", err);
  }

  // ── Fallback: Gemini without grounding (training data) ──
  try {
    const res = await fetch(
      `${GEMINI_API}?key=${googleKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: trendPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 16000 },
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (res.ok) {
      const data = await res.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const text = parts
        .map((p: { text?: string }) => p.text || "")
        .join("");
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
      console.error("Fallback parse failed. finishReason:", data.candidates?.[0]?.finishReason, "text length:", text.length);
    } else {
      console.error("Fallback HTTP error:", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("Fallback exception:", err);
  }

  return NextResponse.json({
    error: "Trend verisi alınamadı",
    trends: [],
    configured: true,
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
