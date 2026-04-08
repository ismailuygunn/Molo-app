import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { headers } from "next/headers";

// Force runtime evaluation — env vars are only available at runtime on Railway
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ENV_PATH = resolve(process.cwd(), "..", ".env");

const KEYS = [
  { id: "google", env: "GOOGLE_API_KEY", label: "Google API Key (Gemini)" },
  { id: "elevenlabs", env: "ELEVENLABS_API_KEY", label: "ElevenLabs API Key (Ses)" },
  { id: "perplexity", env: "PERPLEXITY_API_KEY", label: "Perplexity API Key (Trendler)" },
];

export async function GET() {
  // Force dynamic by reading headers (Next.js optimization bypass)
  await headers();

  try {
    // Parse .env file if it exists (local dev)
    const envVars: Record<string, string> = {};
    let envSource = "process.env";
    try {
      const envContent = await readFile(ENV_PATH, "utf-8");
      envSource = "file";
      for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        envVars[key] = val;
      }
    } catch {
      // .env file not found — normal on Railway
    }

    const keys = KEYS.map((k) => {
      // Priority: .env file > process.env
      const val = envVars[k.env] || process.env[k.env] || "";
      const source = envVars[k.env] ? "file" : process.env[k.env] ? "env" : "none";
      return {
        ...k,
        exists: val.length > 0,
        last4: val.length > 4 ? val.slice(-4) : "",
        length: val.length,
        source,
      };
    });

    return NextResponse.json({
      keys,
      envPath: ENV_PATH,
      envSource,
      nodeEnv: process.env.NODE_ENV || "unknown",
      cwd: process.cwd(),
    });
  } catch (error) {
    console.error("Settings error:", error);
    return NextResponse.json({ error: "Ayarlar okunamadı" }, { status: 500 });
  }
}
