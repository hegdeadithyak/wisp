export function buildPrompt(prefix, suffix, _family = "generic") {
    return {
        // Direct completion prompt — no instruction headers, just raw code context
        // The model naturally continues the code stream
        prompt: prefix,
        stopTokens: ["\n\n\n", "```", "# %%", "###"],
    };
}
