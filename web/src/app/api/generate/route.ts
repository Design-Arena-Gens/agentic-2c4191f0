import { NextRequest } from "next/server";

type AspectRatio = "16:9" | "9:16";

type JobPayload = {
  provider: "veo3-mock";
  createdAt: number;
  readyAfterMs: number;
  url: string;
  durationSeconds: number;
  aspectRatio: AspectRatio;
  prompt: string;
};

function toJobId(payload: JobPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function fromJobId(id: string): JobPayload | null {
  try {
    const json = Buffer.from(id, "base64url").toString("utf8");
    return JSON.parse(json) as JobPayload;
  } catch {
    return null;
  }
}

const LANDSCAPE_VIDEO =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    prompt: string;
    durationSeconds: number;
    aspectRatio: AspectRatio;
  };

  const prompt = String(body.prompt ?? "").slice(0, 2000);
  const durationSeconds = Number(body.durationSeconds ?? 60);
  const aspectRatio: AspectRatio = body.aspectRatio === "9:16" ? "9:16" : "16:9";

  // Mock provider: simulate a short processing delay, then return a sample URL
  const readyAfterMs = 3000;

  const payload: JobPayload = {
    provider: "veo3-mock",
    createdAt: Date.now(),
    readyAfterMs,
    url: LANDSCAPE_VIDEO,
    durationSeconds,
    aspectRatio,
    prompt,
  };

  const id = toJobId(payload);

  // Optionally, in future: call real provider here when API key present

  return Response.json({ id, status: "processing" });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });
  const payload = fromJobId(id);
  if (!payload) return new Response("Invalid id", { status: 400 });

  const elapsed = Date.now() - payload.createdAt;
  const done = elapsed >= payload.readyAfterMs;
  if (!done) {
    return Response.json({ id, status: "processing" });
  }

  return Response.json({
    id,
    status: "completed",
    url: payload.url,
    durationSeconds: payload.durationSeconds,
    aspectRatio: payload.aspectRatio,
    provider: payload.provider,
  });
}
