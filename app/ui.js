// ======================================================
// UI — FASE D (SALIDA)
// tabla + filtros + detalle por fila
// ======================================================

window.UI = (() => {
  let currentFilter = "ALL"; // ALL | APTO | REVISAR | DESCARTADO
  let lastPayload = null;

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function badgeClass(estado) {
    if (estado === "APTO") return "ok";
    if (estado === "REVISAR") return "rev";
    return "bad";
  }

  function setStatus(text) {
    const el = document.getElementById("statusText");
    if (el) el.textContent = text;
  }

  function counts(results) {
    return {
      total: results.length,
      apto: results.filter(r => r.estado === "APTO").length,
      revisar: results.filter(r => r.estado === "REVISAR").length,
      descartado: results.filter(r => r.estado === "DESCARTADO_AUTO" || r.estado === "DESCARTADO").length
    };
  }

  function applyFilter(results) {
    if (currentFilter === "ALL") return results;
    if (currentFilter === "APTO") return results.filter(r => r.estado === "APTO");
    if (currentFilter === "REVISAR") return results.filter(r => r.estado === "REVISAR");
    return results.filter(r => r.estado === "DESCARTADO_AUTO" || r.estado === "DESCARTADO");
  }

  function renderSummary(results, version) {
    const c = counts(results);
    const output = document.getElementById("output");

    output.innerHTML = `
      <div class="row">
        <div class="pill">Total filas: <strong>${c.total}</strong></div>
        <div class="pill">APTO: <strong style="color:var(--ok)">${c.apto}</strong></div>
        <div class="pill">REVISAR: <strong style="color:var(--rev)">${c.revisar}</strong></div>
        <div class="pill">DESCARTADO: <strong style="color:var(--bad)">${c.descartado}</strong></div>
        <div class="pill">Versión reglas: <strong>${escapeHtml(version || "—")}</strong></div>
      </div>
      <div class="hint">Click en una fila para ver el detalle completo.</div>
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

  function hideDetail() {
    const panel = document.getElementById("detailPanel");
    panel.style.display = "none";
    panel.innerHTML = "";
  }

  function showDetail(item) {
    const panel = document.getElementById("detailPanel");
    panel.style.display = "block";

    const flags = (item.flags || []).length ? item.flags.join(", ") : "—";

    // mostramos todo el objeto original (rowRaw) para debug + transparencia
    const rawPretty = JSON.stringify(item.rowRaw || {}, null, 2);

    panel.innerHTML = `
      <div class="row" style="margin-bottom:10px;">
        <div class="pill">Fila: <strong>${item.fila}</strong></div>
        <div class="pill">Score: <strong>${item.score}</strong></div>
        <div class="pill">Estado: <strong>${escapeHtml(item.estado)}</strong></div>
        <div class="pill">Motivo: <strong>${escapeHtml(item.motivo || "—")}</strong></div>
        <div class="pill">Flags: <strong>${escapeHtml(flags)}</strong></div>
        <button class="btn" id="closeDetail">Cerrar detalle</button>
      </div>

      <div class="muted" style="margin-bottom:8px;">Contenido completo de la fila (normalizado por headers):</div>
      <div>${escapeHtml(rawPretty)}</div>
    `;

    document.getElementById("closeDetail").addEventListener("click", hideDetail);
  }

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

      return `
        <tr data-fila="${r.fila}">
          <td>${r.fila}</td>
          <td>${nombre}</td>
          <td>${email}</td>
          <td><b>${r.score}</b></td>
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
            <th>Score</th>
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
      tr.addEventListener("click", (e) => {
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

  function renderAll(payload) {
    lastPayload = payload;
    setStatus("Procesado ✔");

    renderSummary(payload.results, payload.version);
    renderFilters(payload.results);
    renderTable(payload.results);
    hideDetail();
  }

  return { renderAll, setStatus };
})();
