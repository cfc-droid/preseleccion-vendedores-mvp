// ======================================================
// PRESELECCIÓN VENDEDORES — MVP
// PASO 15 + 16 + 17 + FASE A2
// - Lee XLSX exportado desde Google Sheets
// - Valida estructura fija de columnas (LOCKED)
// - Mapea semánticamente cada fila
// - Ejecuta GATES DUROS (DESCARTADO_AUTO)
// - Ejecuta Gate de palabras prohibidas (GBAN)
// NO calcula score todavía (FASE B después)
// ======================================================


// ======================================================
// CONFIGURACIÓN FORMULARIO (LOCKED)
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

let RULES = null;
let BANNED_WORDS = null;

async function loadRules() {
  if (RULES) return RULES;
  const res = await fetch("/rules/rules_v1.json");
  RULES = await res.json();
  return RULES;
}

async function loadBannedWords(path) {
  if (BANNED_WORDS) return BANNED_WORDS;
  const res = await fetch(`/rules/${path}`);
  BANNED_WORDS = await res.json();
  return BANNED_WORDS;
}


// ======================================================
// HELPERS
// ======================================================

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function countValidLines(text, minChars) {
  return normalizeText(text)
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length >= minChars).length;
}

function containsBannedWord(text, bannedWords) {
  const norm = normalizeText(text);
  return bannedWords.find(word =>
    norm.includes(normalizeText(word))
  );
}


// ======================================================
// EJECUCIÓN DE GATES DUROS
// ======================================================

function applyGates(row, rules) {
  for (const gate of rules.gates) {
    const value = row._raw[gate.header] || "";

    if (gate.type === "equals") {
      if (value === gate.value) {
        return gate.reason;
      }
    }

    if (gate.type === "min_lines") {
      const validLines = countValidLines(
        value,
        gate.min_chars_per_line
      );
      if (validLines < gate.min_lines) {
        return gate.reason;
      }
    }

    if (gate.type === "contains_all") {
      const norm = normalizeText(value);
      const ok = gate.value.every(v =>
        norm.includes(normalizeText(v))
      );
      if (!ok) {
        return gate.reason;
      }
    }
  }

  return null;
}

function applyBannedWordsGate(row, rules, bannedWords) {
  if (!rules.banned_words_gate?.enabled) return null;

  for (const value of Object.values(row._raw)) {
    const found = containsBannedWord(value, bannedWords);
    if (found) {
      return rules.banned_words_gate.reason;
    }
  }

  return null;
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
  const file = fileInput.files[0];
  if (!file) return;

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    alert("Archivo inválido. Solo se acepta XLSX exportado desde Google Sheets.");
    fileInput.value = "";
    return;
  }

  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (!rows.length) {
    alert("El archivo está vacío.");
    return;
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  // VALIDAR HEADERS
  const missingHeaders = EXPECTED_HEADERS.filter(h => !headers.includes(h));
  const extraHeaders = headers.filter(h => !EXPECTED_HEADERS.includes(h));

  if (extraHeaders.length > 0) {
    alert(
      "ERROR: El archivo tiene columnas NO esperadas:\n\n" +
      extraHeaders.join("\n")
    );
    return;
  }

  if (missingHeaders.length > 0) {
    console.warn("ATENCIÓN: Faltan columnas:", missingHeaders);
  }

  // MAPEO SIMPLE
  const mappedRows = dataRows.map((row, i) => {
    const raw = {};
    headers.forEach((h, idx) => {
      raw[h] = row[idx] ?? "";
    });
    return {
      _row_excel: i + 2,
      _raw: raw
    };
  });

  const rules = await loadRules();
  const bannedWords = await loadBannedWords(
    rules.banned_words_gate.words_source
  );

  // APLICAR GATES
  const evaluated = mappedRows.map(row => {
    const gateReason = applyGates(row, rules);
    if (gateReason) {
      return {
        ...row,
        estado: rules.states.discarded,
        score: 0,
        motivo: gateReason
      };
    }

    const bannedReason = applyBannedWordsGate(row, rules, bannedWords);
    if (bannedReason) {
      return {
        ...row,
        estado: rules.states.discarded,
        score: 0,
        motivo: bannedReason
      };
    }

    return {
      ...row,
      estado: "PASA_GATES",
      score: null,
      motivo: null
    };
  });

  const descartados = evaluated.filter(
    r => r.estado === rules.states.discarded
  ).length;

  output.innerHTML = `
    <p><strong>Archivo procesado</strong></p>
    <p>Total filas: ${evaluated.length}</p>
    <p>Descartados por gates: ${descartados}</p>
    <p>Pasan a scoring: ${evaluated.length - descartados}</p>
  `;

  console.log("Resultado completo:", evaluated);
});
