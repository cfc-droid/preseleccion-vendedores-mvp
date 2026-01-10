// Paso 12 — escuchar carga de archivo

const fileInput = document.getElementById("fileInput");

fileInput.addEventListener("change", () => {
  console.log("Archivo seleccionado:", fileInput.files[0]);
});

