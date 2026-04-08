export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

interface HookResult {
  text: string;
  type: "question" | "statement" | "action" | "emotion" | "pattern_interrupt";
  rationale: string;
}

interface HookOptimizeResponse {
  hooks: HookResult[];
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { currentHook, sceneTexts, lang, trendContext } = await req.json();

    if (!currentHook) {
      return NextResponse.json(
        { error: "currentHook gerekli" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Google API key yapilandirilmamis" },
        { status: 500 }
      );
    }

    const sceneSummary = Array.isArray(sceneTexts)
      ? sceneTexts
          .map((t: string, i: number) => `Scene ${i + 1}: ${t.slice(0, 80)}`)
          .join("\n")
      : "";

    const langLabel =
      lang === "tr" ? "Turkish" : lang === "en" ? "English" : "German";

    const systemPrompt = `You are a TikTok content optimization expert for MOLO, a small blue robot mascot character for IstaDental (dental clinic brand).

Your job: Generate 5 alternative HOOK texts (the first 1-3 seconds of a TikTok video) that will maximize scroll-stopping power.

MOLO's personality: warm, slightly mischievous, intelligent, playful. Robot perspective on human dental world.

Current hook: "${currentHook}"

Video content summary:
${sceneSummary}

Language: ${langLabel}
${trendContext ? `Trend context: ${trendContext}` : ""}

Generate 5 hooks, each with a different strategy:
1. QUESTION: A surprising question that demands an answer
2. STATEMENT: A bold/controversial/funny statement
3. ACTION: Start mid-action, as if something just happened
4. EMOTION: Appeal to fear, curiosity, or excitement
5. PATTERN INTERRUPT: Something unexpected that breaks the scroll pattern

Return ONLY valid JSON:
{
  "hooks": [
    { "text": "hook text", "type": "question", "rationale": "Why this works (1 sentence)" },
    { "text": "hook text", "type": "statement", "rationale": "..." },
    { "text": "hook text", "type": "action", "rationale": "..." },
    { "text": "hook text", "type": "emotion", "rationale": "..." },
    { "text": "hook text", "type": "pattern_interrupt", "rationale": "..." }
  ]
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            temperature: 1.0,
            maxOutputTokens: 2048,
          },
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      return NextResponse.json(
        { error: err.error?.message || "Gemini API hatasi" },
        { status: 500 }
      );
    }

    const data = await response.json();
    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "";

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
      const parsed: HookOptimizeResponse = JSON.parse(cleaned);
      return NextResponse.json(parsed);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed: HookOptimizeResponse = JSON.parse(match[0]);
        return NextResponse.json(parsed);
      }
      return NextResponse.json({ hooks: [], error: "Hook parse edilemedi" });
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Hook optimize edilemedi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
