// =====================================================
// PATCH DETALLE V2 (SIN TOCAR ui.js)
// - Renderiza 3 partes del detalle estilo mock
// - Parte 2/3 (13 cerradas): usa rules/rules_v1.json
//
// ✅ NUEVO (TU PEDIDO):
// PARTE 1/3:
// A) Completa AUTOMÁTICO 3 columnas SOLO si hay respuesta:
//    - Señales detectadas (válida rta)
//    - Reglas éticas afectadas (si aplica)
//    - Opinión IA (NO decide)
// B1) Permite editar 2 columnas (Observación humana + Porcentaje) y guardar localStorage
// B2) Agrega TABLA RESUMEN Parte 1/3:
//    - ≥70% => APROBADO | <70% => NO VALIDO
//
// Nota: no crea archivos nuevos.
// =====================================================

(() => {
  const DETAIL_ID = "detailPanel";

  const PATCH_KEY_ATTR = "data-patched-v2-key";
  const WRAP_ID = "detalleV2_wrap";
  const STYLE_ID = "detalleV2_style";

  // LocalStorage para Parte 1/3 (humano)
  const LS_P13_KEY = "cfc_preseleccion_p13_v1";

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

  function parsePctInputToNumber(txt) {
    // acepta "8,33" "8.33" "8,33%" "8.33%"
    const s = String(txt ?? "").trim().replace("%", "").replace(",", ".");
    const n = Number(s);
    if (!isFinite(n) || n < 0) return 0;
    return Math.min(100, n);
  }

  // -------------------------
  // Storage Parte 1/3 humano
  // -------------------------

  function loadP13Store() {
    try {
      const raw = localStorage.getItem(LS_P13_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === "object") ? obj : {};
    } catch (_) {
      return {};
    }
  }

  function saveP13Store(store) {
    try {
      localStorage.setItem(LS_P13_KEY, JSON.stringify(store || {}));
    } catch (_) {}
  }

  function getP13Row(store, rowKey) {
    if (!store[rowKey]) store[rowKey] = { obs: {}, pct: {}, total_pct: 0, estado_def: "" };
    if (!store[rowKey].obs) store[rowKey].obs = {};
    if (!store[rowKey].pct) store[rowKey].pct = {};
    return store[rowKey];
  }

  function computeP13TotalFromRow(p13Row) {
    // SUMA de porcentajes por pregunta (lo definís vos con tu input)
    // Si no cargás nada => 0
    const pctObj = p13Row?.pct || {};
    let sum = 0;
    for (const v of Object.values(pctObj)) sum += parsePctInputToNumber(v);
    sum = Math.max(0, Math.min(100, Math.round(sum * 100) / 100));
    const estado = (sum >= 70) ? "APROBADO" : "NO VALIDO";
    return { total: sum, estado };
  }

  function emitP13Updated(rowKey) {
    try {
      window.dispatchEvent(new CustomEvent("psv:p13updated", { detail: { rowKey } }));
    } catch (_) {}
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

      /* Inputs Parte 1/3 */
      #${WRAP_ID} .p13InputObs{
        width: 100%;
        min-height: 34px;
        border: 1px solid var(--border);
        border-radius: 10px;
        background: rgba(255,255,255,0.03);
        color: var(--text);
        padding: 8px;
        font-family: var(--font) !important;
        font-size: 12px;
      }
      #${WRAP_ID} .p13InputPct{
        width: 110px;
        border: 1px solid var(--border);
        border-radius: 10px;
        background: rgba(255,255,255,0.03);
        color: var(--text);
        padding: 8px;
        font-family: var(--font) !important;
        font-size: 12px;
      }
      #${WRAP_ID} .p13Hint{
        font-size: 12px;
        color: var(--muted);
        margin-top: 8px;
      }
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
  // Render Parte 1/3 (✅ AJUSTADO A TU PEDIDO)
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

  function buildRowKey(rowRaw) {
    const mt = safeVal(rowRaw?.["Marca temporal"]);
    const em = safeVal(rowRaw?.["Dirección de correo electrónico"]);
    return `${mt}__${em}`;
  }

  function renderParte13(rowRaw, correctList, incorrectList) {
    const pctFixedPerQ = pctFixed(1, 12);
    const rowKey = buildRowKey(rowRaw);

    // Traer lo humano guardado
    const store = loadP13Store();
    const p13Row = getP13Row(store, rowKey);

    const rows = Q_ABIERTAS_ALTA.map((qid, idx) => {
      const header = QID_TO_HEADER[qid];
      const qnum = headerNumber(header) + "/33";
      const pregunta = questionTextFromHeader(header);

      const ansRaw = String(rowRaw?.[header] ?? "");
      const ansTrim = ansRaw.trim();
      const ans = safeVal(ansRaw);

      // Regla A: si NO hay respuesta => 3 columnas automáticas VACÍAS
      let senales = "";
      let eticas = "";
      let opinion = "";

      if (ansTrim.length) {
        const estadoAuto = inferEstadoPorHeader(header, correctList, incorrectList);

        // Señales
        if (estadoAuto === "CORRECTA") senales = "✔ Respuesta VÁLIDA (señales automáticas)";
        else if (estadoAuto === "INCORRECTA") senales = "✖ Respuesta NO VÁLIDA (señales automáticas)";
        else senales = "—";

        // Reglas éticas (si aplica)
        const incHit = inferJustificacion(header, correctList, incorrectList);
        const incHitLow = String(incHit || "").toLowerCase();

        // criterio simple: si hay una falla / banned / marketing / prohib => lo mostramos
        if (estadoAuto === "INCORRECTA" && (incHitLow.includes("banned") || incHitLow.includes("marketing") || incHitLow.includes("prohib") || incHitLow.includes("falla"))) {
          eticas = incHit;
        } else {
          eticas = "—";
        }

        // Opinión IA (NO decide): SOLO opinión del sistema, sin “decidir”
        if (estadoAuto === "CORRECTA") opinion = "VÁLIDA (no decide)";
        else if (estadoAuto === "INCORRECTA") opinion = "NO VÁLIDA (no decide)";
        else opinion = "—";
      }

      // Inputs humanos
      const obsVal = String(p13Row.obs?.[qid] ?? "");
      const pctVal = String(p13Row.pct?.[qid] ?? "");

      return `
        <tr>
          <td>${idx + 1}</td>
          <td><span class="kbd">${esc(qnum)}</span> ${esc(pregunta)}</td>
          <td>${esc(ans)}</td>

          <td>${esc(senales)}</td>
          <td>${esc(eticas)}</td>
          <td><b>${esc(opinion)}</b></td>

          <td>
            <textarea
              class="p13InputObs"
              data-p13="obs"
              data-rowkey="${esc(rowKey)}"
              data-qid="${esc(qid)}"
              placeholder="(solo vos) Observación humana..."
            >${esc(obsVal)}</textarea>
          </td>

          <td>
            <input
              class="p13InputPct"
              data-p13="pct"
              data-rowkey="${esc(rowKey)}"
              data-qid="${esc(qid)}"
              inputmode="decimal"
              placeholder="ej: 8,33"
              value="${esc(pctVal)}"
            />
            <div class="p13Hint">Referencia: ${esc(pctFixedPerQ)} por pregunta (si usás reparto fijo)</div>
          </td>
        </tr>
      `;
    }).join("");

    // Summary Parte 1/3 (B2)
    const totals = computeP13TotalFromRow(p13Row);
    const totalPctTxt = toPctTxt(totals.total);

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
                <th style="width:180px;">OPINIÓN IA (NO decide)</th>
                <th style="width:260px;">OBSERVACIÓN HUMANA</th>
                <th style="width:160px;">PORCENTAJE</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>

        <div style="margin-top:12px; overflow:auto;">
          <table class="table">
            <thead>
              <tr>
                <th>RESUMEN — PARTE 1/3</th>
                <th style="width:120px;">UNIDAD</th>
                <th style="width:140px;">PORCENTAJE</th>
                <th style="width:180px;">ESTADO (definitivo)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><b>TOTAL DE PREGUNTAS</b></td>
                <td>12</td>
                <td>100%</td>
                <td>—</td>
              </tr>
              <tr>
                <td><b>RESULTADO DEFINITIVO</b> (suma de tus porcentajes)</td>
                <td>—</td>
                <td><b>${esc(totalPctTxt)}</b></td>
                <td><b>${esc(totals.estado)}</b></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="p13Hint" style="margin-top:10px;">
          Regla Parte 1/3: <b>≥70% = APROBADO</b> | <b>&lt;70% = NO VALIDO</b>. (Lo define TU porcentaje manual)
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
  // Ocultar bloque viejo "PASO 2.4"
  // -------------------------

  function hideOldPaso24(panel) {
    const candidates = [...panel.querySelectorAll("div, p, span")];
    const marker = candidates.find(el => norm(el.textContent || "").includes("paso 2.4"));
    if (!marker) return;

    const next = marker.nextElementSibling;
    marker.style.display = "none";
    if (next) next.style.display = "none";
  }

  // -------------------------
  // Bind inputs Parte 1/3
  // -------------------------

  function bindP13Inputs(wrap) {
    if (!wrap) return;

    const store = loadP13Store();

    // OBS
    wrap.querySelectorAll("textarea[data-p13='obs']").forEach(el => {
      el.addEventListener("input", () => {
        const rowKey = el.getAttribute("data-rowkey") || "";
        const qid = el.getAttribute("data-qid") || "";
        const p13Row = getP13Row(store, rowKey);

        p13Row.obs[qid] = el.value || "";

        const totals = computeP13TotalFromRow(p13Row);
        p13Row.total_pct = totals.total;
        p13Row.estado_def = totals.estado;

        saveP13Store(store);
        emitP13Updated(rowKey);
      });
    });

    // PCT
    wrap.querySelectorAll("input[data-p13='pct']").forEach(el => {
      const handler = () => {
        const rowKey = el.getAttribute("data-rowkey") || "";
        const qid = el.getAttribute("data-qid") || "";
        const p13Row = getP13Row(store, rowKey);

        p13Row.pct[qid] = el.value || "";

        const totals = computeP13TotalFromRow(p13Row);
        p13Row.total_pct = totals.total;
        p13Row.estado_def = totals.estado;

        saveP13Store(store);
        emitP13Updated(rowKey);
      };

      el.addEventListener("input", handler);
      el.addEventListener("change", handler);
      el.addEventListener("blur", handler);
    });
  }

  // -------------------------
  // Patch principal
  // -------------------------

  async function patch(panel) {
    if (!panel) return;
    if (panel.style.display === "none") return;

    ensureInnerStyle();
    hideUselessCorrectIncorrectBoxes(panel);
    hideOldPaso24(panel);

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

    // Bind inputs (importante: después del insert)
    bindP13Inputs(wrap);
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
