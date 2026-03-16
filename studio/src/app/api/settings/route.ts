import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { resolve } from "path";

const ENV_PATH = resolve(process.cwd(), "..", ".env");

const KEYS = [
  { id: "google", env: "GOOGLE_API_KEY", label: "Google API Key" },
  { id: "kling_access", env: "KLING_API_ACCESS", label: "Kling Access Key" },
  { id: "kling_secret", env: "KLING_API_SECRET", label: "Kling Secret Key" },
  { id: "elevenlabs", env: "ELEVENLABS_API_KEY", label: "ElevenLabs API Key" },
];

export async function GET() {
  try {
    // Read .env file
    let envContent = "";
    try {
      envContent = await readFile(ENV_PATH, "utf-8");
    } catch {
      return NextResponse.json({ keys: KEYS.map((k) => ({ ...k, exists: false, last4: "" })) });
    }

    // Parse .env
    const envVars: Record<string, string> = {};
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      // Remove quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      envVars[key] = val;
    }

    const keys = KEYS.map((k) => {
      const val = envVars[k.env] || process.env[k.env] || "";
      return {
        ...k,
        exists: val.length > 0,
        last4: val.length > 4 ? val.slice(-4) : "",
        length: val.length,
      };
    });

    return NextResponse.json({ keys, envPath: ENV_PATH });
  } catch (error) {
    console.error("Settings error:", error);
    return NextResponse.json({ error: "Ayarlar okunamadı" }, { status: 500 });
  }
}
