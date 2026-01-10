// ======================================================
// FASE D — UI (SALIDA)
// Tabla + Filtros + Detalle
// Consume window.__RESULTS__ desde app.js
// ======================================================

let CURRENT_FILTER = "ALL";

// ---------- UTILIDADES ----------

function el(id) {
  return document.getElementById(id);
}

function badge(text, color) {
  return `<span style="
    background:${color};
    color:#fff;
    padding:2px 6px;
    border-radius:4px;
    font-size:12px;
    margin-right:4px;
  ">${text}</span>`;
}

function estadoBadge(estado) {
  if (estado === "APTO") return badge("APTO", "#2ecc71");
  if (estado === "REVISAR") return badge("REVISAR", "#f1c40f");
  return badge("DESCARTADO", "#e74c3c");
}

// ---------- RENDER PRINCIPAL ----------

function renderUI(results) {
  renderFilters();
  renderTable(results);
}

function renderFilters() {
  el("filters").innerHTML = `
    <button onclick="setFilter('ALL')">Todos</button>
    <button onclick="setFilter('APTO')">APTO</button>
    <button onclick="setFilter('REVISAR')">REVISAR</button>
    <button onclick="setFilter('DESCARTADO_AUTO')">DESCARTADOS</button>
  `;
}

function setFilter(filter) {
  CURRENT_FILTER = filter;
  renderTable(window.__RESULTS__);
}

// ---------- TABLA ----------

function renderTable(results) {
  let rows = results;

  if (CURRENT_FILTER !== "ALL") {
    rows = results.filter(r => r.estado === CURRENT_FILTER);
  }

  let html = `
    <table border="1" cellpadding="6" cellspacing="0" width="100%">
      <thead>
        <tr>
          <th>Fila</th>
          <th>Score</th>
          <th>Estado</th>
          <th>Motivo</th>
          <th>Detalle</th>
        </tr>
      </thead>
      <tbody>
  `;

  rows.forEach((r, i) => {
    html += `
      <tr>
        <td>${r.fila}</td>
        <td>${r.score ?? "-"}</td>
        <td>${estadoBadge(r.estado)}</td>
        <td>${r.motivo ?? ""}</td>
        <td>
          <button onclick="showDetail(${i})">Ver</button>
        </td>
      </tr>
    `;
  });

  html += "</tbody></table>";

  el("resultsTable").innerHTML = html;
}

// ---------- DETALLE ----------

function showDetail(index) {
  const r = window.__RESULTS__[index];

  let html = `
    <h3>Detalle fila ${r.fila}</h3>
    <p><strong>Estado:</strong> ${r.estado}</p>
    <p><strong>Score:</strong> ${r.score}</p>
    <p><strong>Motivo:</strong> ${r.motivo ?? "-"}</p>
    <button onclick="closeDetail()">Cerrar</button>
  `;

  el("detailPanel").innerHTML = html;
  el("detailPanel").style.display = "block";
}

function closeDetail() {
  el("detailPanel").style.display = "none";
}

// ---------- AUTO INIT ----------

document.addEventListener("DOMContentLoaded", () => {
  const check = setInterval(() => {
    if (window.__RESULTS__) {
      clearInterval(check);
      renderUI(window.__RESULTS__);
    }
  }, 300);
});
