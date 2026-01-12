 // =====================================================
// PATCH DETALLE V3.1 — FIX UI (SIN TOCAR ui.js / app.js)
// =====================================================
// FIXES:
// 1) Parte 1/3 NO desaparece (no se oculta nuestro wrap)
// 2) Scroll horizontal/vertical REAL en tablas (sin estirar la página)
// 3) Oculta cajas "Respuestas/condiciones CORRECTAS" y "INCORRECTAS (por qué)"
// 4) Parte 2/3: resumen arriba, luego tabla 13 preguntas
// 5) Parte 3/3: oculta columna "Largo"
// =====================================================

(() => {
  const DETAIL_ID = "detailPanel";

  const WRAP_ID = "detalleV3_wrap";
  const STYLE_ID = "detalleV3_style";
  const PATCH_KEY = "data-patch-v3-key";

  // Lock anti “doble insert” por MutationObserver + async/await
  const BUSY_ATTR = "data-patch-v3-busy";

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

  const removeV2IfExists = panel => {
    panel.querySelector("#detalleV2_wrap")?.remove();
    panel.querySelector("#detalleV2_style")?.remove();
  };

  // LIMPIEZA AGRESIVA: si por cualquier bug quedó más de un WRAP_ID, los borra todos
  const removeAllOurWraps = panel => {
    panel.querySelectorAll(`#${WRAP_ID}`).forEach(n => n.remove());
  };

  // Oculta SOLO la Parte 1/3 vieja (pero jamás nuestra Parte 1/3 nueva)
  const hideOldParte13Everywhere = panel => {
    // Caso 1: miniCards
    panel.querySelectorAll(".miniCard").forEach(c => {
      if (c.id === WRAP_ID) return;
      const t = norm(c.querySelector(".sectionTitle")?.textContent || "");
      if (t.startsWith("parte 1/3")) c.style.display = "none";
    });

    // Caso 2: sectionTitle sueltos
    panel.querySelectorAll(".sectionTitle").forEach(st => {
      const t = norm(st.textContent || "");
      if (!t.startsWith("parte 1/3")) return;

      // Si pertenece a nuestro wrap, NO tocar
      if (st.closest(`#${WRAP_ID}`)) return;

      const mc = st.closest(".miniCard");
      if (mc && mc.id !== WRAP_ID) {
        mc.style.display = "none";
        return;
      }

      // Si no hay miniCard, ocultar un contenedor razonable (no el propio st)
      const container = st.parentElement;
      if (container && container.id !== WRAP_ID) container.style.display = "none";
    });
  };

  const hideCorrectIncorrectBoxes = panel => {
    panel.querySelectorAll(".miniCard").forEach(c => {
      const t = norm(c.querySelector(".sectionTitle")?.textContent || "");
      if (
        t.includes("respuestas/condiciones correctas") ||
        t.includes("respuestas/condiciones incorrectas")
      ) c.style.display = "none";
    });
  };

  const findParte23Card = panel => {
    const cards = [...panel.querySelectorAll(".miniCard")];
    return cards.find(c => {
      const t = norm(c.querySelector(".sectionTitle")?.textContent || "");
      return t.startsWith("parte 2/3");
    }) || null;
  };

  const findParte33Card = panel => {
    const cards = [...panel.querySelectorAll(".miniCard")];
    return cards.find(c => {
      const t = norm(c.querySelector(".sectionTitle")?.textContent || "");
      return t.startsWith("parte 3/3");
    }) || null;
  };

  /* ================= STYLES (SCROLL REAL) ================= */

  const ensureStyle = () => {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = STYLE_ID;

    s.textContent = `
      /* No estires el layout: el scroll debe ocurrir en wrappers */
      #${DETAIL_ID}{
        white-space: normal !important;
        max-width: 100% !important;
      }

      #${DETAIL_ID} .miniCard{
        max-width: 100% !important;
      }

      /* Wrapper universal para tablas */
      #${DETAIL_ID} .cfcTableScroll{
        overflow: auto !important;
        max-width: 100% !important;
        margin-top: 10px;
      }

      /* Tablas: si no entran, que scrolleen en su wrapper */
      #${DETAIL_ID} table{
        width: max-content !important;
        min-width: 100% !important;
        table-layout: auto !important;
      }

      /* Nuestro bloque Parte 1/3 */
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
      #${WRAP_ID} th, #${WRAP_ID} td{
        overflow-wrap:anywhere;
        word-break:break-word;
        vertical-align:top;
      }
    `;
    document.head.appendChild(s);
  };

  // Asegura que TODA tabla dentro del detalle tenga un wrapper con overflow:auto
  const ensureTableWrappers = panel => {
    const tables = [...panel.querySelectorAll("table")];
    tables.forEach(table => {
      if (table.closest(".cfcTableScroll")) return;

      const p = table.parentElement;
      // Si el padre ya es un “div con overflow”, lo convertimos en wrapper
      if (p && p.tagName === "DIV") {
        const st = (p.getAttribute("style") || "").toLowerCase();
        if (st.includes("overflow")) {
          p.classList.add("cfcTableScroll");
          p.style.overflow = "auto";
          p.style.maxWidth = "100%";
          return;
        }
      }

      // Si no, lo envolvemos nosotros
      const wrap = document.createElement("div");
      wrap.className = "cfcTableScroll";
      wrap.style.overflow = "auto";
      wrap.style.maxWidth = "100%";

      table.parentNode?.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
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
    if (!txt) return { s:"", e:"", o:"" };

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

  /* ================= RENDER PARTE 1/3 (NUEVA) ================= */

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
        <div class="cfcTableScroll">
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

  /* ================= FIX PARTE 2/3 ORDER ================= */

  const fixParte23Order = panel => {
    const card = findParte23Card(panel);
    if (!card) return;

    const candidates = [...card.querySelectorAll("table, div")];
    const resumenNode = candidates.find(n => {
      const t = norm(n.textContent || "");
      return t.includes("total de preguntas") && t.includes("respuestas válidas");
    });
    if (!resumenNode) return;

    let resumenBlock = resumenNode;
    if (resumenBlock.tagName === "TABLE") {
      const up = resumenBlock.closest("div");
      if (up && up !== card) resumenBlock = up;
    }

    const title = card.querySelector(".sectionTitle");
    if (!title) return;

    const firstAfterTitle = title.nextElementSibling;
    if (firstAfterTitle === resumenBlock) return;

    card.insertBefore(resumenBlock, firstAfterTitle);
  };

  /* ================= FIX PARTE 3/3 HIDE "LARGO" ================= */

  const hideParte33LargoColumn = panel => {
    const card = findParte33Card(panel);
    if (!card) return;

    const table = card.querySelector("table");
    if (!table) return;

    const ths = [...table.querySelectorAll("thead th")];
    const idx = ths.findIndex(th => norm(th.textContent || "") === "largo");
    if (idx < 0) return;

    ths[idx].style.display = "none";
    table.querySelectorAll("tbody tr").forEach(tr => {
      const tds = [...tr.children];
      if (tds[idx]) tds[idx].style.display = "none";
    });
  };

  /* ================= PATCH ================= */

  const patch = async panel => {
    if (!panel || panel.style.display === "none") return;

    if (panel.getAttribute(BUSY_ATTR) === "1") return;
    panel.setAttribute(BUSY_ATTR, "1");

    try {
      ensureStyle();
      removeV2IfExists(panel);

      // UI fixes primero
      hideCorrectIncorrectBoxes(panel);
      hideParte33LargoColumn(panel);
      fixParte23Order(panel);
      hideOldParte13Everywhere(panel);

      // Scroll wrappers para TODO lo existente
      ensureTableWrappers(panel);

      const row = extractRowRaw(panel);
      if (!row) return;

      const key = buildRowKey(row);
      panel.setAttribute(PATCH_KEY, key);

      // (re)insert nuestra Parte 1/3
      removeAllOurWraps(panel);

      const html = await renderParte13(row);

      removeAllOurWraps(panel);
      hideOldParte13Everywhere(panel);

      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      const node = tmp.firstElementChild;
      if (!node) return;

      const parte23 = findParte23Card(panel);
      if (parte23 && parte23.parentNode) {
        parte23.parentNode.insertBefore(node, parte23);
      } else {
        const divs = [...panel.querySelectorAll("div")];
        const jsonDiv = divs.find(d =>
          (d.textContent || "").trim().startsWith("{") &&
          (d.textContent || "").includes('"Marca temporal"')
        );
        if (!jsonDiv || !jsonDiv.parentNode) return;
        jsonDiv.parentNode.insertBefore(node, jsonDiv);
      }

      bindHuman(panel);

      // Reaplicar todo post-insert
      hideCorrectIncorrectBoxes(panel);
      hideParte33LargoColumn(panel);
      fixParte23Order(panel);
      hideOldParte13Everywhere(panel);
      ensureTableWrappers(panel);

    } finally {
      panel.setAttribute(BUSY_ATTR, "0");
    }
  };

  const init = () => {
    const p = document.getElementById(DETAIL_ID);
    if (!p) return;

    new MutationObserver(() => patch(p)).observe(p, { childList: true, subtree: true });
    patch(p);
  };

  document.addEventListener("DOMContentLoaded", init);
})();
