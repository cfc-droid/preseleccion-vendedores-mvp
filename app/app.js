// ======================================================
// PRESELECCIÓN VENDEDORES — MVP
// Paso 15 + Paso 16
// Lee XLSX exportado desde Google Sheets
// Valida estructura fija de 35 columnas (LOCKED)
// NO aplica reglas
// NO calcula score
// NO descarta perfiles
// ======================================================

// ===== CONFIGURACIÓN FORMULARIO (LOCKED) =====
// Estas son las ÚNICAS columnas esperadas.
// Nunca se agregan más.
// Eventualmente pueden reducirse.

const EXPECTED_HEADERS = [
  "Marca temporal",
  "Dirección de correo electrónico",
  "1/33. Escribí esta frase y agregá tu @usuario principal + ciudad:",
  "2/33. ¿Aceptás cobrar solo por resultados (COMISIÓN)?",
  "3/33. ¿Buscás empleo o sueldo?",
  "4/33. Horas semanales reales",
  "5/33. Conversaciones reales que podés iniciar en 7 días",
  "6/33. ¿Leíste completo el anuncio y la advertencia?",
  "7/33. Hotmart",
  "8/33. Nombre y apellido",
  "9/33. Email de contacto (confirmación)",
  "10/33. País / zona horaria",
  "11/33. Perfil de red social principal",
  "12/33. ¿Vendiste productos digitales o educativos antes?",
  "13/33. ¿Qué vendiste?",
  "14/33. ¿Cómo vendías?",
  "15/33. Contá brevemente tu experiencia comercial",
  "16/33. ¿Tenés comunidad propia?",
  "17/33. Tamaño aproximado",
  "18/33. Listá 3 lugares concretos donde podrías difundir",
  "19/33. ¿Tenés base de contactos?",
  "20/33. ¿Cuál de estas prácticas NO harías nunca?",
  "21/33. ¿Qué significa cobrar solo por resultados?",
  "22/33. ¿Qué responderías si alguien pregunta cuánto voy a ganar?",
  "23/33. ¿Qué cosas NO dirías nunca al presentar este producto?",
  "24/33. Aceptación de reglas",
  "25/33. ¿Alguna vez hiciste spam o te reportaron?",
  "26/33. Explicá qué pasó y qué aprendiste",
  "27/33. DM de presentación del producto",
  "28/33. Post corto para redes",
  "29/33. ¿A qué tipo de cliente apuntarías?",
  "30/33. Acciones concretas primeros 7 días",
  "31/33. ¿Por qué creés que sos apto?",
  "32/33. Comentarios finales",
  "33/33. Si en 30 días no generás ventas, ¿cómo lo interpretás?"
];

// ===== ELEMENTOS DOM =====

const fileInput = document.getElementById("fileInput");
const output = document.getElementById("output");

// ===== EVENTO PRINCIPAL =====

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;

  const name = file.name.toLowerCase();

  // Validación estricta: SOLO XLSX
  if (!name.endsWith(".xlsx")) {
    alert("Archivo inválido. Solo se acepta XLSX exportado desde Google Sheets.");
    fileInput.value = "";
    return;
  }

  // Leer archivo
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Leer como matriz (filas crudas)
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (!rows.length) {
    alert("El archivo está vacío.");
    return;
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  // ===== VALIDACIÓN DE ESTRUCTURA =====

  const missingHeaders = EXPECTED_HEADERS.filter(
    h => !headers.includes(h)
  );

  const extraHeaders = headers.filter(
    h => !EXPECTED_HEADERS.includes(h)
  );

  // Si hay columnas extra → ERROR DURO
  if (extraHeaders.length > 0) {
    alert(
      "ERROR: El archivo tiene columnas NO esperadas.\n\n" +
      extraHeaders.join("\n")
    );
    return;
  }

  // Si faltan columnas → aviso (permitido)
  if (missingHeaders.length > 0) {
    console.warn(
      "ATENCIÓN: Faltan columnas (posible reducción futura):",
      missingHeaders
    );
  }

  // ===== LOGS DE CONTROL =====

  console.log("Columnas detectadas:", headers);
  console.log("Cantidad de columnas:", headers.length);
  console.log("Filas detectadas:", dataRows.length);

  // ===== SALIDA VISUAL =====

  output.innerHTML = `
    <p><strong>Archivo cargado correctamente</strong></p>
    <p>Columnas detectadas: ${headers.length}</p>
    <p>Filas detectadas: ${dataRows.length}</p>
    ${
      missingHeaders.length > 0
        ? `<p style="color:#c49b00;">Columnas faltantes: ${missingHeaders.length}</p>`
        : `<p style="color:#2ecc71;">Estructura completa</p>`
    }
  `;
});
