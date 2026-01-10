// Paso 13 — validar extensión del archivo

const fileInput = document.getElementById("fileInput");

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;

  const name = file.name.toLowerCase();

  if (name.endsWith(".xlsx") || name.endsWith(".csv")) {
    console.log("Archivo válido:", name);
  } else {
    alert("Archivo inválido. Solo se acepta XLSX o CSV exportado desde Google Sheets.");
    fileInput.value = "";
  }
});
