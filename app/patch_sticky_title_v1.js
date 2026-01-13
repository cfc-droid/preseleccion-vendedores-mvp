// ======================================================
// PATCH: Sticky THEAD (encabezado de tabla Resultados)
// Objetivo: que quede fijo SOLO el header:
// "Fila | Nombre | Email | Total | Estado | ..."
// SIN mover nada para abajo y SIN tocar ui.js.
//
// - Busca la tabla dentro de #resultsTable
// - Aplica position:sticky a TH del THEAD
// - No crea espaciadores
// - Reintenta si la tabla se re-renderiza
// ======================================================

(function () {
  const WRAP_ID = "resultsTable";
  const STICKY_Z = "50";

  function isStickyApplied(table) {
    try {
      const th = table.querySelector("thead th");
      if (!th) return false;
      const cs = getComputedStyle(th);
      return cs.position === "sticky";
    } catch (_) {
      return false;
    }
  }

  function applyStickyThead() {
    const wrap = document.getElementById(WRAP_ID);
    if (!wrap) return false;

    const table = wrap.querySelector("table");
    if (!table) return false;

    const thead = table.querySelector("thead");
    if (!thead) return false;

    // Importante: sticky del thead funciona mejor aplicándolo a cada TH
    const ths = Array.from(thead.querySelectorAll("th"));
    if (!ths.length) return false;

    // Si ya está aplicado, no repetimos
    if (isStickyApplied(table)) return true;

    // Aseguramos que el contenedor permita scroll horizontal/vertical
    // (sin cambiar el layout, solo asegura comportamiento sticky)
    // No forzamos heights acá.
    wrap.style.overflowX = wrap.style.overflowX || "auto";

    // Aplicamos sticky a cada TH
    for (const th of ths) {
      th.style.position = "sticky";
      th.style.top = "0px";
      th.style.zIndex = STICKY_Z;

      // Fondo para que no se transparente al scrollear
      // (sin tocar CSS global)
      th.style.background = "rgba(10, 12, 18, 0.96)";

      // Línea inferior sutil
      th.style.borderBottom = th.style.borderBottom || "1px solid rgba(255,255,255,0.06)";
    }

    return true;
  }

  // Reintentos suaves porque UI re-renderiza tabla al filtrar / cambiar tabs
  let tries = 0;
  function boot() {
    const ok = applyStickyThead();
    if (ok) return;

    tries++;
    if (tries < 30) {
      setTimeout(boot, 150);
    }
  }

  // Observa cambios dentro de #resultsTable para re-aplicar cuando se re-renderiza
  function observeRerenders() {
    const wrap = document.getElementById(WRAP_ID);
    if (!wrap) return;

    const mo = new MutationObserver(() => {
      applyStickyThead();
    });

    mo.observe(wrap, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      boot();
      observeRerenders();
    });
  } else {
    boot();
    observeRerenders();
  }
})();
