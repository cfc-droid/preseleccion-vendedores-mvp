// ======================================================
// UI — FASE D (SALIDA)
// tabla + filtros + detalle por fila
// + pestañas: Resultados | Seleccionados | Historial
// + export CSV + historial local
// ======================================================

window.UI = (() => {
  let currentFilter = "ALL"; // ALL | APTO | REVISAR | DESCARTADO
  let lastPayload = null;

  let currentTab = "RESULTADOS"; // RESULTADOS | SELECCIONADOS | HISTORIAL
  const LS_KEY = "cfc_preseleccion_history_v1";

  // ======================================================
  // PASO 2.4 — Mapeo QID -> Header oficial (desde EXPECTED_HEADERS)
  // (copiado de app.js para que UI pueda separar secciones en Detalle)
  // ======================================================

  const EXPECTED_HEADERS_UI = [
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

  const QID_TO_HEADER = (() => {
    const m = {};
    for (const h of EXPECTED_HEADERS_UI) {
      const num = headerNumber(h);
      if (num) m[`Q${num}`] = h;
    }
    return m;
  })();

  function questionLabelFromHeader(h) {
    // "12/33. bla" -> "Q12"
    const num = headerNumber(h);
    return num ? `Q${num}` : "";
  }

  function questionTextFromHeader(h) {
    // "12/33. Texto" -> "Texto"
    const s = canonHeader(h);
    return s.replace(/^\d+\/33\.\s*/, "");
  }

  function safeVal(v) {
    const s = String(v ?? "").trim();
    return s.length ? s : "—";
  }

  function getQLists() {
    // Preferimos las listas oficiales desde HumanPSV si existen
    const hasHuman = (window.HumanPSV && Array.isArray(HumanPSV.Q_ALTA) && Array.isArray(HumanPSV.Q_INFO));
    const Q_ALTA = hasHuman ? HumanPSV.Q_ALTA : ["Q1","Q9","Q13","Q14","Q15","Q18","Q21","Q22","Q23","Q27","Q30","Q31"];
    const Q_INFO = hasHuman ? HumanPSV.Q_INFO : ["Q8","Q10","Q11","Q26","Q28","Q29","Q32","Q33"];
    return { Q_ALTA, Q_INFO };
  }

  // ======================================================
  // PARTE 2/3 — CERRADAS FIJAS (NO varía cantidad)
  // 13 cerradas “core” (las que vos estás usando como resumen fijo)
  // ======================================================

  const Q_CERRADAS_FIXED = ["Q2","Q3","Q4","Q5","Q6","Q7","Q12","Q16","Q17","Q19","Q20","Q24","Q25"];

  // ======================================================
  // Carga de reglas (SOLO LECTURA desde UI) para evaluar cerradas fijas
  // ======================================================

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

  function normalizeText(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function evalGateRule(gate, value) {
    // Devuelve: { ok, why }
    if (!gate || !gate.type) return { ok: true, why: "—" };

    if (gate.type === "equals") {
      const ok = String(value ?? "") !== String(gate.value ?? "");
      return { ok, why: ok ? "Cumple" : (gate.reason || "No cumple") };
    }

    if (gate.type === "contains_all") {
      const norm = normalizeText(value);
      const ok = (gate.value || []).every(v => norm.includes(normalizeText(v)));
      return { ok, why: ok ? "Aceptó reglas" : (gate.reason || "No acepta todas las reglas") };
    }

    if (gate.type === "min_lines") {
      // Cerradas no usan esto normalmente, pero lo soportamos igual.
      const lines = String(value ?? "").split("\n").map(x => x.trim()).filter(x => x.length >= (gate.min_chars_per_line || 1)).length;
      const ok = lines >= (gate.min_lines || 0);
      return { ok, why: ok ? `Líneas válidas: ${lines}` : (gate.reason || "No cumple mínimo") };
    }

    return { ok: true, why: "—" };
  }

  function evalScoringRule(r, value) {
    // Devuelve: { ok, pts, why }
    if (!r || !r.type) return { ok: true, pts: 0, why: "—" };

    if (r.type === "equals") {
      const ok = String(value ?? "") === String(r.value ?? "");
      return { ok, pts: ok ? Number(r.points || 0) : 0, why: ok ? "Cumple" : "No cumple" };
    }

    if (r.type === "contains_all") {
      const norm = normalizeText(value);
      const ok = (r.value || []).every(v => norm.includes(normalizeText(v)));
      return { ok, pts: ok ? Number(r.points || 0) : 0, why: ok ? "Contiene reglas" : "Faltan reglas" };
    }

    if (r.type === "map") {
      const pts = Number((r.points_map && (r.points_map[value] ?? r.points_map[String(value)])) || 0);
      const ok = pts > 0;
      return { ok, pts, why: ok ? "Suma puntos" : "0 pts" };
    }

    // min_length, min_length_with_action son abiertas -> las ignoramos en Parte 2/3 cerradas
    return { ok: true, pts: 0, why: "—" };
  }

  function pctFixed13() {
    const v = 100 / 13; // 7.6923...
    return v.toFixed(2).replace(".", ",") + "%";
  }

  function buildFixedClosedRows(item, RULES) {
    // Siempre devuelve 13 filas (Q_CERRADAS_FIXED)
    const rr = item.rowRaw || {};
    const out = [];
    const PCT_OK = pctFixed13();

    // Index gates por header exacto
    const gates = Array.isArray(RULES?.gates) ? RULES.gates : [];
    const gateByHeader = {};
    for (const g of gates) {
      if (g && g.header) gateByHeader[g.header] = g;
    }

    // Index scoring rules por header (solo equals/map/contains_all)
    const scoring = RULES?.scoring || {};
    const scoringRulesFlat = [];
    for (const [block, ruleset] of Object.entries(scoring)) {
      if (block === "canales" && ruleset && Array.isArray(ruleset.rules)) {
        for (const r of ruleset.rules) scoringRulesFlat.push({ block, r });
        continue;
      }
      if (Array.isArray(ruleset)) {
        for (const r of ruleset) scoringRulesFlat.push({ block, r });
      }
    }

    const scoringByHeader = {};
    for (const it of scoringRulesFlat) {
      const h = it?.r?.header;
      if (!h) continue;
      if (!scoringByHeader[h]) scoringByHeader[h] = it;
    }

    for (let i = 0; i < Q_CERRADAS_FIXED.length; i++) {
      const qid = Q_CERRADAS_FIXED[i];
      const header = QID_TO_HEADER[qid] || "";
      const qtext = header ? questionTextFromHeader(header) : qid;

      const ansRaw = header ? rr[header] : "";
      const ansTrim = String(ansRaw ?? "").trim();

      let estado = "INCORRECTA";
      let why = "Celda vacía";
      let pts = "0";

      // REGLA BASE (TU PEDIDO):
      // - vacío => NO OK => 0
      // - OK => 7,69%
      if (!ansTrim.length) {
        out.push({
          idx: i + 1,
          qid,
          qtext,
          ans: safeVal(ansRaw),
          estado,
          why,
          pts
        });
        continue;
      }

      // Si tiene respuesta, evaluamos según rules_v1.json:
      // 1) Gate: si falla => NO OK
      const g = header ? gateByHeader[header] : null;
      if (g) {
        const evg = evalGateRule(g, ansRaw);
        if (!evg.ok) {
          estado = "INCORRECTA";
          why = evg.why;
          pts = "0";
          out.push({
            idx: i + 1,
            qid,
            qtext,
            ans: safeVal(ansRaw),
            estado,
            why,
            pts
          });
          continue;
        }
      }

      // 2) Scoring: equals / map / contains_all define OK/NO OK
      const sr = header ? scoringByHeader[header] : null;
      if (sr && sr.r) {
        const evs = evalScoringRule(sr.r, ansRaw);
        if (evs.ok) {
          estado = "CORRECTA";
          why = sr.block ? `[${sr.block}] OK` : "OK";
          pts = PCT_OK;
        } else {
          estado = "INCORRECTA";
          why = sr.block ? `[${sr.block}] NO OK` : "NO OK";
          pts = "0";
        }

        out.push({
          idx: i + 1,
          qid,
          qtext,
          ans: safeVal(ansRaw),
          estado,
          why,
          pts
        });
        continue;
      }

      // 3) Sin gate ni scoring:
      // (Esto NO inventa nada: es exactamente Q16 “Sí/No OK; vacío NO OK”)
      estado = "CORRECTA";
      why = "OK";
      pts = PCT_OK;

      out.push({
        idx: i + 1,
        qid,
        qtext,
        ans: safeVal(ansRaw),
        estado,
        why,
        pts
      });
    }

    return out;
  }

  function buildClosedSummary(rows) {
    const total = rows.length;
    const ok = rows.filter(r => r.estado === "CORRECTA").length;
    const bad = rows.filter(r => r.estado === "INCORRECTA").length;
    const pctOk = total > 0 ? Math.round((ok / total) * 100) : 0;

    // Estado informativo (no decide IA)
    let estadoInfo = "—";
    if (pctOk >= 70) estadoInfo = "APTO";
    else if (pctOk >= 50) estadoInfo = "REVISAR";
    else estadoInfo = "DESCARTADO";

    return { total, ok, bad, pctOk, estadoInfo };
  }

  // ======================================================

  function buildSectionQuestions(item) {
    const { Q_ALTA, Q_INFO } = getQLists();

    const allQ = [];
    for (let i = 1; i <= 33; i++) allQ.push(`Q${i}`);

    const setAlta = new Set(Q_ALTA);
    const setInfo = new Set(Q_INFO);

    // OJO: Parte 2/3 cerradas FIJAS, así que acá no usamos dynamic.
    const Q_CERRADAS = allQ.filter(q => !setAlta.has(q) && !setInfo.has(q));

    const mkRows = (qids) => {
      const rr = item.rowRaw || {};
      return qids.map(qid => {
        const header = QID_TO_HEADER[qid] || "";
        const qtext = header ? questionTextFromHeader(header) : qid;
        const ans = header ? rr[header] : "";
        return { qid, qtext, ans: safeVal(ans) };
      });
    };

    return {
      alta: mkRows(Q_ALTA),
      cerradas: mkRows(Q_CERRADAS),
      info: mkRows(Q_INFO)
    };
  }

  function renderQTable(title, rows) {
    // TABLAS ABIERTAS/INFO: agregamos columnas útiles (Q / Pregunta / Respuesta / Largo)
    const t = `
      <div class="miniCard">
        <div class="sectionTitle">${escapeHtml(title)}</div>
        <div style="overflow:auto; margin-top:8px;">
          <table class="table">
            <thead>
              <tr>
                <th style="width:70px;">Q</th>
                <th style="min-width:240px;">Pregunta</th>
                <th style="min-width:340px;">Respuesta</th>
                <th style="width:90px;">Largo</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td><span class="kbd">${escapeHtml(r.qid)}</span></td>
                  <td>${escapeHtml(r.qtext)}</td>
                  <td>${escapeHtml(r.ans)}</td>
                  <td>${String((r.ans && r.ans !== "—") ? String(r.ans).length : 0)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
    return t;
  }

  function renderQTableAltaWithSignals(title, rows, openAIMap) {
    // PARTE 1/3 — ABIERTAS ALTA: incluye 3 columnas NUEVAS:
    // Señales | Ética | Opinión
    // REGLA DURA 1: si respuesta vacía -> estas 3 columnas deben quedar VACÍAS reales.
    const t = `
      <div class="miniCard">
        <div class="sectionTitle">${escapeHtml(title)}</div>
        <div style="overflow:auto; margin-top:8px;">
          <table class="table">
            <thead>
              <tr>
                <th style="width:70px;">Q</th>
                <th style="min-width:240px;">Pregunta</th>
                <th style="min-width:340px;">Respuesta</th>
                <th style="min-width:220px;">Señales</th>
                <th style="min-width:220px;">Ética</th>
                <th style="min-width:220px;">Opinión</th>
                <th style="width:90px;">Largo</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => {
                const ev = (openAIMap && openAIMap[r.qid]) ? openAIMap[r.qid] : null;

                // IMPORTANTE: vacío real si no hay ev (incluye respuesta vacía)
                const sig = ev && String(ev.signals ?? "").trim().length ? String(ev.signals) : "";
                const eth = ev && String(ev.ethics ?? "").trim().length ? String(ev.ethics) : "";
                const op  = ev && String(ev.opinion ?? "").trim().length ? String(ev.opinion) : "";

                return `
                  <tr>
                    <td><span class="kbd">${escapeHtml(r.qid)}</span></td>
                    <td>${escapeHtml(r.qtext)}</td>
                    <td>${escapeHtml(r.ans)}</td>
                    <td>${sig.length ? escapeHtml(sig) : ""}</td>
                    <td>${eth.length ? escapeHtml(eth) : ""}</td>
                    <td>${op.length ? escapeHtml(op) : ""}</td>
                    <td>${String((r.ans && r.ans !== "—") ? String(r.ans).length : 0)}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
    return t;
  }

  function renderClosedFixedTables(title, rows, summary) {
    // Parte 2/3: columnas completas y cantidad FIJA
    const t = `
      <div class="miniCard">
        <div class="sectionTitle">${escapeHtml(title)}</div>

        <div style="overflow:auto; margin-top:10px;">
          <table class="table">
            <thead>
              <tr>
                <th style="width:60px;">N°</th>
                <th style="width:70px;">Q</th>
                <th style="min-width:240px;">Pregunta</th>
                <th style="min-width:240px;">Respuesta del vendedor</th>
                <th style="width:130px;">Estado</th>
                <th style="min-width:240px;">Justificación (sistema)</th>
                <th style="width:90px;">Puntos</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td>${r.idx}</td>
                  <td><span class="kbd">${escapeHtml(r.qid)}</span></td>
                  <td>${escapeHtml(r.qtext)}</td>
                  <td>${escapeHtml(r.ans)}</td>
                  <td><b>${escapeHtml(r.estado)}</b></td>
                  <td>${escapeHtml(r.why)}</td>
                  <td>${escapeHtml(String(r.pts))}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>

        <div style="margin-top:12px; overflow:auto;">
          <table class="table">
            <thead>
              <tr>
                <th>Detalle</th>
                <th style="width:120px;">Unidad</th>
                <th style="width:120px;">Porcentaje</th>
                <th style="width:140px;">Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><b>TOTAL DE PREGUNTAS</b></td>
                <td>${summary.total}</td>
                <td>100%</td>
                <td>—</td>
              </tr>
              <tr>
                <td><b>RESPUESTAS VÁLIDAS</b></td>
                <td>${summary.ok}</td>
                <td>${summary.pctOk}%</td>
                <td><b>${escapeHtml(summary.estadoInfo)}</b></td>
              </tr>
              <tr>
                <td><b>RESPUESTAS INCORRECTAS</b></td>
                <td>${summary.bad}</td>
                <td>${summary.total ? (100 - summary.pctOk) : 0}%</td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="hint" style="margin-top:10px;">
          Regla (solo informativa para Parte 2/3): ≥70% = APTO, 50–69% = REVISAR, &lt;50% = DESCARTADO.
          (Esta parte NO decide el estado IA; es resumen fijo de cerradas.)
        </div>
      </div>
    `;
    return t;
  }

  // ======================================================

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // PASO 2.3: preferimos estado_final si existe (fallback a estado)
  function estadoUI(r) {
    return String(r?.estado_final ?? r?.estado ?? "");
  }

  function badgeClass(estado) {
    if (estado === "APTO" || estado === "APTO_AUTO") return "ok";
    if (estado === "REVISAR" || estado === "REVISAR_AUTO") return "rev";
    return "bad";
  }

  function setStatus(text) {
    const el = document.getElementById("statusText");
    if (el) el.textContent = text;
  }

  function counts(results) {
    return {
      total: results.length,
      apto: results.filter(r => {
        const e = estadoUI(r);
        return e === "APTO" || e === "APTO_AUTO";
      }).length,
      revisar: results.filter(r => {
        const e = estadoUI(r);
        return e === "REVISAR" || e === "REVISAR_AUTO";
      }).length,
      descartado: results.filter(r => {
        const e = estadoUI(r);
        return e === "DESCARTADO_AUTO" || e === "DESCARTADO";
      }).length
    };
  }

  function applyFilter(results) {
    if (currentFilter === "ALL") return results;

    if (currentFilter === "APTO") {
      return results.filter(r => {
        const e = estadoUI(r);
        return e === "APTO" || e === "APTO_AUTO";
      });
    }

    if (currentFilter === "REVISAR") {
      return results.filter(r => {
        const e = estadoUI(r);
        return e === "REVISAR" || e === "REVISAR_AUTO";
      });
    }

    return results.filter(r => {
      const e = estadoUI(r);
      return e === "DESCARTADO_AUTO" || e === "DESCARTADO";
    });
  }

  // -------------------------
  // Tabs
  // -------------------------

  function setTab(tabId) {
    currentTab = tabId;

    const viewResultados = document.getElementById("viewResultados");
    const viewSeleccionados = document.getElementById("viewSeleccionados");
    const viewHistorial = document.getElementById("viewHistorial");

    viewResultados.classList.toggle("hidden", tabId !== "RESULTADOS");
    viewSeleccionados.classList.toggle("hidden", tabId !== "SELECCIONADOS");
    viewHistorial.classList.toggle("hidden", tabId !== "HISTORIAL");

    // filtros solo tiene sentido en RESULTADOS
    const filters = document.getElementById("filters");
    filters.classList.toggle("hidden", tabId !== "RESULTADOS");

    // detalle lo ocultamos al cambiar de tab
    hideDetail();

    // render por tab
    if (tabId === "RESULTADOS" && lastPayload) {
      renderFilters(lastPayload.results);
      renderTable(lastPayload.results);
    }

    if (tabId === "SELECCIONADOS" && lastPayload) {
      renderSelected(lastPayload.results);
    }

    if (tabId === "HISTORIAL") {
      renderHistory();
    }

    renderTopTabs();
  }

  function renderTopTabs() {
    const el = document.getElementById("topTabs");
    if (!el) return;

    const mkBtn = (id, label) => {
      const active = currentTab === id ? "active" : "";
      return `<button class="btn ${active}" data-tab="${id}">${label}</button>`;
    };

    el.innerHTML = `
      ${mkBtn("RESULTADOS", "Resultados")}
      ${mkBtn("SELECCIONADOS", "Seleccionados")}
      ${mkBtn("HISTORIAL", "Historial")}
    `;

    el.querySelectorAll("button[data-tab]").forEach(btn => {
      btn.addEventListener("click", () => setTab(btn.getAttribute("data-tab")));
    });
  }

  // -------------------------
  // Summary + Filters
  // -------------------------

  function renderSummary(results, version, meta = {}) {
    const c = counts(results);
    const output = document.getElementById("output");

    const fileLabel = meta.fileName ? escapeHtml(meta.fileName) : "—";
    const runAt = meta.runAt ? escapeHtml(meta.runAt) : "—";

    output.innerHTML = `
      <div class="row">
        <div class="pill">Total filas: <strong>${c.total}</strong></div>
        <div class="pill">APTO: <strong style="color:var(--ok)">${c.apto}</strong></div>
        <div class="pill">REVISAR: <strong style="color:var(--rev)">${c.revisar}</strong></div>
        <div class="pill">DESCARTADO: <strong style="color:var(--bad)">${c.descartado}</strong></div>
        <div class="pill">Versión reglas: <strong>${escapeHtml(version || "—")}</strong></div>
      </div>

      <div class="row" style="margin-top:10px;">
        <div class="pill">Archivo: <strong>${fileLabel}</strong></div>
        <div class="pill">Ejecutado: <strong>${runAt}</strong></div>
        <div class="hint">Click en una fila para ver el detalle completo (incluye correctas/incorrectas).</div>
      </div>
    `;
  }

  function renderFilters(results) {
    const c = counts(results);
    const filters = document.getElementById("filters");

    const mkBtn = (id, label) => {
      const active = currentFilter === id ? "active" : "";
      return `<button class="btn ${active}" data-filter="${id}">${label}</button>`;
    };

    filters.innerHTML = `
      <div class="row">
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          ${mkBtn("ALL", `Todos (${c.total})`)}
          ${mkBtn("APTO", `APTO (${c.apto})`)}
          ${mkBtn("REVISAR", `REVISAR (${c.revisar})`)}
          ${mkBtn("DESCARTADO", `DESCARTADO (${c.descartado})`)}
        </div>

        <div class="pill">Orden: <strong>Fila asc</strong></div>
      </div>
    `;

    filters.querySelectorAll("button[data-filter]").forEach(btn => {
      btn.addEventListener("click", () => {
        currentFilter = btn.getAttribute("data-filter");
        renderTable(lastPayload.results);
        renderFilters(lastPayload.results);
        hideDetail();
      });
    });
  }

  // -------------------------
  // Detail
  // -------------------------

  function hideDetail() {
    const panel = document.getElementById("detailPanel");
    panel.style.display = "none";
    panel.innerHTML = "";
  }

  function scoreParts(item) {
    const max = Number(item.maxScore ?? 100);
    const auto = Number(item.score_auto ?? item.score ?? 0);
    const hum = Number(item.score_humano ?? 0);
    const total = Number(item.score_total ?? item.score ?? 0);
    const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((total / max) * 100))) : 0;
    return { max, auto, hum, total, pct };
  }

  function listHtml(title, items) {
    if (!items || !items.length) return `<div class="miniCard"><div class="sectionTitle">${escapeHtml(title)}</div><div class="muted">—</div></div>`;
    const li = items.map(x => `<li>${escapeHtml(x)}</li>`).join("");
    return `<div class="miniCard"><div class="sectionTitle">${escapeHtml(title)}</div><ul class="list">${li}</ul></div>`;
  }

  async function showDetail(item) {
    const panel = document.getElementById("detailPanel");
    panel.style.display = "block";

    const flags = (item.flags || []).length ? item.flags.join(", ") : "—";
    const { max, auto, hum, total, pct } = scoreParts(item);

    const progress = `
      <div class="progressWrap" title="${total}/${max} (${pct}%)">
        <div class="progressBar" style="width:${pct}%;"></div>
      </div>
    `;

    const correct = item.correct || [];
    const incorrect = item.incorrect || [];

    // Row raw (para auditoría)
    const rawPretty = JSON.stringify(item.rowRaw || {}, null, 2);

    const eUI = estadoUI(item);
    const pendiente = item.pendiente_humano ? "SÍ" : "NO";

    // PASO 2.4: separar Q por secciones
    const sections = buildSectionQuestions(item);

    // Parte 2/3 FIX: cerradas fijas + evaluación usando rules_v1.json
    const RULES = await loadRulesOnce();
    const fixedClosedRows = buildFixedClosedRows(item, RULES || {});
    const fixedClosedSummary = buildClosedSummary(fixedClosedRows);

    // NUEVO: Parte 1/3 — open_ai (3 columnas)
    const openAIMap = item.open_ai || null;

    panel.innerHTML = `
      <div class="row" style="margin-bottom:10px;">
        <div class="pill">Fila: <strong>${item.fila}</strong></div>

        <div class="pill">Auto: <strong>${auto}/${max}</strong></div>
        <div class="pill">Humano: <strong>${hum}</strong></div>
        <div class="pill">Total: <strong>${total}/${max}</strong> <span class="kbd">${pct}%</span></div>
        ${progress}

        <div class="pill">Pendiente humano: <strong>${pendiente}</strong></div>

        <div class="pill">Estado: <strong>${escapeHtml(eUI)}</strong></div>
        <div class="pill">Motivo: <strong>${escapeHtml(item.motivo || "—")}</strong></div>
        <div class="pill">Flags: <strong>${escapeHtml(flags)}</strong></div>
        <button class="btn" id="closeDetail">Cerrar detalle</button>
      </div>

      <div class="grid2">
        ${listHtml("Respuestas/condiciones CORRECTAS", correct)}
        ${listHtml("Respuestas/condiciones INCORRECTAS (por qué)", incorrect)}
      </div>

      <div style="margin-top:12px;" class="muted">PASO 2.4 — Detalle por secciones:</div>

      <div style="display:grid; gap:12px; margin-top:10px;">
        ${renderQTableAltaWithSignals("PARTE 1/3 — Preguntas ABIERTAS (PRIORIDAD ALTA)", sections.alta, openAIMap)}
        ${renderClosedFixedTables("PARTE 2/3 — RESUMEN (CERRADAS) — FIJO (13 preguntas)", fixedClosedRows, fixedClosedSummary)}
        ${renderQTable("PARTE 3/3 — Preguntas ABIERTAS (INFORMATIVAS)", sections.info)}
      </div>

      <div style="margin-top:12px;" class="muted">Contenido completo de la fila (normalizado por headers):</div>
      <div>${escapeHtml(rawPretty)}</div>
    `;

    document.getElementById("closeDetail").addEventListener("click", hideDetail);
  }

  // -------------------------
  // Table
  // -------------------------

  function renderTable(results) {
    const tableWrap = document.getElementById("resultsTable");

    // ORDEN FIJO: por fila asc (antiguo -> nuevo), sin importar resultado
    const sorted = [...results].sort((a, b) => (a.fila - b.fila));

    const filtered = applyFilter(sorted);

    if (!filtered.length) {
      tableWrap.innerHTML = `<div class="muted">No hay filas en este filtro.</div>`;
      return;
    }

    const rowsHtml = filtered.map(r => {
      const eUI = estadoUI(r);
      const estadoBadge = `<span class="badge ${badgeClass(eUI)}">${escapeHtml(eUI)}</span>`;
      const flagsCount = (r.flags || []).length;

      const nombre = escapeHtml(r.nombre || "—");
      const email = escapeHtml(r.email || "—");
      const motivo = escapeHtml(r.motivo || "—");

      const { max, auto, hum, total, pct } = scoreParts(r);
      const pend = r.pendiente_humano ? "SÍ" : "NO";

      return `
        <tr data-fila="${r.fila}">
          <td>${r.fila}</td>
          <td>${nombre}</td>
          <td>${email}</td>
          <td><b>${auto}</b></td>
          <td><b>${hum}</b></td>
          <td><b>${total}/${max}</b> <span class="kbd">${pct}%</span></td>
          <td>${escapeHtml(pend)}</td>
          <td>${estadoBadge}</td>
          <td>${motivo}</td>
          <td>${flagsCount ? escapeHtml(String(flagsCount)) : "—"}</td>
          <td><a href="#" data-open="${r.fila}">Ver</a></td>
        </tr>
      `;
    }).join("");

    tableWrap.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Fila</th>
            <th>Nombre</th>
            <th>Email</th>
            <th>Auto</th>
            <th>Hum</th>
            <th>Total</th>
            <th>Pend</th>
            <th>Estado</th>
            <th>Motivo</th>
            <th>Flags</th>
            <th>Detalle</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;

    // click en fila o en link "Ver"
    tableWrap.querySelectorAll("tr[data-fila]").forEach(tr => {
      tr.addEventListener("click", () => {
        const fila = Number(tr.getAttribute("data-fila"));
        const item = lastPayload.results.find(x => x.fila === fila);
        if (item) showDetail(item);
      });
    });

    tableWrap.querySelectorAll("a[data-open]").forEach(a => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const fila = Number(a.getAttribute("data-open"));
        const item = lastPayload.results.find(x => x.fila === fila);
        if (item) showDetail(item);
      });
    });
  }

  // -------------------------
  // Seleccionados
  // -------------------------

  function renderSelected(results) {
    const el = document.getElementById("selectedView");

    const selected = results.filter(r => {
      const e = estadoUI(r);
      return e === "APTO" || e === "REVISAR" || e === "APTO_AUTO" || e === "REVISAR_AUTO";
    }).sort((a, b) => (a.fila - b.fila)); // ORDEN FIJO por fila asc

    if (!selected.length) {
      el.innerHTML = `<div class="muted">No hay seleccionados (APTO/REVISAR) en esta carga.</div>`;
      return;
    }

    const cards = selected.map(r => {
      const { max, auto, hum, total, pct } = scoreParts(r);
      const eUI = estadoUI(r);
      const estadoBadge = `<span class="badge ${badgeClass(eUI)}">${escapeHtml(eUI)}</span>`;
      const flags = (r.flags || []).length ? escapeHtml(r.flags.join(", ")) : "—";
      const pend = r.pendiente_humano ? "SÍ" : "NO";

      // Checklist mínimo útil para decidir “le escribo o no”
      const okEmail = (r.email || "").includes("@");
      const social = (r.rowRaw?.["11/33. Perfil de red social principal"] || "");
      const okSocial = /(http|@)/.test(social);

      const checklist = [
        `${okEmail ? "✅" : "❌"} Email válido`,
        `${okSocial ? "✅" : "❌"} Perfil/red social parece válido`,
        `${pend === "SÍ" ? "⚠️" : "✅"} Pendiente humano: ${pend}`,
        `${(r.correct || []).length ? "✅" : "⚠️"} Cumplimientos detectados`,
        `${(r.incorrect || []).length ? "⚠️" : "✅"} Incumplimientos`
      ];

      const progress = `
        <div class="progressWrap" title="${total}/${max} (${pct}%)">
          <div class="progressBar" style="width:${pct}%;"></div>
        </div>
      `;

      return `
        <div class="miniCard">
          <div class="row" style="justify-content:space-between;">
            <div>
              <div style="font-weight:800;">${escapeHtml(r.nombre || "—")}</div>
              <div class="muted">${escapeHtml(r.email || "—")}</div>
            </div>
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
              <div class="pill">Auto: <strong>${auto}</strong></div>
              <div class="pill">Hum: <strong>${hum}</strong></div>
              <div class="pill">Total: <strong>${total}/${max}</strong> <span class="kbd">${pct}%</span></div>
              ${progress}
              <div>${estadoBadge}</div>
              <button class="btn" data-open="${r.fila}">Ver detalle</button>
            </div>
          </div>

          <div style="margin-top:10px;" class="grid2">
            <div class="miniCard">
              <div class="sectionTitle">Checklist rápido</div>
              <ul class="list">${checklist.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
            </div>
            <div class="miniCard">
              <div class="sectionTitle">Flags</div>
              <div class="muted">${flags}</div>
            </div>
          </div>

          <div style="margin-top:10px;" class="hint">
            Tip: usá “Ver detalle” para ver Parte 1/2/3 completas + la fila completa.
          </div>
        </div>
      `;
    }).join("");

    el.innerHTML = `
      <div class="row" style="margin-bottom:10px;">
        <div class="pill">Total seleccionados: <strong>${selected.length}</strong></div>
        <div class="hint">Seleccionados = APTO + REVISAR. (DESCARTADO_AUTO no se analiza más).</div>
      </div>
      <div style="display:grid; gap:12px;">${cards}</div>
    `;

    el.querySelectorAll("button[data-open]").forEach(btn => {
      btn.addEventListener("click", () => {
        const fila = Number(btn.getAttribute("data-open"));
        const item = lastPayload.results.find(x => x.fila === fila);
        if (item) showDetail(item);
      });
    });
  }

  // -------------------------
  // Historial local (localStorage)
  // -------------------------

  function loadHistory() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function saveHistory(entries) {
    localStorage.setItem(LS_KEY, JSON.stringify(entries.slice(0, 30))); // max 30 corridas
  }

  function pushHistory(run) {
    const hist = loadHistory();
    // dedupe por runId
    const next = [run, ...hist.filter(x => x.runId !== run.runId)];
    saveHistory(next);
  }

  function renderHistory() {
    const el = document.getElementById("historyView");
    const hist = loadHistory();

    if (!hist.length) {
      el.innerHTML = `<div class="muted">No hay historial guardado todavía. Subí un XLSX para crear el primero.</div>`;
      return;
    }

    const rows = hist.map(h => {
      const c = h.counts || { total: 0, apto: 0, revisar: 0, descartado: 0 };
      return `
        <tr>
          <td>${escapeHtml(h.runAt || "—")}</td>
          <td>${escapeHtml(h.fileName || "—")}</td>
          <td><span class="kbd">${escapeHtml(h.fingerprint || "—")}</span></td>
          <td>${c.total}</td>
          <td style="color:var(--ok)">${c.apto}</td>
          <td style="color:var(--rev)">${c.revisar}</td>
          <td style="color:var(--bad)">${c.descartado}</td>
          <td><button class="btn" data-load="${escapeHtml(h.runId)}">Cargar</button></td>
        </tr>
      `;
    }).join("");

    el.innerHTML = `
      <div class="hint" style="margin-bottom:10px;">
        Historial local (máx 30 corridas). “Cargar” reabre los resultados de esa corrida.
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Archivo</th>
            <th>Fingerprint</th>
            <th>Total</th>
            <th>APTO</th>
            <th>REVISAR</th>
            <th>DESC</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;

    el.querySelectorAll("button[data-load]").forEach(btn => {
      btn.addEventListener("click", () => {
        const runId = btn.getAttribute("data-load");
        const item = loadHistory().find(x => x.runId === runId);
        if (!item) return;

        // Rehidratar “payload”
        lastPayload = {
          results: item.results || [],
          version: item.version || "—",
          meta: item.meta || {}
        };

        setStatus("Procesado ✔ (historial)");
        renderSummary(lastPayload.results, lastPayload.version, lastPayload.meta);
        setTab("RESULTADOS");
      });
    });
  }

  // -------------------------
  // Export CSV
  // -------------------------

  function toCSVCell(v) {
    const s = String(v ?? "");
    // escapado CSV básico
    if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  }

  function exportCSVCurrent() {
    if (!lastPayload?.results?.length) {
      alert("No hay resultados para exportar.");
      return;
    }

    // CSV con columnas nuevas (Auto/Hum/Total/Pendiente)
    const cols = ["fila", "nombre", "email", "score_auto", "score_humano", "score_total", "maxScore", "percent", "pendiente_humano", "estado", "motivo", "flags"];
    const lines = [];
    lines.push(cols.join(","));

    for (const r of lastPayload.results) {
      const { max, auto, hum, total, pct } = scoreParts(r);
      const eUI = estadoUI(r);

      const row = [
        r.fila,
        r.nombre || "",
        r.email || "",
        auto,
        hum,
        total,
        max,
        pct,
        r.pendiente_humano ? "SI" : "NO",
        eUI,
        r.motivo || "",
        (r.flags || []).join("|")
      ].map(toCSVCell).join(",");

      lines.push(row);
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `preseleccion_resultados_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function clearHistory() {
    if (!confirm("¿Borrar historial guardado en este navegador?")) return;
    localStorage.removeItem(LS_KEY);
    renderHistory();
  }

  // -------------------------
  // Public render
  // -------------------------

  function renderAll(payload) {
    lastPayload = payload;
    setStatus("Procesado ✔");

    renderTopTabs();
    renderSummary(payload.results, payload.version, payload.meta || {});
    renderFilters(payload.results);
    renderTable(payload.results);
    hideDetail();

    // push historial
    try {
      const c = counts(payload.results);
      pushHistory({
        runId: payload.meta?.runId || String(Date.now()),
        runAt: payload.meta?.runAt || new Date().toLocaleString(),
        fileName: payload.meta?.fileName || "—",
        fingerprint: payload.meta?.fingerprint || "—",
        version: payload.version || "—",
        counts: c,
        meta: payload.meta || {},
        results: payload.results || []
      });
    } catch (_) {}

    // mantiene pestaña actual (si estabas en otra, la respeta)
    setTab(currentTab);

    // precarga rules (best effort, no rompe si falla)
    loadRulesOnce();
  }

  // Init botones top
  function bindTopButtons() {
    const btnCSV = document.getElementById("btnExportCSV");
    const btnClear = document.getElementById("btnClearHistory");

    if (btnCSV) btnCSV.addEventListener("click", exportCSVCurrent);
    if (btnClear) btnClear.addEventListener("click", clearHistory);
  }

  // Se llama cuando carga el script
  document.addEventListener("DOMContentLoaded", () => {
    renderTopTabs();
    bindTopButtons();
    setTab("RESULTADOS");
  });

  return { renderAll, setStatus };
})();
