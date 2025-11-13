import { NextRequest } from "next/server";

type AspectRatio = "16:9" | "9:16";

function parseDurationSeconds(text: string): number | null {
  const lower = text.toLowerCase();
  // explicit allowed durations
  const allowed = new Set([88, 60, 180, 300, 600]);

  const patterns = [
    /(\d+)\s*(sec|secs|second|seconds)\b/,
    /(\d+)\s*(min|mins|minute|minutes)\b/,
  ];
  for (const re of patterns) {
    const m = lower.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      const unit = m[2];
      let seconds = n;
      if (unit.startsWith("min")) seconds = n * 60;
      if (allowed.has(seconds)) return seconds;
      // Snap to nearest allowed
      const choices = Array.from(allowed.values());
      let best = choices[0];
      let bestDiff = Math.abs(choices[0] - seconds);
      for (const c of choices) {
        const diff = Math.abs(c - seconds);
        if (diff < bestDiff) {
          best = c;
          bestDiff = diff;
        }
      }
      return best;
    }
  }
  return null;
}

function parseAspect(text: string): AspectRatio | null {
  const lower = text.toLowerCase().replace(/\s+/g, "");
  if (/(16[:x]?9)/.test(lower)) return "16:9";
  if (/(9[:x]?16)/.test(lower)) return "9:16";
  if (/landscape/.test(lower)) return "16:9";
  if (/portrait|vertical/.test(lower)) return "9:16";
  return null;
}

function stripKnown(text: string): string {
  return text
    .replace(/\b(16\s*[:x]?\s*9|9\s*[:x]?\s*16|landscape|portrait|vertical)\b/gi, "")
    .replace(/\b\d+\s*(sec|secs|second|seconds|min|mins|minute|minutes)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function POST(req: NextRequest) {
  const { message } = (await req.json()) as { message: string };
  const text = String(message ?? "").slice(0, 2000);

  const aspect = parseAspect(text) ?? "16:9";
  const durationSeconds = parseDurationSeconds(text) ?? 60;
  const prompt = stripKnown(text) || "A cinematic nature scene";

  const reply = `Okay. I set aspect to ${aspect}, duration to ${durationSeconds} seconds. Prompt: "${prompt}"`;

  return Response.json({ reply, prompt, durationSeconds, aspectRatio: aspect });
}
