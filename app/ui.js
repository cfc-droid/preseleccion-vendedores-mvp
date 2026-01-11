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

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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
apto: results.filter(r => r.estado === "APTO" || r.estado === "APTO_AUTO").length,
revisar: results.filter(r => r.estado === "REVISAR" || r.estado === "REVISAR_AUTO").length,
descartado: results.filter(r =>
  r.estado === "DESCARTADO_AUTO" || r.estado === "DESCARTADO"
).length
    };
  }

  function applyFilter(results) {
    if (currentFilter === "ALL") return results;
    if (currentFilter === "APTO") return results.filter(r => r.estado === "APTO");
    if (currentFilter === "REVISAR") return results.filter(r => r.estado === "REVISAR");
    return results.filter(r => r.estado === "DESCARTADO_AUTO" || r.estado === "DESCARTADO");
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

        <div class="pill">Orden: <strong>Score desc</strong></div>
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

  function scorePercent(item) {
    const max = Number(item.maxScore ?? 100);
    const s = Number(item.score ?? 0);
    const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((s / max) * 100))) : 0;
    return { max, s, pct };
  }

  function listHtml(title, items) {
    if (!items || !items.length) return `<div class="miniCard"><div class="sectionTitle">${escapeHtml(title)}</div><div class="muted">—</div></div>`;
    const li = items.map(x => `<li>${escapeHtml(x)}</li>`).join("");
    return `<div class="miniCard"><div class="sectionTitle">${escapeHtml(title)}</div><ul class="list">${li}</ul></div>`;
  }

  function showDetail(item) {
    const panel = document.getElementById("detailPanel");
    panel.style.display = "block";

    const flags = (item.flags || []).length ? item.flags.join(", ") : "—";
    const { max, s, pct } = scorePercent(item);

    const progress = `
      <div class="progressWrap" title="${s}/${max} (${pct}%)">
        <div class="progressBar" style="width:${pct}%;"></div>
      </div>
    `;

    const correct = item.correct || [];
    const incorrect = item.incorrect || [];

    // Row raw (para auditoría)
    const rawPretty = JSON.stringify(item.rowRaw || {}, null, 2);

    panel.innerHTML = `
      <div class="row" style="margin-bottom:10px;">
        <div class="pill">Fila: <strong>${item.fila}</strong></div>
        <div class="pill">Score: <strong>${s}/${max}</strong> <span class="kbd">${pct}%</span></div>
        ${progress}
        <div class="pill">Estado: <strong>${escapeHtml(item.estado)}</strong></div>
        <div class="pill">Motivo: <strong>${escapeHtml(item.motivo || "—")}</strong></div>
        <div class="pill">Flags: <strong>${escapeHtml(flags)}</strong></div>
        <button class="btn" id="closeDetail">Cerrar detalle</button>
      </div>

      <div class="grid2">
        ${listHtml("Respuestas/condiciones CORRECTAS", correct)}
        ${listHtml("Respuestas/condiciones INCORRECTAS (por qué)", incorrect)}
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

    // orden score desc, y si empatan, por fila asc
    const sorted = [...results].sort((a, b) => (b.score - a.score) || (a.fila - b.fila));
    const filtered = applyFilter(sorted);

    if (!filtered.length) {
      tableWrap.innerHTML = `<div class="muted">No hay filas en este filtro.</div>`;
      return;
    }

    const rowsHtml = filtered.map(r => {
      const estadoBadge = `<span class="badge ${badgeClass(r.estado)}">${escapeHtml(r.estado)}</span>`;
      const flagsCount = (r.flags || []).length;
      const nombre = escapeHtml(r.nombre || "—");
      const email = escapeHtml(r.email || "—");
      const motivo = escapeHtml(r.motivo || "—");
      const { max, s, pct } = scorePercent(r);

      return `
        <tr data-fila="${r.fila}">
          <td>${r.fila}</td>
          <td>${nombre}</td>
          <td>${email}</td>
          <td><b>${s}/${max}</b> <span class="kbd">${pct}%</span></td>
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
            <th>Puntaje</th>
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
    const selected = results.filter(r => r.estado === "APTO" || r.estado === "REVISAR")
      .sort((a, b) => (b.score - a.score) || (a.fila - b.fila));

    if (!selected.length) {
      el.innerHTML = `<div class="muted">No hay seleccionados (APTO/REVISAR) en esta carga.</div>`;
      return;
    }

    const cards = selected.map(r => {
      const { max, s, pct } = scorePercent(r);
      const estadoBadge = `<span class="badge ${badgeClass(r.estado)}">${escapeHtml(r.estado)}</span>`;
      const flags = (r.flags || []).length ? escapeHtml(r.flags.join(", ")) : "—";

      // Checklist mínimo útil para decidir “le escribo o no”
      const okEmail = (r.email || "").includes("@");
      const social = (r.rowRaw?.["11/33. Perfil de red social principal"] || "");
      const okSocial = /(http|@)/.test(social);

      const checklist = [
        `${okEmail ? "✅" : "❌"} Email válido`,
        `${okSocial ? "✅" : "❌"} Perfil/red social parece válido`,
        `${(r.correct || []).length ? "✅" : "⚠️"} Cumplimientos detectados`,
        `${(r.incorrect || []).length ? "⚠️" : "✅"} Incumplimientos`
      ];

      const progress = `
        <div class="progressWrap" title="${s}/${max} (${pct}%)">
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
              <div class="pill">Puntaje: <strong>${s}/${max}</strong> <span class="kbd">${pct}%</span></div>
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
            Tip: usá “Ver detalle” para ver correctas/incorrectas y la fila completa.
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

    const cols = ["fila", "nombre", "email", "score", "maxScore", "percent", "estado", "motivo", "flags"];
    const lines = [];
    lines.push(cols.join(","));

    for (const r of lastPayload.results) {
      const { max, s, pct } = scorePercent(r);
      const row = [
        r.fila,
        r.nombre || "",
        r.email || "",
        s,
        max,
        pct,
        r.estado || "",
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
