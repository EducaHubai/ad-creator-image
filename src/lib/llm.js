import { appConfig } from "./config";
import { getTextModel } from "./models.js";

// ─── API HELPERS ────────────────────────────────────────────────────
// Todas las llamadas LLM van por el proxy del propio server (/api/llm/chat),
// que añade la LITELLM_API_KEY de su entorno — ninguna credencial viaja en el
// bundle (mismo esquema que course-cover-engine). appConfig llega en runtime
// desde /api/config.
export function hasApiKey() { return !!appConfig.hasLlmKey; }

// Reintentos con backoff exponencial (portado de course-cover-engine): 429/quota
// espera ~60s, 500/503/overloaded backoff 2s→4s→8s con jitter. Los errores de
// billing NO se reintentan — fallan al instante para no colgar el lote un minuto
// por intento en un error que no se va a arreglar solo.
async function withRetry(fn, { maxAttempts = 4, baseDelay = 2000, label = "", onRetry = null } = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const msg = e.message || "";
      const httpStatus = parseInt((msg.match(/(?:LiteLLM|HTTP) (\d+)/) || [])[1]) || 0;
      const isBillingError = /billing account has exceeded|billing.*exceeded|exceeded.*billing/i.test(msg);
      const is429 = !isBillingError && (httpStatus === 429 || /RESOURCE_EXHAUSTED|quota.*exceeded|rate.limit.*exceeded/i.test(msg));
      const isRetryable = is429 || httpStatus === 503 || httpStatus === 500 || /UNAVAILABLE|overloaded|timeout/i.test(msg);
      if (!isRetryable || attempt === maxAttempts) throw e;
      const delay = is429 ? 60000 + Math.random() * 5000 : baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.warn(`[retry ${attempt}/${maxAttempts}] ${label} — esperando ${Math.round(delay / 1000)}s…`, msg.slice(0, 80));
      if (onRetry) onRetry(attempt, delay);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// fetch() no tiene timeout propio — si LiteLLM/el modelo se cuelga (más
// probable con requests pesados, p. ej. imagen de referencia inline en
// base64) el browser esperaba PARA SIEMPRE, sin error ni resolución, y el
// lote quedaba "trabado" sin ningún aviso. AbortController fuerza un límite.
async function fetchWithTimeout(url, opts, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } catch (e) {
    if (e.name === "AbortError") throw new Error(`LiteLLM timeout: sin respuesta tras ${Math.round(timeoutMs / 1000)}s`, { cause: e });
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function callLLMChat(body, { timeoutMs = 120000 } = {}) {
  return withRetry(async () => {
    const res = await fetchWithTimeout("/api/llm/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, timeoutMs);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`LiteLLM ${res.status}: ${err.error?.message || "request failed"}`);
    }
    return res.json();
  }, { label: body.model });
}

// Igual que callLLMChat pero contra la Images API (para gpt-image-2.5 y demás
// modelos de imagen de OpenAI, que no pasan por chat/completions). Timeout
// largo: Sunburst en quality high tarda bastante más que Gemini.
export async function callLLMImages(body, { timeoutMs = 300000 } = {}) {
  return withRetry(async () => {
    const res = await fetchWithTimeout("/api/llm/images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, timeoutMs);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`LiteLLM ${res.status}: ${err.error?.message || "request failed"}`);
    }
    return res.json();
  }, { label: body.model });
}

export async function callOpenAI(systemPrompt, userMessage, maxTokens = 1000, model = getTextModel()) {
  const data = await callLLMChat({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userMessage },
    ],
  });
  return data.choices?.[0]?.message?.content || "";
}

export async function callOpenAIVision(systemPrompt, contentBlocks, maxTokens = 1000, model = getTextModel()) {
  const data = await callLLMChat({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: contentBlocks },
    ],
  });
  return data.choices?.[0]?.message?.content || "";
}

// PDFs viajan como data URLs inline por chat/completions — LiteLLM los convierte
// a inline_data de Gemini (mismo mecanismo que usa course-cover-engine para
// adjuntos). El bridge /v1/responses no cubre modelos gemini en nuestro proxy.
export async function callOpenAIResponsesPDF(systemPrompt, pdfBase64Array, userText, maxTokens = 2000, model = getTextModel()) {
  const fileBlocks = pdfBase64Array.map(b64 => ({
    type: "image_url",
    image_url: { url: `data:application/pdf;base64,${b64}` },
  }));
  return callOpenAIVision(systemPrompt, [...fileBlocks, { type: "text", text: userText }], maxTokens, model);
}
