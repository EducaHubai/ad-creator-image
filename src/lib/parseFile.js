// ─── CSV / XLSX PARSER ──────────────────────────────────────────────
function stripDiacritics(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function firstFiveKeywords(raw) {
  return String(raw || "").split(",").map(k => k.trim()).filter(Boolean).slice(0, 5);
}

function detectDelimiter(headerLine) {
  const semis = (headerLine.match(/;/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  return semis > commas ? ";" : ",";
}

function buildColumnIndex(header) {
  const norm = header.map(h => stripDiacritics(h).toLowerCase());
  return {
    siglasIdx:   norm.findIndex(h => /sigla|acronym|abbr|codigo/i.test(h)),
    nivelIdx:    norm.findIndex(h => /nivel|level|grado/i.test(h)),
    nameIdx:     norm.findIndex(h => /course|name|nombre|title|titulo/i.test(h)),
    urlIdx:      norm.findIndex(h => /url|link|href/i.test(h)),
    keywordsIdx: norm.findIndex(h => /keyword/i.test(h)),
    precioIdx:   norm.findIndex(h => /precio|price/i.test(h)),
  };
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const delim = detectDelimiter(lines[0]);
  const header = lines[0].split(delim).map(h => h.trim().replace(/['"]/g, ""));
  const { siglasIdx, nivelIdx, nameIdx, urlIdx, keywordsIdx, precioIdx } = buildColumnIndex(header);
  return lines.slice(1).map(line => {
    const cols = line.split(delim).map(c => c.trim().replace(/^["']|["']$/g, ""));
    const keywords = keywordsIdx >= 0 ? (cols[keywordsIdx] || "") : "";
    return {
      siglas: siglasIdx >= 0 ? (cols[siglasIdx] || "") : "",
      nivel:  nivelIdx  >= 0 ? (cols[nivelIdx]  || "") : "",
      name:   cols[nameIdx >= 0 ? nameIdx : (siglasIdx >= 0 || nivelIdx >= 0 ? -1 : 0)] || cols[0] || "",
      url:    cols[urlIdx  >= 0 ? urlIdx  : 1] || "",
      precio: precioIdx >= 0 ? (cols[precioIdx] || "") : "",
      keywords,
      keywords5: firstFiveKeywords(keywords),
    };
  }).filter(r => r.name);
}

export async function parseFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "csv" || ext === "tsv" || ext === "txt") {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(parseCSV(e.target.result));
      reader.readAsText(file);
    });
  }
  if (ext === "xlsx" || ext === "xls" || ext === "ods") {
    const { default: readXlsxFile } = await import("read-excel-file/browser");
    const rows = await readXlsxFile(file);
    if (rows.length < 2) return [];
    const header = rows[0].map(h => String(h || ""));
    const { siglasIdx, nivelIdx, nameIdx, urlIdx, keywordsIdx, precioIdx } = buildColumnIndex(header);
    return rows.slice(1).map(row => {
      const keywords = keywordsIdx >= 0 ? String(row[keywordsIdx] || "") : "";
      return {
        siglas: siglasIdx >= 0 ? String(row[siglasIdx] || "") : "",
        nivel:  nivelIdx  >= 0 ? String(row[nivelIdx]  || "") : "",
        name:   String(row[nameIdx >= 0 ? nameIdx : 0] || ""),
        url:    String(row[urlIdx  >= 0 ? urlIdx  : 1] || ""),
        precio: precioIdx >= 0 ? String(row[precioIdx] || "") : "",
        keywords,
        keywords5: firstFiveKeywords(keywords),
      };
    }).filter(r => r.name);
  }
  return [];
}
