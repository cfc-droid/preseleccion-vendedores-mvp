// =====================================================
// PATCH DETALLE V3 — ORDEN + COLUMNAS CORRECTAS (SIN TOCAR UI)
// =====================================================
// - NO toca ui.js ni app.js
// - Remueve restos del Patch V2 si existen (#detalleV2_wrap/#detalleV2_style)
// - Oculta SOLO la PARTE 1/3 vieja (original), NO toca Parte 2/3 ni Parte 3/3
// - Inserta Parte 1/3 NUEVA antes de la Parte 2/3 (orden correcto: 1/3 -> 2/3 -> 3/3 -> JSON)
// - Mantiene 8 columnas estilo mock
// - Humano editable: Observación + Porcentaje (0 o 8.33)
// - Guardado en localStorage por fila + pregunta
// =====================================================

(() => {
  const DETAIL_ID = "detailPanel";

  const WRAP_ID = "detalleV3_wrap";
  const STYLE_ID = "detalleV3_style";
  const PATCH_KEY = "data-patch-v3-key";

  const LS_KEY = "cfc_parte13_humano_v1";
  const PCT_ALLOWED = "8.33"; // permitido: "0" o "8.33"

  /* ================= HELPERS ================= */

  const esc = s =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const safe = v => {
    const s = String(v ?? "").trim();
    return s.length ? s : "—";
  };

  const norm = s =>
    String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

  const canonHeader = h =>
    String(h ?? "").split("\n")[0].replace(/\s+/g, " ").trim();

  const headerNumber = h => {
    const m = canonHeader(h).match(/^(\d+)\/33\./);
    return m ? m[1] : null;
  };

  const questionText = h =>
    canonHeader(h).replace(/^\d+\/33\.\s*/, "");

  const normalizeText = t =>
    String(t ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const buildRowKey = row =>
    `${row?.["Marca temporal"] ?? ""}__${row?.["Dirección de correo electrónico"] ?? ""}`;

  /* ================= HEADERS ================= */

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

  const QID_TO_HEADER = {};
  EXPECTED_HEADERS.forEach(h => {
    const n = headerNumber(h);
    if (n) QID_TO_HEADER[`Q${n}`] = h;
  });

  // 12 abiertas prioridad alta
  const Q_ABIERTAS = [
    "Q1","Q9","Q13","Q14","Q15","Q18",
    "Q21","Q22","Q23","Q27","Q30","Q31"
  ];

  /* ================= DOM EXTRACTION ================= */

  const extractRowRaw = panel => {
    const divs = [...panel.querySelectorAll("div")];
    const json = divs.find(d =>
      (d.textContent || "").trim().startsWith("{") &&
      d.textContent.includes('"Marca temporal"')
    );
    try { return json ? JSON.parse(json.textContent) : null; }
    catch { return null; }
  };

  // Remueve restos del patch v2 (evita mezcla)
  const removeV2IfExists = panel => {
    panel.querySelector("#detalleV2_wrap")?.remove();
    panel.querySelector("#detalleV2_style")?.remove();
  };

  // Oculta SOLO la Parte 1/3 vieja (original)
  const hideOldParte13Only = panel => {
    panel.querySelectorAll(".miniCard").forEach(c => {
      if (c.id === WRAP_ID) return;
      const t = norm(c.querySelector(".sectionTitle")?.textContent || "");
      if (t.startsWith("parte 1/3")) c.style.display = "none";
    });
  };

  // Encuentra la tarjeta de Parte 2/3 (ancla estable para insertar antes)
  const findParte23Card = panel => {
    const cards = [...panel.querySelectorAll(".miniCard")];
    return cards.find(c => {
      const t = norm(c.querySelector(".sectionTitle")?.textContent || "");
      return t.startsWith("parte 2/3");
    }) || null;
  };

  /* ================= STYLES ================= */

  const ensureStyle = () => {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
      #${WRAP_ID}, #${WRAP_ID} *{
        font-family: var(--font, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial) !important;
        white-space: normal !important;
      }
      #${WRAP_ID} textarea,
      #${WRAP_ID} input{
        width:100%;
        padding:8px;
        border-radius:10px;
        background:rgba(255,255,255,.03);
        border:1px solid var(--border);
        color:var(--text);
      }
      #${WRAP_ID} .table{ table-layout: fixed; width:100%; }
      #${WRAP_ID} th, #${WRAP_ID} td{
        overflow-wrap:anywhere;
        word-break:break-word;
        vertical-align:top;
      }
    `;
    document.head.appendChild(s);
  };

  /* ================= AUTO RULES (OPEN) ================= */

  let OPEN_CACHE = null;
  const loadOpen = async () => {
    if (OPEN_CACHE) return OPEN_CACHE;
    try {
      const r = await fetch("rules/open_signals_v1.json");
      OPEN_CACHE = r.ok ? await r.json() : null;
    } catch { OPEN_CACHE = null; }
    return OPEN_CACHE;
  };

  const evalAuto = (OPEN, qid, answer) => {
    const txt = String(answer ?? "").trim();
    if (!txt) return { s:"", e:"", o:"" }; // auto columns only if there is answer

    let sev = "ok";
    const sig = [];
    const eth = new Set();
    const n = normalizeText(txt);

    (OPEN?.defaults?.risk_rules || []).forEach(r => {
      if (r.pattern && new RegExp(r.pattern, "i").test(n)) {
        (r.signals || []).forEach(x => sig.push(x));
        (r.ethics || []).forEach(x => eth.add(x));
        if (r.severity === "bad") sev = "bad";
        if (r.severity === "warn" && sev !== "bad") sev = "warn";
      }
    });

    (OPEN?.questions?.[qid]?.rules || []).forEach(r => {
      if (r.pattern && new RegExp(r.pattern, "i").test(n)) {
        (r.signals || []).forEach(x => sig.push(x));
        (r.ethics || []).forEach(x => eth.add(x));
        if (r.severity === "bad") sev = "bad";
        if (r.severity === "warn" && sev !== "bad") sev = "warn";
      }
    });

    const op =
      sev === "bad" ? "Riesgo alto." :
      sev === "warn" ? "Revisar." :
      "OK.";

    return {
      s: sig.length ? sig.join(" | ") : "Sin señales relevantes",
      e: eth.size ? [...eth].join(" | ") : "—",
      o: op
    };
  };

  /* ================= HUMANO (LOCALSTORAGE) ================= */

  const loadDB = () => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
    catch { return {}; }
  };
  const saveDB = db => localStorage.setItem(LS_KEY, JSON.stringify(db));

  const normPct = v => {
    const s = String(v ?? "").trim().replace(",", ".");
    return s === PCT_ALLOWED ? PCT_ALLOWED : "0";
  };

  /* ================= RENDER ================= */

  const renderParte13 = async row => {
    const OPEN = await loadOpen();
    const key = buildRowKey(row);
    const db = loadDB();

    const pctDefault = "0";

    const rows = Q_ABIERTAS.map((qid, idx) => {
      const h = QID_TO_HEADER[qid];
      const ansRaw = row?.[h];
      const ansTxt = String(ansRaw ?? "").trim();
      const auto = evalAuto(OPEN, qid, ansRaw);

      const hk = `${key}__${qid}`;
      const sv = db[hk] || { obs: "", pct: pctDefault };

      const qnum = (headerNumber(h) || "") + "/33";
      const pregunta = questionText(h);

      return `
        <tr data-k="${esc(hk)}">
          <td>${idx + 1}</td>
          <td><span class="kbd">${esc(qnum)}</span> ${esc(pregunta)}</td>
          <td>${esc(safe(ansRaw))}</td>
          <td>${esc(auto.s)}</td>
          <td>${esc(auto.e)}</td>
          <td><b>${esc(auto.o)}</b></td>
          <td><textarea ${ansTxt ? "" : "disabled"}>${esc(sv.obs || "")}</textarea></td>
          <td><input ${ansTxt ? "" : "disabled"} type="number" step="8.33" value="${esc(sv.pct || pctDefault)}"></td>
        </tr>
      `;
    }).join("");

    return `
      <div id="${WRAP_ID}" class="miniCard" style="margin-top:14px;">
        <div class="sectionTitle">PARTE 1/3 — PREGUNTAS Y RESPUESTAS (ABIERTAS • PRIORIDAD ALTA)</div>
        <div style="overflow:auto; margin-top:10px;">
          <table class="table">
            <thead>
              <tr>
                <th style="width:60px;">N°</th>
                <th style="width:320px;">12 PREGUNTAS “ABIERTAS” — PRIORIDAD ALTA</th>
                <th style="width:360px;">RESPUESTA DEL VENDEDOR</th>
                <th style="width:260px;">SEÑALES DETECTADAS (VÁLIDA RTA)</th>
                <th style="width:320px;">REGLAS ÉTICAS AFECTADAS (si aplica)</th>
                <th style="width:160px;">OPINIÓN IA (NO decide)</th>
                <th style="width:180px;">OBSERVACIÓN HUMANA</th>
                <th style="width:110px;">PORCENTAJE</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  };

  const bindHuman = panel => {
    const db = loadDB();

    panel.querySelectorAll(`#${WRAP_ID} tr[data-k]`).forEach(tr => {
      const k = tr.getAttribute("data-k");
      const ta = tr.querySelector("textarea");
      const ip = tr.querySelector("input");

      if (!ta || !ip) return;

      const save = () => {
        db[k] = { obs: ta.value, pct: normPct(ip.value) };
        ip.value = db[k].pct;
        saveDB(db);
      };

      ta.oninput = save;
      ip.oninput = save;
      ip.onblur = save;
    });
  };

  /* ================= PATCH ================= */

  const patch = async panel => {
    if (!panel || panel.style.display === "none") return;

    ensureStyle();

    // Evitar mezcla con v2
    removeV2IfExists(panel);

    // Ocultar solo la Parte 1/3 vieja
    hideOldParte13Only(panel);

    const row = extractRowRaw(panel);
    if (!row) return;

    const key = buildRowKey(row);

    // Si ya está parcheado para esta fila y existe el wrap, no rehacer
    if (panel.getAttribute(PATCH_KEY) === key && panel.querySelector(`#${WRAP_ID}`)) return;

    // Remover nuestro wrap anterior
    panel.querySelector(`#${WRAP_ID}`)?.remove();

    // Render
    const html = await renderParte13(row);

    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    const node = tmp.firstElementChild;
    if (!node) return;

    // Insertar ANTES de la Parte 2/3 (orden correcto)
    const parte23 = findParte23Card(panel);
    if (parte23 && parte23.parentNode) {
      parte23.parentNode.insertBefore(node, parte23);
    } else {
      // Fallback ultra seguro: si no se encuentra Parte 2/3, insertar antes del JSON
      const divs = [...panel.querySelectorAll("div")];
      const jsonDiv = divs.find(d =>
        (d.textContent || "").trim().startsWith("{") &&
        (d.textContent || "").includes('"Marca temporal"')
      );
      if (!jsonDiv || !jsonDiv.parentNode) return;
      jsonDiv.parentNode.insertBefore(node, jsonDiv);
    }

    panel.setAttribute(PATCH_KEY, key);
    bindHuman(panel);
  };

  const init = () => {
    const p = document.getElementById(DETAIL_ID);
    if (!p) return;

    new MutationObserver(() => patch(p)).observe(p, { childList: true, subtree: true });
    patch(p);
  };

  document.addEventListener("DOMContentLoaded", init);
})();
