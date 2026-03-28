import express, { Request, Response } from "express";
import { trimContext } from "./trimmer.js";
import { buildPrompt, ModelFamily } from "./promptBuilder.js";
import { streamCompletion } from "./completer.js";
import { cacheKey, getCache, setCache } from "./cache.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

const MODEL_FAMILY: ModelFamily =
  (process.env.MODEL_FAMILY as ModelFamily) ?? "deepseek";
const PORT = parseInt(process.env.PORT ?? "3000", 10);

const inflight = new Map<string, AbortController>();

interface CompleteRequest {
  id?: string;
  prefix: string;
  suffix: string;
  maxTokens?: number;
}

app.post("/complete", async (req: Request, res: Response) => {
  const body = req.body as CompleteRequest;
  const { prefix = "", suffix = "", maxTokens } = body;
  const requestId = body.id ?? Math.random().toString(36).slice(2);

  // Cancel existing request with same ID
  const existing = inflight.get(requestId);
  if (existing) {
    existing.abort();
    inflight.delete(requestId);
  }

  const { prefix: trimmedPrefix, suffix: trimmedSuffix } = trimContext(prefix, suffix);

  // Check cache
  const key = cacheKey(trimmedPrefix, trimmedSuffix);
  const cached = getCache(key);
  if (cached) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Cache", "HIT");
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ token: cached, stop: true })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }

  const { prompt, stopTokens } = buildPrompt(trimmedPrefix, trimmedSuffix, MODEL_FAMILY);

  const controller = new AbortController();
  inflight.set(requestId, controller);

  // ✅ FIXED: listen on res.on("close") not req.on("close")
  // req "close" fires when client finishes SENDING the body (too early)
  // res "close" fires when client DISCONNECTS from the response stream
  res.on("close", () => {
    controller.abort();
    inflight.delete(requestId);
  });

  try {
    const completion = await streamCompletion(
      { prompt, stopTokens, maxTokens, signal: controller.signal },
      res
    );

    if (completion.trim().length > 0) {
      setCache(key, completion);
    }
  } catch (err: any) {
    const isAbort = err?.message?.includes("Abort") || err?.name === "AbortError";
    if (!isAbort) {
      console.error("[completer] error:", err?.message);
    }
    if (!res.headersSent) {
      res.status(502).json({ error: "Inference backend unavailable" });
    }
  } finally {
    inflight.delete(requestId);
    if (!res.writableEnded) res.end();
  }
});

app.delete("/cancel/:id", (req: Request, res: Response) => {
  const ctrl = inflight.get(req.params.id);
  if (ctrl) {
    ctrl.abort();
    inflight.delete(req.params.id);
    res.status(204).end();
  } else {
    res.status(404).json({ error: "Not found" });
  }
});

app.get("/health", async (_req: Request, res: Response) => {
  try {
    const r = await fetch("http://127.0.0.1:8080/health");
    const data = await r.json() as { status: string };
    res.json({ middleware: "ok", llama: data.status ?? "unknown" });
  } catch {
    res.status(503).json({ middleware: "ok", llama: "unreachable" });
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`[local-copilot] Middleware listening on http://127.0.0.1:${PORT}`);
  console.log(`[local-copilot] Model family: ${MODEL_FAMILY}`);
});
