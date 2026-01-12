// patch_detalle_v5.js
// ======================================================
// PATCH DETALLE v5 (NO TOCA ui.js)
// Objetivos (forzado real):
// 1) Ocultar SÍ O SÍ el bloque de "Respuestas/condiciones CORRECTAS/INCORRECTAS".
// 2) Evitar estiramiento a la derecha: overflow interno + min-width controlado.
// 3) En PARTE 2/3, mover el cuadro RESUMEN (TOTAL/VÁLIDAS/INCORRECTAS) ARRIBA.
// 4) El raw JSON NO rompe layout: caja con scroll + monospace + pre.
// ======================================================

(() => {
  const CSS = `
    /* 1) Ocultar el grid2 SOLO dentro del detalle (ahi viven esos 2 cuadros) */
    #detailPanel .grid2{ display:none !important; }

    /* 2) Evitar estiramientos raros del detalle */
    #detailPanel{ max-width:100% !important; overflow:hidden !important; }
    #detailPanel .miniCard{ max-width:100% !important; overflow:hidden !important; }

    /* 3) Scroll interno real para tablas (horizontal y vertical) */
    #detailPanel .cfcTableScroll{
      overflow:auto !important;
      max-width:100% !important;
      -webkit-overflow-scrolling: touch;
    }

    /* Para asegurar scroll horizontal: que la tabla pueda ser más ancha que el contenedor */
    #detailPanel table.table{
      width:100% !important;
      min-width: 980px; /* fuerza overflow horizontal cuando haga falta */
    }

    /* 4) Raw JSON en caja con scroll */
    #detailPanel .rawBox{
      overflow:auto !important;
      max-width:100% !important;
      white-space: pre !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
      font-size: 12px !important;
      padding: 10px;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      background: rgba(255,255,255,0.02);
    }
  `;

  function injectCSS() {
    if (document.getElementById("patch_detalle_v5_css")) return;
    const style = document.createElement("style");
    style.id = "patch_detalle_v5_css";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function textOf(el) {
    return (el?.textContent || "").trim();
  }

  function wrapTablesForScroll(detailPanel) {
    // Envuelve tablas en .cfcTableScroll si no lo están.
    const tables = Array.from(detailPanel.querySelectorAll("table.table"));
    tables.forEach(tbl => {
      if (tbl.closest(".cfcTableScroll")) return;

      const parent = tbl.parentElement;
      if (!parent) return;

      const wrap = document.createElement("div");
      wrap.className = "cfcTableScroll";

      // Mantener margin-top si el parent lo tenía inline
      const st = (parent.getAttribute("style") || "");
      const mt = st.match(/margin-top:\s*([^;]+);?/i);
      if (mt && mt[1]) wrap.style.marginTop = mt[1].trim();

      parent.insertBefore(wrap, tbl);
      wrap.appendChild(tbl);
    });
  }

  function moveParte23SummaryAbove(detailPanel) {
    // Busca miniCard PARTE 2/3 y mueve la tabla resumen arriba (SIEMPRE)
    const cards = Array.from(detailPanel.querySelectorAll(".miniCard"));
    const card23 = cards.find(c => {
      const st = c.querySelector(".sectionTitle");
      const s = textOf(st).toLowerCase();
      return s.includes("parte 2/3") && s.includes("cerradas");
    });
    if (!card23) return;

    const allTables = Array.from(card23.querySelectorAll("table.table"));
    if (allTables.length < 2) return;

    const isSummaryTable = (tbl) => {
      const th = Array.from(tbl.querySelectorAll("thead th")).map(x => textOf(x).toLowerCase());
      return th.includes("detalle") && th.includes("unidad") && th.includes("porcentaje");
    };

    const summaryTbl = allTables.find(isSummaryTable);
    if (!summaryTbl) return;

    // tabla principal = la otra
    const mainTbl = allTables.find(t => t !== summaryTbl) || allTables[0];
    if (!mainTbl) return;

    const summaryWrap = summaryTbl.closest(".cfcTableScroll") || summaryTbl.parentElement;
    const mainWrap = mainTbl.closest(".cfcTableScroll") || mainTbl.parentElement;
    if (!summaryWrap || !mainWrap) return;

    // Insertar SIEMPRE summary arriba de main (idempotente: si ya está arriba, no pasa nada)
    if (mainWrap.parentElement) {
      mainWrap.parentElement.insertBefore(summaryWrap, mainWrap);
    }
  }

  function fixRawBox(detailPanel) {
    // Detecta el label "Contenido completo..." y aplica rawBox al div siguiente
    const mutedLabels = Array.from(detailPanel.querySelectorAll(".muted"));
    const label = mutedLabels.find(m => textOf(m).toLowerCase().includes("contenido completo de la fila"));
    if (!label) return;

    const next = label.nextElementSibling;
    if (!next) return;

    if (!next.classList.contains("rawBox")) next.classList.add("rawBox");
  }

  function applyAllFixes(detailPanel) {
    if (!detailPanel || !(detailPanel instanceof HTMLElement)) return;
    const disp = (detailPanel.style.display || "").toLowerCase();
    if (disp === "none") return;

    // FORZADO
    wrapTablesForScroll(detailPanel);
    moveParte23SummaryAbove(detailPanel);
    fixRawBox(detailPanel);
  }

  function observeDetailPanel() {
    const panel = document.getElementById("detailPanel");
    if (!panel) return;

    applyAllFixes(panel);

    const mo = new MutationObserver(() => applyAllFixes(panel));
    mo.observe(panel, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });
  }

  function boot() {
    injectCSS();

    const tryInit = () => {
      const panel = document.getElementById("detailPanel");
      if (panel) {
        observeDetailPanel();
        return true;
      }
      return false;
    };

    if (tryInit()) return;

    const mo = new MutationObserver(() => {
      if (tryInit()) mo.disconnect();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
