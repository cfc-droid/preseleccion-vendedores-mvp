// Paso 14 — detectar tipo de archivo (CSV o XLSX)

const fileInput = document.getElementById("fileInput");

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;

  const name = file.name.toLowerCase();

  if (name.endsWith(".xlsx")) {
    console.log("Tipo de archivo: XLSX");
  } else if (name.endsWith(".csv")) {
    console.log("Tipo de archivo: CSV");
  } else {
    alert("Archivo inválido. Solo se acepta XLSX o CSV exportado desde Google Sheets.");
    fileInput.value = "";
  }
});
