// ======================================================
// PATCH: Sticky THEAD (encabezado de tabla Resultados)
// Objetivo: que quede fijo SOLO el header:
// "Fila | Nombre | Email | Total | Estado | ..."
// SIN mover nada para abajo y SIN tocar ui.js.
//
// ✅ Fix real:
// - En Chrome, position:sticky en <th> puede FALLAR si la tabla usa
//   border-collapse: collapse (muy común). Lo forzamos a "separate".
// - Aseguramos contexto correcto (wrap position:relative).
// - Reaplicamos en re-render (MutationObserver) y en resize.
//
// NO crea espaciadores.
// NO cambia maxHeight.
// NO mueve el layout.
// ======================================================

(function () {
  const WRAP_ID = "resultsTable";
  const STICKY_Z = 200; // arriba de filas
  const TOP_PX = 0;     // si alguna vez necesitás offset: cambiar a 46, etc.

  function applyOnce() {
    const wrap = document.getElementById(WRAP_ID);
    if (!wrap) return false;

    const table = wrap.querySelector("table");
    if (!table) return false;

    const thead = table.querySelector("thead");
    if (!thead) return false;

    const ths = Array.from(thead.querySelectorAll("th"));
    if (!ths.length) return false;

    // --- Claves para que STICKY funcione bien (sin mover nada) ---
    // 1) Contexto
    if (!wrap.style.position) wrap.style.position = "relative";

    // 2) Sticky + tablas: en Chrome, con border-collapse: collapse puede fallar.
    //    Lo forzamos a separate (no cambia visual casi nunca; evita bug de sticky).
    table.style.borderCollapse = "separate";
    table.style.borderSpacing = "0";

    // 3) Si el wrap ya scrollea, perfecto. Si no, no forzamos alturas.
    //    Solo aseguramos que horizontal no rompa.
    if (!wrap.style.overflowX) wrap.style.overflowX = "auto";

    // --- Aplicar sticky a cada TH ---
    for (const th of ths) {
      th.style.position = "sticky";
      th.style.top = `${TOP_PX}px`;
      th.style.zIndex = String(STICKY_Z);

      // Fondo opaco para que no “desaparezca” al pasar filas por debajo
      th.style.background = "rgba(10, 12, 18, 0.98)";

      // Línea inferior sutil (si no existe ya)
      if (!th.style.borderBottom) {
        th.style.borderBottom = "1px solid rgba(255,255,255,0.08)";
      }

      // Asegurar que el sticky no quede transparente por efectos raros
      th.style.backgroundClip = "padding-box";
    }

    return true;
  }

  // Reintentos suaves (porque UI re-renderiza)
  let tries = 0;
  function boot() {
    const ok = applyOnce();
    if (ok) return;

    tries++;
    if (tries < 40) {
      setTimeout(boot, 120);
    }
  }

  function observeRerenders() {
    const wrap = document.getElementById(WRAP_ID);
    if (!wrap) return;

    const mo = new MutationObserver(() => {
      // Reaplicar en el próximo frame (evita aplicar mientras se está pintando)
      requestAnimationFrame(() => applyOnce());
    });

    mo.observe(wrap, { childList: true, subtree: true });
  }

  function bindResize() {
    window.addEventListener("resize", () => {
      requestAnimationFrame(() => applyOnce());
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      boot();
      observeRerenders();
      bindResize();
    });
  } else {
    boot();
    observeRerenders();
    bindResize();
  }
})();
