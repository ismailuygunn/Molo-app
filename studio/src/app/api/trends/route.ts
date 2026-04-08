export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

/**
 * GET /api/trends
 * Gemini search grounding ile güncel TikTok trendlerini çeker.
 * Google API key ile çalışır, ek API key gerektirmez.
 */
export async function GET() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Google API key yapılandırılmamış" }, { status: 500 });
  }

  try {
    // Gemini 2.0 Flash with Google Search grounding
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a TikTok trend analyst. Search the web for the LATEST TikTok trends happening RIGHT NOW (this week).

I need:
1. Top 5 VIRAL TikTok trends/challenges happening globally this week (any category — comedy, dance, POV, storytelling, brand mascots like Duolingo owl, etc.)
2. Top 5 trending TikTok formats/templates (e.g., "Get Ready With Me", "POV:", "Day in the life", "Things that just make sense", etc.)
3. Top 5 trending hashtags on TikTok right now
4. Any brand mascot or character-driven content trends (like Duolingo, Scrub Daddy, etc.) — these are VERY relevant for our mascot character MOLO

For each trend, include: name, short description (1 sentence), and why it's going viral.

Return ONLY valid JSON:
{
  "fetched_at": "ISO date string",
  "viral_trends": [
    { "name": "trend name", "description": "what it is", "why_viral": "why it works", "adaptable": true }
  ],
  "formats": [
    { "name": "format name", "template": "how the format works", "example": "example caption or setup" }
  ],
  "hashtags": [
    { "tag": "#hashtag", "context": "why it's trending" }
  ],
  "mascot_trends": [
    { "brand": "brand name", "what_they_do": "description", "adaptation_idea": "how MOLO could adapt this" }
  ]
}`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          },
          tools: [{
            google_search: {}
          }],
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      // Fallback: try without search grounding (older models)
      return await fallbackWithoutGrounding(apiKey);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Extract grounding metadata if available
    const groundingMetadata = data.candidates?.[0]?.groundingMetadata;
    const searchQueries = groundingMetadata?.searchEntryPoint?.renderedContent || null;

    // Parse JSON from response
    const parsed = parseJsonFromText(text);
    if (parsed) {
      return NextResponse.json({
        ...parsed,
        _grounded: !!groundingMetadata,
        _source: "gemini-2.0-flash-search-grounding",
      });
    }

    return NextResponse.json({ error: "Trend verisi parse edilemedi", raw: text.slice(0, 500) }, { status: 500 });
  } catch (error) {
    console.error("Trends API error:", error);
    return NextResponse.json({ error: "Trend verisi alınamadı" }, { status: 500 });
  }
}

/** Fallback: Gemini 2.5 Flash without search grounding (uses training data) */
async function fallbackWithoutGrounding(apiKey: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a TikTok trend analyst. Based on your knowledge of recent TikTok trends (as recent as possible), provide:

1. Top 5 viral TikTok trends/challenges (global, any category)
2. Top 5 trending formats/templates
3. Top 5 popular hashtags
4. Brand mascot/character content trends (Duolingo, Scrub Daddy style)

Return ONLY valid JSON:
{
  "fetched_at": "${new Date().toISOString()}",
  "viral_trends": [{ "name": "", "description": "", "why_viral": "", "adaptable": true }],
  "formats": [{ "name": "", "template": "", "example": "" }],
  "hashtags": [{ "tag": "", "context": "" }],
  "mascot_trends": [{ "brand": "", "what_they_do": "", "adaptation_idea": "" }],
  "_note": "Based on training data, not real-time search"
}`
          }]
        }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 4096 },
      }),
      signal: AbortSignal.timeout(30000),
    }
  );

  if (!response.ok) {
    return NextResponse.json({ error: "Gemini API hatası" }, { status: 500 });
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const parsed = parseJsonFromText(text);

  if (parsed) {
    return NextResponse.json({
      ...parsed,
      _grounded: false,
      _source: "gemini-2.5-flash-fallback",
    });
  }

  return NextResponse.json({ error: "Trend verisi parse edilemedi" }, { status: 500 });
}

/** JSON extraction helper */
function parseJsonFromText(text: string): Record<string, unknown> | null {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.split("\n").slice(1).join("\n");
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, cleaned.lastIndexOf("```"));
  }
  if (cleaned.startsWith("json")) {
    cleaned = cleaned.slice(4).trim();
  }

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
