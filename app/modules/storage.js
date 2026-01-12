// app/modules/storage.js
// Persistencia cerrada (ÍNDICE 11)
// Key: psv10b_active_dataset
// Valor: { meta, results, human_overrides }
// results[] NUNCA contiene humano (humano va en human_overrides)

window.StoragePSV = (() => {
  const LS_KEY = "psv10b_active_dataset";

  function isObject(x){ return x && typeof x === "object" && !Array.isArray(x); }

  function saveActiveDataset(dataset) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(dataset || null));
      return true;
    } catch (e) {
      console.error("saveActiveDataset error:", e);
      return false;
    }
  }

  function loadActiveDataset() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      return obj || null;
    } catch (e) {
      console.error("loadActiveDataset error:", e);
      return null;
    }
  }

  function resetActiveDataset() {
    try {
      localStorage.removeItem(LS_KEY);
      return true;
    } catch (e) {
      console.error("resetActiveDataset error:", e);
      return false;
    }
  }

  function exportActiveDatasetJSON() {
    const dataset = loadActiveDataset();
    if (!dataset) {
      alert("No hay dataset activo para exportar.");
      return false;
    }

    const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `psv10b_active_dataset_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  }

  function validateDatasetShape(ds) {
    // validación mínima cerrada
    if (!isObject(ds)) return false;
    if (!isObject(ds.meta)) return false;
    if (!Array.isArray(ds.results)) return false;
    if (!isObject(ds.human_overrides)) return false;
    return true;
  }

  function importActiveDatasetJSON(file, onDone) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || "");
        const ds = JSON.parse(text);

        if (!validateDatasetShape(ds)) {
          alert("JSON inválido: no cumple estructura mínima { meta, results, human_overrides }.");
          return;
        }

        saveActiveDataset(ds);
        if (typeof onDone === "function") onDone(ds);
      } catch (e) {
        console.error("importActiveDatasetJSON error:", e);
        alert("No se pudo importar JSON (archivo inválido).");
      }
    };
    reader.readAsText(file);
  }

  return {
    LS_KEY,
    saveActiveDataset,
    loadActiveDataset,
    resetActiveDataset,
    exportActiveDatasetJSON,
    importActiveDatasetJSON
  };
})();
