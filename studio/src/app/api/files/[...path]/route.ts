export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { stat } from "fs/promises";
import { createReadStream } from "fs";
import { join, extname, resolve } from "path";
import { Readable } from "stream";

const PROJECTS_DIR = resolve(process.cwd(), "..", "projects");

const MIME_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".json": "application/json",
  ".md": "text/markdown",
  ".ass": "text/plain",
  ".srt": "text/plain",
  ".webm": "video/webm",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const filePath = join(PROJECTS_DIR, ...path);

  // Security: ensure path stays within projects dir
  const resolved = resolve(filePath);
  if (!resolved.startsWith(resolve(PROJECTS_DIR))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const s = await stat(filePath);
    if (!s.isFile()) {
      return NextResponse.json({ error: "Not a file" }, { status: 404 });
    }

    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const fileSize = s.size;

    // Handle Range requests for video/audio streaming
    const range = req.headers.get("range");
    if (range && (contentType.startsWith("video/") || contentType.startsWith("audio/"))) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 2 * 1024 * 1024, fileSize - 1); // 2MB chunks
      const chunkSize = end - start + 1;

      const stream = createReadStream(filePath, { start, end });
      const webStream = Readable.toWeb(stream) as ReadableStream;

      return new Response(webStream, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize.toString(),
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // Small files (< 5MB): read into memory (fast for images, JSON, etc.)
    if (fileSize < 5 * 1024 * 1024) {
      const { readFile } = await import("fs/promises");
      const data = await readFile(filePath);
      return new NextResponse(data, {
        headers: {
          "Content-Type": contentType,
          "Content-Length": fileSize.toString(),
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // Large files: stream
    const stream = createReadStream(filePath);
    const webStream = Readable.toWeb(stream) as ReadableStream;

    return new Response(webStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": fileSize.toString(),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
