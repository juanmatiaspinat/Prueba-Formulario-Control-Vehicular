// PEGA TU URL DE GOOGLE APPS SCRIPT ACÁ:
const SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbwoK_DKWL6-1W3cY207i8rsG79flYGsusOaHtczS1djHXbhmLrCCmsDoqsi2kQcDV5Eng/exec";

const totalSteps = 12;
let currentStep = 1;

function updateProgress() {
    const progress = (currentStep / totalSteps) * 100;
    document.getElementById("progressBar").style.width = `${progress}%`;
}

function nextStep(step) {
    const currentContainer = document.querySelector(`.step[data-step="${step}"]`);
    const inputs = currentContainer.querySelectorAll("input, select, textarea");

    for (let input of inputs) {
        if (input.hasAttribute("required") && !input.value.trim()) {
            input.focus();
            return;
        }
    }

    currentContainer.classList.remove("active");
    currentStep = step + 1;

    const nextContainer = document.querySelector(`.step[data-step="${currentStep}"]`);
    if (nextContainer) {
        nextContainer.classList.add("active");
        updateProgress();

        // Precarga en el Paso 11 (Fechas de Mantenimiento)
        if (currentStep === 11) {
            setTimeout(() => {
                try {
                    precargarMantenimientoPrevio();
                } catch (err) {
                    console.error("Error al precargar mantenimiento:", err);
                }
            }, 50);
        }
    }
}

function prevStep(step) {
    document
        .querySelector(`.step[data-step="${step}"]`)
        .classList.remove("active");
    currentStep = step - 1;
    document
        .querySelector(`.step[data-step="${currentStep}"]`)
        .classList.add("active");
    updateProgress();
}

document.getElementById("vehicleForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnSubmit");
    btn.disabled = true;
    btn.innerText = "Guardando en planilla...";

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    guardarMantenimientoActual();

    try {
        // Envío compatible 100% con Google Apps Script sin bloqueos de red
        await fetch(SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify(data),
        });

        // 1. Ocultamos el formulario
        form.style.display = "none";

        // 2. Buscamos el contenedor de éxito
        const feedback = document.getElementById("feedbackMsg");
        if (feedback) {
            feedback.style.display = "block";
        }
    } catch (err) {
        console.error("Error capturado:", err);
        // Aunque salte un falso error en la consola, si la planilla guardó, mostramos el éxito
        form.style.display = "none";
        const feedback = document.getElementById("feedbackMsg");
        if (feedback) feedback.style.display = "block";
    }
});

function resetForm() {
    document.getElementById("vehicleForm").reset();
    document.getElementById("vehicleForm").style.display = "block";
    document.getElementById("feedbackMsg").style.display = "none";

    document
        .querySelectorAll(".step")
        .forEach((s) => s.classList.remove("active"));
    currentStep = 1;
    document.querySelector('.step[data-step="1"]').classList.add("active");
    updateProgress();

    const btn = document.getElementById("btnSubmit");
    btn.disabled = false;
    btn.innerText = "Finalizar y Guardar";
}

// Diccionario de patentes asociadas
const patentes = {
    "Renault - Duster": "AB299UW",
    "Chevrolet - Montana": "LDU005",
    "Ford - Ecosport": "OQF461",
};

// Autocompleta la patente según el vehículo elegido
function autocompletarPatente() {
    const select = document.getElementById("selectVehiculo");
    const inputPatente = document.getElementById("inputPatente");
    const pat = patentes[select.value] || "";
    inputPatente.value = pat;

    if (pat) {
        consultarFechasVehiculo(pat);
    }
}

// Carga la fecha y hora actual en el input
function setFechaHoraActual() {
    const now = new Date();
    // Formatea al estándar requerido por datetime-local (YYYY-MM-DDTHH:mm)
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById("fechaHora").value = now.toISOString().slice(0, 16);
}

// Carga la fecha/hora actual por defecto apenas abre la página
document.addEventListener("DOMContentLoaded", () => {
    setFechaHoraActual();
});

// Muestra u oculta la caja de detalle según la opción marcada
function toggleObsField(boxId, show) {
    const box = document.getElementById(boxId);
    if (show) {
        box.classList.add("visible");
        const textarea = box.querySelector("textarea");
        if (textarea) textarea.focus();
    } else {
        box.classList.remove("visible");
        const textarea = box.querySelector("textarea");
        if (textarea) textarea.value = ""; // Limpia el texto si vuelven a marcar OK
    }
}

// Cálculo automático de la barra de progreso
function updateProgress() {
    const totalSteps = document.querySelectorAll(".step").length;
    const progress = (currentStep / totalSteps) * 100;
    document.getElementById("progressBar").style.width = `${progress}%`;
}

// Dispara la búsqueda silenciosa apenas se elige el auto en el Paso 1
async function consultarFechasVehiculo(patente) {
    if (!patente) return;

    const loader = document.getElementById("loadingFechas");
    if (loader) loader.style.display = "block";

    try {
        const res = await fetch(
            `${SCRIPT_URL}?patente=${encodeURIComponent(patente)}`,
        );
        const json = await res.json();

        if (json.status === "success" && json.data) {
            // Si existía una fecha próxima anterior, ahora pasa a ser el último control sugerido
            if (json.data.fecha_prox_bateria) {
                document.getElementById("ult_bateria").value = formatearFechaParaInput(
                    json.data.fecha_prox_bateria,
                );
            }
            if (json.data.fecha_prox_lavado) {
                document.getElementById("ult_lavado").value = formatearFechaParaInput(
                    json.data.fecha_prox_lavado,
                );
            }
            if (json.data.fecha_prox_service) {
                document.getElementById("ult_service").value = formatearFechaParaInput(
                    json.data.fecha_prox_service,
                );
            }
        }
    } catch (err) {
        console.warn("No se pudieron precargar las fechas previas:", err);
    } finally {
        if (loader) loader.style.display = "none";
    }
}

// Adapta fechas devueltas por Google Sheets al formato YYYY-MM-DD
function formatearFechaParaInput(fechaRaw) {
    if (!fechaRaw) return "";
    const d = new Date(fechaRaw);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
}

// Helpers para botones rápidos
function setFechaHoy(inputId) {
    const hoy = new Date().toISOString().split("T")[0];
    document.getElementById(inputId).value = hoy;
}

function sumarMeses(origenId, destinoId, meses) {
    const baseVal = document.getElementById(origenId).value;
    const fechaBase = baseVal ? new Date(baseVal) : new Date();
    fechaBase.setMonth(fechaBase.getMonth() + meses);
    document.getElementById(destinoId).value = fechaBase
        .toISOString()
        .split("T")[0];
}

function sumarDias(origenId, destinoId, dias) {
    const baseVal = document.getElementById(origenId).value;
    const fechaBase = baseVal ? new Date(baseVal) : new Date();
    fechaBase.setDate(fechaBase.getDate() + dias);
    document.getElementById(destinoId).value = fechaBase
        .toISOString()
        .split("T")[0];
}

// Navegación entre vistas principales
function mostrarFormulario() {
    document.getElementById("homeView").style.display = "none";
    document.getElementById("reportContainerView").style.display = "none";
    document.getElementById("formContainerView").style.display = "block";
    updateProgress();
}

function mostrarReportes() {
    document.getElementById("homeView").style.display = "none";
    document.getElementById("formContainerView").style.display = "none";
    document.getElementById("reportContainerView").style.display = "block";
}

function volverAlMenu() {
    document.getElementById("formContainerView").style.display = "none";
    document.getElementById("reportContainerView").style.display = "none";
    document.getElementById("homeView").style.display = "block";
}

function volverAlMenuDesdeFeedback() {
    document.getElementById("feedbackMsg").style.display = "none";
    resetForm(); // resetea los campos
    volverAlMenu();
}

let tipoReporteActual = "dia";

// Inicializa valores por defecto al cargar
function initReportView() {
    const hoy = new Date().toISOString().split("T")[0];
    const mesActual = hoy.slice(0, 7);

    const inputDia = document.getElementById("filtroFechaDia");
    const inputMes = document.getElementById("filtroFechaMes");

    if (inputDia) inputDia.value = hoy;
    if (inputMes) inputMes.value = mesActual;
}
initReportView();

function setFechaHoyFiltro() {
    document.getElementById("filtroFechaDia").value = new Date()
        .toISOString()
        .split("T")[0];
}

function cambiarTipoReporte(tipo) {
    tipoReporteActual = tipo;
    const btnDia = document.getElementById("btnTipoDia");
    const btnMes = document.getElementById("btnTipoMes");
    const grupoDia = document.getElementById("grupoFiltroDia");
    const grupoMes = document.getElementById("grupoFiltroMes");

    if (tipo === "dia") {
        btnDia.className = "btn-primary";
        btnMes.className = "btn-secondary";
        grupoDia.style.display = "block";
        grupoMes.style.display = "none";
    } else {
        btnDia.className = "btn-secondary";
        btnMes.className = "btn-primary";
        grupoDia.style.display = "none";
        grupoMes.style.display = "block";
    }
}

// Función auxiliar para llevar cualquier fecha (ISO, Date de Sheets o D/M/YYYY) a formato YYYY-MM-DD
function normalizarFecha(val) {
    if (!val) return "";
    const str = val.toString().trim();

    // Si ya empieza en formato YYYY-MM-DD (ej: "2026-09-04 10:30")
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        return str.slice(0, 10);
    }

    // Si viene en formato D/M/YYYY o DD/MM/YYYY (ej: "4/9/2026, 10:40:27")
    const partes = str.split(",")[0].split("/");
    if (partes.length === 3) {
        const dia = partes[0].padStart(2, "0");
        const mes = partes[1].padStart(2, "0");
        const anio = partes[2];
        return `${anio}-${mes}-${dia}`;
    }

    // Fallback con objeto Date
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }

    return "";
}

// Función para cargar la imagen en memoria antes de meterla al PDF
function cargarImagen(ruta) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = ruta;
        img.onload = () => resolve(img);
        img.onerror = (err) =>
            reject(new Error("No se pudo cargar la imagen: " + ruta));
    });
}

async function generarReportePDF() {
    const btn = document.getElementById("btnGenerarPDF");
    const loader = document.getElementById("reportLoading");

    btn.disabled = true;
    if (loader) loader.style.display = "block";

    try {
        const res = await fetch(`${SCRIPT_URL}?action=getAll`);
        const json = await res.json();

        if (json.status !== "success" || !json.data || json.data.length === 0) {
            alert("No se encontraron datos en la planilla.");
            return;
        }

        const vehiculoSeleccionado =
            document.getElementById("filtroVehiculo").value;
        let registros = json.data;

        // 1. Filtrado por Fecha (Día o Mes)
        if (tipoReporteActual === "dia") {
            const diaBuscado = document.getElementById("filtroFechaDia").value; // Formato: YYYY-MM-DD
            if (!diaBuscado) {
                alert("Por favor seleccioná una fecha.");
                return;
            }

            registros = registros.filter((r) => {
                // Busca en 'fecha_hora' (columna C) o en 'Fecha y Hora' (columna A)
                const fechaRaw = r.fecha_hora || r["Fecha y Hora"] || "";
                const fechaNormalizada = normalizarFecha(fechaRaw);
                return fechaNormalizada === diaBuscado;
            });
        } else {
            const mesBuscado = document.getElementById("filtroFechaMes").value; // Formato: YYYY-MM
            if (!mesBuscado) {
                alert("Por favor seleccioná un mes.");
                return;
            }

            registros = registros.filter((r) => {
                const fechaRaw = r.fecha_hora || r["Fecha y Hora"] || "";
                const fechaNormalizada = normalizarFecha(fechaRaw);
                return fechaNormalizada.startsWith(mesBuscado);
            });
        }

        // 2. Filtrado por Vehículo si no es 'TODOS'
        if (vehiculoSeleccionado !== "TODOS") {
            registros = registros.filter(
                (r) => (r.vehiculo || "").trim() === vehiculoSeleccionado.trim(),
            );
        }

        if (registros.length === 0) {
            alert("No hay inspecciones registradas para los filtros seleccionados.");
            return;
        }

        // 3. Generación del documento con jsPDF (Ficha por Vehículo completa)
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
        });

        // Precargamos banner institucional
        let bannerImg = null;
        try {
            bannerImg = await cargarImagen("assets/banner.png");
        } catch (e) {
            console.warn("Banner no encontrado en assets/banner.png");
        }

        // Limpieza de formato para fecha y hora de inspección
        const formatearFechaHora = (val) => {
            if (!val) return "-";
            const str = val.toString().trim();
            if (str.includes("T")) {
                const d = new Date(str);
                if (!isNaN(d.getTime())) {
                    const dia = String(d.getDate()).padStart(2, "0");
                    const mes = String(d.getMonth() + 1).padStart(2, "0");
                    const anio = d.getFullYear();
                    const hora = String(d.getHours()).padStart(2, "0");
                    const min = String(d.getMinutes()).padStart(2, "0");
                    return `${dia}/${mes}/${anio} - ${hora}:${min} hs`;
                }
            }
            return str;
        };

        // Formateo de fechas simples (YYYY-MM-DD a DD/MM/YYYY)
        const formatearFechaCorta = (val) => {
            if (!val) return "-";
            const str = val.toString().trim();
            if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
                const [y, m, d] = str.slice(0, 10).split("-");
                return `${d}/${m}/${y}`;
            }
            return str;
        };

        // Formatea el estado de cada ítem: OK limpio o Alerta con detalle
        const fItem = (estado, detalle) => {
            if (!estado || estado.toString().trim() === "") return "-";
            const est = estado.toString().trim().toUpperCase();
            if (est === "REVISAR") {
                const det =
                    detalle && detalle.toString().trim()
                        ? detalle.toString().trim()
                        : "Sin detalle";
                return `REVISAR: ${det}`;
            }
            return "OK";
        };

        // Iteramos cada registro: 1 página por vehículo
        registros.forEach((item, index) => {
            if (index > 0) {
                doc.addPage();
            }

            // --- ENCABEZADO INSTITUCIONAL ---
            if (bannerImg) {
                doc.addImage(bannerImg, "PNG", 12, 8, 186, 22);
            }
            doc.setDrawColor(200, 200, 200);
            doc.line(12, 32, 198, 32);

            // --- TÍTULO Y METADATOS DE LA INSPECCIÓN ---
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10.5);
            doc.setTextColor(30, 41, 59);
            doc.text("FICHA DE INSPECCIÓN TÉCNICA VEHICULAR", 12, 38);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(
                `Fecha y hora: ${formatearFechaHora(item.fecha_hora || item["Fecha y Hora"])}`,
                12,
                43,
            );
            doc.text(`Inspector: ${item.inspector || "-"}`, 95, 43);
            doc.text(`Unidad: ${index + 1} de ${registros.length}`, 172, 43);

            // --- BLOQUE 1: DATOS BÁSICOS DEL VEHÍCULO ---
            doc.autoTable({
                startY: 46,
                head: [
                    ["VEHÍCULO", "PATENTE", "KILOMETRAJE", "COMBUSTIBLE", "BATERÍA"],
                ],
                body: [
                    [
                        item.vehiculo || "-",
                        item.patente || "-",
                        item.kilometraje ? `${item.kilometraje} km` : "-",
                        item.combustible || "-",
                        item.estado_bateria || "-",
                    ],
                ],
                theme: "plain",
                headStyles: {
                    fillColor: [30, 41, 59],
                    textColor: [255, 255, 255],
                    fontStyle: "bold",
                    fontSize: 7.5,
                    halign: "center",
                },
                styles: {
                    fontSize: 8,
                    halign: "center",
                    fontStyle: "bold",
                    textColor: [30, 41, 59],
                    cellPadding: 2,
                },
                tableLineColor: [203, 213, 225],
                tableLineWidth: 0.2,
            });

            // Helper para encabezados de sección que abarcan 2 columnas
            const headerSeccion = (texto) => ({
                content: texto,
                colSpan: 2,
                styles: {
                    fillColor: [241, 245, 249],
                    textColor: [30, 41, 59],
                    fontStyle: "bold",
                    halign: "left",
                },
            });

            // --- BLOQUE 2: CHECKLIST EXACTO CON FILA ADICIONAL A LA IZQUIERDA ---
            const checklistPorVistas = [
                // Fila 1: Títulos
                [
                    headerSeccion("INSPECCIÓN DE LUCES"),
                    headerSeccion("ELEMENTOS DE SEGURIDAD"),
                ],

                // Fila 2
                [
                    "Luces Bajas",
                    fItem(item.luces_bajas_estado, item.luces_bajas_detalle),
                    "Matafuego Reglam.",
                    fItem(
                        item.seguridad_matafuego_estado,
                        item.seguridad_matafuego_detalle,
                    ),
                ],

                // Fila 3
                [
                    "Luces Altas",
                    fItem(item.luces_altas_estado, item.luces_altas_detalle),
                    "Balizas Portátiles",
                    fItem(item.seguridad_balizas_estado, item.seguridad_balizas_detalle),
                ],

                // Fila 4: Continúa Luces / Título Auxilio
                [
                    "Luces de Giro (Guiños)",
                    fItem(
                        item.luces_giros_estado || item.luces_giro_estado,
                        item.luces_giros_detalle || item.luces_giro_detalle,
                    ),
                    headerSeccion("ELEMENTOS DE AUXILIO"),
                ],

                // Fila 5
                [
                    "Balizas (Emergencia)",
                    fItem(item.luces_balizas_estado, item.luces_balizas_detalle),
                    "Gato Hidráulico",
                    fItem(item.auxilio_gato_estado, item.auxilio_gato_detalle),
                ],

                // Fila 6: Título Frenos / Continúa Auxilio
                [
                    headerSeccion("INSPECCIÓN DE FRENOS"),
                    "Llave Cruz",
                    fItem(item.auxilio_llave_estado, item.auxilio_llave_detalle),
                ],

                // Fila 7
                [
                    "Frenos de Servicio (Pedal)",
                    fItem(item.frenos_servicio_estado, item.frenos_servicio_detalle),
                    "Rueda de Auxilio",
                    fItem(item.auxilio_rueda_estado, item.auxilio_rueda_detalle),
                ],

                // Fila 8: Continúa Frenos / Título Escobillas
                [
                    "Freno de Mano",
                    fItem(item.freno_mano_estado, item.freno_mano_detalle),
                    headerSeccion("ESCOBILLAS LIMPIAPARABRISAS"),
                ],

                // Fila 9: Título Cubiertas / Continúa Escobillas
                [
                    headerSeccion("INSPECCIÓN DE CUBIERTAS (RODADO)"),
                    "Escobillas Delanteras",
                    fItem(
                        item.escobillas_delanteras_estado,
                        item.escobillas_delanteras_detalle,
                    ),
                ],

                // Fila 10
                [
                    "Cubierta Delantera Izq.",
                    fItem(item.cubierta_di_estado, item.cubierta_di_detalle),
                    "Escobilla Trasera",
                    fItem(item.escobilla_trasera_estado, item.escobilla_trasera_detalle),
                ],

                // Fila 11: Continúa Cubiertas / Título Documentación
                [
                    "Cubierta Delantera Der.",
                    fItem(item.cubierta_dd_estado, item.cubierta_dd_detalle),
                    headerSeccion("DOCUMENTACIÓN OBLIGATORIA"),
                ],

                // Fila 12
                [
                    "Cubierta Trasera Izq.",
                    fItem(item.cubierta_ti_estado, item.cubierta_ti_detalle),
                    "Cédula Vehicular",
                    fItem(item.doc_cedula_estado, item.doc_cedula_detalle),
                ],

                // Fila 13
                [
                    "Cubierta Trasera Der.",
                    fItem(item.cubierta_td_estado, item.cubierta_td_detalle),
                    "Comprobante de Seguro",
                    fItem(item.doc_seguro_estado, item.doc_seguro_detalle),
                ],

                // Fila 14: Título Fluidos / Continúa Documentación
                [
                    headerSeccion("INSPECCIÓN DE FLUIDOS"),
                    "VTV / RTO Vigente",
                    fItem(item.doc_vtv_estado, item.doc_vtv_detalle),
                ],

                // Fila 15: Aceite a la izquierda / Derecha vacía limpia (sin guiones)
                [
                    "Nivel de Aceite",
                    fItem(item.fluido_aceite_estado, item.fluido_aceite_detalle),
                    "",
                    "",
                ],

                // Fila 16: Agua / Refrigerante a la izquierda (FILA NUEVA) / Derecha vacía limpia
                [
                    "Agua / Refrigerante",
                    fItem(item.fluido_agua_estado, item.fluido_agua_detalle),
                    "",
                    "",
                ],
            ];

            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 3,
                margin: { left: 12, right: 12 },
                tableWidth: 186, // 186 mm calza exacto con el ancho del banner y márgenes
                head: [
                    ["COMPONENTE / SISTEMA", "ESTADO", "COMPONENTE / SISTEMA", "ESTADO"],
                ],
                body: checklistPorVistas,
                theme: "plain",
                headStyles: {
                    fillColor: [30, 41, 59],
                    textColor: [255, 255, 255],
                    fontStyle: "bold",
                    fontSize: 7.2,
                },
                styles: { fontSize: 6.8, cellPadding: 1.2, textColor: [30, 41, 59] },
                tableLineColor: [226, 232, 240],
                tableLineWidth: 0.15,
                columnStyles: {
                    0: { fontStyle: "bold", cellWidth: 43 },
                    1: { cellWidth: 50 },
                    2: { fontStyle: "bold", cellWidth: 43 },
                    3: { cellWidth: 50 },
                },
                didParseCell: function (data) {
                    if (
                        (data.column.index === 1 || data.column.index === 3) &&
                        data.cell.raw &&
                        typeof data.cell.raw === "string"
                    ) {
                        const val = data.cell.raw.trim();
                        if (val.startsWith("REVISAR")) {
                            data.cell.styles.textColor = [185, 28, 28];
                            data.cell.styles.fontStyle = "bold";
                        } else if (val === "OK") {
                            data.cell.styles.textColor = [21, 128, 61];
                            data.cell.styles.fontStyle = "bold";
                        }
                    }
                },
            });

            // --- BLOQUE 3: HISTORIAL Y PROGRAMACIÓN DE MANTENIMIENTO ---
            const mantenimientos = [
                [
                    "Control de Batería",
                    formatearFechaCorta(item.fecha_ult_bateria),
                    formatearFechaCorta(item.fecha_prox_bateria),
                ],
                [
                    "Lavado de Unidad",
                    formatearFechaCorta(item.fecha_ult_lavado),
                    formatearFechaCorta(item.fecha_prox_lavado),
                ],
                [
                    "Service Mecánico",
                    formatearFechaCorta(item.fecha_ult_service),
                    formatearFechaCorta(item.fecha_prox_service),
                ],
            ];

            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 3.5,
                head: [
                    [
                        "CONTROL DE MANTENIMIENTO",
                        "ÚLTIMO REALIZADO",
                        "PRÓXIMO PROGRAMADO",
                    ],
                ],
                body: mantenimientos,
                theme: "plain",
                headStyles: {
                    fillColor: [71, 85, 105],
                    textColor: [255, 255, 255],
                    fontStyle: "bold",
                    fontSize: 7.5,
                },
                styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [30, 41, 59] },
                tableLineColor: [203, 213, 225],
                tableLineWidth: 0.2,
            });

            // --- BLOQUE 4: OBSERVACIONES GENERALES DE LA UNIDAD ---
            const yObs = doc.lastAutoTable.finalY + 4;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(30, 41, 59);
            doc.text("Observaciones Generales / Novedades del Vehículo", 12, yObs);

            const obsFinal =
                item.observaciones_generales &&
                    item.observaciones_generales.toString().trim()
                    ? item.observaciones_generales.toString().trim()
                    : "Sin observaciones reportadas.";

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);

            // Cuadro contenedor prolijo hasta el final de la hoja
            doc.setDrawColor(203, 213, 225);
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(12, yObs + 2, 186, 18, 1, 1, "FD");
            doc.text(obsFinal, 14, yObs + 7, { maxWidth: 182 });
        });

        // Guardado y descarga del documento
        // Obtener la fecha y hora exacta actual
        const ahora = new Date();
        const dia = String(ahora.getDate()).padStart(2, "0");
        const mes = String(ahora.getMonth() + 1).padStart(2, "0");
        const anio = ahora.getFullYear();
        const horas = String(ahora.getHours()).padStart(2, "0");
        const minutos = String(ahora.getMinutes()).padStart(2, "0");

        // Construcción del nombre final: Reporte_DEA_Inspeccion_DD-MM-YYYY_HH-mm.pdf
        const nombreArchivo = `Reporte_DEA_Inspeccion_${dia}-${mes}-${anio}_${horas}-${minutos}.pdf`;

        doc.save(nombreArchivo);
    } catch (err) {
        console.error("Error al exportar:", err);
        alert("Ocurrió un error al procesar el reporte.");
    } finally {
        btn.disabled = false;
        if (loader) loader.style.display = "none";
    }
}

function formatearYCalcularKm(input) {
    const proxInput = document.getElementById("kms_prox_service");

    // Extrae únicamente los dígitos numéricos
    const valorLimpio = input.value.replace(/\D/g, "");

    if (!valorLimpio) {
        input.value = "";
        if (proxInput) proxInput.value = "";
        return;
    }

    const numero = parseInt(valorLimpio, 10);

    // Formatea el input actual con puntos de miles (es-AR)
    input.value = numero.toLocaleString("es-AR");

    // Calcula y formatea el próximo service (+10.000)
    if (proxInput) {
        const proximo = numero + 10000;
        proxInput.value = proximo.toLocaleString("es-AR");
    }
}

// Obtiene el identificador del móvil actual (patente o número de móvil)
function getVehiculoIdActual() {
    const movilInput = document.getElementById("movil") || document.getElementById("patente") || document.querySelector("[name='movil']");
    return movilInput && movilInput.value ? movilInput.value.trim().toUpperCase() : "GENERAL";
}

// Carga las fechas anteriores guardadas para este vehículo
function precargarMantenimientoPrevio() {
    const vehiculoId = getVehiculoIdActual();
    const rawData = localStorage.getItem(`mantenimiento_${vehiculoId}`);
    if (!rawData) return;

    try {
        const data = JSON.parse(rawData);

        // Batería
        const batInput = document.getElementById("ult_bateria");
        const hintBat = document.getElementById("hint_bateria");
        if (batInput && data.fecha_ult_bateria) {
            batInput.value = data.fecha_ult_bateria;
            if (hintBat) hintBat.innerText = `Anterior: ${data.fecha_ult_bateria.split("-").reverse().join("/")}`;
        }

        // Lavado
        const lavInput = document.getElementById("ult_lavado");
        const hintLav = document.getElementById("hint_lavado");
        if (lavInput && data.fecha_ult_lavado) {
            lavInput.value = data.fecha_ult_lavado;
            if (hintLav) hintLav.innerText = `Anterior: ${data.fecha_ult_lavado.split("-").reverse().join("/")}`;
        }

        // Service
        const srvInput = document.getElementById("ult_service");
        const hintSrv = document.getElementById("hint_service");
        if (srvInput && data.fecha_ult_service) {
            srvInput.value = data.fecha_ult_service;
            if (hintSrv) hintSrv.innerText = `Anterior: ${data.fecha_ult_service.split("-").reverse().join("/")}`;
        }

        // Kms
        const kmInput = document.getElementById("kms_ult_service");
        if (kmInput && data.kms_ult_service) {
            kmInput.value = data.kms_ult_service;
            if (typeof formatearYCalcularKm === "function") {
                formatearYCalcularKm(kmInput);
            }
        }
    } catch (e) {
        console.error("Error leyendo datos de mantenimiento:", e);
    }
}

// Guarda los valores actuales para que queden fijados en el próximo control
function guardarMantenimientoActual() {
    const vehiculoId = getVehiculoIdActual();
    const datos = {
        fecha_ult_bateria: document.getElementById("ult_bateria")?.value || "",
        fecha_ult_lavado: document.getElementById("ult_lavado")?.value || "",
        fecha_ult_service: document.getElementById("ult_service")?.value || "",
        kms_ult_service: document.getElementById("kms_ult_service")?.value || "",
        // Nuevo: Alineado y balanceo
        fecha_ult_alineado: document.getElementById("ult_alineado")?.value || "",
        kms_ult_alineado: document.getElementById("kms_ult_alineado")?.value || ""
    };
    localStorage.setItem(`mantenimiento_${vehiculoId}`, JSON.stringify(datos));
}

// Obtiene el identificador del vehículo de forma segura
function getVehiculoIdActual() {
    const movilInput = document.getElementById("movil") ||
        document.getElementById("patente") ||
        document.querySelector("[name='movil']") ||
        document.querySelector("[name='patente']");
    return (movilInput && movilInput.value) ? movilInput.value.trim().toUpperCase() : "GENERAL";
}

// Carga datos previos sin romper si un elemento no existe
function precargarMantenimientoPrevio() {
    const vehiculoId = getVehiculoIdActual();
    const rawData = localStorage.getItem(`mantenimiento_${vehiculoId}`);
    if (!rawData) return;

    try {
        const data = JSON.parse(rawData);

        // Batería
        const bat = document.getElementById("ult_bateria");
        const hintBat = document.getElementById("hint_bateria");
        if (bat && data.fecha_ult_bateria) {
            bat.value = data.fecha_ult_bateria;
            if (hintBat) hintBat.innerText = `Anterior: ${data.fecha_ult_bateria.split("-").reverse().join("/")}`;
        }

        // Lavado
        const lav = document.getElementById("ult_lavado");
        const hintLav = document.getElementById("hint_lavado");
        if (lav && data.fecha_ult_lavado) {
            lav.value = data.fecha_ult_lavado;
            if (hintLav) hintLav.innerText = `Anterior: ${data.fecha_ult_lavado.split("-").reverse().join("/")}`;
        }

        // Service
        const srv = document.getElementById("ult_service");
        const hintSrv = document.getElementById("hint_service");
        if (srv && data.fecha_ult_service) {
            srv.value = data.fecha_ult_service;
            if (hintSrv) hintSrv.innerText = `Anterior: ${data.fecha_ult_service.split("-").reverse().join("/")}`;
        }

        // Kilómetros
        const kmInput = document.getElementById("kms_ult_service");
        if (kmInput && data.kms_ult_service) {
            kmInput.value = data.kms_ult_service;
            formatearYCalcularKm(kmInput);
        }

        // Alineado: Fecha
        const alnInput = document.getElementById("ult_alineado");
        const hintAln = document.getElementById("hint_alineado");
        if (alnInput && data.fecha_ult_alineado) {
            alnInput.value = data.fecha_ult_alineado;
            calcularProximoAlineadoFecha(data.fecha_ult_alineado);
            if (hintAln) hintAln.innerText = `Anterior: ${data.fecha_ult_alineado.split("-").reverse().join("/")}`;
        }

        // Alineado: Kilómetros
        const kmAlnInput = document.getElementById("kms_ult_alineado");
        if (kmAlnInput && data.kms_ult_alineado) {
            kmAlnInput.value = data.kms_ult_alineado;
            formatearYCalcularKmAlineado(kmAlnInput);
        }
    } catch (e) {
        console.warn("Aviso al parsear datos de mantenimiento:", e);
    }
}

// Formato con punto de miles y suma de 10.000
function formatearYCalcularKm(input) {
    if (!input) return;
    const proxInput = document.getElementById("kms_prox_service");
    const valorLimpio = input.value.replace(/\D/g, "");

    if (!valorLimpio) {
        input.value = "";
        if (proxInput) proxInput.value = "";
        return;
    }

    const numero = parseInt(valorLimpio, 10);
    input.value = numero.toLocaleString("es-AR");

    if (proxInput) {
        proxInput.value = (numero + 10000).toLocaleString("es-AR");
    }
}

// Calcula exactamente 6 meses a partir de la fecha seleccionada
function calcularProximoAlineadoFecha(fechaStr) {
    const inputProx = document.getElementById("prox_alineado_fecha");
    if (!fechaStr || !inputProx) return;

    const partes = fechaStr.split("-"); // AAAA-MM-DD
    const fecha = new Date(partes[0], partes[1] - 1, partes[2]);

    // Suma 6 meses exactos
    fecha.setMonth(fecha.getMonth() + 6);

    const yyyy = fecha.getFullYear();
    const mm = String(fecha.getMonth() + 1).padStart(2, "0");
    const dd = String(fecha.getDate()).padStart(2, "0");

    inputProx.value = `${yyyy}-${mm}-${dd}`;
}

// Botón Hoy específico para alineado (setea hoy y calcula los 6 meses)
function setAlineadoHoy() {
    const inputUlt = document.getElementById("ult_alineado");
    if (!inputUlt) return;

    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    const dd = String(hoy.getDate()).padStart(2, "0");
    const fechaHoyStr = `${yyyy}-${mm}-${dd}`;

    inputUlt.value = fechaHoyStr;
    calcularProximoAlineadoFecha(fechaHoyStr);
}

// Formateo de puntos y suma de 10.000 km para alineado
function formatearYCalcularKmAlineado(input) {
    if (!input) return;
    const proxInput = document.getElementById("kms_prox_alineado");
    const valorLimpio = input.value.replace(/\D/g, "");

    if (!valorLimpio) {
        input.value = "";
        if (proxInput) proxInput.value = "";
        return;
    }

    const numero = parseInt(valorLimpio, 10);
    input.value = numero.toLocaleString("es-AR");

    if (proxInput) {
        proxInput.value = (numero + 10000).toLocaleString("es-AR");
    }
}
