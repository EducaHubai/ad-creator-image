// Lee la respuesta NDJSON en streaming de /api/batch/results, invocando onItem
// por cada imagen a medida que llega (el payload completo puede ser enorme).
export async function readBatchResults(name, model, onItem) {
  const res = await fetch(`/api/batch/results?name=${encodeURIComponent(name)}&model=${encodeURIComponent(model)}`);
  if (!res.ok) throw new Error(`Batch results HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "", summary = null, done = false;
  while (!done) {
    const { value, done: d } = await reader.read();
    done = d;
    buf += decoder.decode(value || new Uint8Array(), { stream: !d });
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      const obj = JSON.parse(t);
      if (obj.__error) throw new Error(obj.__error);
      if (obj.__done) { summary = obj; continue; }
      await onItem(obj);
    }
  }
  return summary;
}
