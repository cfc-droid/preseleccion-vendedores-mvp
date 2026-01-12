// patch_detalle_v4.js
// ======================================================
// PATCH DETALLE v4 (NO TOCA ui.js)
// Objetivos:
// 1) Ocultar/eliminar los cuadros "Respuestas/condiciones CORRECTAS" y "INCORRECTAS".
// 2) Forzar scroll interno horizontal/vertical en tablas del detalle.
// 3) En PARTE 2/3, mover el cuadro RESUMEN (TOTAL/VÁLIDAS/INCORRECTAS) ARRIBA.
// 4) Evitar que el JSON/raw rompa el layout (overflow).
// ======================================================

(() => {
  const CSS = `
    /* wrapper de scroll interno para tablas */
    .cfcTableScroll{
      overflow:auto !important;
      max-width:100% !important;
      -webkit-overflow-scrolling: touch;
    }
    /* para el bloque raw JSON (si existe) */
    .rawBox{
      overflow:auto !important;
      max-width:100% !important;
      white-space: pre !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 12px;
      color: inherit;
    }
  `;

  function injectCSS() {
    if (document.getElementById("patch_detalle_v4_css")) return;
    const style = document.createElement("style");
    style.id = "patch_detalle_v4_css";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function textOf(el) {
    return (el?.textContent || "").trim();
  }

  function removeCorrectIncorrectCards(detailPanel) {
    // Saca los miniCard cuyo título sea CORRECTAS o INCORRECTAS
    const titles = Array.from(detailPanel.querySelectorAll(".miniCard .sectionTitle"));
    titles.forEach(t => {
      const s = textOf(t).toLowerCase();
      if (
        s.includes("respuestas/condiciones correctas") ||
        s.includes("respuestas/condiciones incorrectas")
      ) {
        const card = t.closest(".miniCard");
        if (card) card.remove();
      }
    });

    // También por si quedaron dentro de un grid2 anterior:
    const grid2 = Array.from(detailPanel.querySelectorAll(".grid2"));
    grid2.forEach(g => {
      const hasBad = Array.from(g.querySelectorAll(".sectionTitle")).some(tt => {
        const s = textOf(tt).toLowerCase();
        return s.includes("respuestas/condiciones correctas") || s.includes("respuestas/condiciones incorrectas");
      });
      if (hasBad) g.remove();
    });
  }

  function wrapTablesForScroll(detailPanel) {
    // Envuelve tablas en wrapper con overflow:auto (si no está envuelta ya)
    const tables = Array.from(detailPanel.querySelectorAll("table.table"));
    tables.forEach(tbl => {
      const p = tbl.parentElement;
      if (!p) return;

      // Si ya está dentro de .cfcTableScroll, ok
      if (tbl.closest(".cfcTableScroll")) return;

      // Si el padre ya tiene overflow:auto inline (lo viejo), lo convertimos a clase
      const parentStyle = (p.getAttribute("style") || "").toLowerCase();
      const hasOverflowInline = parentStyle.includes("overflow") && parentStyle.includes("auto");

      // Crear wrapper nuevo
      const wrap = document.createElement("div");
      wrap.className = "cfcTableScroll";

      // Conserva margen-top si estaba inline
      if (hasOverflowInline) {
        // intenta rescatar margin-top:XXpx
        const mt = parentStyle.match(/margin-top:\s*([^;]+);?/i);
        if (mt && mt[1]) wrap.style.marginTop = mt[1].trim();
      }

      // Inserta wrapper y mueve la tabla adentro
      p.insertBefore(wrap, tbl);
      wrap.appendChild(tbl);

      // Si el padre era un div "solo contenedor overflow", lo dejamos si tiene otras cosas.
      // (No lo removemos para no romper nada).
    });
  }

  function moveParte23SummaryAbove(detailPanel) {
    // Busca el miniCard de PARTE 2/3
    const cards = Array.from(detailPanel.querySelectorAll(".miniCard"));
    const card23 = cards.find(c => {
      const st = c.querySelector(".sectionTitle");
      const s = textOf(st).toLowerCase();
      return s.includes("parte 2/3") && s.includes("cerradas");
    });
    if (!card23) return;

    const allTables = Array.from(card23.querySelectorAll("table.table"));
    if (allTables.length < 2) return;

    // Identificamos cuál es la tabla "Resumen" por encabezado "Detalle"
    const isSummaryTable = (tbl) => {
      const th = Array.from(tbl.querySelectorAll("thead th")).map(x => textOf(x).toLowerCase());
      return th.includes("detalle") && th.includes("unidad") && th.includes("porcentaje");
    };

    const summaryTbl = allTables.find(isSummaryTable);
    if (!summaryTbl) return;

    // El "principal" suele ser la de 13 preguntas (tiene th "N°", "Q", etc.)
    const mainTbl = allTables.find(t => t !== summaryTbl) || allTables[0];
    if (!mainTbl) return;

    // Mover el wrapper de la summary (si tiene) arriba del wrapper de la main
    const summaryWrap = summaryTbl.closest(".cfcTableScroll") || summaryTbl.parentElement;
    const mainWrap = mainTbl.closest(".cfcTableScroll") || mainTbl.parentElement;

    if (!summaryWrap || !mainWrap) return;

    // Evitar mover repetido
    if (summaryWrap.compareDocumentPosition(mainWrap) & Node.DOCUMENT_POSITION_FOLLOWING) {
      // summary está antes: OK
      return;
    }

    mainWrap.parentElement.insertBefore(summaryWrap, mainWrap);
  }

  function fixRawBox(detailPanel) {
    // Detecta el label "Contenido completo..." y aplica rawBox al div siguiente
    const mutedLabels = Array.from(detailPanel.querySelectorAll(".muted"));
    const label = mutedLabels.find(m => textOf(m).toLowerCase().includes("contenido completo de la fila"));
    if (!label) return;

    // El raw está en el siguiente <div>
    const next = label.nextElementSibling;
    if (!next) return;

    // Ya aplicado?
    if (next.classList.contains("rawBox")) return;

    next.classList.add("rawBox");
  }

  function applyAllFixes(detailPanel) {
    if (!detailPanel || !(detailPanel instanceof HTMLElement)) return;
    // Solo si está visible (display:block)
    const disp = (detailPanel.style.display || "").toLowerCase();
    if (disp === "none") return;

    removeCorrectIncorrectCards(detailPanel);
    wrapTablesForScroll(detailPanel);
    moveParte23SummaryAbove(detailPanel);
    fixRawBox(detailPanel);
  }

  function observeDetailPanel() {
    const panel = document.getElementById("detailPanel");
    if (!panel) return;

    // Aplicar una vez por si ya está renderizado
    applyAllFixes(panel);

    const mo = new MutationObserver(() => {
      // Cada vez que cambie el HTML del detalle, re-aplicamos
      applyAllFixes(panel);
    });

    mo.observe(panel, { childList: true, subtree: true });
  }

  function boot() {
    injectCSS();

    // Esperar que exista #detailPanel
    const tryInit = () => {
      const panel = document.getElementById("detailPanel");
      if (panel) {
        observeDetailPanel();
        return true;
      }
      return false;
    };

    if (tryInit()) return;

    // fallback: observar body hasta que aparezca
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
