// ======================================================
// PRESELECCIÓN VENDEDORES — MVP
// FASE A2 (GATES) + FASE B (SCORING) + FASE C (FLAGS)
// + FASE D (SALIDA UI) -> ui.js
// ======================================================


// ======================================================
// CONFIGURACIÓN FORMULARIO (LOCKED)
// OJO: Google Forms/Sheets a veces mete saltos de línea,
// doble espacios y textos de ayuda en el HEADER.
// Por eso NO podemos matchear por string exacto.
// ======================================================

const EXPECTED_HEADERS = [
  "Marca temporal",
  "Dirección de correo electrónico",
  "1/33. Escribí esta frase y agregá tu @usuario principal + ciudad:",
  "2/33. ¿Aceptás cobrar solo por resultados (COMISIÓN)?",
  "3/33. ¿Buscás empleo o sueldo?",
  "4/33. Horas semanales reales",
  "5/33. Conversaciones reales que podés iniciar en 7 días",
  "6/33. ¿Leíste completo el anuncio y la advertencia?",
  "7/33. Hotmart",
  "8/33. Nombre y apellido",
  "9/33. Email de contacto (confirmación)",
  "10/33. País / zona horaria",
  "11/33. Perfil de red social principal",
  "12/33. ¿Vendiste productos digitales o educativos antes?",
  "13/33. ¿Qué vendiste?",
  "14/33. ¿Cómo vendías?",
  "15/33. Contá brevemente tu experiencia comercial",
  "16/33. ¿Tenés comunidad propia?",
  "17/33. Tamaño aproximado",
  "18/33. Listá 3 lugares concretos donde podrías difundir",
  "19/33. ¿Tenés base de contactos?",
  "20/33. ¿Cuál de estas prácticas NO harías nunca?",
  "21/33. ¿Qué significa cobrar solo por resultados?",
  "22/33. ¿Qué responderías si alguien pregunta cuánto voy a ganar?",
  "23/33. ¿Qué cosas NO dirías nunca al presentar este producto?",
  "24/33. Aceptación de reglas",
  "25/33. ¿Alguna vez hiciste spam o te reportaron?",
  "26/33. Explicá qué pasó y qué aprendiste",
  "27/33. DM de presentación del producto",
  "28/33. Post corto para redes",
  "29/33. ¿A qué tipo de cliente apuntarías?",
  "30/33. Acciones concretas primeros 7 días",
  "31/33. ¿Por qué creés que sos apto?",
  "32/33. Comentarios finales",
  "33/33. Si en 30 días no generás ventas, ¿cómo lo interpretás?"
];


// ======================================================
// CARGA DE REGLAS
// ======================================================

let RULES, BANNED_WORDS, ACTION_VERBS, GENERIC_WORDS;

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`No se pudo cargar ${path} (HTTP ${res.status})`);
  return res.json();
}


// ======================================================
// HELPERS
// ======================================================

function canonHeader(h) {
  // Normaliza espacios + recorta, y toma solo la 1ra línea (Forms mete \n + instrucciones)
  return String(h ?? "")
    .split("\n")[0]
    .replace(/\s+/g, " ")
    .trim();
}

function headerNumber(h) {
  // Detecta "12/33." etc al principio
  const m = canonHeader(h).match(/^(\d+)\/33\./);
  return m ? m[1] : null;
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function hasBanned(text) {
  const norm = normalizeText(text);
  return (BANNED_WORDS || []).some(w => norm.includes(normalizeText(w)));
}

function hasActionVerb(text) {
  const norm = normalizeText(text);
  return (ACTION_VERBS || []).some(v => norm.includes(normalizeText(v)));
}

function countValidLines(text, minChars) {
  return normalizeText(text)
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length >= minChars).length;
}

function isGeneric(text) {
  const norm = normalizeText(text);
  let hits = 0;
  for (const w of (GENERIC_WORDS || [])) {
    if (norm.includes(normalizeText(w))) hits++;
  }
  return hits >= 2;
}

function safeStr(v) {
  return String(v ?? "");
}

function toPctTxt(n) {
  // 7.6923 -> "7,69%"
  const v = Math.round(Number(n) * 100) / 100;
  return v.toFixed(2).replace(".", ",") + "%";
}


// ======================================================
// NUEVO — PARTE 2/3 (CERRADAS) ESTRUCTURADA PARA UI
// (ÍNDICE 12: A y B)
// - ESTADO (panel principal) debe depender SOLO de estas 13
// - PUNTAJE: SOLO "0" o "7,69%" (si hay respuesta)
// - JUSTIFICACIÓN: SOLO empieza con "OK porque ..." o "NO ES VALIDO porque ..."
// ======================================================

const Q_CERRADAS_HEADERS = [
  "2/33. ¿Aceptás cobrar solo por resultados (COMISIÓN)?",
  "3/33. ¿Buscás empleo o sueldo?",
  "4/33. Horas semanales reales",
  "5/33. Conversaciones reales que podés iniciar en 7 días",
  "6/33. ¿Leíste completo el anuncio y la advertencia?",
  "7/33. Hotmart",
  "12/33. ¿Vendiste productos digitales o educativos antes?",
  "16/33. ¿Tenés comunidad propia?",
  "17/33. Tamaño aproximado",
  "19/33. ¿Tenés base de contactos?",
  "20/33. ¿Cuál de estas prácticas NO harías nunca?",
  "24/33. Aceptación de reglas",
  "25/33. ¿Alguna vez hiciste spam o te reportaron?"
];

function qidFromHeader33(header) {
  const m = String(header || "").match(/^(\d+)\/33\./);
  return m ? `Q${m[1]}` : "";
}

function questionTextFromHeader33(header) {
  return String(header || "").replace(/^\d+\/33\.\s*/, "").trim();
}

function getGateByHeader(header) {
  const gates = Array.isArray(RULES?.gates) ? RULES.gates : [];
  return gates.find(g => g && g.header === header) || null;
}

function getScoringRuleByHeader(header) {
  // Busca la primera regla de scoring cuyo header coincida (equals/contains_all/map)
  const scoring = RULES?.scoring || {};
  for (const [block, ruleset] of Object.entries(scoring)) {
    if (block === "canales" && ruleset && Array.isArray(ruleset.rules)) {
      for (const r of ruleset.rules) {
        if (r?.header === header) return { block, r };
      }
      continue;
    }
    if (Array.isArray(ruleset)) {
      for (const r of ruleset) {
        if (r?.header === header) return { block, r };
      }
    }
  }
  return null;
}

function evalClosedOk(header, answer) {
  // Regla de decisión (sin inventar reglas nuevas):
  // 1) Si existe GATE para ese header y el gate falla -> NO válido
  // 2) Si existe scoring equals/contains_all/map -> válido si cumple (o suma >0 en map)
  // 3) Si no hay regla, pero hay respuesta -> válido (mínimo)
  // 4) Si no hay respuesta -> no decide columnas (quedan vacías), pero para % cuenta como no OK.

  const a = safeStr(answer).trim();
  if (!a) {
    return { hasAnswer: false, isOk: false, whyCore: "" };
  }

  // 1) Gate del header (si existe)
  const g = getGateByHeader(header);
  if (g) {
    const r = evalGate(g, a);
    if (!r.ok) {
      return { hasAnswer: true, isOk: false, whyCore: g.reason || "No cumple gate" };
    }
  }

  // 2) Scoring rule (si existe)
  const sr = getScoringRuleByHeader(header);
  if (sr && sr.r) {
    const r = sr.r;

    if (r.type === "equals") {
      const ok = a === String(r.value ?? "");
      return {
        hasAnswer: true,
        isOk: ok,
        whyCore: ok ? `respondió "${a}" y coincide con lo esperado` : `respondió "${a}" y no coincide con lo esperado`
      };
    }

    if (r.type === "contains_all") {
      const norm = normalizeText(a);
      const ok = (r.value || []).every(v => norm.includes(normalizeText(v)));
      return {
        hasAnswer: true,
        isOk: ok,
        whyCore: ok ? "incluye todas las reglas obligatorias" : "no incluye todas las reglas obligatorias"
      };
    }

    if (r.type === "map") {
      const pts = Number((r.points_map && (r.points_map[a] ?? r.points_map[String(a)])) || 0);
      const ok = pts > 0;
      return {
        hasAnswer: true,
        isOk: ok,
        whyCore: ok ? `suma puntos (${pts})` : "no suma puntos (0)"
      };
    }
  }

  // 3) Sin reglas: si hay respuesta, lo consideramos válido mínimo
  return { hasAnswer: true, isOk: true, whyCore: "hay respuesta" };
}

function closedJustificationStrict(header, answer, isOk, whyCore) {
  // IMPORTANTE: formato obligatorio
  const a = safeStr(answer).trim();
  if (!a) return "";

  if (isOk) return `OK porque ${whyCore || "cumple la condición"}.`;
  return `NO ES VALIDO porque ${whyCore || "no cumple la condición"}.`;
}

function buildClosedEval(rowObj) {
  const pctWeight = 100 / 13; // 7.6923...

  const detalle = Q_CERRADAS_HEADERS.map(h => {
    const ans = rowObj[h] ?? "";
    const ev = evalClosedOk(h, ans);

    const just = closedJustificationStrict(h, ans, ev.isOk, ev.whyCore);

    // columnas: solo si hay respuesta
    const puntaje = ev.hasAnswer ? (ev.isOk ? toPctTxt(pctWeight) : "0") : "";
    const justificacion_ia = ev.hasAnswer ? just : "";

    return {
      qid: qidFromHeader33(h),
      header: h,
      pregunta: questionTextFromHeader33(h),
      answer: safeStr(ans),
      is_ok: ev.isOk,
      pct_weight: pctWeight,
      puntaje,                 // "7,69%" o "0" o ""
      justificacion_ia         // empieza con OK porque / NO ES VALIDO porque / o ""
    };
  });

  const total = detalle.length; // 13
  const ok_count = detalle.filter(d => d.is_ok).length;
  const bad_count = total - ok_count;

  const pct_ok = Math.round((ok_count / total) * 100);

  return {
    total,
    ok_count,
    bad_count,
    pct_ok,
    detalle
  };
}


// ======================================================
// MAPEO DE HEADERS (CLAVE)
// - Base: "Marca temporal", "Dirección de correo electrónico" por canon()
// - Preguntas: se matchean por NÚMERO "1/33", "2/33", etc.
// ======================================================

function buildHeaderMap(fileHeaders) {
  const byNum = {};
  const byCanon = {};

  fileHeaders.forEach((fh) => {
    const ch = canonHeader(fh);
    byCanon[ch] = fh;

    const num = headerNumber(fh);
    if (num) byNum[num] = fh;
  });

  const map = {};
  for (const eh of EXPECTED_HEADERS) {
    const num = headerNumber(eh);
    if (num) {
      map[eh] = byNum[num] || null;
    } else {
      map[eh] = byCanon[canonHeader(eh)] || null;
    }
  }

  return map;
}

function validateHeaders(fileHeaders, headerMap) {
  const missing = EXPECTED_HEADERS.filter(eh => !headerMap[eh]);
  if (missing.length) {
    throw new Error(
      "El XLSX no trae algunas columnas esperadas (faltantes):\n\n" +
      missing.map(x => `- ${x}`).join("\n") +
      "\n\nSolución: exportá de nuevo desde Google Forms/Sheets, sin modificar encabezados."
    );
  }
}


// ======================================================
// GATES (FASE A2) + CORRECT/INCORRECT
// ======================================================

function evalGate(gate, value) {
  if (gate.type === "equals") {
    const ok = value !== gate.value; // si es igual al valor bloqueante => falla
    return { ok, why: ok ? `OK: ${gate.header}` : `FALLA ${gate.id}: ${gate.reason}` };
  }

  if (gate.type === "min_lines") {
    const lines = countValidLines(value, gate.min_chars_per_line);
    const ok = lines >= gate.min_lines;
    return {
      ok,
      why: ok
        ? `OK: ${gate.header} (líneas válidas: ${lines})`
        : `FALLA ${gate.id}: ${gate.reason} (líneas válidas: ${lines}/${gate.min_lines})`
    };
  }

  if (gate.type === "contains_all") {
    const norm = normalizeText(value);
    const ok = gate.value.every(v => norm.includes(normalizeText(v)));
    return {
      ok,
      why: ok
        ? `OK: ${gate.header} (aceptó reglas)`
        : `FALLA ${gate.id}: ${gate.reason}`
    };
  }

  // desconocido: no bloquea
  return { ok: true, why: `OK: ${gate.header}` };
}

function applyGatesWithExplain(row) {
  const correct = [];
  const incorrect = [];

  for (const gate of RULES.gates) {
    const value = row[gate.header] || "";
    const r = evalGate(gate, value);

    if (r.ok) {
      correct.push(r.why);
      continue;
    }

    incorrect.push(r.why);
    return {
      failed: true,
      reason: gate.reason,
      correct,
      incorrect
    };
  }

  // banned gate (GBAN)
  if (RULES.banned_words_gate?.enabled) {
    let found = null;
    for (const v of Object.values(row)) {
      if (hasBanned(v)) { found = v; break; }
    }

    if (found) {
      incorrect.push(`${RULES.banned_words_gate.reason} (detectado en texto)`);
      return {
        failed: true,
        reason: RULES.banned_words_gate.reason,
        correct,
        incorrect
      };
    } else {
      correct.push("OK: sin palabras prohibidas (banned_words)");
    }
  }

  return { failed: false, reason: null, correct, incorrect };
}


// ======================================================
// SCORING (FASE B) + CORRECT/INCORRECT
// ======================================================

function applyScoringWithExplain(row) {
  let total = 0;
  const correct = [];
  const incorrect = [];

  // Max score: asumimos 100 por diseño, pero lo guardamos explícito
  const maxScore = 100;

  for (const [block, ruleset] of Object.entries(RULES.scoring)) {

    if (block === "canales") {
      let subtotal = 0;

      for (const r of ruleset.rules) {
        const value = row[r.header] || "";

        if (r.type === "min_lines") {
          const lines = countValidLines(value, r.min_chars_per_line);
          const ok = lines >= r.min_lines;
          if (ok) {
            subtotal += r.points;
            correct.push(`+${r.points} [${block}] ${r.header} (líneas válidas: ${lines})`);
          } else {
            incorrect.push(`[${block}] ${r.header} (líneas válidas: ${lines}/${r.min_lines})`);
          }
          continue;
        }

        if (r.type === "map") {
          const pts = (r.points_map?.[value] || 0);
          if (pts > 0) {
            correct.push(`+${pts} [${block}] ${r.header} = "${safeStr(value)}"`);
          } else {
            incorrect.push(`[${block}] ${r.header} = "${safeStr(value)}" (0 pts)`);
          }
          subtotal += pts;
        }
      }

      const applied = Math.min(subtotal, ruleset.cap);
      total += applied;

      if (subtotal > ruleset.cap) {
        correct.push(`[${block}] cap aplicado: ${applied}/${ruleset.cap}`);
      } else {
        correct.push(`[${block}] subtotal: ${applied}/${ruleset.cap}`);
      }

      continue;
    }

    // blocks array
    for (const r of ruleset) {
      const value = row[r.header] || "";

      if (r.type === "equals") {
        const ok = value === r.value;
        if (ok) {
          total += r.points;
          correct.push(`+${r.points} [${block}] ${r.header} = "${safeStr(value)}"`);
        } else {
          incorrect.push(`[${block}] ${r.header} (esperado: "${r.value}", recibido: "${safeStr(value)}")`);
        }
        continue;
      }

      if (r.type === "min_length") {
        const ok = safeStr(value).length >= r.min_chars;
        if (ok) {
          total += r.points;
          correct.push(`+${r.points} [${block}] ${r.header} (len ≥ ${r.min_chars})`);
        } else {
          incorrect.push(`[${block}] ${r.header} (len ${safeStr(value).length}/${r.min_chars})`);
        }
        continue;
      }

      if (r.type === "contains_all") {
        const norm = normalizeText(value);
        const ok = r.value.every(v => norm.includes(normalizeText(v)));
        if (ok) {
          total += r.points;
          correct.push(`+${r.points} [${block}] ${r.header} (contiene reglas)`);
        } else {
          incorrect.push(`[${block}] ${r.header} (faltan reglas obligatorias)`);
        }
        continue;
      }

      if (r.type === "min_length_with_action") {
        const okLen = safeStr(value).length >= r.min_chars;
        const okVerb = hasActionVerb(value);
        const ok = okLen && okVerb;

        if (ok) {
          total += r.points;
          correct.push(`+${r.points} [${block}] ${r.header} (len ≥ ${r.min_chars} + verbo acción)`);
        } else {
          const why = [];
          if (!okLen) why.push(`len ${safeStr(value).length}/${r.min_chars}`);
          if (!okVerb) why.push("sin verbo de acción");
          incorrect.push(`[${block}] ${r.header} (${why.join(" + ")})`);
        }
      }
    }
  }

  // clamp por seguridad
  total = Math.max(0, Math.min(maxScore, total));

  return { total, maxScore, correct, incorrect };
}


// ======================================================
// FLAGS (FASE C — NO DECIDEN)
// ======================================================

const FLAG_FIELDS = [
  "15/33. Contá brevemente tu experiencia comercial",
  "21/33. ¿Qué significa cobrar solo por resultados?",
  "22/33. ¿Qué responderías si alguien pregunta cuánto voy a ganar?",
  "23/33. ¿Qué cosas NO dirías nunca al presentar este producto?",
  "27/33. DM de presentación del producto",
  "28/33. Post corto para redes",
  "30/33. Acciones concretas primeros 7 días",
  "31/33. ¿Por qué creés que sos apto?",
  "33/33. Si en 30 días no generás ventas, ¿cómo lo interpretás?"
];

function applyFlags(row) {
  const flags = [];

  for (const h of FLAG_FIELDS) {
    const v = row[h] || "";
    if (safeStr(v).length < 120) flags.push("FLAG_TEXTO_CORTO");
    if (isGeneric(v)) flags.push("FLAG_TEXTO_GENERICO");
    if (!hasActionVerb(v)) flags.push("FLAG_SIN_VERBOS");
    if (/ingres|ganar|rentab|facil|garant/i.test(safeStr(v))) {
      flags.push("FLAG_RIESGO_MARKETING");
    }
  }

  if (!safeStr(row["9/33. Email de contacto (confirmación)"]).includes("@") ||
      !/(http|@)/.test(safeStr(row["11/33. Perfil de red social principal"]))) {
    flags.push("FLAG_DATOS_INCONSISTENTES");
  }

  return [...new Set(flags)];
}


// ======================================================
// DOM
// ======================================================

const fileInput = document.getElementById("fileInput");
const output = document.getElementById("output");


// ======================================================
// PASO 2.3 — Integración capa humana + dataset activo
// - crea ds = { meta, results, human_overrides }
// - conserva human_overrides si es el mismo archivo (fingerprint)
// - enriquece results con: score_auto/score_humano/score_total + estado_final + pendiente_humano
// ======================================================

function enrichResultsWithHuman(ds) {
  const hasHuman = (window.HumanPSV && typeof HumanPSV.getOverride === "function");
  const out = (ds.results || []).map(r => {
    const rowIndex = r.fila;               // usamos "fila" como row_index (estable y único)
    const email = r.email || "";
    const override = hasHuman ? HumanPSV.getOverride(ds, email, rowIndex) : null;

    const sc = hasHuman
      ? HumanPSV.computeScores(r.score ?? 0, override)
      : { score_auto: Number(r.score ?? 0), score_humano: 0, score_total: Number(r.score ?? 0) };

    const estadoIA = r.estado_ia || r.estado || "";
    const estadoFinal = hasHuman ? HumanPSV.computeEstadoFinal(estadoIA, override) : estadoIA;
    const pendiente = hasHuman ? HumanPSV.isPendienteHumano(override) : false;

    return {
      ...r,
      score_auto: sc.score_auto,
      score_humano: sc.score_humano,
      score_total: sc.score_total,
      estado_final: estadoFinal,
      pendiente_humano: pendiente
    };
  });

  return out;
}

function loadOrCreateActiveDataset(meta, results, versionRules) {
  const hasStorage = (window.StoragePSV && typeof StoragePSV.loadActiveDataset === "function");
  if (!hasStorage) return { meta: { ...(meta || {}), versionRules }, results: results || [], human_overrides: {} };

  const prev = StoragePSV.loadActiveDataset();
  const same = prev && prev.meta && prev.meta.fingerprint && meta && prev.meta.fingerprint === meta.fingerprint;

  const ds = {
    meta: { ...(meta || {}), versionRules },
    results: results || [],
    human_overrides: (same && prev.human_overrides) ? prev.human_overrides : {}
  };

  StoragePSV.saveActiveDataset(ds);
  return ds;
}


// ======================================================
// EVENTO PRINCIPAL
// ======================================================

fileInput.addEventListener("change", async () => {
  try {
    UI.setStatus("Procesando…");

    const file = fileInput.files[0];
    if (!file || !file.name.endsWith(".xlsx")) {
      alert("Solo XLSX exportado desde Google Sheets.");
      UI.setStatus("Esperando XLSX…");
      return;
    }

    // Cargamos reglas y auxiliares
    RULES = await loadJSON("rules/rules_v1.json");
    BANNED_WORDS = await loadJSON("rules/banned_words.json");
    ACTION_VERBS = await loadJSON("rules/action_verbs.json");
    GENERIC_WORDS = await loadJSON("rules/generic_words.json");

    // Versionado (opcional pero útil)
    let version = "—";
    try {
      const res = await fetch("/version/current.txt");
      if (res.ok) version = (await res.text()).trim();
    } catch (_) {}

    // Parse XLSX
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const fileHeaders = rows[0] || [];
    const dataRows = rows.slice(1);

    // Mapeo robusto: expected -> real header del XLSX
    const headerMap = buildHeaderMap(fileHeaders);

    // Validación: SOLO faltantes reales, NO "extras"
    validateHeaders(fileHeaders, headerMap);

    // Índices rápidos de columnas reales
    const idxByRealHeader = {};
    fileHeaders.forEach((h, i) => { idxByRealHeader[h] = i; });

    // Resultados por fila
    const results = dataRows.map((row, i) => {
      const obj = {};

      // Construimos el objeto con CLAVES "esperadas" (las que usan reglas)
      // pero leyendo los valores desde el header real del XLSX.
      for (const eh of EXPECTED_HEADERS) {
        const realHeader = headerMap[eh];
        const idx = idxByRealHeader[realHeader];
        obj[eh] = (idx !== undefined) ? (row[idx] ?? "") : "";
      }

      // Datos mínimos para UI
      const nombre = obj["8/33. Nombre y apellido"] || "";
      const email = obj["9/33. Email de contacto (confirmación)"] || "";

      // Gates + explicación (se conservan como DEBUG, pero NO deciden ESTADO)
      const gate = applyGatesWithExplain(obj);

      // Scoring completo (se conserva como DEBUG/score, pero NO decide ESTADO)
      // Nota: si falló gate, sc no se calcula (como antes).
      let sc = { total: 0, maxScore: 100, correct: [], incorrect: [] };
      if (!gate.failed) {
        sc = applyScoringWithExplain(obj);
      }

      const flags = applyFlags(obj);

      const correctAll = gate.failed ? [...gate.correct] : [...gate.correct, ...sc.correct];
      const incorrectAll = gate.failed ? [...gate.incorrect] : [...gate.incorrect, ...sc.incorrect];

      // ============================
      // ÍNDICE 12 — PARTE 2/3 (A+B)
      // closed_eval SIEMPRE se calcula desde las 13 cerradas
      // y ESTADO (panel principal) sale SOLO de closed_eval.pct_ok
      // ============================
      const closed_eval = buildClosedEval(obj);

      let estado_ia = "DESCARTADO_AUTO";
      if (closed_eval.pct_ok >= 70) {
        estado_ia = "REVISAR_AUTO";
      } else {
        estado_ia = "DESCARTADO_AUTO";
      }

      // Motivo alineado a Parte 2/3 (sin mezclar con gates/scoring)
      const motivo = `Parte 2/3: ${closed_eval.pct_ok}% (válidas ${closed_eval.ok_count}/13)`;

      return {
        fila: i + 2,
        nombre,
        email,
        score: sc.total,
        maxScore: sc.maxScore,
        estado: estado_ia,
        estado_ia,
        motivo,
        flags,
        correct: correctAll,
        incorrect: incorrectAll,
        rowRaw: obj,
        closed_eval
      };
    });

    // Meta para historial
    const now = new Date();
    const meta = {
      runId: `${now.getTime()}_${Math.random().toString(16).slice(2)}`,
      runAt: now.toLocaleString(),
      fileName: file.name,
      fingerprint: `${file.name}|${file.size}|${file.lastModified}`
    };

    // Render FASE D (UI)
    UI.renderAll({ results, version, meta });

    // Dataset activo (conserva overrides si es mismo XLSX)
    const ds = loadOrCreateActiveDataset(meta, results, version);

    // Enriquecemos para UI con capa humana
    const resultsFinal = enrichResultsWithHuman(ds);

    // Render FASE D (UI) usando FINAL
    UI.renderAll({ results: resultsFinal, version, meta });

    // Debug
    console.log("RESULTADO FINAL:", results);

  } catch (err) {
    console.error(err);
    alert(err.message || String(err));
    UI.setStatus("Error");
    output.innerHTML = `<p style="color:#ef4444;"><b>Error:</b> ${String(err.message || err)}</p>`;
  }
});

document.addEventListener("DOMContentLoaded", () => {
  try {
    if (!window.StoragePSV) return;
    const ds = StoragePSV.loadActiveDataset();
    if (!ds || !ds.results) return;

    const resultsFinal = enrichResultsWithHuman(ds);
    const versionRules = ds.meta?.versionRules || "—";

    UI.renderAll({ results: resultsFinal, version: versionRules, meta: ds.meta || {} });
    UI.setStatus("Procesado ✔ (dataset)");
  } catch (e) {
    console.error(e);
  }
});
