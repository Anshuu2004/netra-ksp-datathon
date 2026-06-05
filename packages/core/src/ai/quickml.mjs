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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.NETRA_LLM_KEY ? { Authorization: `Bearer ${process.env.NETRA_LLM_KEY}` } : {}),
      },
      body: JSON.stringify({
        // QuickML RAG endpoints accept a question + grounding context; the model must answer
        // ONLY from the provided context and respond in `language`.
        question,
        language: lang === 'kn' ? 'kn' : 'en',
        context: grounding,
        instruction: 'Answer only from the provided context. Be concise and factual. Cite FIR IDs where relevant.',
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.answer || data.output || data.text || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
