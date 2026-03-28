"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const http = __importStar(require("http"));
const MIDDLEWARE_HOST = "127.0.0.1";
const MIDDLEWARE_PORT = 3000;
const DEBOUNCE_MS = 400;
function httpPost(path, body, signal) {
    return new Promise((resolve) => {
        const bodyStr = JSON.stringify(body);
        let rawData = "";
        let settled = false;
        const done = () => {
            if (settled)
                return;
            settled = true;
            resolve(rawData);
        };
        const req = http.request({
            hostname: MIDDLEWARE_HOST,
            port: MIDDLEWARE_PORT,
            path,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(bodyStr),
            },
        }, (res) => {
            res.setEncoding("utf8");
            res.on("data", (chunk) => { rawData += chunk; });
            res.on("end", done);
            res.on("error", done);
        });
        req.on("error", done);
        signal.addEventListener("abort", () => { req.destroy(); done(); });
        req.write(bodyStr);
        req.end();
    });
}
function extractCompletion(sseText) {
    let assembled = "";
    for (const line of sseText.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:"))
            continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]")
            continue;
        try {
            assembled += (JSON.parse(payload).token ?? "");
        }
        catch { }
    }
    // Only strip leading newline, keep the rest
    return assembled.replace(/^\n/, "");
}
function extractContext(document, position) {
    const fullText = document.getText();
    const offset = document.offsetAt(position);
    return {
        prefix: fullText.slice(Math.max(0, offset - 6000), offset),
        suffix: fullText.slice(offset, offset + 1500),
    };
}
class LocalCopilotProvider {
    debounceTimer;
    activeController;
    async provideInlineCompletionItems(document, position, _context, _token) {
        if (this.activeController)
            this.activeController.abort();
        if (this.debounceTimer)
            clearTimeout(this.debounceTimer);
        const { prefix, suffix } = extractContext(document, position);
        if (prefix.trim().length < 3)
            return undefined;
        return new Promise((resolve) => {
            this.debounceTimer = setTimeout(async () => {
                const controller = new AbortController();
                this.activeController = controller;
                const timeoutId = setTimeout(() => controller.abort(), 15000);
                const raw = await httpPost("/complete", { prefix, suffix }, controller.signal);
                clearTimeout(timeoutId);
                const completion = extractCompletion(raw);
                console.log("[local-copilot] raw:", JSON.stringify(raw.slice(0, 300)));
                console.log("[local-copilot] completion:", JSON.stringify(completion));
                if (!completion)
                    return resolve(undefined);
                resolve(new vscode.InlineCompletionList([
                    new vscode.InlineCompletionItem(completion, new vscode.Range(position, position)),
                ]));
            }, DEBOUNCE_MS);
        });
    }
    dispose() {
        if (this.debounceTimer)
            clearTimeout(this.debounceTimer);
        if (this.activeController)
            this.activeController.abort();
    }
}
function activate(context) {
    console.log("[local-copilot] activated");
    vscode.window.showInformationMessage("Local Copilot active!");
    const provider = new LocalCopilotProvider();
    context.subscriptions.push(vscode.languages.registerInlineCompletionItemProvider({ pattern: "**" }, provider), { dispose: () => provider.dispose() });
    const bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    bar.text = "$(zap) Local Copilot";
    bar.show();
    context.subscriptions.push(bar);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map