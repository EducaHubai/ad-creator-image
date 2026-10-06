import { useEffect, useRef, useState } from "react";
import { CodeChip, ExpandBtn, Lightbox } from "../components/ui.jsx";
import { readBatchResults } from "../lib/batchResults.js";
import { DEFAULT_BRANDS, isUuid } from "../lib/brands.js";
import { compositeAd } from "../lib/composite.js";
import { generateAdCopy, researchCourse } from "../lib/copywriting.js";
import { FORMAT_SIZES, customDimToSize, parseCustomDim } from "../lib/formats.js";
import { generateImage, generateImagePrompt, openaiSizeForAr } from "../lib/imageGen.js";
import { hasApiKey } from "../lib/llm.js";
import { IMG_DELAY_MS, batchAvailableFor, getImageModel, getImgMode } from "../lib/models.js";
import { FALLBACK_STYLE_VARIANTS, buildStyleVariantPrompt, generateStyleDirections } from "../lib/styleDirections.js";
import { BUCKETS, createBatch, fetchBatch, fetchCreatives, getSignedUrl, insertCreative, updateBatch, uploadFile } from "../lib/supabase";
import { useTheme } from "../theme/tokens.js";

// ─── BATCH PROCESSOR ────────────────────────────────────────────────
export function BatchProcessor({ batch, brands, onUpdate }) {
  const T = useTheme();
  const [items, setItems] = useState([]);
  const [phase, setPhase] = useState("researching");
  const [progress, setProgress] = useState(0);
  // Progreso del job en Google Batch API: { done, total, submittedAt }
  const [batchWait, setBatchWait] = useState(null);
  const [ctrl, setCtrl] = useState("running"); // "running"|"paused"|"cancelled"|"done"|"error"
  const [runKey, setRunKey] = useState(0);
  const [pilotDirections, setPilotDirections] = useState([]);
  const [pilotCandidates, setPilotCandidates] = useState([]);
  const [pilotSelected, setPilotSelected] = useState(null);
  const [pipelineError, setPipelineError] = useState("");
  // Mensaje del fallo de createBatch al arrancar: si el lote no tiene fila en
  // la base, nada de este run sobrevive a un reload — el usuario debe saberlo.
  const [persistWarning, setPersistWarning] = useState("");
  const [lightbox, setLightbox] = useState(null); // { images, index } | null
  const brand = brands.find(b => b.id === batch.config.brandId) || brands[0] || DEFAULT_BRANDS[0];
  const isPausedRef   = useRef(false);
  const isCancelledRef = useRef(false);
  const pilotResolverRef = useRef(null);
  const dbBatchIdRef = useRef(null);
  const errorMessageRef = useRef(null);
  const imagedCourseIndicesRef = useRef([]);
  // El diseño ganador solo existe en el config de la BD (no en batch.config en
  // memoria) — sin este ref, cada checkpoint de progreso lo borraría al
  // reescribir config y el resume perdería la dirección elegida.
  const winningDirectionRef = useRef(null);
  // Set only when reopening an interrupted batch (reload/closed tab) — see
  // persistBatchStart. { doneIndices, byCourseIndex, winningDirection }.
  const resumeStateRef = useRef(null);

  // Config sin payloads pesados para la BD: replicateImage/refImages llevan
  // data URLs de MBs y csvText el CSV entero, y cada checkpoint de progreso
  // reescribe el jsonb completo. Los descriptores de texto que el pipeline
  // necesita al retomar (replicateStyleDescriptor, refImageDescriptor,
  // winningDirection) sí se conservan; courses vive en su columna propia.
  function persistableConfig(config = {}) {
    const { replicateImage, refImages, csvText, courses, ...rest } = config;
    void csvText; void courses;
    return {
      ...rest,
      replicateImage: replicateImage ? { name: replicateImage.name } : null,
      refImagesCount: refImages?.length || 0,
    };
  }

  // Best-effort Supabase persistence — must never break the core generation
  // pipeline. Every call here is self-contained: catches its own errors,
  // logs, and simply no-ops (dbBatchIdRef stays null) if Supabase is
  // unreachable, exactly like the app already behaves without persistence.
  //
  // Checkpoint/resume: only *imaging* is checkpointed (config.imaged_course_ids
  // + the winning style direction, once known). Research/copy for courses not
  // yet imaged are never persisted mid-flight, so those still redo from
  // scratch on resume — full-pipeline resumability would need persisting
  // those too, a separate, larger change.
  async function persistBatchStart() {
    // batch.dbId + no in-memory items = reopened from the batches list (a
    // previous session), not a batch just created in this one — try to
    // resume it instead of creating a duplicate row.
    if (batch.dbId && !batch.items?.length) {
      try {
        const row = await fetchBatch(batch.dbId);
        dbBatchIdRef.current = row.id;
        winningDirectionRef.current = row.config?.winningDirection || null;
        const doneIndices = new Set(row.config?.imaged_course_ids || []);
        if (doneIndices.size) {
          imagedCourseIndicesRef.current = [...doneIndices];
          const creativeRows = await fetchCreatives(row.id);
          const byCourseIndex = {};
          for (const c of creativeRows) {
            const idx = c.params_json?.courseIndex;
            if (idx == null) continue;
            if (!byCourseIndex[idx]) {
              byCourseIndex[idx] = {
                name: c.params_json?.name, siglas: c.params_json?.siglas, nivel: c.params_json?.nivel,
                url: c.params_json?.url, keywords5: c.params_json?.keywords5,
                status: "imaged", copies: [c.params_json?.copy || {}], imagePrompt: c.params_json?.imagePrompt || "",
                composited: {},
              };
            }
            if (c.image_path) {
              try { byCourseIndex[idx].composited[c.format_label || c.id] = await getSignedUrl(BUCKETS.creatives, c.image_path); }
              catch (err) { console.warn("[supabase] No se pudo firmar creatividad al retomar:", err.message); }
            }
          }
          resumeStateRef.current = { doneIndices, byCourseIndex, winningDirection: row.config?.winningDirection || null };
        }
        return;
      } catch (err) {
        console.warn("[supabase] No se pudo retomar el lote, se crea uno nuevo:", err.message);
      }
    }
    try {
      const row = await createBatch({
        name: batch.name || null,
        status: "processing",
        brand_id: isUuid(brand?.id) ? brand.id : null,
        config: persistableConfig(batch.config),
        courses: batch.config.courses || [],
        started_at: new Date().toISOString(),
      });
      dbBatchIdRef.current = row.id;
      setPersistWarning("");
    } catch (err) {
      console.warn("[supabase] No se pudo crear el lote en la base:", err.message);
      setPersistWarning(err.message);
    }
  }

  async function persistBatchEnd(status, extra = {}) {
    if (!dbBatchIdRef.current) return;
    try {
      await updateBatch(dbBatchIdRef.current, { status, completed_at: new Date().toISOString(), ...extra });
    } catch (err) {
      console.warn("[supabase] No se pudo actualizar el lote en la base:", err.message);
    }
  }

  // Called once the style direction is locked in (pilot review resolved, or
  // immediately for replicate) — so an interruption *after* this point can
  // still resume without re-asking the user to pick a pilot winner again.
  async function persistWinningDirection(direction) {
    if (!dbBatchIdRef.current) return;
    winningDirectionRef.current = direction;
    try { await updateBatch(dbBatchIdRef.current, { config: { ...persistableConfig(batch.config), winningDirection: direction, imaged_course_ids: imagedCourseIndicesRef.current } }); }
    catch (err) { console.warn("[supabase] No se pudo guardar el diseño elegido:", err.message); }
  }

  async function persistBatchProgress(courseIndex) {
    if (!dbBatchIdRef.current) return;
    imagedCourseIndicesRef.current = [...imagedCourseIndicesRef.current, courseIndex];
    try {
      await updateBatch(dbBatchIdRef.current, { config: { ...persistableConfig(batch.config), winningDirection: winningDirectionRef.current, imaged_course_ids: imagedCourseIndicesRef.current } });
    } catch (err) {
      console.warn("[supabase] No se pudo guardar el progreso del lote:", err.message);
    }
  }

  async function persistCreative(courseIndex, item, copy, imagePrompt, fmtKey, fmtMeta, dataUrl) {
    if (!dbBatchIdRef.current || !dataUrl) return;
    try {
      const path = `${dbBatchIdRef.current}/${courseIndex}-${fmtKey}-${crypto.randomUUID()}.png`;
      // El server recomprime a WebP y devuelve la ruta final (.webp).
      const storedPath = await uploadFile(BUCKETS.creatives, path, dataUrl);
      await insertCreative({
        batch_id: dbBatchIdRef.current,
        image_path: storedPath,
        width: fmtMeta?.w || null,
        height: fmtMeta?.h || null,
        format_label: fmtKey,
        params_json: {
          courseIndex, name: item.name, siglas: item.siglas, nivel: item.nivel, url: item.url,
          keywords5: item.keywords5, copy, imagePrompt,
        },
      });
    } catch (err) {
      console.warn("[supabase] No se pudo guardar la creatividad:", err.message);
    }
  }

  async function waitIfPaused() {
    while (isPausedRef.current && !isCancelledRef.current) {
      await new Promise(r => setTimeout(r, 150));
    }
  }

  function pause()   { isPausedRef.current = true;  setCtrl("paused"); }
  function resume()  { isPausedRef.current = false; setCtrl("running"); }
  function cancel()  {
    isCancelledRef.current = true; isPausedRef.current = false; setCtrl("cancelled");
    if (pilotResolverRef.current) { pilotResolverRef.current(null); pilotResolverRef.current = null; }
  }
  function restart() {
    isPausedRef.current   = false;
    isCancelledRef.current = false;
    pilotResolverRef.current = null;
    dbBatchIdRef.current = null;
    errorMessageRef.current = null;
    imagedCourseIndicesRef.current = [];
    resumeStateRef.current = null;
    setItems([]);
    setPilotDirections([]);
    setPilotCandidates([]);
    setPilotSelected(null);
    setPipelineError("");
    setPhase("researching");
    setProgress(0);
    setCtrl("running");
    setRunKey(k => k + 1);
  }
  function confirmPilotWinner() {
    if (pilotSelected && pilotResolverRef.current) {
      pilotResolverRef.current(pilotSelected);
      pilotResolverRef.current = null;
    }
  }

  useEffect(() => {
    // Safety net: any error not already caught inline (network failure, unexpected
    // exception, etc.) must still surface — never fail silently / hang the UI.
    runPipeline()
      .then(() => {
        // runPipeline() resolves normally from EVERY early "return" (cancellation
        // checks, explicit pilot-failure branches) as well as full completion —
        // this is the one place that reliably runs after any of them, so it's
        // where cancelled/explicit-error batches get persisted (the success path
        // already persists itself at the bottom of runPipeline).
        if (isCancelledRef.current) {
          onUpdate(batch.id, { status: "cancelled" });
          persistBatchEnd("cancelled");
        } else if (errorMessageRef.current) {
          onUpdate(batch.id, { status: "error", errorMessage: errorMessageRef.current });
          persistBatchEnd("failed", { error_message: errorMessageRef.current });
        }
      })
      .catch(err => {
        setCtrl("error");
        setPipelineError(err?.message || String(err));
        onUpdate(batch.id, { status: "error", errorMessage: err?.message || String(err) });
        persistBatchEnd("failed", { error_message: err?.message || String(err) });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  async function runPipeline() {
    const courses = batch.config.courses || [];
    const total = courses.length;
    const researched = [];
    const hasKeywordsCSV = courses.some(c => c.keywords5?.length);
    const variantCount = batch.config.variantCount || 1;

    const selectedFormats = batch.config.formats || [];
    // Only a genuinely parseable custom size counts — leftover invalid text
    // (e.g. "abc") must never silently become a phantom 1080×1080 format.
    const customDims = (batch.config.customDims || []).filter(d => parseCustomDim(d));
    const formatList = [
      ...selectedFormats.map(fid => ({ key: fid, ...(FORMAT_SIZES[fid] || { w: 1080, h: 1080, api: "1024x1024" }) })),
      ...customDims.map(d => ({ key: d, ...customDimToSize(d) })),
    ];
    const primaryApiSize = formatList[0]?.api || "1:1";

    await persistBatchStart();
    const resume = resumeStateRef.current; // set only when reopening an interrupted batch

    setPhase("researching");
    for (let i = 0; i < total; i++) {
      await waitIfPaused();
      if (isCancelledRef.current) return;
      if (resume?.doneIndices.has(i)) {
        // Already fully imaged before the interruption — reuse the persisted
        // creative(s), skip research/copy/imaging for this course entirely.
        researched.push({ ...courses[i], ...resume.byCourseIndex[i] });
        setItems(prev => [...prev, researched[i]]);
        setProgress(Math.round(((i + 1) / total) * 25));
        continue;
      }
      const c = courses[i];
      setItems(prev => [...prev, { ...c, status: "researching", research: null }]);
      try {
        const research = await researchCourse(c, c.url);
        if (isCancelledRef.current) return;
        researched.push({ ...c, research, status: "researched" });
      } catch (err) {
        researched.push({ ...c, status: "researchFailed", researchError: err?.message || "Error al investigar el curso" });
      }
      setItems(prev => prev.map((it, idx) => idx === i ? researched[i] : it));
      setProgress(Math.round(((i + 1) / total) * 25));
    }

    await waitIfPaused();
    if (isCancelledRef.current) return;

    // Pilot flow: only when the CSV carries per-course keywords AND image
    // generation is available. Course 0 becomes the pilot — 5 AI-brainstormed
    // style directions (bound to the brand's own colors/tone/image rules) are
    // rendered for it, the user approves one, and that same direction (only
    // title/keywords swapped) replicates across the rest of the courses.
    // "replicate" path skips all of this — the user already supplied THE
    // design (one analyzed reference creative), so it's locked in up front
    // and every course (including index 0) goes straight through the normal
    // per-course loop below with no brainstorm/candidates/review step.
    // Resuming an interrupted batch works the same way once the winning
    // direction was already persisted (persistWinningDirection) — no need to
    // re-ask the user to pick a pilot winner again.
    const isReplicatePath = batch.config.path === "replicate";
    const usePilotFlow = !isReplicatePath && !resume?.winningDirection && hasKeywordsCSV && hasApiKey() && researched.length > 0;
    let winningDirection = resume?.winningDirection || (isReplicatePath
      ? { id: "replicated", label: "Creatividad replicada", description: batch.config.replicateStyleDescriptor || "" }
      : null);
    let pilotStartIdx = 0;
    if (isReplicatePath && !resume) persistWinningDirection(winningDirection);

    if (usePilotFlow && researched[0].status === "researchFailed") {
      // Can't build a pilot design without research on course 0 — surface it and stop.
      setCtrl("error");
      errorMessageRef.current = `No se pudo investigar el curso piloto: ${researched[0].researchError}`;
      setPipelineError(errorMessageRef.current);
      return;
    }

    if (usePilotFlow) {
      setPhase("pilot-copy");
      const pilotCourse = researched[0];
      let pilotCopy;
      try {
        pilotCopy = await generateAdCopy(brand, batch.config, pilotCourse, pilotCourse.research || {});
      } catch (err) {
        researched[0] = { ...pilotCourse, status: "copyFailed", copyError: err?.message || "Error al generar copy piloto" };
        setItems(prev => prev.map((it, idx) => idx === 0 ? researched[0] : it));
        setCtrl("error");
        errorMessageRef.current = `No se pudo generar el copy del curso piloto: ${err?.message || err}`;
        setPipelineError(errorMessageRef.current);
        return;
      }
      if (isCancelledRef.current) return;
      researched[0] = { ...pilotCourse, status: "generated", copies: [pilotCopy] };
      setItems(prev => prev.map((it, idx) => idx === 0 ? researched[0] : it));

      setPhase("pilot-brainstorm");
      let directions;
      try {
        directions = await generateStyleDirections(brand, pilotCourse, pilotCourse.keywords5, batch.config.refImageDescriptor);
      } catch {
        directions = FALLBACK_STYLE_VARIANTS.map((s, i) => ({ id: `style_${i + 1}`, label: s.label, description: s.description }));
      }
      setPilotDirections(directions);

      setPhase("pilot-imaging");
      const candidates = [];
      for (const direction of directions) {
        await waitIfPaused();
        if (isCancelledRef.current) return;
        try {
          const prompt = buildStyleVariantPrompt(direction, brand, pilotCourse, pilotCourse.keywords5);
          const imageB64 = await generateImage(prompt, primaryApiSize);
          if (isCancelledRef.current) return;
          const composited = {};
          for (const fmt of formatList) composited[fmt.key] = (await compositeAd(imageB64, pilotCopy, brand, fmt.w, fmt.h)).dataUrl;
          candidates.push({ styleId: direction.id, label: direction.label, composited });
        } catch (err) {
          candidates.push({ styleId: direction.id, label: direction.label, error: err.message });
        }
        setPilotCandidates([...candidates]);
        setProgress(25 + Math.round((candidates.length / directions.length) * 20));
        if (candidates.length < directions.length) await new Promise(r => setTimeout(r, IMG_DELAY_MS));
      }
      if (isCancelledRef.current) return;

      setPhase("pilot-review");
      const chosenId = await new Promise(resolve => { pilotResolverRef.current = resolve; });
      if (isCancelledRef.current || !chosenId) return;
      winningDirection = directions.find(d => d.id === chosenId) || null;
      persistWinningDirection(winningDirection);

      const winner = candidates.find(c => c.styleId === chosenId);
      const pilotImagePrompt = winningDirection ? buildStyleVariantPrompt(winningDirection, brand, pilotCourse, pilotCourse.keywords5) : "";
      researched[0] = {
        ...researched[0], status: "imaged",
        imagePrompt: pilotImagePrompt,
        composited: winner?.composited || {},
      };
      setItems(prev => prev.map((it, idx) => idx === 0 ? researched[0] : it));
      for (const [fmtKey, dataUrl] of Object.entries(winner?.composited || {})) {
        const fmtMeta = formatList.find(f => f.key === fmtKey);
        persistCreative(0, researched[0], pilotCopy, pilotImagePrompt, fmtKey, fmtMeta, dataUrl);
      }
      persistBatchProgress(0);
      pilotStartIdx = 1;
      setProgress(45);
    }

    const copyBase = usePilotFlow ? 45 : 25;
    const remainingCount = Math.max(1, researched.length - pilotStartIdx);

    setPhase("generating");
    for (let i = pilotStartIdx; i < researched.length; i++) {
      await waitIfPaused();
      if (isCancelledRef.current) return;
      const c = researched[i];
      if (c.status === "researchFailed" || c.status === "imaged") {
        // "imaged" here means a resumed course already fully done pre-interruption.
        setProgress(copyBase + Math.round(((i + 1 - pilotStartIdx) / remainingCount) * 25));
        continue;
      }
      try {
        const variants = [];
        for (let v = 0; v < variantCount; v++) {
          await waitIfPaused();
          if (isCancelledRef.current) return;
          variants.push(await generateAdCopy(brand, batch.config, c, c.research || {}));
        }
        researched[i] = { ...c, status: "generated", copies: variants };
      } catch (err) {
        researched[i] = { ...c, status: "copyFailed", copyError: err?.message || "Error al generar copy" };
      }
      setItems(prev => prev.map((it, idx) => idx === i ? researched[i] : it));
      setProgress(copyBase + Math.round(((i + 1 - pilotStartIdx) / remainingCount) * 25));
    }

    await waitIfPaused();
    if (isCancelledRef.current) return;

    // Composita todos los formatos de un curso y lo persiste — compartido por
    // los modos Rápido y Batch.
    async function compositeAndPersist(i, item, firstCopy, imagePrompt, imageB64) {
      const composited = {};
      const qaIssues = {};
      const layoutOverride = isReplicatePath ? batch.config.replicateLayout : undefined;
      for (const fmt of formatList) {
        const result = await compositeAd(imageB64, firstCopy, brand, fmt.w, fmt.h, layoutOverride);
        composited[fmt.key] = result.dataUrl;
        qaIssues[fmt.key] = result.qaIssues;
        setItems(prev => prev.map((it, idx) => idx === i ? { ...it, status: "imaging", composited: { ...composited } } : it));
        persistCreative(i, item, firstCopy, imagePrompt, fmt.key, fmt, composited[fmt.key]);
      }
      researched[i] = { ...item, status: "imaged", imagePrompt, composited, qaIssues };
      persistBatchProgress(i);
    }

    // Espera troceada para poder abortar el polling del batch con Cancelar.
    async function sleepUnlessCancelled(ms) {
      const end = Date.now() + ms;
      while (Date.now() < end && !isCancelledRef.current) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // Image generation (requires a LiteLLM key)
    const batchImageModel = getImageModel();
    if (hasApiKey() && getImgMode() === "batch" && batchAvailableFor(batchImageModel)) {
      // ── Modo Batch (50% más barato, asíncrono): Google Batch API para los
      // modelos Gemini, managed batches de LiteLLM para el de OpenAI ────────
      // NOTA: a diferencia del Modo Rápido, acá /api/batch/submit solo manda
      // {prompt, aspectRatio} — no lleva la imagen de referencia real del
      // camino "replicate" (generateImage's referenceImageDataUrl). Mientras
      // se prueba esa fidelidad, usar Modo Rápido para el camino replicate.
      setPhase("imaging");
      const jobs = [];
      for (let i = pilotStartIdx; i < researched.length; i++) {
        if (isCancelledRef.current) return;
        const item = researched[i];
        if (item.status === "researchFailed" || item.status === "copyFailed" || item.status === "imaged") continue;
        const firstCopy = Array.isArray(item.copies) ? item.copies[0] : {};
        try {
          const imagePrompt = winningDirection
            ? buildStyleVariantPrompt(winningDirection, brand, item, item.keywords5)
            : await generateImagePrompt(brand, item, item.research || {}, firstCopy);
          jobs.push({ courseIndex: i, item, firstCopy, imagePrompt });
          setItems(prev => prev.map((it, idx) => idx === i ? { ...it, status: "imaging" } : it));
        } catch (err) {
          researched[i] = { ...item, status: "imageFailed", imageError: err.message };
          setItems(prev => prev.map((it, idx) => idx === i ? researched[i] : it));
        }
      }

      if (jobs.length) {
        setPhase("batch-wait");
        setBatchWait({ done: 0, total: jobs.length, submittedAt: Date.now() });
        // Chunks de ≤100 (límite de la Batch API de Google para requests inline;
        // el mismo tope para OpenAI acota el JSONL que pasa por el proxy).
        const chunks = [];
        for (let o = 0; o < jobs.length; o += 100) chunks.push(jobs.slice(o, o + 100));
        try {
          const submitted = [];
          for (const chunk of chunks) {
            const res = await fetch("/api/batch/submit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                displayName: batch.name || "adbatch",
                model: batchImageModel,
                items: chunk.map(j => ({ id: String(j.courseIndex), prompt: j.imagePrompt, aspectRatio: primaryApiSize, size: openaiSizeForAr(primaryApiSize) })),
              }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || `Batch submit HTTP ${res.status}`);
            submitted.push({ name: data.name, chunk });
          }

          let doneImages = 0;
          for (const job of submitted) {
            // Poll cada 30s hasta que el job termine.
            let state = "JOB_STATE_PENDING";
            while (!isCancelledRef.current) {
              const res = await fetch(`/api/batch/status?name=${encodeURIComponent(job.name)}&model=${encodeURIComponent(batchImageModel)}`);
              const st = await res.json().catch(() => ({}));
              if (res.ok) {
                state = st.state;
                setBatchWait({ done: doneImages + (st.completedCount || 0), total: jobs.length, submittedAt: Date.now() });
                if (["JOB_STATE_SUCCEEDED", "JOB_STATE_FAILED", "JOB_STATE_CANCELLED", "JOB_STATE_EXPIRED"].includes(state)) break;
              }
              await sleepUnlessCancelled(30000);
            }
            if (isCancelledRef.current) return;

            if (state !== "JOB_STATE_SUCCEEDED") {
              for (const j of job.chunk) {
                researched[j.courseIndex] = { ...j.item, status: "imageFailed", imageError: `Batch ${state}` };
                setItems(prev => prev.map((it, idx) => idx === j.courseIndex ? researched[j.courseIndex] : it));
              }
              continue;
            }

            // Resultados en streaming: compositar cada imagen según llega.
            const byIndex = new Map(job.chunk.map(j => [String(j.courseIndex), j]));
            await readBatchResults(job.name, batchImageModel, async ({ key, data, error }) => {
              const j = byIndex.get(String(key));
              if (!j) return;
              await waitIfPaused();
              if (isCancelledRef.current) return;
              if (error || !data) {
                researched[j.courseIndex] = { ...j.item, status: "imageFailed", imageError: error || "Sin imagen en el batch" };
              } else {
                try {
                  await compositeAndPersist(j.courseIndex, j.item, j.firstCopy, j.imagePrompt, data);
                } catch (err) {
                  researched[j.courseIndex] = { ...j.item, status: "imageFailed", imageError: err.message };
                }
              }
              doneImages++;
              setBatchWait({ done: doneImages, total: jobs.length, submittedAt: Date.now() });
              setItems(prev => prev.map((it, idx) => idx === j.courseIndex ? researched[j.courseIndex] : it));
              setProgress(70 + Math.round((doneImages / jobs.length) * 30));
            });
          }
        } catch (err) {
          // Fallo global del batch (submit/poll/results): marca lo pendiente.
          for (const j of jobs) {
            if (researched[j.courseIndex].status !== "imaged" && researched[j.courseIndex].status !== "imageFailed") {
              researched[j.courseIndex] = { ...j.item, status: "imageFailed", imageError: err.message };
              setItems(prev => prev.map((it, idx) => idx === j.courseIndex ? researched[j.courseIndex] : it));
            }
          }
        }
        setBatchWait(null);
      }
    } else if (hasApiKey()) {
      // ── Modo Rápido: síncrono vía LiteLLM, una a una ─────────────────────
      setPhase("imaging");
      for (let i = pilotStartIdx; i < researched.length; i++) {
        await waitIfPaused();
        if (isCancelledRef.current) return;
        const item = researched[i];
        if (item.status === "researchFailed" || item.status === "copyFailed" || item.status === "imaged") {
          // "imaged" here means a resumed course already fully done pre-interruption.
          setProgress(70 + Math.round(((i + 1 - pilotStartIdx) / remainingCount) * 30));
          continue;
        }
        const firstCopy = Array.isArray(item.copies) ? item.copies[0] : {};
        setItems(prev => prev.map((it, idx) => idx === i ? { ...it, status: "imaging" } : it));
        try {
          const imagePrompt = winningDirection
            ? buildStyleVariantPrompt(winningDirection, brand, item, item.keywords5)
            : await generateImagePrompt(brand, item, item.research || {}, firstCopy);
          if (isCancelledRef.current) return;
          // replicate: manda la imagen de referencia real además del texto —
          // batch.config.replicateImage ya viene stripped de lo persistido
          // (persistableConfig), pero acá seguimos en memoria de la corrida actual.
          const referenceImageDataUrl = isReplicatePath ? batch.config.replicateImage?.data : undefined;
          const imageB64 = await generateImage(imagePrompt, primaryApiSize, referenceImageDataUrl);
          if (isCancelledRef.current) return;
          await compositeAndPersist(i, item, firstCopy, imagePrompt, imageB64);
        } catch (err) {
          researched[i] = { ...item, status: "imageFailed", imageError: err.message };
        }
        setItems(prev => prev.map((it, idx) => idx === i ? researched[i] : it));
        setProgress(70 + Math.round(((i + 1 - pilotStartIdx) / remainingCount) * 30));
        // Respiro entre imágenes (course-cover-engine usa el mismo valor) para
        // no provocar 429 en el proxy con lotes grandes.
        if (i < researched.length - 1) await new Promise(r => setTimeout(r, IMG_DELAY_MS));
      }
    }

    setCtrl("done");
    setPhase("done");
    setProgress(100);
    const allFormats = [...(batch.config.formats || []), ...customDims];
    const finalAdsCount = researched.length * allFormats.length * variantCount;
    onUpdate(batch.id, {
      status: "review",
      adsCount: finalAdsCount,
      items: researched,
      config: { ...batch.config, winningStyleId: winningDirection?.id || null, winningStyleLabel: winningDirection?.label || null },
    });
    persistBatchEnd("done", { ads_count: finalAdsCount });
  }

  const done = items.filter(it => ["generated","imaged","imageFailed","researchFailed","copyFailed"].includes(it.status)).length;
  // Colecciones para el visor: candidatos piloto con imagen y filas ya
  // compuestas — permiten ampliar/navegar sin interferir con la selección.
  const pilotImages = pilotDirections.map(d => {
    const cand = pilotCandidates.find(c => c.styleId === d.id);
    const thumb = cand?.composited ? Object.values(cand.composited)[0] : null;
    return thumb ? { styleId: d.id, src: thumb, title: d.label, subtitle: d.description, downloadName: `piloto_${d.id}.png` } : null;
  }).filter(Boolean);
  const rowImages = items.map((it, idx) => {
    const thumb = it.composited ? Object.values(it.composited)[0] : null;
    return thumb ? { itemIdx: idx, src: thumb, title: it.name, subtitle: it.siglas || "", downloadName: `${(it.siglas || it.name || "ad").replace(/\s/g, "_")}.png` } : null;
  }).filter(Boolean);
  const missingApiKey = !hasApiKey();
  const total = batch.config.courses?.length || 0;
  const barColor = ctrl === "error" ? T.coral : ctrl === "cancelled" ? T.coral : ctrl === "paused" ? T.textMuted : phase === "done" ? T.teal : T.text;
  const phaseLabel = ctrl === "error" ? "Error" : ctrl === "cancelled" ? "Cancelado" : ctrl === "paused" ? "En pausa" : phase === "researching" ? "Investigando cursos..." : phase === "pilot-copy" ? "Generando copy piloto..." : phase === "pilot-brainstorm" ? "Diseñando 5 direcciones de estilo..." : phase === "pilot-imaging" ? "Generando 5 diseños piloto..." : phase === "pilot-review" ? "Esperando aprobación de diseño" : phase === "generating" ? "Generando copy..." : phase === "imaging" ? "Generando imágenes..." : phase === "batch-wait" ? `Batch en Google — ${batchWait ? `${batchWait.done}/${batchWait.total} imágenes` : "enviando"} · normalmente 15min–2h, mantén la pestaña abierta` : "Completado";

  return (
    <div className="fade-in content-area" style={{ flex: 1 }}>
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: "0.06em", textTransform: "uppercase" }}>Procesando</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4, gap: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>{batch.name}</h2>
        {/* Control buttons */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0, paddingTop: 2 }}>
          {ctrl === "running" && (
            <>
              <button onClick={pause} style={{ fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 999, background: T.cream, color: T.text, border: `1px solid ${T.cardBorder}` }}>
                ⏸ Pausar
              </button>
              <button onClick={cancel} style={{ fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 999, background: "#FFE6E8", color: T.accent, border: `1px solid ${T.accent}` }}>
                ✕ Cancelar
              </button>
            </>
          )}
          {ctrl === "paused" && (
            <>
              <button onClick={resume} style={{ fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 999, background: T.teal, color: T.white, border: "none" }}>
                ▶ Reanudar
              </button>
              <button onClick={cancel} style={{ fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 999, background: "#FFE6E8", color: T.accent, border: `1px solid ${T.accent}` }}>
                ✕ Cancelar
              </button>
            </>
          )}
          {(ctrl === "cancelled" || ctrl === "done" || ctrl === "error") && (
            <button onClick={restart} style={{ fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 999, background: T.text, color: T.white, border: "none" }}>
              ↺ Repetir
            </button>
          )}
        </div>
      </div>
      <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 28 }}>{brand?.name} · {total} cursos · {batch.config.formats?.length || 1} formato{batch.config.formats?.length !== 1 ? "s" : ""}</p>

      {ctrl === "error" && (
        <div style={{ padding: "12px 16px", background: T.statusFail.bg, border: `1px solid ${T.accent}`, borderRadius: 10, marginBottom: 20, fontSize: 12, color: T.statusFail.text, lineHeight: 1.5 }}>
          <strong>Error:</strong> {pipelineError || "El lote se detuvo por un error inesperado."}
        </div>
      )}
      {missingApiKey && ctrl !== "error" && (
        <div style={{ padding: "12px 16px", background: "#FFF6E0", border: "1px solid #E0B84D", borderRadius: 10, marginBottom: 20, fontSize: 12, color: "#8A6300", lineHeight: 1.5 }}>
          <strong>Aviso:</strong> sin LiteLLM key configurada — este lote generará solo copy, sin imágenes ni diseño piloto. Configura <CodeChip>LITELLM_API_KEY</CodeChip> en el entorno del server (Coolify) y repite el lote.
        </div>
      )}
      {persistWarning && ctrl !== "error" && (
        <div style={{ padding: "12px 16px", background: "#FFF6E0", border: "1px solid #E0B84D", borderRadius: 10, marginBottom: 20, fontSize: 12, color: "#8A6300", lineHeight: 1.5 }}>
          <strong>Aviso:</strong> este lote no se pudo guardar en Supabase y desaparecerá al recargar la página. Detalle: <CodeChip>{persistWarning}</CodeChip>. Revisa <CodeChip>/api/supabase-ping</CodeChip> en el server.
        </div>
      )}

      <div style={{ background: T.cardBorder, borderRadius: 999, height: 6, marginBottom: 8 }}>
        <div style={{ width: `${progress}%`, height: 6, borderRadius: 999, background: barColor, transition: "width 0.4s ease, background 0.3s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28 }}>
        <span style={{ fontSize: 11, color: ctrl === "paused" ? T.blueMid : ctrl === "cancelled" ? T.coral : T.textMuted, fontWeight: ctrl === "paused" || ctrl === "cancelled" ? 600 : 400 }}>{phaseLabel}</span>
        <span style={{ fontSize: 11, color: T.textMuted }}>{done}/{total} listos</span>
      </div>

      {(phase === "pilot-brainstorm" || phase === "pilot-imaging" || phase === "pilot-review") && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Elige el diseño ganador</div>
            <div style={{ fontSize: 12, color: T.textMuted }}>
              {phase === "pilot-brainstorm"
                ? `Diseñando 5 direcciones de estilo distintas para "${items[0]?.name || "el curso piloto"}", dentro de las reglas de marca…`
                : phase === "pilot-imaging"
                ? `Generando las 5 imágenes para "${items[0]?.name || "el curso piloto"}"…`
                : "Este diseño se replicará en el resto de cursos del CSV, cambiando solo título y keywords."}
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            {pilotDirections.map(direction => {
              const cand = pilotCandidates.find(c => c.styleId === direction.id);
              const thumb = cand?.composited ? Object.values(cand.composited)[0] : null;
              const isSelected = pilotSelected === direction.id;
              const canSelect = phase === "pilot-review" && !!thumb;
              return (
                <div key={direction.id}
                  onClick={() => { if (canSelect) setPilotSelected(direction.id); }}
                  title={direction.description}
                  onMouseEnter={e => { if (canSelect && !isSelected) e.currentTarget.style.borderColor = T.teal; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = T.cardBorder; }}
                  style={{ width: 150, cursor: canSelect ? "pointer" : "default", background: T.card, borderRadius: 12, overflow: "hidden", border: `2px solid ${isSelected ? T.teal : T.cardBorder}`, boxShadow: isSelected ? "0 0 0 3px rgba(96,191,184,0.15)" : "none", transition: "border-color 0.15s, box-shadow 0.15s" }}>
                  <div style={{ position: "relative", width: 150, height: 188, background: T.cream, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {thumb
                      ? <img src={thumb} alt={direction.label} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      : cand?.error
                        ? <span style={{ fontSize: 10, color: T.statusFail.text, padding: 8, textAlign: "center", lineHeight: 1.4 }}>{cand.error}</span>
                        : <div className="spin" style={{ width: 18, height: 18, border: `2px solid ${T.cardBorder}`, borderTopColor: T.textMuted, borderRadius: "50%" }} />
                    }
                    {isSelected && (
                      <div style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: "50%", background: T.teal, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 700 }}>✓</div>
                    )}
                    {thumb && (
                      <ExpandBtn onClick={() => setLightbox({ images: pilotImages, index: Math.max(0, pilotImages.findIndex(p => p.styleId === direction.id)) })} />
                    )}
                  </div>
                  <div style={{ padding: "8px 10px", borderTop: `1px solid ${T.cardBorder}` }}>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{direction.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {phase === "pilot-review" && (
            <button onClick={confirmPilotWinner} disabled={!pilotSelected}
              style={{ marginTop: 16, background: pilotSelected ? T.text : T.cardBorder, color: pilotSelected ? T.white : T.textMuted, fontSize: 13, fontWeight: 700, padding: "10px 24px", borderRadius: 999, cursor: pilotSelected ? "pointer" : "not-allowed" }}>
              Confirmar diseño ganador →
            </button>
          )}
        </div>
      )}

      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 12, overflow: "hidden" }}>
        {items.map((it, i) => {
          const isImaging   = it.status === "imaging";
          const isImaged    = it.status === "imaged";
          const isFailed    = it.status === "imageFailed" || it.status === "researchFailed" || it.status === "copyFailed";
          const isGenerated = it.status === "generated";
          const isResearching = it.status === "researching";
          const dotBg = isImaged ? T.teal : isFailed ? T.coral : isImaging ? T.blueMid : isGenerated ? T.accent : isResearching ? T.blueMid : T.cardBorder;
          const firstThumb = it.composited ? Object.values(it.composited)[0] : null;
          const failMsg = it.status === "researchFailed" ? it.researchError : it.status === "copyFailed" ? it.copyError : it.imageError;
          const statusLabel = isImaged ? "Imagen lista" : isFailed ? `Error: ${failMsg?.slice(0,40)}` : isImaging ? "Generando imagen…" : isGenerated ? "Copy listo" : it.status === "researched" ? "Investigado" : isResearching ? "Investigando…" : "En cola";
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", padding: "10px 18px", borderBottom: i < items.length - 1 ? `1px solid ${T.cardBorder}` : "none", gap: 12 }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: dotBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {(isImaged || isGenerated) && <span style={{ fontSize: 8, color: "#fff", fontWeight: 700 }}>✓</span>}
                {(isImaging || isResearching) && <div className="spin" style={{ width: 8, height: 8, border: "1.5px solid transparent", borderTopColor: "#fff", borderRadius: "50%" }} />}
              </div>
              {firstThumb
                ? <img src={firstThumb} alt={`Ampliar ${it.name}`} title="Ampliar"
                    onClick={() => setLightbox({ images: rowImages, index: Math.max(0, rowImages.findIndex(r => r.itemIdx === i)) })}
                    style={{ width: 36, height: 36, borderRadius: 4, objectFit: "cover", border: `1px solid ${T.cardBorder}`, flexShrink: 0, cursor: "zoom-in" }} />
                : <div style={{ width: 36, height: 36, borderRadius: 4, background: T.cream, flexShrink: 0 }} />
              }
              <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: isImaged ? T.text : T.textMuted, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
              <span style={{ fontSize: 10, color: isFailed ? T.coral : T.textMuted, flexShrink: 0 }}>{statusLabel}</span>
            </div>
          );
        })}
        {Array.from({ length: Math.max(0, total - items.length) }, (_, i) => (
          <div key={`q${i}`} style={{ display: "flex", alignItems: "center", padding: "11px 18px", borderBottom: `1px solid ${T.cardBorder}`, gap: 12, opacity: 0.65 }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: T.cardBorder, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: T.textMuted }}>{batch.config.courses?.[items.length + i]?.name || "..."}</span>
            <span style={{ fontSize: 10, color: T.textMuted }}>En cola</span>
          </div>
        ))}
      </div>
      {lightbox && (
        <Lightbox images={lightbox.images} index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNav={i => setLightbox(lb => lb && { ...lb, index: i })} />
      )}
    </div>
  );
}
