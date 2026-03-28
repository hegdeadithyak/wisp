export type ModelFamily = "deepseek" | "codellama" | "starcoder" | "generic";
export interface PromptResult { prompt: string; stopTokens: string[]; }

export function buildPrompt(prefix: string, suffix: string, _family: ModelFamily = "generic"): PromptResult {
  return {
    // Direct completion prompt — no instruction headers, just raw code context
    // The model naturally continues the code stream
    prompt: prefix,
    stopTokens: ["\n\n\n", "```", "# %%", "###"],
  };
}
