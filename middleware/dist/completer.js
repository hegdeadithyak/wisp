import * as http from "http";
const LLAMA_HOST = "127.0.0.1";
const LLAMA_PORT = 8080;
export async function streamCompletion(opts, sseResponse) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            prompt: opts.prompt,
            n_predict: opts.maxTokens ?? 48,
            temperature: opts.temperature ?? 0.15,
            stop: opts.stopTokens,
            stream: true,
            cache_prompt: true,
            repeat_penalty: 1.1,
            reasoning_format: "none",
        });
        const reqOptions = {
            hostname: LLAMA_HOST,
            port: LLAMA_PORT,
            path: "/completion",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
            },
        };
        if (!sseResponse.headersSent) {
            sseResponse.setHeader("Content-Type", "text/event-stream");
            sseResponse.setHeader("Cache-Control", "no-cache");
            sseResponse.setHeader("Connection", "keep-alive");
            sseResponse.flushHeaders();
        }
        let assembled = "";
        let buffer = "";
        let finished = false;
        const finish = () => {
            if (finished)
                return;
            finished = true;
            sseResponse.write("data: [DONE]\n\n");
            resolve(assembled);
        };
        const llamaReq = http.request(reqOptions, (llamaRes) => {
            llamaRes.setEncoding("utf8");
            llamaRes.on("data", (chunk) => {
                buffer += chunk;
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith("data:"))
                        continue;
                    const payload = trimmed.slice(5).trim();
                    if (!payload)
                        continue;
                    try {
                        const json = JSON.parse(payload);
                        const token = (json.content ?? "").replace(/[\x00-\x08\x0B-\x1F\x7F]/g, "");
                        const stop = json.stop ?? false;
                        if (token) {
                            assembled += token;
                            sseResponse.write(`data: ${JSON.stringify({ token, stop })}\n\n`);
                        }
                        if (stop) {
                            llamaRes.destroy();
                            finish();
                            return;
                        }
                    }
                    catch {
                        // skip malformed lines
                    }
                }
            });
            // ✅ Always finish when stream ends — even if stop:true never fired
            llamaRes.on("end", finish);
            llamaRes.on("error", (e) => { finish(); reject(e); });
        });
        llamaReq.on("error", (err) => {
            if (!finished)
                reject(err);
        });
        opts.signal?.addEventListener("abort", () => {
            llamaReq.destroy();
            finish();
        });
        llamaReq.write(body);
        llamaReq.end();
    });
}
export async function completeOnce(opts) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            prompt: opts.prompt,
            n_predict: opts.maxTokens ?? 48,
            temperature: opts.temperature ?? 0.15,
            stop: opts.stopTokens,
            stream: false,
            cache_prompt: true,
            reasoning_format: "none",
        });
        const req = http.request({ hostname: LLAMA_HOST, port: LLAMA_PORT, path: "/completion", method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } }, (res) => {
            let data = "";
            res.on("data", (c) => (data += c));
            res.on("end", () => {
                try {
                    resolve((JSON.parse(data).content ?? "").trim());
                }
                catch {
                    reject(new Error("Invalid JSON"));
                }
            });
        });
        req.on("error", reject);
        req.write(body);
        req.end();
    });
}
