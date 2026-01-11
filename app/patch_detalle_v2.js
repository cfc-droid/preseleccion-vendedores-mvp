// =====================================================
// PATCH DETALLE V2 (SIN TOCAR ui.js)
// - Rehace las 3 partes del detalle con el nivel del mock
// - Usa SOLO el DOM ya renderizado por ui.js:
//   * Lee rowRaw (JSON visible al final del detalle)
//   * Lee listas CORRECTAS/INCORRECTAS (ULs existentes)
// - No toca scoring, gates, reglas. Solo PRESENTACIÓN.
// =====================================================

(() => {
  const DETAIL_ID = "detailPanel";

  const PATCH_KEY_ATTR = "data-patched-v2-key"; // clave por fila (NO booleano)
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

  // Ocultar SIEMPRE los 2 cuadros inútiles
  function hideUselessCorrectIncorrectBoxes(panel) {
    const cards = [...panel.querySelectorAll(".miniCard")];
    for (const c of cards) {
      const t = norm(c.querySelector(".sectionTitle")?.textContent || "");
      if (
        t.includes("respuestas/condiciones correctas") ||
        t.includes("respuestas/condiciones incorrectas")
      ) {
        c.style.display = "none";
      }
    }
  }

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

  // -------------------------
  // Estilos internos para NO heredar monospace / pre-wrap
  // -------------------------

  function ensureInnerStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const st = document.createElement("style");
    st.id = STYLE_ID;

    st.textContent = `
      /* El panel original usa monospace + pre-wrap. Lo anulamos SOLO dentro del wrap nuevo */
      #${WRAP_ID}, #${WRAP_ID} *{
        font-family: var(--font, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial) !important;
        white-space: normal !important;
      }
      #${WRAP_ID} .table{
        table-layout: fixed;
        width:100%;
      }
      #${WRAP_ID} th, #${WRAP_ID} td{
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      /* Evita que una respuesta larguísima empuje todo */
      #${WRAP_ID} td:nth-child(3){
        max-width: 520px;
      }
    `;
    document.head.appendChild(st);
  }

  // -------------------------
  // Render (3 partes)
  // -------------------------

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

  function renderParte23(rowRaw, correctList, incorrectList) {
    const pct = pctFixed(1, 13);

    const items = Q_CERRADAS_FIJAS.map((qid, idx) => {
      const header = QID_TO_HEADER[qid];
      const qnum = headerNumber(header) + "/33";
      const pregunta = questionTextFromHeader(header);
      const resp = safeVal(rowRaw?.[header]);

      const estado = inferEstadoPorHeader(header, correctList, incorrectList);
      const just = inferJustificacion(header, correctList, incorrectList);
      const puntos = (estado === "CORRECTA") ? pct : (estado === "INCORRECTA" ? "0" : "—");

      return { idx, qnum, pregunta, resp, estado, just, puntos };
    });

    const total = 13;
    const validas = items.filter(x => x.estado === "CORRECTA").length;
    const incorrectas = items.filter(x => x.estado === "INCORRECTA").length;

    const pctValid = total ? Math.round((validas / total) * 100) : 0;
    const pctInc = total ? Math.round((incorrectas / total) * 100) : 0;

    const estadoResumen = (pctValid >= 70) ? "APTO" : (pctValid >= 50) ? "REVISAR" : "DESCARTADO";

    const rowsCerradas = () => items.map(x => `
      <tr>
        <td>${x.idx + 1}</td>
        <td><span class="kbd">${esc(x.qnum)}</span></td>
        <td>${esc(x.pregunta)}</td>
        <td>${esc(x.puntos)}</td>
        <td>${esc(x.resp)}</td>
        <td>${esc(x.just)}</td>
        <td>${pct}</td>
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
                <th style="width:160px;">ESTADO</th>
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
          Regla (solo informativa para Parte 2/3): ≥70% = APTO, 50–69% = REVISAR, &lt;50% = DESCARTADO.
          (Esta parte NO decide el estado final, es resumen fijo de cerradas.)
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
                  <th style="width:320px;">JUSTIFICACIÓN “CERRADA” — RESPUESTA DE LA IA</th>
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
  // (más robusto: no depende solo de .muted)
  // -------------------------

  function hideOldPaso24(panel) {
    const candidates = [...panel.querySelectorAll("div, p, span")];
    const marker = candidates.find(el => norm(el.textContent || "").includes("paso 2.4"));
    if (!marker) return;

    // A veces el layout viejo viene “pegado” en el siguiente contenedor
    const next = marker.nextElementSibling;
    marker.style.display = "none";
    if (next) next.style.display = "none";
  }

  // -------------------------
  // RowKey: para re-patchear al cambiar de fila
  // -------------------------

  function buildRowKey(rowRaw) {
    // Robustez: marca temporal + email (si falta algo, igual arma key)
    const mt = safeVal(rowRaw?.["Marca temporal"]);
    const em = safeVal(rowRaw?.["Dirección de correo electrónico"]);
    return `${mt}__${em}`;
  }

  // -------------------------
  // Patch principal (re-render por fila)
  // -------------------------

  function patch(panel) {
    if (!panel) return;
    if (panel.style.display === "none") return;

    ensureInnerStyle();

    // Siempre: ocultar cajas inútiles + ocultar paso viejo
    hideUselessCorrectIncorrectBoxes(panel);
    hideOldPaso24(panel);

    const rowRaw = extractRowRaw(panel);
    if (!rowRaw) return;

    const rowKey = buildRowKey(rowRaw);
    const prevKey = panel.getAttribute(PATCH_KEY_ATTR);

    // Si ya está renderizado para ESTA fila y el wrap existe, no hagas nada
    const existingWrap = panel.querySelector(`#${WRAP_ID}`);
    if (prevKey === rowKey && existingWrap) return;

    // Si cambia la fila: borrar wrap anterior y re-crear
    if (existingWrap) existingWrap.remove();

    const correctList = extractList(panel, "CORRECTAS");
    const incorrectList = extractList(panel, "INCORRECTAS");

    // Insertar antes del JSON final
    const allDivs = [...panel.querySelectorAll("div")];
    const jsonDiv = allDivs.find(d => (d.textContent || "").trim().startsWith("{") && (d.textContent || "").includes('"Marca temporal"'));
    if (!jsonDiv) return;

    const wrap = document.createElement("div");
    wrap.id = WRAP_ID;
    wrap.innerHTML = `
      ${renderParte13(rowRaw, correctList, incorrectList)}
      ${renderParte23(rowRaw, correctList, incorrectList)}
      ${renderParte33(rowRaw)}
    `;

    jsonDiv.parentNode.insertBefore(wrap, jsonDiv);

    // Guardar key de la fila actual
    panel.setAttribute(PATCH_KEY_ATTR, rowKey);
  }

  // -------------------------
  // Observer
  // -------------------------

  function init() {
    const panel = document.getElementById(DETAIL_ID);
    if (!panel) return;

    const obs = new MutationObserver(() => {
      // ui.js re-renderiza: re-patchear SIEMPRE según rowKey
      patch(panel);
    });

    obs.observe(panel, { childList: true, subtree: true });

    // primer intento
    patch(panel);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
