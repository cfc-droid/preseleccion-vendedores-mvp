// fixed_header.js
// Encabezado fijo para la tabla de Resultados (sin tocar ui.js)
// - Clona títulos desde el thead real
// - Se pega arriba del panel
// - Toggle ocultar/mostrar (persistente por navegador)
// - Sync scroll horizontal con #resultsTable

(() => {
  const LS_KEY = "psv_fixed_header_enabled_v1";

  function isEnabled() {
    const v = localStorage.getItem(LS_KEY);
    if (v === null) return true; // default ON
    return v === "1";
  }

  function setEnabled(val) {
    try { localStorage.setItem(LS_KEY, val ? "1" : "0"); } catch (_) {}
  }

  function $(sel, root = document) { return root.querySelector(sel); }

  function ensureMountPoint() {
    const host = $("#psvFixedHeaderWrap");
    return !!host;
  }

  function getRealTable() {
    const wrap = document.getElementById("resultsTable");
    const table = wrap ? wrap.querySelector("table.table") : null;
    const thead = table ? table.querySelector("thead") : null;
    const ths = thead ? Array.from(thead.querySelectorAll("th")) : [];
    if (!wrap || !table || !thead || !ths.length) return null;
    return { wrap, table, ths };
  }

  function buildHeader() {
    const real = getRealTable();
    if (!real) return false;

    const wrap = document.getElementById("psvFixedHeaderWrap");
    const title = document.getElementById("psvFixedHeaderTitle");
    const btn = document.getElementById("psvFixedHeaderToggle");
    const scroller = document.getElementById("psvFixedHeaderScroll");
    const headTable = document.getElementById("psvFixedHeaderTable");

    if (!wrap || !title || !btn || !scroller || !headTable) return false;

    // Crear thead fijo
    headTable.innerHTML = "";
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");

    for (const th of real.ths) {
      const th2 = document.createElement("th");
      th2.textContent = (th.textContent || "").trim();
      tr.appendChild(th2);
    }

    thead.appendChild(tr);
    headTable.appendChild(thead);

    // Sync ancho columnas con tabla real
    function syncWidths() {
      const realNow = getRealTable();
      if (!realNow) return;

      const realThs = realNow.ths;
      const fakeThs = Array.from(headTable.querySelectorAll("th"));
      if (fakeThs.length !== realThs.length) return;

      for (let i = 0; i < realThs.length; i++) {
        const w = realThs[i].getBoundingClientRect().width;
        if (w && w > 0) {
          fakeThs[i].style.width = Math.ceil(w) + "px";
          fakeThs[i].style.minWidth = Math.ceil(w) + "px";
          fakeThs[i].style.maxWidth = Math.ceil(w) + "px";
        }
      }
    }

    // Sync scroll horizontal (doble vía, sin loop)
    let lock = false;

    function syncFromReal() {
      if (lock) return;
      lock = true;
      try { scroller.scrollLeft = real.wrap.scrollLeft; } catch (_) {}
      lock = false;
    }

    function syncFromFake() {
      if (lock) return;
      lock = true;
      try { real.wrap.scrollLeft = scroller.scrollLeft; } catch (_) {}
      lock = false;
    }

    // Limpiar listeners previos (simple: clonar nodos)
    const scrollerNew = scroller.cloneNode(true);
    scroller.parentNode.replaceChild(scrollerNew, scrollerNew.previousSibling); // no-op safety

    // (Arriba no sirve en todos los browsers, entonces hacemos directo)
    // Mejor: remove + rebind: (acá minimalista)
    real.wrap.addEventListener("scroll", syncFromReal, { passive: true });
    scroller.addEventListener("scroll", syncFromFake, { passive: true });

    // Toggle
    function applyEnabled() {
      const on = isEnabled();
      wrap.classList.toggle("psvFixedHeaderHidden", !on);
      btn.textContent = on ? "Ocultar encabezado fijo" : "Mostrar encabezado fijo";
    }

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const next = !isEnabled();
      setEnabled(next);
      applyEnabled();
    });

    applyEnabled();
    syncWidths();
    setTimeout(syncWidths, 250);
    setTimeout(syncWidths, 800);
    setTimeout(syncWidths, 1500);

    // Re-sync si cambia layout
    try {
      const ro = new ResizeObserver(() => syncWidths());
      ro.observe(real.wrap);
      ro.observe(real.table);
    } catch (_) {}

    return true;
  }

  function boot() {
    // Solo si existe el mount point (lo ponemos en index.html)
    if (!ensureMountPoint()) return;

    // Intentar construir cuando ya exista la tabla
    let tries = 0;
    const maxTries = 80; // ~20s

    const tick = () => {
      tries++;
      if (buildHeader()) return;
      if (tries >= maxTries) return;
      setTimeout(tick, 250);
    };
    tick();

    // Detectar re-render de UI (tu UI reescribe resultsTable)
    const mo = new MutationObserver(() => {
      const real = getRealTable();
      const fake = document.getElementById("psvFixedHeaderTable");
      if (real && fake && fake.querySelectorAll("th").length !== real.ths.length) {
        buildHeader();
      }
    });
    mo.observe(document.getElementById("viewResultados") || document.body, { childList: true, subtree: true });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
