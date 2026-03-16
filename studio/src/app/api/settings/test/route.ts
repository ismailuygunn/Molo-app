export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { keyId } = await req.json();

  try {
    if (keyId === "google") {
      const key = process.env.GOOGLE_API_KEY;
      if (!key) return NextResponse.json({ status: "missing", error: "Key not set" });
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        return NextResponse.json({ status: "ok", message: "Google API bağlantı başarılı" });
      }
      const data = await res.json();
      return NextResponse.json({ status: "error", error: data.error?.message || "API hatası" });
    }

    if (keyId === "elevenlabs") {
      const key = process.env.ELEVENLABS_API_KEY;
      if (!key) return NextResponse.json({ status: "missing", error: "Key not set" });
      const res = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": key },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        return NextResponse.json({ status: "ok", message: "ElevenLabs bağlantı başarılı" });
      }
      return NextResponse.json({ status: "error", error: `HTTP ${res.status}` });
    }

    if (keyId === "kling_access" || keyId === "kling_secret") {
      const access = process.env.KLING_API_ACCESS;
      const secret = process.env.KLING_API_SECRET;
      if (!access || !secret) return NextResponse.json({ status: "missing", error: "Key not set" });
      // Simple connectivity check — just test that keys exist and are non-empty
      if (access.length > 10 && secret.length > 10) {
        return NextResponse.json({ status: "ok", message: "Kling keys configured" });
      }
      return NextResponse.json({ status: "error", error: "Keys too short" });
    }

    return NextResponse.json({ status: "error", error: "Bilinmeyen API key" });
  } catch (error) {
    return NextResponse.json({ status: "error", error: String(error) });
  }
}
