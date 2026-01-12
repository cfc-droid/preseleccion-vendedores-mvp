// =====================================================
// PATCH DETALLE V2 (SIN TOCAR ui.js)
// - Renderiza 3 partes del detalle estilo mock
// - Parte 2/3 (13 cerradas):
//   * Puntaje SOLO: "7,69%" o "0" (si hay respuesta)
//   * Justificación SOLO: "OK porque ..." / "NO ES VALIDO porque ..."
//   * Evaluación usando rules/rules_v1.json (gates/scoring por header)
//
// FIX (2026-01-12):
// - NO pisa el Detalle nuevo de ui.js (PASO 2.4 + columnas Señales/Ética/Opinión).
// - Si detecta el detalle nuevo => NO renderiza mock, NO oculta Paso 2.4.
// =====================================================

(() => {
  const DETAIL_ID = "detailPanel";

  const PATCH_KEY_ATTR = "data-patched-v2-key";
  const WRAP_ID = "detalleV2_wrap";
  const STYLE_ID = "detalleV2_style";

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

  function pctFixed(_n, total) {
    const v = total > 0 ? (100 / total) : 0;
    return (Math.round(v * 100) / 100).toFixed(2).replace(".", ",") + "%";
  }

  function normalizeText(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function toPctTxt(n) {
    const v = Math.round(Number(n) * 100) / 100;
    return v.toFixed(2).replace(".", ",") + "%";
  }

  // -------------------------
  // Detectar si UI nueva ya renderizó PASO 2.4
  // (si existe => NO renderizar mock, NO ocultar nada)
  // -------------------------

  function hasNewUIDetail(panel) {
    // Señal 1: texto explícito "PASO 2.4 — Detalle por secciones"
    const txt = norm(panel.textContent || "");
    if (txt.includes("paso 2.4") && txt.includes("detalle por secciones")) return true;

    // Señal 2: tabla Parte 1/3 con headers "Señales" "Ética" "Opinión"
    const ths = [...panel.querySelectorAll("table thead th")].map(th => norm(th.textContent || ""));
    const hasSignals = ths.some(t => t === "señales" || t.includes("señales"));
    const hasEthics = ths.some(t => t === "ética" || t.includes("ética") || t.includes("etica"));
    const hasOpinion = ths.some(t => t === "opinión" || t.includes("opinión") || t.includes("opinion"));

    if (hasSignals && hasEthics && hasOpinion) return true;

    return false;
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

  // -------------------------
  // 3 PARTES (mock)
  // -------------------------

  const Q_ABIERTAS_ALTA = ["Q1","Q9","Q13","Q14","Q15","Q18","Q21","Q22","Q23","Q27","Q30","Q31"];
  const Q_CERRADAS_FIJAS = ["Q2","Q3","Q4","Q5","Q6","Q7","Q12","Q16","Q17","Q19","Q20","Q24","Q25"];
  const Q_INFO = ["Q8","Q10","Q11","Q26","Q28","Q29","Q32","Q33"];

  // -------------------------
  // Extraer rowRaw + listas del DOM
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

  function extractList(panel, titleIncludes) {
    const cards = [...panel.querySelectorAll(".miniCard")];
    const card = cards.find(c => (c.querySelector(".sectionTitle")?.textContent || "").includes(titleIncludes));
    if (!card) return [];
    return [...card.querySelectorAll("ul.list li")]
      .map(li => (li.textContent || "").trim())
      .filter(Boolean);
  }

  function hideUselessCorrectIncorrectBoxes(panel) {
    const cards = [...panel.querySelectorAll(".miniCard")];
    for (const c of cards) {
      const t = norm(c.querySelector(".sectionTitle")?.textContent || "");
      if (t.includes("respuestas/condiciones correctas") || t.includes("respuestas/condiciones incorrectas")) {
        c.style.display = "none";
      }
    }
  }

  // -------------------------
  // Estilos internos
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
      }
      #${WRAP_ID} td:nth-child(3){ max-width: 520px; }
    `;
    document.head.appendChild(st);
  }

  // -------------------------
  // Cargar rules una vez
  // -------------------------

  let _RULES_CACHE = null;

  async function loadRulesOnce() {
    if (_RULES_CACHE) return _RULES_CACHE;
    try {
      const res = await fetch("rules/rules_v1.json");
      if (!res.ok) throw new Error(`No se pudo cargar rules_v1.json (HTTP ${res.status})`);
      _RULES_CACHE = await res.json();
      return _RULES_CACHE;
    } catch (e) {
      console.error(e);
      _RULES_CACHE = null;
      return null;
    }
  }

  function getGateByHeader(RULES, header) {
    const gates = Array.isArray(RULES?.gates) ? RULES.gates : [];
    return gates.find(g => g && g.header === header) || null;
  }

  function getScoringRuleByHeader(RULES, header) {
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

  function evalGateSimple(gate, value) {
    if (!gate || !gate.type) return { ok: true };

    if (gate.type === "equals") {
      const ok = String(value ?? "") !== String(gate.value ?? "");
      return { ok, why: ok ? "Cumple" : (gate.reason || "No cumple") };
    }

    if (gate.type === "contains_all") {
      const normv = normalizeText(value);
      const ok = (gate.value || []).every(v => normv.includes(normalizeText(v)));
      return { ok, why: ok ? "Aceptó reglas" : (gate.reason || "No acepta todas las reglas") };
    }

    return { ok: true, why: "Cumple" };
  }

  function evalClosedOkByRules(RULES, header, answer) {
    const a = String(answer ?? "").trim();
    if (!a) return { hasAnswer: false, isOk: false, whyCore: "" };

    // 1) Gate (si falla => NO válido)
    const g = getGateByHeader(RULES, header);
    if (g) {
      const eg = evalGateSimple(g, a);
      if (!eg.ok) return { hasAnswer: true, isOk: false, whyCore: g.reason || "No cumple gate" };
    }

    // 2) Scoring (si existe)
    const sr = getScoringRuleByHeader(RULES, header);
    if (sr && sr.r) {
      const r = sr.r;

      if (r.type === "equals") {
        const ok = a === String(r.value ?? "");
        return { hasAnswer: true, isOk: ok, whyCore: ok ? `respondió "${a}" y coincide con lo esperado` : `respondió "${a}" y no coincide con lo esperado` };
      }

      if (r.type === "contains_all") {
        const normv = normalizeText(a);
        const ok = (r.value || []).every(v => normv.includes(normalizeText(v)));
        return { hasAnswer: true, isOk: ok, whyCore: ok ? "incluye todas las reglas obligatorias" : "no incluye todas las reglas obligatorias" };
      }

      if (r.type === "map") {
        const pts = Number((r.points_map && (r.points_map[a] ?? r.points_map[String(a)])) || 0);
        const ok = pts > 0;
        return { hasAnswer: true, isOk: ok, whyCore: ok ? `suma puntos (${pts})` : "no suma puntos (0)" };
      }
    }

    // 3) Sin regla: si hay respuesta, válida mínima
    return { hasAnswer: true, isOk: true, whyCore: "hay respuesta" };
  }

  function closedJustificationStrict(answer, isOk, whyCore) {
    const a = String(answer ?? "").trim();
    if (!a) return "";
    if (isOk) return `OK porque ${whyCore || "cumple la condición"}.`;
    return `NO ES VALIDO porque ${whyCore || "no cumple la condición"}.`;
  }

  // -------------------------
  // Render Parte 1/3 (mantiene lógica anterior)
  // -------------------------

  function inferEstadoPorHeader(header, correctList, incorrectList) {
    const h = canonHeader(header);
    const ok = correctList.some(x => x.includes(h));
    const bad =
      incorrectList.some(x => x.includes(h)) ||
      incorrectList.some(x => x.includes("FALLA") && x.includes(headerNumber(header) ? `${headerNumber(header)}/33` : ""));
    if (bad) return "INCORRECTA";
    if (ok) return "CORRECTA";
    return "—";
  }

  function inferJustificacion(header, correctList, incorrectList) {
    const h = canonHeader(header);
    const hitBad = incorrectList.find(x => x.includes(h));
    const hitOk = correctList.find(x => x.includes(h));
    if (hitBad) return hitBad;
    if (hitOk) return hitOk;
    return "—";
  }

  function renderParte13(rowRaw, correctList, incorrectList) {
    const pct = pctFixed(1, 12);

    const rows = Q_ABIERTAS_ALTA.map((qid, idx) => {
      const header = QID_TO_HEADER[qid];
      const qnum = headerNumber(header) + "/33";
      const pregunta = questionTextFromHeader(header);
      const ans = safeVal(rowRaw?.[header]);

      const estado = inferEstadoPorHeader(header, correctList, incorrectList);
      const senales = (estado === "CORRECTA")
        ? "✔ Respuesta VÁLIDA (señales automáticas)"
        : (estado === "INCORRECTA")
          ? "✖ Respuesta NO VÁLIDA (señales automáticas)"
          : "—";

      const incHit = inferJustificacion(header, correctList, incorrectList);
      const eticas =
        (String(incHit).toLowerCase().includes("banned") ||
         String(incHit).toLowerCase().includes("marketing") ||
         String(incHit).toLowerCase().includes("prohib"))
          ? incHit
          : (estado === "INCORRECTA" ? incHit : "—");

      return `
        <tr>
          <td>${idx + 1}</td>
          <td><span class="kbd">${esc(qnum)}</span> ${esc(pregunta)}</td>
          <td>${esc(ans)}</td>
          <td>${esc(senales)}</td>
          <td>${esc(eticas)}</td>
          <td><b>${esc(estado)}</b></td>
          <td>—</td>
          <td>${pct}</td>
        </tr>
      `;
    }).join("");

    return `
      <div class="miniCard" style="margin-top:14px;">
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
  }

  // -------------------------
  // Render Parte 2/3 (CORREGIDA: puntaje+justificación estricta)
  // -------------------------

  async function renderParte23(rowRaw) {
    const RULES = await loadRulesOnce();
    const pct = toPctTxt(100 / 13); // "7,69%"

    const items = Q_CERRADAS_FIJAS.map((qid, idx) => {
      const header = QID_TO_HEADER[qid];
      const qnum = headerNumber(header) + "/33";
      const pregunta = questionTextFromHeader(header);
      const respRaw = String(rowRaw?.[header] ?? "");
      const resp = safeVal(respRaw);

      const ev = RULES ? evalClosedOkByRules(RULES, header, respRaw) : { hasAnswer: !!respRaw.trim(), isOk: false, whyCore: "no se cargaron reglas" };

      // Puntaje SOLO si hay respuesta
      const puntaje = ev.hasAnswer ? (ev.isOk ? pct : "0") : "";
      const just = ev.hasAnswer ? closedJustificationStrict(respRaw, ev.isOk, ev.whyCore) : "";

      return { idx, qnum, pregunta, resp, hasAnswer: ev.hasAnswer, isOk: ev.isOk, puntaje, just };
    });

    const total = 13;
    const validas = items.filter(x => x.isOk).length;
    const incorrectas = total - validas;

    const pctValid = total ? Math.round((validas / total) * 100) : 0;
    const pctInc = total ? Math.round((incorrectas / total) * 100) : 0;

    const estadoResumen = (pctValid >= 70) ? "REVISAR_AUTO" : "DESCARTADO_AUTO";

    const rowsCerradas = () => items.map(x => `
      <tr>
        <td>${x.idx + 1}</td>
        <td><span class="kbd">${esc(x.qnum)}</span></td>
        <td>${esc(x.pregunta)}</td>
        <td>${esc(x.puntaje)}</td>
        <td>${esc(x.resp)}</td>
        <td>${esc(x.just)}</td>
        <td>${esc(pct)}</td>
      </tr>
    `).join("");

    return `
      <div class="miniCard" style="margin-top:14px;">
        <div class="sectionTitle">PARTE 2/3 — PREGUNTAS Y RESPUESTAS (CERRADAS) — FIJO (13 preguntas)</div>

        <div style="overflow:auto; margin-top:10px;">
          <table class="table">
            <thead>
              <tr>
                <th style="min-width:260px;">RESUMEN — RESPUESTAS “CERRADAS”</th>
                <th style="width:100px;">UNIDAD</th>
                <th style="width:120px;">PORCENTAJE</th>
                <th style="width:180px;">ESTADO (solo 2)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><b>TOTAL DE PREGUNTAS</b></td><td>${total}</td><td>100%</td><td>—</td></tr>
              <tr><td><b>RESPUESTAS VÁLIDAS</b></td><td>${validas}</td><td>${pctValid}%</td><td><b>${esc(estadoResumen)}</b></td></tr>
              <tr><td><b>RESPUESTAS INCORRECTAS</b></td><td>${incorrectas}</td><td>${pctInc}%</td><td>—</td></tr>
            </tbody>
          </table>
        </div>

        <div class="muted" style="margin-top:8px;">
          Regla Parte 2/3 (AUTOMÁTICA): &lt;70% = DESCARTADO_AUTO | ≥70% = REVISAR_AUTO.
        </div>

        <div style="margin-top:14px;">
          <div class="sectionTitle">RESPUESTAS — DETALLE (13 filas fijas)</div>
          <div style="overflow:auto; margin-top:10px;">
            <table class="table">
              <thead>
                <tr>
                  <th style="width:60px;">N°</th>
                  <th style="width:80px;">Q</th>
                  <th style="width:280px;">PREGUNTA</th>
                  <th style="width:110px;">PUNTAJE</th>
                  <th style="width:240px;">RESPUESTA DEL VENDEDOR</th>
                  <th style="width:360px;">JUSTIFICACIÓN “CERRADA” — RESPUESTA DE LA IA</th>
                  <th style="width:120px;">PORCENTAJE</th>
                </tr>
              </thead>
              <tbody>${rowsCerradas()}</tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // -------------------------
  // Render Parte 3/3
  // -------------------------

  function renderParte33(rowRaw) {
    const rows = Q_INFO.map((qid, idx) => {
      const header = QID_TO_HEADER[qid];
      const qnum = headerNumber(header) + "/33";
      const pregunta = questionTextFromHeader(header);
      const resp = safeVal(rowRaw?.[header]);

      return `
        <tr>
          <td>${idx + 1}</td>
          <td><span class="kbd">${esc(qnum)}</span> ${esc(pregunta)}</td>
          <td>${esc(resp)}</td>
        </tr>
      `;
    }).join("");

    return `
      <div class="miniCard" style="margin-top:14px;">
        <div class="sectionTitle">PARTE 3/3 — PREGUNTAS Y RESPUESTAS (ABIERTAS • INFORMATIVAS)</div>
        <div style="overflow:auto; margin-top:10px;">
          <table class="table">
            <thead>
              <tr>
                <th style="width:60px;">N°</th>
                <th style="width:360px;">8 PREGUNTAS “ABIERTAS” — PRIORIDAD BAJA</th>
                <th style="width:520px;">RESPUESTA DEL VENDEDOR</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  // -------------------------
  // RowKey
  // -------------------------

  function buildRowKey(rowRaw) {
    const mt = safeVal(rowRaw?.["Marca temporal"]);
    const em = safeVal(rowRaw?.["Dirección de correo electrónico"]);
    return `${mt}__${em}`;
  }

  // -------------------------
  // Patch principal
  // -------------------------

  async function patch(panel) {
    if (!panel) return;
    if (panel.style.display === "none") return;

    // FIX: si UI nueva está presente, no tocar nada del detalle nuevo.
    // (Dejamos el script cargado sin romper otras cosas.)
    if (hasNewUIDetail(panel)) {
      // Si existía un wrap viejo de este patch, lo retiramos para no duplicar.
      const existingWrap = panel.querySelector(`#${WRAP_ID}`);
      if (existingWrap) existingWrap.remove();
      // No ocultar nada.
      return;
    }

    ensureInnerStyle();
    hideUselessCorrectIncorrectBoxes(panel);

    const rowRaw = extractRowRaw(panel);
    if (!rowRaw) return;

    const rowKey = buildRowKey(rowRaw);
    const prevKey = panel.getAttribute(PATCH_KEY_ATTR);
    const existingWrap = panel.querySelector(`#${WRAP_ID}`);
    if (prevKey === rowKey && existingWrap) return;

    if (existingWrap) existingWrap.remove();

    // correct/incorrect siguen existiendo para Parte 1/3
    const correctList = extractList(panel, "CORRECTAS");
    const incorrectList = extractList(panel, "INCORRECTAS");

    // Insertar antes del JSON final
    const allDivs = [...panel.querySelectorAll("div")];
    const jsonDiv = allDivs.find(d => (d.textContent || "").trim().startsWith("{") && (d.textContent || "").includes('"Marca temporal"'));
    if (!jsonDiv) return;

    const wrap = document.createElement("div");
    wrap.id = WRAP_ID;

    const parte23 = await renderParte23(rowRaw);

    wrap.innerHTML = `
      ${renderParte13(rowRaw, correctList, incorrectList)}
      ${parte23}
      ${renderParte33(rowRaw)}
    `;

    jsonDiv.parentNode.insertBefore(wrap, jsonDiv);
    panel.setAttribute(PATCH_KEY_ATTR, rowKey);
  }

  // -------------------------
  // Observer
  // -------------------------

  function init() {
    const panel = document.getElementById(DETAIL_ID);
    if (!panel) return;

    const obs = new MutationObserver(() => {
      patch(panel);
    });

    obs.observe(panel, { childList: true, subtree: true });
    patch(panel);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
