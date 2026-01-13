// ======================================================
// PATCH: Sticky Title/Header (sin tocar ui.js)
// Objetivo: fijar el "título del registro" arriba al scrollear.
//
// - No depende de clases específicas: busca el H1 principal.
// - Aplica estilos INLINE (no modifica CSS global).
// - Si el header ya es sticky/fixed, no hace nada.
// - Crea un "espaciador" para que el contenido no salte.
// ======================================================

(function () {
  function isAlreadyStickyOrFixed(el) {
    try {
      const cs = getComputedStyle(el);
      return cs.position === "sticky" || cs.position === "fixed";
    } catch (_) {
      return false;
    }
  }

  function findMainTitleH1() {
    // 1) Preferimos el primer H1 visible (título grande)
    const h1s = Array.from(document.querySelectorAll("h1"));
    for (const h of h1s) {
      const txt = (h.textContent || "").trim();
      if (!txt) continue;
      const r = h.getBoundingClientRect();
      // visible en layout
      if (r.height > 10 && r.width > 50) return h;
    }
    return null;
  }

  function pickHeaderContainerFromH1(h1) {
    // Elegimos un contenedor razonable para "fijar" (no el H1 solo).
    // Subimos hasta encontrar un bloque que contenga el título + subtítulo/botones.
    // Limitamos la subida para no agarrar el BODY.
    let el = h1;
    for (let i = 0; i < 6; i++) {
      const p = el.parentElement;
      if (!p) break;

      // Evitar subir a body/html
      const tag = (p.tagName || "").toLowerCase();
      if (tag === "body" || tag === "html") break;

      // Heurística: si el padre tiene más contenido útil (inputs/botones/subtítulo),
      // lo tomamos como candidato a sticky.
      const hasControls =
        p.querySelector("input, button, select, textarea, a") !== null;
      const hasText = (p.textContent || "").trim().length > (h1.textContent || "").trim().length + 10;

      // Si tiene controles o bastante texto, es buen "header" a fijar
      if (hasControls || hasText) el = p;
      else break;
    }
    return el;
  }

  function applyStickyHeader() {
    const h1 = findMainTitleH1();
    if (!h1) return;

    const header = pickHeaderContainerFromH1(h1);
    if (!header) return;

    // Si ya es sticky/fixed, no lo tocamos
    if (isAlreadyStickyOrFixed(header)) return;

    // Creamos espaciador para evitar "salto" al cambiar a sticky
    const spacer = document.createElement("div");
    spacer.setAttribute("data-sticky-spacer", "1");

    // Insertamos el espaciador justo antes del header
    header.parentNode.insertBefore(spacer, header);

    // Medimos alto real del header
    const rect = header.getBoundingClientRect();
    const h = Math.ceil(rect.height || 0);

    spacer.style.height = h ? `${h}px` : "0px";

    // Aplicamos sticky inline
    header.style.position = "sticky";
    header.style.top = "0px";
    header.style.zIndex = "999"; // arriba de cards/tablas
    header.style.backdropFilter = "blur(6px)";
    header.style.webkitBackdropFilter = "blur(6px)";

    // Fondo semi-transparente para que no se “pierda” sobre el contenido
    // (sin tocar variables CSS)
    header.style.background = "rgba(10, 12, 18, 0.78)";

    // Separación sutil abajo
    header.style.borderBottom = "1px solid rgba(255,255,255,0.06)";

    // Que no se achique si hay flex layouts
    header.style.flexShrink = "0";

    // Si el header cambia de tamaño por responsive, recalculamos el spacer
    const ro = new ResizeObserver(() => {
      const r2 = header.getBoundingClientRect();
      const nh = Math.ceil(r2.height || 0);
      spacer.style.height = nh ? `${nh}px` : "0px";
    });
    ro.observe(header);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyStickyHeader);
  } else {
    applyStickyHeader();
  }
})();
