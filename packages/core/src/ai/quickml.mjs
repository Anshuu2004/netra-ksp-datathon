// Catalyst QuickML (RAG + LLM Serving) / Zia LLM client.
// Optional production layer: if NETRA_LLM_URL is configured, NETRA polishes its grounded
// narration through QuickML; otherwise it uses the deterministic local templates. The model
// only re-phrases over NETRA's own grounded facts (RAG-style) — it never invents data, so
// answers stay auditable. See catalyst/DEPLOY.md §4.

export function llmConfigured() {
  return !!process.env.NETRA_LLM_URL;
}

/**
 * Re-narrate an answer over its grounding via Catalyst QuickML/Zia. Returns a string, or
 * null on any error/timeout so callers fall back to the template narration.
 */
export async function ragNarrate({ question, grounding, lang = 'en' }) {
  const url = process.env.NETRA_LLM_URL;
  if (!url) return null;
  // Catalyst QuickML LLM Serving contract: POST {model, prompt, instructions, temperature,
  // top_p, top_k, max_tokens}, Zoho OAuth2 header (Zoho-oauthtoken, scope QuickML.deployment.READ),
  // response {response:'...'}. We stay tolerant of other shapes for flexibility.
  const token = process.env.NETRA_LLM_KEY;
  const scheme = process.env.NETRA_LLM_AUTH_SCHEME || 'Zoho-oauthtoken';
  const model = process.env.NETRA_LLM_MODEL || 'Qwen2.5-14B-Instruct';
  const prompt = `Question: ${question}\n\nGrounded facts (answer ONLY from these; reply in ${lang === 'kn' ? 'Kannada' : 'English'}):\n${JSON.stringify(grounding)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `${scheme} ${token}` } : {}) },
      body: JSON.stringify({
        model, prompt,
        instructions: 'Answer only from the provided grounded facts. Be concise and factual. Cite FIR IDs where relevant. Never invent data.',
        temperature: 0.2, top_p: 0.9, top_k: 40, max_tokens: 512,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.response || data.answer || data.output || data.text || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
