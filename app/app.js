// ======================================================
// PRESELECCIÓN VENDEDORES — MVP
// Paso 15 + Paso 16 + Paso 17
// - Lee XLSX exportado desde Google Sheets
// - Valida estructura fija de columnas (LOCKED)
// - Mapea semánticamente cada fila
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


// ===== CLASIFICACIÓN SEMÁNTICA (POR BLOQUES) =====
// Índices 0-based sobre el XLSX

const COLUMN_SECTIONS = {
  system: [0, 1],
  filtros: [2, 3, 4, 5, 6, 7],
  identidad: [8, 9, 10, 11],
  experiencia: [12, 13, 14, 15],
  canales: [16, 17, 18, 19],
  etica_gate: [20],
  comprension: [21, 22, 23],
  etica: [24, 25, 26],
  prueba: [27, 28, 29, 30],
  cierre: [31, 32, 33]
};


// ===== ELEMENTOS DOM =====

const fileInput = document.getElementById("fileInput");
const output = document.getElementById("output");


// ===== EVENTO PRINCIPAL =====

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;

  // Validación estricta: SOLO XLSX
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    alert("Archivo inválido. Solo se acepta XLSX exportado desde Google Sheets.");
    fileInput.value = "";
    return;
  }

  // Leer archivo
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (!rows.length) {
    alert("El archivo está vacío.");
    return;
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);


  // ===== VALIDACIÓN DE HEADERS =====

  const missingHeaders = EXPECTED_HEADERS.filter(h => !headers.includes(h));
  const extraHeaders = headers.filter(h => !EXPECTED_HEADERS.includes(h));

  if (extraHeaders.length > 0) {
    alert(
      "ERROR: El archivo tiene columnas NO esperadas:\n\n" +
      extraHeaders.join("\n")
    );
    return;
  }

  if (missingHeaders.length > 0) {
    console.warn(
      "ATENCIÓN: Faltan columnas (posible reducción futura):",
      missingHeaders
    );
  }


  // ===== MAPEO SEMÁNTICO DE FILAS =====

  const mappedRows = dataRows.map((row, rowIndex) => {
    const entry = {
      _row_excel: rowIndex + 2,
      _raw: {},
      sections: {
        system: {},
        filtros: {},
        identidad: {},
        experiencia: {},
        canales: {},
        etica_gate: {},
        comprension: {},
        etica: {},
        prueba: {},
        cierre: {}
      }
    };

    headers.forEach((header, colIndex) => {
      const value = row[colIndex] ?? "";
      entry._raw[header] = value;

      Object.entries(COLUMN_SECTIONS).forEach(([section, indices]) => {
        if (indices.includes(colIndex)) {
          entry.sections[section][header] = value;
        }
      });
    });

    return entry;
  });


  // ===== LOGS DE CONTROL =====

  console.log("Columnas detectadas:", headers);
  console.log("Cantidad de columnas:", headers.length);
  console.log("Filas detectadas:", mappedRows.length);
  console.log("Ejemplo fila mapeada:", mappedRows[0]);


  // ===== SALIDA VISUAL =====

  output.innerHTML = `
    <p><strong>Archivo cargado y mapeado correctamente</strong></p>
    <p>Columnas detectadas: ${headers.length}</p>
    <p>Filas procesadas: ${mappedRows.length}</p>
    ${
      missingHeaders.length > 0
        ? `<p style="color:#c49b00;">Columnas faltantes: ${missingHeaders.length}</p>`
        : `<p style="color:#2ecc71;">Estructura completa</p>`
    }
  `;
});
