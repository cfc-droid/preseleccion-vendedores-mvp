// =====================================================
// PATCH DETALLE V3 — FINAL ESTABLE
// =====================================================
// - NO toca ui.js ni app.js
// - Oculta SOLO la Parte 1/3 original (display:none)
// - Inserta Parte 1/3 nueva ARRIBA
// - 3 columnas automáticas (solo si hay respuesta)
// - 2 columnas humanas editables (obs + porcentaje)
// - Porcentaje permitido: 0 o 8,33
// - Guardado localStorage por fila + pregunta
// =====================================================

(() => {
  const DETAIL_ID = "detailPanel";
  const WRAP_ID = "detalleV3_wrap";
  const STYLE_ID = "detalleV3_style";
  const PATCH_KEY = "data-patch-v3-key";
  const LS_KEY = "cfc_parte13_humano_v1";
  const PCT_ALLOWED = "8.33";

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

  /* ================= DOM ================= */

  const extractRowRaw = panel => {
    const divs = [...panel.querySelectorAll("div")];
    const json = divs.find(d =>
      (d.textContent || "").trim().startsWith("{") &&
      d.textContent.includes('"Marca temporal"')
    );
    try { return json ? JSON.parse(json.textContent) : null; }
    catch { return null; }
  };

  const hideOldParte13 = panel => {
    panel.querySelectorAll(".miniCard").forEach(c => {
      const t = norm(c.querySelector(".sectionTitle")?.textContent);
      if (t.includes("parte 1/3")) c.style.display = "none";
    });
  };

  /* ================= STYLES ================= */

  const ensureStyle = () => {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
      #${WRAP_ID} textarea,
      #${WRAP_ID} input{
        width:100%;padding:8px;border-radius:10px;
        background:rgba(255,255,255,.03);
        border:1px solid var(--border);color:var(--text);
      }
    `;
    document.head.appendChild(s);
  };

  /* ================= AUTO EVAL ================= */

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
      if (r.pattern && new RegExp(r.pattern,"i").test(n)) {
        (r.signals||[]).forEach(x=>sig.push(x));
        (r.ethics||[]).forEach(x=>eth.add(x));
        if (r.severity==="bad") sev="bad";
        if (r.severity==="warn" && sev!=="bad") sev="warn";
      }
    });

    (OPEN?.questions?.[qid]?.rules || []).forEach(r => {
      if (r.pattern && new RegExp(r.pattern,"i").test(n)) {
        (r.signals||[]).forEach(x=>sig.push(x));
        (r.ethics||[]).forEach(x=>eth.add(x));
        if (r.severity==="bad") sev="bad";
        if (r.severity==="warn" && sev!=="bad") sev="warn";
      }
    });

    const op =
      sev==="bad" ? "Riesgo alto." :
      sev==="warn" ? "Revisar." :
      "OK.";

    return {
      s: sig.length ? sig.join(" | ") : "Sin señales relevantes",
      e: eth.size ? [...eth].join(" | ") : "—",
      o: op
    };
  };

  /* ================= HUMANO ================= */

  const loadDB = () => {
    try { return JSON.parse(localStorage.getItem(LS_KEY)||"{}"); }
    catch { return {}; }
  };
  const saveDB = db => localStorage.setItem(LS_KEY, JSON.stringify(db));

  const normPct = v => {
    const s = String(v??"").replace(",",".");
    return s === PCT_ALLOWED ? PCT_ALLOWED : "0";
  };

  /* ================= RENDER ================= */

  const render = async row => {
    const OPEN = await loadOpen();
    const key = buildRowKey(row);
    const db = loadDB();

    const rows = Q_ABIERTAS.map((qid,i)=>{
      const h = QID_TO_HEADER[qid];
      const a = row[h];
      const auto = evalAuto(OPEN,qid,a);
      const hk = `${key}__${qid}`;
      const sv = db[hk]||{obs:"",pct:"0"};

      return `
        <tr data-k="${hk}">
          <td>${i+1}</td>
          <td><b>${headerNumber(h)}/33</b> ${esc(questionText(h))}</td>
          <td>${esc(safe(a))}</td>
          <td>${esc(auto.s)}</td>
          <td>${esc(auto.e)}</td>
          <td>${esc(auto.o)}</td>
          <td><textarea>${esc(sv.obs)}</textarea></td>
          <td><input type="number" step="8.33" value="${sv.pct}"></td>
        </tr>`;
    }).join("");

    return `
      <div id="${WRAP_ID}" class="miniCard">
        <div class="sectionTitle">PARTE 1/3 — ABIERTAS (PRIORIDAD ALTA)</div>
        <table class="table">
          <thead>
            <tr>
              <th>#</th><th>Pregunta</th><th>Respuesta</th>
              <th>Señales</th><th>Ética</th><th>Opinión IA</th>
              <th>Observación</th><th>%</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  };

  const bindHuman = panel => {
    const db = loadDB();
    panel.querySelectorAll(`#${WRAP_ID} tr[data-k]`).forEach(tr=>{
      const k = tr.dataset.k;
      const ta = tr.querySelector("textarea");
      const ip = tr.querySelector("input");
      const save = ()=>{
        db[k]={obs:ta.value,pct:normPct(ip.value)};
        ip.value=db[k].pct;
        saveDB(db);
      };
      ta.oninput = save;
      ip.oninput = save;
      ip.onblur = save;
    });
  };

  /* ================= PATCH ================= */

  const patch = async panel => {
    if (!panel || panel.style.display==="none") return;
    ensureStyle();
    hideOldParte13(panel);

    const row = extractRowRaw(panel);
    if (!row) return;

    const key = buildRowKey(row);
    if (panel.getAttribute(PATCH_KEY)===key) return;

    panel.querySelector(`#${WRAP_ID}`)?.remove();
    const wrap = document.createElement("div");
    wrap.innerHTML = await render(row);

    const top = panel.querySelector(".row");
    panel.insertBefore(wrap.firstElementChild, top?.nextSibling || panel.firstChild);

    panel.setAttribute(PATCH_KEY,key);
    bindHuman(panel);
  };

  const init = ()=>{
    const p = document.getElementById(DETAIL_ID);
    if (!p) return;
    new MutationObserver(()=>patch(p)).observe(p,{childList:true,subtree:true});
    patch(p);
  };

  document.addEventListener("DOMContentLoaded",init);
})();
