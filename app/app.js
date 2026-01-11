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

  // banned gate
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

      // Gates + explicación
      const gate = applyGatesWithExplain(obj);

      if (gate.failed) {
        return {
          fila: i + 2,
          nombre,
          email,
          score: 0,
          maxScore: 100,
          estado: "DESCARTADO_AUTO",
          motivo: gate.reason,
          flags: [],
          correct: gate.correct,
          incorrect: gate.incorrect,
          rowRaw: obj
        };
      }

      // Scoring + explicación
      const sc = applyScoringWithExplain(obj);

      // Flags (no deciden)
      const flags = applyFlags(obj);

let estado_ia = "DESCARTADO_AUTO";
let motivo = "";

if (sc.total >= RULES.thresholds.approve_min) {
  estado_ia = "APTO_AUTO";
  motivo = `Score ≥ ${RULES.thresholds.approve_min}`;
} else if (sc.total >= RULES.thresholds.review_min) {
  estado_ia = "REVISAR_AUTO";
  motivo = `Score ${RULES.thresholds.review_min}–${RULES.thresholds.approve_min - 1}`;
} else {
  estado_ia = "DESCARTADO_AUTO";
  motivo = `Score < ${RULES.thresholds.review_min}`;
}


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
  correct: [...gate.correct, ...sc.correct],
  incorrect: [...gate.incorrect, ...sc.incorrect],
  rowRaw: obj
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

    // Debug
    console.log("RESULTADO FINAL:", results);

  } catch (err) {
    console.error(err);
    alert(err.message || String(err));
    UI.setStatus("Error");
    output.innerHTML = `<p style="color:#ef4444;"><b>Error:</b> ${String(err.message || err)}</p>`;
  }
});
