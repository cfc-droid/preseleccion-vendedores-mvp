// =====================================================
// PATCH PARTE 1/3 — INPUTS HUMANOS (SIN TOCAR ui.js NI patch_detalle_v2.js)
// Objetivo:
// - En la tabla: "PARTE 1/3 — PREGUNTAS Y RESPUESTAS (ABIERTAS • PRIORIDAD ALTA)"
// - Reemplaza las ÚLTIMAS 2 columnas por inputs:
//    1) OBSERVACIÓN HUMANA (textarea)
//    2) PUNTAJE HUMANO (input 0–10)
// - Persiste en localStorage por (rowKey + QID)
// - No re-renderiza nada: solo inyecta UI sobre DOM ya creado
// =====================================================

(() => {
  const DETAIL_ID = "detailPanel";

  // Coinciden con patch_detalle_v2.js
  const WRAP_ID = "detalleV2_wrap";

  // Storage
  const LS_KEY = "cfc_parte13_humano_v1";

  // Orden fijo (12)
  const Q_ALTA = ["Q1","Q9","Q13","Q14","Q15","Q18","Q21","Q22","Q23","Q27","Q30","Q31"];

  // Para evitar re-parcheos infinitos
  const PATCH_ATTR = "data-parte13-hum-patched";

  function safeJsonParse(s) {
    try { return JSON.parse(s); } catch(_) { return null; }
  }

  function esc(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === "object") ? obj : {};
    } catch (_) {
      return {};
    }
  }

  function saveStore(obj) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch (_) {}
  }

  function getRowKeyFromPanel(panel) {
    // 1) Si patch_detalle_v2 ya lo seteo:
    const k = panel.getAttribute("data-patched-v2-key");
    if (k && String(k).trim().length) return String(k);

    // 2) Fallback: buscar JSON de rowRaw en el DOM (como hace patch_detalle_v2)
    const divs = [...panel.querySelectorAll("div")];
    const candidate = divs
      .map(d => d.textContent || "")
      .find(t => t.trim().startsWith("{") && t.includes('"Marca temporal"'));

    if (!candidate) return null;

    const rowRaw = safeJsonParse(candidate);
    if (!rowRaw) return null;

    const mt = String(rowRaw["Marca temporal"] ?? "").trim() || "—";
    const em = String(rowRaw["Dirección de correo electrónico"] ?? "").trim() || "—";
    return `${mt}__${em}`;
  }

  function findParte13Table(panel) {
    const wrap = panel.querySelector(`#${WRAP_ID}`);
    if (!wrap) return null;

    // Buscar el bloque por título exacto/contiene
    const cards = [...wrap.querySelectorAll(".miniCard")];
    const card = cards.find(c => {
      const t = (c.querySelector(".sectionTitle")?.textContent || "").trim();
      return t.includes("PARTE 1/3") && t.includes("PRIORIDAD ALTA");
    });
    if (!card) return null;

    const table = card.querySelector("table.table");
    return table || null;
  }

  function ensureHeader(table) {
    const ths = table.querySelectorAll("thead th");
    if (!ths || ths.length < 2) return;

    // Últimas 2 columnas del patch_detalle_v2:
    // ... "OBSERVACIÓN HUMANA" y "PORCENTAJE"
    // Las dejamos como: "OBSERVACIÓN HUMANA" y "PUNTAJE HUMANO"
    const last = ths[ths.length - 1];
    const prev = ths[ths.length - 2];

    if (prev) prev.textContent = "OBSERVACIÓN HUMANA";
    if (last) last.textContent = "PUNTAJE HUMANO";

    // Ajuste opcional de ancho (si existe style inline)
    if (prev) prev.style.width = "240px";
    if (last) last.style.width = "140px";
  }

  function makeTextarea(value, onChange) {
    const ta = document.createElement("textarea");
    ta.value = value || "";
    ta.rows = 2;
    ta.placeholder = "Anotá tu observación…";
    ta.style.width = "100%";
    ta.style.minHeight = "44px";
    ta.style.resize = "vertical";
    ta.style.padding = "8px";
    ta.style.borderRadius = "10px";
    ta.style.border = "1px solid var(--border)";
    ta.style.background = "rgba(255,255,255,0.03)";
    ta.style.color = "var(--text)";
    ta.addEventListener("input", () => onChange(ta.value));
    return ta;
  }

  function makeScoreInput(value, onChange) {
    const inp = document.createElement("input");
    inp.type = "number";
    inp.min = "0";
    inp.max = "10";
    inp.step = "1";
    inp.value = (value === 0 || value) ? String(value) : "";
    inp.placeholder = "0–10";
    inp.style.width = "100%";
    inp.style.padding = "8px";
    inp.style.borderRadius = "10px";
    inp.style.border = "1px solid var(--border)";
    inp.style.background = "rgba(255,255,255,0.03)";
    inp.style.color = "var(--text)";
    inp.addEventListener("input", () => {
      const v = inp.value;
      // Guardamos vacío si el user borra
      onChange(v === "" ? "" : Math.max(0, Math.min(10, Number(v))));
    });
    return inp;
  }

  function patchRows(table, rowKey) {
    const tbody = table.querySelector("tbody");
    if (!tbody) return;

    // Evitar repatch si ya lo hicimos para este rowKey
    const already = table.getAttribute(PATCH_ATTR);
    if (already === rowKey) return;

    const store = loadStore();
    if (!store[rowKey]) store[rowKey] = {};

    const trs = [...tbody.querySelectorAll("tr")];

    // Seguridad: solo si son 12 filas (Parte 1/3)
    if (trs.length !== 12) {
      // igual lo intentamos, pero por índice
    }

    trs.forEach((tr, idx) => {
      const qid = Q_ALTA[idx] || `Q?${idx+1}`;
      if (!store[rowKey][qid]) store[rowKey][qid] = { obs: "", score: "" };

      const tds = tr.querySelectorAll("td");
      if (!tds || tds.length < 2) return;

      // Últimas 2 celdas actuales (OBSERVACIÓN HUMANA, PORCENTAJE)
      const obsTd = tds[tds.length - 2];
      const scoreTd = tds[tds.length - 1];

      // Si ya hay controles, no duplicar
      if (obsTd.querySelector("textarea") || scoreTd.querySelector("input[type='number']")) return;

      // Limpiar contenido previo (el patch ponía "—" y "8,33%")
      obsTd.innerHTML = "";
      scoreTd.innerHTML = "";

      // Crear UI
      const current = store[rowKey][qid];

      const ta = makeTextarea(current.obs, (v) => {
        const s = loadStore();
        if (!s[rowKey]) s[rowKey] = {};
        if (!s[rowKey][qid]) s[rowKey][qid] = {};
        s[rowKey][qid].obs = v;
        saveStore(s);
      });

      const sc = makeScoreInput(current.score, (v) => {
        const s = loadStore();
        if (!s[rowKey]) s[rowKey] = {};
        if (!s[rowKey][qid]) s[rowKey][qid] = {};
        s[rowKey][qid].score = v;
        saveStore(s);
      });

      obsTd.appendChild(ta);
      scoreTd.appendChild(sc);
    });

    table.setAttribute(PATCH_ATTR, rowKey);
  }

  function apply(panel) {
    if (!panel) return;
    if (panel.style.display === "none") return;

    const rowKey = getRowKeyFromPanel(panel);
    if (!rowKey) return;

    const table = findParte13Table(panel);
    if (!table) return;

    ensureHeader(table);
    patchRows(table, rowKey);
  }

  function init() {
    const panel = document.getElementById(DETAIL_ID);
    if (!panel) return;

    // Observa cambios del detalle (cuando abrís otra fila, etc.)
    const obs = new MutationObserver(() => apply(panel));
    obs.observe(panel, { childList: true, subtree: true });

    // Primer intento
    apply(panel);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
