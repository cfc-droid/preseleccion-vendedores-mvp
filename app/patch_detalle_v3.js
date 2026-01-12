// =====================================================
// PATCH DETALLE V3 (UNICO)
// - NO toca ui.js
// - Inserta PARTE 1/3 ARRIBA (debajo del header de pills) y OCULTA la PARTE 1/3 vieja
// - Inserta PARTE 1/3 con 5 columnas clave:
//   (3 auto) Señales / Ética / Opinión  -> SOLO si hay respuesta
//   (2 humano) Observación / Porcentaje -> editables + localStorage
// - Evalúa con rules/open_signals_v1.json
//
// FIXES:
// (A) Ubicación: ahora aparece arriba (no abajo)
// (B) Oculta solo la miniCard vieja de "PARTE 1/3" (no elimina nada)
// (C) Porcentaje humano: SOLO 0 ó 8,33 (cualquier otro valor => 0)
// =====================================================

(() => {
  const DETAIL_ID = "detailPanel";

  const PATCH_KEY_ATTR = "data-patched-v3-key";
  const WRAP_ID = "detalleV3_wrap";
  const STYLE_ID = "detalleV3_style";

  const LS_KEY = "cfc_parte13_humano_v1";

  // porcentaje permitido (solo 2 valores)
  const PCT_ALLOWED = "8.33"; // guardamos con punto
  const PCT_ALLOWED_DISPLAY = "8,33"; // para placeholder UI

  // -------------------------
  // Helpers
  // -------------------------
  function esc(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeVal(v) {
    const s = String(v ?? "").trim();
    return s.length ? s : "—";
  }

  function norm(s) {
    return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function canonHeader(h) {
    return String(h ?? "")
      .split("\n")[0]
      .replace(/\s+/g, " ")
      .trim();
  }

  function headerNumber(h) {
    const m = canonHeader(h).match(/^(\d+)\/33\./);
    return m ? m[1] : null;
  }

  function questionTextFromHeader(h) {
    const s = canonHeader(h);
    return s.replace(/^\d+\/33\.\s*/, "");
  }

  function normalizeText(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function buildRowKey(rowRaw) {
    const mt = safeVal(rowRaw?.["Marca temporal"]);
    const em = safeVal(rowRaw?.["Dirección de correo electrónico"]);
    return `${mt}__${em}`;
  }

  // -------------------------
  // HEADERS oficiales
  // -------------------------
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

  const QID_TO_HEADER = (() => {
    const m = {};
    for (const h of EXPECTED_HEADERS) {
      const num = headerNumber(h);
      if (num) m[`Q${num}`] = h;
    }
    return m;
  })();

  // PARTE 1/3 oficial (12)
  const Q_ABIERTAS_ALTA = ["Q1","Q9","Q13","Q14","Q15","Q18","Q21","Q22","Q23","Q27","Q30","Q31"];

  // -------------------------
  // Extraer rowRaw del DOM
  // -------------------------
  function extractRowRaw(panel) {
    const divs = [...panel.querySelectorAll("div")];
    const candidate = divs
      .map(d => d.textContent || "")
      .find(t => t.trim().startsWith("{") && t.includes('"Marca temporal"'));

    if (!candidate) return null;

    try {
      return JSON.parse(candidate);
    } catch (_) {
      return null;
    }
  }

  // -------------------------
  // Ocultar la PARTE 1/3 vieja (miniCard de ui.js)
  // -------------------------
  function hideOldParte13(panel) {
    const cards = [...panel.querySelectorAll(".miniCard")];
    for (const c of cards) {
      const title = c.querySelector(".sectionTitle")?.textContent || "";
      if (norm(title).includes("parte 1/3")) {
        c.style.display = "none"; // SOLO ocultar
      }
    }
  }

  // -------------------------
  // Estilos internos (solo V3)
  // -------------------------
  function ensureInnerStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = `
      #${WRAP_ID}, #${WRAP_ID} *{
        font-family: var(--font, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial) !important;
        white-space: normal !important;
      }
      #${WRAP_ID} .table{ table-layout: fixed; width:100%; }
      #${WRAP_ID} th, #${WRAP_ID} td{
        overflow-wrap: anywhere;
        word-break: break-word;
        vertical-align: top;
      }
      #${WRAP_ID} textarea{
        width: 100%;
        min-height: 70px;
        resize: vertical;
        padding: 8px;
        border-radius: 10px;
        border: 1px solid var(--border, #2a2a3a);
        background: rgba(255,255,255,0.03);
        color: var(--text, #f2f2f2);
        font-family: var(--font, ui-sans-serif);
        font-size: 13px;
      }
      #${WRAP_ID} input[type="number"]{
        width: 100%;
        padding: 8px;
        border-radius: 10px;
        border: 1px solid var(--border, #2a2a3a);
        background: rgba(255,255,255,0.03);
        color: var(--text, #f2f2f2);
        font-size: 13px;
      }
      #${WRAP_ID} .muted { color: var(--muted, #b9b9c6); }
      #${WRAP_ID} .kbd{
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 12px;
        padding: 2px 6px;
        border:1px solid var(--border, #2a2a3a);
        border-radius: 8px;
        background: rgba(255,255,255,0.03);
        color: var(--text, #f2f2f2);
      }
    `;
    document.head.appendChild(st);
  }

  // -------------------------
  // Cargar open_signals una vez
  // -------------------------
  let _OPEN_CACHE = null;

  async function loadOpenSignalsOnce() {
    if (_OPEN_CACHE) return _OPEN_CACHE;
    try {
      const res = await fetch("rules/open_signals_v1.json");
      if (!res.ok) throw new Error(`No se pudo cargar open_signals_v1.json (HTTP ${res.status})`);
      _OPEN_CACHE = await res.json();
      return _OPEN_CACHE;
    } catch (e) {
      console.error(e);
      _OPEN_CACHE = null;
      return null;
    }
  }

  // -------------------------
  // Evaluación Parte 1/3 (auto 3 columnas)
  // REGLA DURA: si respuesta vacía -> 3 columnas VACÍAS reales
  // -------------------------
  function runRegex(pattern, text) {
    try {
      const re = new RegExp(pattern, "i");
      return re.test(text);
    } catch (_) {
      return false;
    }
  }

  function evalMinLines(rule, answer) {
    const minLines = Number(rule.min_lines || 0);
    const minCharsPerLine = Number(rule.min_chars_per_line || 1);
    const lines = String(answer || "")
      .split("\n")
      .map(x => x.trim())
      .filter(x => x.length >= minCharsPerLine);
    return lines.length >= minLines;
  }

  function buildAutoColumns(OPEN, qid, answerRaw) {
    const ans = String(answerRaw ?? "").trim();
    if (!ans.length) {
      // VACÍO REAL
      return { signals: "", ethics: "", opinion: "" };
    }

    if (!OPEN) {
      return {
        signals: "—",
        ethics: "—",
        opinion: "No se pudieron cargar reglas open_signals_v1.json"
      };
    }

    const outSignals = [];
    const outEthics = new Set();
    let severity = "ok"; // ok | warn | bad

    const ansNorm = normalizeText(ans);

    // 1) Risk rules globales
    const riskRules = OPEN?.defaults?.risk_rules || [];
    for (const rr of riskRules) {
      if (rr?.type === "regex" && rr?.pattern && runRegex(rr.pattern, ansNorm)) {
        (rr.signals || rr.signals_ok || rr.signals_bad || []).forEach(s => outSignals.push(String(s)));
        (rr.ethics || []).forEach(e => outEthics.add(String(e)));
        if (rr.severity === "bad") severity = "bad";
        else if (rr.severity === "warn" && severity !== "bad") severity = "warn";
      }
    }

    // 2) Rules por pregunta (Q1, Q9...)
    const Q = OPEN?.questions?.[qid] || null;
    if (Q && Array.isArray(Q.rules)) {
      for (const r of Q.rules) {
        if (!r || !r.type) continue;

        if (r.type === "regex") {
          const hit = runRegex(r.pattern, ansNorm);

          if (r.signals_ok || r.signals_bad) {
            if (hit) {
              (r.signals_ok || []).forEach(s => outSignals.push(String(s)));
            } else {
              (r.signals_bad || []).forEach(s => outSignals.push(String(s)));
              const sev = r.severity_if_missing || "warn";
              if (sev === "bad") severity = "bad";
              else if (sev === "warn" && severity !== "bad") severity = "warn";
            }
          } else {
            if (hit) {
              (r.signals || []).forEach(s => outSignals.push(String(s)));
              (r.ethics || []).forEach(e => outEthics.add(String(e)));
              if (r.severity === "bad") severity = "bad";
              else if (r.severity === "warn" && severity !== "bad") severity = "warn";
            }
          }
        }

        if (r.type === "min_lines") {
          const ok = evalMinLines(r, ans);
          if (ok) (r.signals_ok || []).forEach(s => outSignals.push(String(s)));
          else {
            (r.signals_bad || []).forEach(s => outSignals.push(String(s)));
            const sev = r.severity_if_missing || "warn";
            if (sev === "bad") severity = "bad";
            else if (sev === "warn" && severity !== "bad") severity = "warn";
          }
        }
      }
    }

    // 3) Opinion
    let opinion = "—";
    if (Q && Q.opinions) {
      if (severity === "bad") opinion = Q.opinions.bad || "Riesgo alto: revisar.";
      else if (severity === "warn") opinion = Q.opinions.warn || "Revisar: hay señales parciales.";
      else opinion = Q.opinions.ok || "OK.";
    } else {
      opinion = (severity === "bad") ? "Riesgo alto (señales negativas detectadas)."
             : (severity === "warn") ? "Revisar (señales mixtas)."
             : "OK (sin señales negativas relevantes).";
    }

    // 4) Señales y ética
    const signalsTxt = outSignals.length ? outSignals.join(" | ") : "Sin señales relevantes";
    const ethicsTxt = outEthics.size ? [...outEthics].join(" | ") : "—";

    return { signals: signalsTxt, ethics: ethicsTxt, opinion };
  }

  // -------------------------
  // LocalStorage (humano)
  // -------------------------
  function loadHumanDB() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const db = raw ? JSON.parse(raw) : {};
      return (db && typeof db === "object") ? db : {};
    } catch (_) {
      return {};
    }
  }

  function saveHumanDB(db) {
    localStorage.setItem(LS_KEY, JSON.stringify(db));
  }

  function getHumanKey(rowKey, qid) {
    return `${rowKey}__${qid}`;
  }

  // Normaliza porcentaje: SOLO "0" o "8.33"
  function normalizePctInput(value) {
    const s = String(value ?? "").trim();
    if (!s.length) return "0";

    // permitir coma o punto
    const s2 = s.replace(",", ".").replace(/\s+/g, "");

    // casos exactos
    if (s2 === "0" || s2 === "0.0" || s2 === "0.00") return "0";
    if (s2 === PCT_ALLOWED || s2 === "8.330" || s2 === "8.3300") return PCT_ALLOWED;

    // cualquier otro => 0 (tu regla dura)
    return "0";
  }

  // -------------------------
  // Render PARTE 1/3 V3
  // -------------------------
  async function renderParte13_V3(rowRaw) {
    const OPEN = await loadOpenSignalsOnce();

    const rowKey = buildRowKey(rowRaw);

    const rows = Q_ABIERTAS_ALTA.map((qid, idx) => {
      const header = QID_TO_HEADER[qid];
      const qnum = headerNumber(header) + "/33";
      const pregunta = questionTextFromHeader(header);
      const ansRaw = rowRaw?.[header];

      // AUTO (3 cols) SOLO si hay respuesta:
      const auto = buildAutoColumns(OPEN, qid, ansRaw);

      // HUMANO (2 cols) siempre editables:
      const k = getHumanKey(rowKey, qid);

      return `
        <tr data-qid="${esc(qid)}" data-hkey="${esc(k)}">
          <td>${idx + 1}</td>
          <td><span class="kbd">${esc(qnum)}</span> ${esc(pregunta)}</td>
          <td>${esc(safeVal(ansRaw))}</td>

          <!-- AUTO -->
          <td>${auto.signals ? esc(auto.signals) : ""}</td>
          <td>${auto.ethics ? esc(auto.ethics) : ""}</td>
          <td>${auto.opinion ? esc(auto.opinion) : ""}</td>

          <!-- HUMANO -->
          <td><textarea placeholder="Tu observación..."></textarea></td>
          <td>
            <input
              type="number"
              min="0"
              max="8.33"
              step="8.33"
              placeholder="0 o ${PCT_ALLOWED_DISPLAY}"
            >
          </td>
        </tr>
      `;
    }).join("");

    return `
      <div class="miniCard" style="margin-top:12px;">
        <div class="sectionTitle">PARTE 1/3 — PREGUNTAS Y RESPUESTAS (ABIERTAS • PRIORIDAD ALTA)</div>
        <div class="muted" style="margin-top:6px;">
          Regla: Señales/Ética/Opinión se completan SOLO si hay respuesta.
          Observación/Porcentaje son 100% tuyos y se guardan en este navegador.
          Porcentaje permitido: <b>0</b> o <b>${PCT_ALLOWED_DISPLAY}%</b>.
        </div>

        <div style="overflow:auto; margin-top:10px;">
          <table class="table">
            <thead>
              <tr>
                <th style="width:60px;">N°</th>
                <th style="width:320px;">12 PREGUNTAS “ABIERTAS” — PRIORIDAD ALTA</th>
                <th style="width:360px;">RESPUESTA DEL VENDEDOR</th>

                <th style="width:260px;">SEÑALES DETECTADAS (VÁLIDA RTA)</th>
                <th style="width:320px;">REGLAS ÉTICAS AFECTADAS (si aplica)</th>
                <th style="width:220px;">OPINIÓN IA (NO decide)</th>

                <th style="width:260px;">OBSERVACIÓN HUMANA</th>
                <th style="width:140px;">PORCENTAJE</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  // -------------------------
  // Patch principal
  // - Oculta Parte 1/3 vieja
  // - Inserta V3 ARRIBA (debajo del header row de pills/botón cerrar)
  // -------------------------
  async function patch(panel) {
    if (!panel) return;
    if (panel.style.display === "none") return;

    ensureInnerStyle();

    // OCULTAR la Parte 1/3 vieja (solo display none)
    hideOldParte13(panel);

    const rowRaw = extractRowRaw(panel);
    if (!rowRaw) return;

    const rowKey = buildRowKey(rowRaw);
    const prevKey = panel.getAttribute(PATCH_KEY_ATTR);
    const existingWrap = panel.querySelector(`#${WRAP_ID}`);
    if (prevKey === rowKey && existingWrap) return;

    if (existingWrap) existingWrap.remove();

    const wrap = document.createElement("div");
    wrap.id = WRAP_ID;
    wrap.innerHTML = await renderParte13_V3(rowRaw);

    // INSERTAR ARRIBA:
    // ui.js arma primero un <div class="row" ...> (pills + cerrar)
    // Lo dejamos, y ponemos V3 inmediatamente DESPUÉS.
    const topRow = panel.querySelector("div.row");
    if (topRow && topRow.parentNode === panel) {
      const ref = topRow.nextSibling; // puede ser textnode
      panel.insertBefore(wrap, ref);
    } else {
      // fallback: al inicio absoluto
      panel.insertBefore(wrap, panel.firstChild);
    }

    panel.setAttribute(PATCH_KEY_ATTR, rowKey);

    // Bind humano (load + autosave)
    bindHumanEditors(panel);
  }

  function bindHumanEditors(panel) {
    const db = loadHumanDB();
    const wrap = panel.querySelector(`#${WRAP_ID}`);
    if (!wrap) return;

    const rows = [...wrap.querySelectorAll('tr[data-hkey]')];

    for (const tr of rows) {
      const hkey = tr.getAttribute("data-hkey");
      const ta = tr.querySelector("textarea");
      const inp = tr.querySelector('input[type="number"]');

      const saved = db[hkey] || { obs: "", pct: "0" };

      if (ta) ta.value = saved.obs || "";
      if (inp) inp.value = normalizePctInput(saved.pct ?? "0");

      const saveNow = () => {
        const next = loadHumanDB();
        const pct = inp ? normalizePctInput(inp.value) : "0";

        // FORZAMOS EN UI el valor normalizado
        if (inp) inp.value = pct;

        next[hkey] = {
          obs: ta ? String(ta.value || "") : "",
          pct
        };
        saveHumanDB(next);
      };

      if (ta) ta.addEventListener("input", saveNow);

      if (inp) {
        // input en vivo + blur/enter
        inp.addEventListener("input", saveNow);
        inp.addEventListener("blur", saveNow);
        inp.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            saveNow();
            inp.blur();
          }
        });
      }
    }
  }

  // -------------------------
  // Observer
  // -------------------------
  function init() {
    const panel = document.getElementById(DETAIL_ID);
    if (!panel) return;

    const obs = new MutationObserver(() => patch(panel));
    obs.observe(panel, { childList: true, subtree: true });

    patch(panel);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
