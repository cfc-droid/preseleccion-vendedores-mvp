// Paso 15 — Leer archivo XLSX (Google Sheets exportado)

const fileInput = document.getElementById("fileInput");
const output = document.getElementById("output");

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;

  const name = file.name.toLowerCase();

  if (!name.endsWith(".xlsx")) {
    alert("Archivo inválido. Solo se acepta XLSX exportado desde Google Sheets.");
    fileInput.value = "";
    return;
  }

  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const headers = rows[0];
  const dataRows = rows.slice(1);

  console.log("Columnas detectadas:", headers);
  console.log("Cantidad de columnas:", headers.length);
  console.log("Filas detectadas:", dataRows.length);

  output.innerHTML = `
    <p><strong>Archivo cargado correctamente</strong></p>
    <p>Columnas detectadas: ${headers.length}</p>
    <p>Filas detectadas: ${dataRows.length}</p>
  `;
});
