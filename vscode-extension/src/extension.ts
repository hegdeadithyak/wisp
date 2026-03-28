import * as vscode from "vscode";
import * as http from "http";

const MIDDLEWARE_HOST = "127.0.0.1";
const MIDDLEWARE_PORT = 3000;
const DEBOUNCE_MS = 400;

function httpPost(path: string, body: object, signal: AbortSignal): Promise<string> {
  return new Promise((resolve) => {
    const bodyStr = JSON.stringify(body);
    let rawData = "";
    let settled = false;

    const done = () => {
      if (settled) return;
      settled = true;
      resolve(rawData);
    };

    const req = http.request(
      {
        hostname: MIDDLEWARE_HOST,
        port: MIDDLEWARE_PORT,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyStr),
        },
      },
      (res) => {
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => { rawData += chunk; });
        res.on("end", done);
        res.on("error", done);
      }
    );

    req.on("error", done);
    signal.addEventListener("abort", () => { req.destroy(); done(); });
    req.write(bodyStr);
    req.end();
  });
}

function extractCompletion(sseText: string): string {
  let assembled = "";
  for (const line of sseText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      assembled += (JSON.parse(payload).token ?? "");
    } catch {}
  }
  // Only strip leading newline, keep the rest
  return assembled.replace(/^\n/, "");
}

function extractContext(document: vscode.TextDocument, position: vscode.Position) {
  const fullText = document.getText();
  const offset = document.offsetAt(position);
  return {
    prefix: fullText.slice(Math.max(0, offset - 6000), offset),
    suffix: fullText.slice(offset, offset + 1500),
  };
}

class LocalCopilotProvider implements vscode.InlineCompletionItemProvider {
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private activeController: AbortController | undefined;

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    _token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionList | undefined> {

    if (this.activeController) this.activeController.abort();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    const { prefix, suffix } = extractContext(document, position);
    if (prefix.trim().length < 3) return undefined;

    return new Promise<vscode.InlineCompletionList | undefined>((resolve) => {
      this.debounceTimer = setTimeout(async () => {
        const controller = new AbortController();
        this.activeController = controller;
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const raw = await httpPost("/complete", { prefix, suffix }, controller.signal);
        clearTimeout(timeoutId);

        const completion = extractCompletion(raw);
        console.log("[local-copilot] raw:", JSON.stringify(raw.slice(0, 300)));
        console.log("[local-copilot] completion:", JSON.stringify(completion));

        if (!completion) return resolve(undefined);

        resolve(new vscode.InlineCompletionList([
          new vscode.InlineCompletionItem(
            completion,
            new vscode.Range(position, position)
          ),
        ]));
      }, DEBOUNCE_MS);
    });
  }

  dispose() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.activeController) this.activeController.abort();
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log("[local-copilot] activated");
  vscode.window.showInformationMessage("Local Copilot active!");
  const provider = new LocalCopilotProvider();
  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider({ pattern: "**" }, provider),
    { dispose: () => provider.dispose() }
  );
  const bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  bar.text = "$(zap) Local Copilot";
  bar.show();
  context.subscriptions.push(bar);
}

export function deactivate() {}
