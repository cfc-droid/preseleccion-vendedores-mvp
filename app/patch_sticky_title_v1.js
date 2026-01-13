// ======================================================
// PATCH: Header flotante FIXED (tabla Resultados)
// Objetivo: que el header "Fila | Nombre | Email | ..."
// quede como BARRA FLOTANTE FIJA al hacer scroll del documento.
//
// - No usa sticky (porque en tu layout no alcanza).
// - Clona THEAD y lo renderiza en un contenedor FIXED.
// - No crea espaciadores (no mueve nada para abajo).
// - Se muestra SOLO cuando corresponde (cuando la tabla está en viewport
//   y el header real ya se fue para arriba).
// - Sin tocar ui.js.
// ======================================================

(function () {
  const WRAP_ID = "resultsTable";
  const FLOAT_ID = "cfcFloatingThead";
  const TOP_OFFSET = 0;     // si querés bajarlo por alguna barra fija arriba: 46, 60, etc.
  const Z = 9999;

  let floatEl = null;
  let floatTable = null;
  let cleanupMo = null;

  function qsWrap() {
    return document.getElementById(WRAP_ID);
  }

  function getTable(wrap) {
    return wrap ? wrap.querySelector("table") : null;
  }

  function getThead(table) {
    return table ? table.querySelector("thead") : null;
  }

  function removeFloating() {
    if (cleanupMo) {
      cleanupMo.disconnect();
      cleanupMo = null;
    }
    if (floatEl && floatEl.parentNode) {
      floatEl.parentNode.removeChild(floatEl);
    }
    floatEl = null;
    floatTable = null;
  }

  function ensureFloatingShell() {
    if (floatEl) return;

    floatEl = document.createElement("div");
    floatEl.id = FLOAT_ID;
    floatEl.style.position = "fixed";
    floatEl.style.top = `${TOP_OFFSET}px`;
    floatEl.style.left = "0px";
    floatEl.style.width = "0px";
    floatEl.style.display = "none";
    floatEl.style.zIndex = String(Z);
    floatEl.style.pointerEvents = "none"; // no bloquea clicks del usuario
    floatEl.style.overflow = "hidden";

    // look & feel
    floatEl.style.background = "rgba(10, 12, 18, 0.98)";
    floatEl.style.borderBottom = "1px solid rgba(255,255,255,0.10)";
    floatEl.style.backdropFilter = "blur(6px)";
    floatEl.style.webkitBackdropFilter = "blur(6px)";

    // inner container para scroll horizontal (transform)
    const inner = document.createElement("div");
    inner.setAttribute("data-inner", "1");
    inner.style.willChange = "transform";

    // table clonada
    floatTable = document.createElement("table");
    floatTable.className = "table";
    floatTable.style.margin = "0";
    floatTable.style.width = "max-content";
    floatTable.style.borderCollapse = "separate";
    floatTable.style.borderSpacing = "0";
    floatTable.style.tableLayout = "fixed";

    inner.appendChild(floatTable);
    floatEl.appendChild(inner);
    document.body.appendChild(floatEl);
  }

  function buildClone() {
    const wrap = qsWrap();
    const table = getTable(wrap);
    const thead = getThead(table);
    if (!wrap || !table || !thead) return false;

    ensureFloatingShell();

    // Clonar solo thead
    floatTable.innerHTML = "";
    const clonedThead = thead.cloneNode(true);

    // En algunos layouts conviene limpiar ids duplicados (por si hubiera)
    clonedThead.querySelectorAll("[id]").forEach(el => el.removeAttribute("id"));

    floatTable.appendChild(clonedThead);

    // Estilos a TH clonados (bien opaco siempre)
    floatTable.querySelectorAll("th").forEach(th => {
      th.style.position = "static";
      th.style.background = "rgba(10, 12, 18, 0.98)";
      th.style.borderBottom = "1px solid rgba(255,255,255,0.10)";
      th.style.whiteSpace = "nowrap";
    });

    syncSizes();
    return true;
  }

  function syncSizes() {
    const wrap = qsWrap();
    const table = getTable(wrap);
    const thead = getThead(table);
    if (!wrap || !table || !thead || !floatEl || !floatTable) return;

    const rect = wrap.getBoundingClientRect();

    // Ancho visible = el ancho del wrap (no de toda la tabla)
    const wrapWidth = Math.max(0, rect.width);
    floatEl.style.left = `${Math.round(rect.left)}px`;
    floatEl.style.width = `${Math.round(wrapWidth)}px`;

    // Sincronizar widths por columna (th)
    const srcThs = Array.from(thead.querySelectorAll("th"));
    const dstThs = Array.from(floatTable.querySelectorAll("th"));

    if (srcThs.length && dstThs.length && srcThs.length === dstThs.length) {
      for (let i = 0; i < srcThs.length; i++) {
        const w = Math.round(srcThs[i].getBoundingClientRect().width);
        dstThs[i].style.width = `${w}px`;
        dstThs[i].style.minWidth = `${w}px`;
        dstThs[i].style.maxWidth = `${w}px`;
      }
    }

    // Alto del header para cálculo de visibilidad
    const headH = Math.round(thead.getBoundingClientRect().height || 0);
    floatEl.style.height = headH ? `${headH}px` : "auto";
  }

  function syncHorizontalScroll() {
    if (!floatEl) return;
    const wrap = qsWrap();
    if (!wrap) return;

    const inner = floatEl.querySelector('[data-inner="1"]');
    if (!inner) return;

    // Si el wrap tiene scroll horizontal, lo seguimos
    const sl = wrap.scrollLeft || 0;
    inner.style.transform = `translateX(${-sl}px)`;
  }

  function shouldShow() {
    const wrap = qsWrap();
    const table = getTable(wrap);
    const thead = getThead(table);
    if (!wrap || !table || !thead) return false;

    const wrapRect = wrap.getBoundingClientRect();
    const headRect = thead.getBoundingClientRect();

    const topLine = TOP_OFFSET;

    // Mostrar cuando:
    // 1) el header real ya pasó arriba (headRect.top < topLine)
    // 2) y todavía estamos dentro del área de la tabla (wrapRect.bottom > topLine + headerHeight)
    const headerH = Math.max(1, Math.round(headRect.height || 1));
    const cond1 = headRect.top < topLine;
    const cond2 = wrapRect.bottom > (topLine + headerH);

    // además: el wrap debe estar al menos parcialmente visible
    const cond3 = wrapRect.top < window.innerHeight && wrapRect.bottom > 0;

    return cond1 && cond2 && cond3;
  }

  function tick() {
    const ok = buildClone(); // se auto-protege si ya existe y no rompe
    if (!ok) {
      if (floatEl) floatEl.style.display = "none";
      return;
    }

    syncSizes();
    syncHorizontalScroll();

    const show = shouldShow();
    floatEl.style.display = show ? "block" : "none";
  }

  function bind() {
    const wrap = qsWrap();
    if (!wrap) return;

    // Scroll del documento
    window.addEventListener("scroll", tick, { passive: true });

    // Resize
    window.addEventListener("resize", () => requestAnimationFrame(tick));

    // Scroll horizontal interno del wrap (si existe)
    wrap.addEventListener("scroll", () => {
      syncHorizontalScroll();
      // no hace falta tick entero en cada pixel, pero lo dejamos liviano:
      // (solo mueve transform)
    }, { passive: true });

    // Re-render / cambios en la tabla
    cleanupMo = new MutationObserver(() => {
      requestAnimationFrame(() => {
        // reconstruir clone y re-sync
        buildClone();
        tick();
      });
    });
    cleanupMo.observe(wrap, { childList: true, subtree: true });

    // Primer tick
    requestAnimationFrame(tick);
    setTimeout(tick, 200);
    setTimeout(tick, 600);
  }

  function boot() {
    // limpiar versiones anteriores si quedaron
    const old = document.getElementById(FLOAT_ID);
    if (old) old.remove();

    removeFloating();
    bind();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
