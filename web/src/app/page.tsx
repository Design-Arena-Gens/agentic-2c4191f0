"use client";

import { useCallback, useMemo, useState } from "react";

type AspectRatio = "16:9" | "9:16";

const DURATIONS = [88, 60, 180, 300, 600] as const;

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState<number>(60);
  const [aspect, setAspect] = useState<AspectRatio>("16:9");
  const [isLoading, setIsLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);

  const containerClassName = useMemo(() => {
    return aspect === "16:9" ? "w-full aspect-video" : "w-[360px] sm:w-[420px] aspect-[9/16]";
  }, [aspect]);

  const handleGenerate = useCallback(async () => {
    setIsLoading(true);
    setVideoUrl(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, durationSeconds: duration, aspectRatio: aspect }),
      });
      if (!res.ok) throw new Error("Failed to start generation");
      const data = await res.json();
      setJobId(data.id ?? null);
      // If URL is ready immediately, set it; otherwise poll
      if (data.url) {
        setVideoUrl(data.url);
      } else if (data.id) {
        await pollStatus(data.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [prompt, duration, aspect]);

  const pollStatus = useCallback(async (id: string) => {
    let attempts = 0;
    while (attempts < 40) {
      const res = await fetch(`/api/generate?id=${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === "completed" && data.url) {
          setVideoUrl(data.url);
          return;
        }
      }
      attempts += 1;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }, []);

  const submitChat = useCallback(
    async (text: string) => {
      setMessages((m) => [...m, { role: "user", content: text }]);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          reply: string;
          prompt: string;
          durationSeconds: number;
          aspectRatio: AspectRatio;
        };
        setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
        setPrompt(data.prompt);
        setDuration(data.durationSeconds);
        setAspect(data.aspectRatio);
      }
    },
    []
  );

  return (
    <div className="min-h-screen w-full bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 py-10 sm:grid-cols-2 sm:py-16">
        <section className="order-2 sm:order-1">
          <h1 className="mb-4 text-2xl font-semibold">Veo3 Video Generator</h1>
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the video you want..."
              className="h-28 w-full rounded-md border border-zinc-300 bg-white p-3 text-sm outline-none ring-2 ring-transparent transition focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Duration</label>
              <select
                className="w-full rounded-md border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                {DURATIONS.map((s) => (
                  <option key={s} value={s}>
                    {s === 60 ? "60 seconds" : s === 180 ? "3 minutes" : s === 300 ? "5 minutes" : s === 600 ? "10 minutes" : `${s} seconds`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Aspect Ratio</label>
              <select
                className="w-full rounded-md border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                value={aspect}
                onChange={(e) => setAspect(e.target.value as AspectRatio)}
              >
                <option value="16:9">16:9 (Landscape)</option>
                <option value="9:16">9:16 (Portrait)</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim()}
            className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isLoading ? "Generating?" : "Generate Video"}
          </button>

          <div className="mt-8">
            <div className={`relative overflow-hidden rounded-lg border border-zinc-200 bg-black dark:border-zinc-800 ${containerClassName}`}>
              {videoUrl ? (
                <video
                  key={videoUrl}
                  src={videoUrl}
                  className="h-full w-full object-contain"
                  controls
                  playsInline
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-zinc-400">
                  {jobId ? "Waiting for video?" : "Your video will appear here."}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="order-1 sm:order-2">
          <h2 className="mb-2 text-xl font-semibold">AI Chat Command</h2>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            Type natural language commands like: "make 9:16, 60 seconds, sunrise over mountains".
          </p>
          <ChatBox onSend={submitChat} messages={messages} />
        </section>
      </div>
    </div>
  );
}

function ChatBox({
  onSend,
  messages,
}: {
  onSend: (text: string) => void | Promise<void>;
  messages: { role: "user" | "assistant"; content: string }[];
}) {
  const [text, setText] = useState("");

  return (
    <div className="flex h-[540px] flex-col rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="text-sm text-zinc-500">Ask me to set duration, aspect, and prompt.</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`max-w-[85%] rounded-md px-3 py-2 text-sm ${m.role === "user" ? "ml-auto bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"}`}>
            {m.content}
          </div>
        ))}
      </div>
      <form
        className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800"
        onSubmit={async (e) => {
          e.preventDefault();
          const v = text.trim();
          if (!v) return;
          setText("");
          await onSend(v);
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g., 3 minutes 9:16 forest in rain"
          className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-2 ring-transparent transition focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Send
        </button>
      </form>
    </div>
  );
}
