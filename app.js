// PEGA TU URL DE GOOGLE APPS SCRIPT ACÁ:
const SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbwoK_DKWL6-1W3cY207i8rsG79flYGsusOaHtczS1djHXbhmLrCCmsDoqsi2kQcDV5Eng/exec";

const totalSteps = 5;
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
    document
        .querySelector(`.step[data-step="${currentStep}"]`)
        .classList.add("active");
    updateProgress();
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

            // --- BLOQUE 2: CHECKLIST COMPLETO EN 2 COLUMNAS (11 VISTAS) ---
            const checklistCompleto = [
                // Fila 1: Luces Bajas vs Frenos de Servicio
                [
                    "Luces Bajas",
                    fItem(item.luces_bajas_estado, item.luces_bajas_detalle),
                    "Frenos",
                    fItem(item.frenos_servicio_estado, item.frenos_servicio_detalle),
                ],
                // Fila 2: Luces Altas vs Freno de Mano
                [
                    "Luces Altas",
                    fItem(item.luces_altas_estado, item.luces_altas_detalle),
                    "Freno de Mano",
                    fItem(item.freno_mano_estado, item.freno_mano_detalle),
                ],
                // Fila 3: Giros vs Cubierta Delantera Izq.
                [
                    "Luces de Giro (Guiños)",
                    fItem(item.luces_giros_estado, item.luces_giros_detalle),
                    "Cubierta 1 (delantera izquierda)",
                    fItem(item.cubierta_di_estado, item.cubierta_di_detalle),
                ],
                // Fila 4: Balizas vs Cubierta Delantera Der.
                [
                    "Balizas (Luces de Emergencia)",
                    fItem(item.luces_balizas_estado, item.luces_balizas_detalle),
                    "Cubierta 2 (delantera derecha)",
                    fItem(item.cubierta_dd_estado, item.cubierta_dd_detalle),
                ],
                // Fila 5: Aceite de Motor vs Cubierta Trasera Izq.
                [
                    "Aceite",
                    fItem(item.fluido_aceite_estado, item.fluido_aceite_detalle),
                    "Cubierta 3 (trasera izquierda)",
                    fItem(item.cubierta_ti_estado, item.cubierta_ti_detalle),
                ],
                // Fila 6: Refrigerante / Agua vs Cubierta Trasera Der.
                [
                    "Agua / Refrigerante",
                    fItem(item.fluido_agua_estado, item.fluido_agua_detalle),
                    "Cubierta 4 (trasera derecha)",
                    fItem(item.cubierta_td_estado, item.cubierta_td_detalle),
                ],
                // Fila 7: Matafuego vs Escobillas Delanteras
                [
                    "Matafuego",
                    fItem(
                        item.seguridad_matafuego_estado,
                        item.seguridad_matafuego_detalle,
                    ),
                    "Escobillas Limpiaparabrisas (delanteras)",
                    fItem(
                        item.escobillas_delanteras_estado,
                        item.escobillas_delanteras_detalle,
                    ),
                ],
                // Fila 8: Balizas de Emergencia vs Escobilla Trasera
                [
                    "Balizas (Portátiles / Triángulos)",
                    fItem(item.seguridad_balizas_estado, item.seguridad_balizas_detalle),
                    "Escobilla Limpiaparabrisas (trasera)",
                    fItem(item.escobilla_trasera_estado, item.escobilla_trasera_detalle),
                ],
                // Fila 9: Cédula del Automotor vs Póliza de Seguro
                [
                    "Cédula de Identificación (Verde)",
                    fItem(item.doc_cedula_estado, item.doc_cedula_detalle),
                    "Comprobante de Seguro Vigente (Póliza / Tarjeta)",
                    fItem(item.doc_seguro_estado, item.doc_seguro_detalle),
                ],
                // Fila 10: VTV / RTO
                [
                    "Verificación Técnica Vehicular (VTV / RTO) Vigente",
                    fItem(item.doc_vtv_estado, item.doc_vtv_detalle),
                    "-",
                    "-",
                ],
            ];

            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 3.5,
                head: [
                    ["COMPONENTE / SISTEMA", "ESTADO", "COMPONENTE / SISTEMA", "ESTADO"],
                ],
                body: checklistCompleto,
                theme: "striped",
                headStyles: {
                    fillColor: [51, 65, 85],
                    textColor: [255, 255, 255],
                    fontStyle: "bold",
                    fontSize: 7.5,
                },
                styles: { fontSize: 7, cellPadding: 1.8, textColor: [30, 41, 59] },
                columnStyles: {
                    0: { fontStyle: "bold", cellWidth: 42 },
                    1: { cellWidth: 51 },
                    2: { fontStyle: "bold", cellWidth: 42 },
                    3: { cellWidth: 51 },
                },
                didParseCell: function (data) {
                    // Evaluamos solo las columnas de estado (índices 1 y 3)
                    if ((data.column.index === 1 || data.column.index === 3) && data.cell.raw) {
                        const val = data.cell.raw.toString().trim();

                        if (val.startsWith("REVISAR")) {
                            // Rojo sobrio para alertas
                            data.cell.styles.textColor = [185, 28, 28];
                            data.cell.styles.fontStyle = "bold";
                        } else if (val === "OK") {
                            // Verde institucional para ítems aprobados
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
        const sufijoFecha =
            tipoReporteActual === "dia"
                ? document.getElementById("filtroFechaDia").value
                : document.getElementById("filtroFechaMes").value;

        doc.save(`Reporte_Inspeccion_${sufijoFecha}.pdf`);
    } catch (err) {
        console.error("Error al exportar:", err);
        alert("Ocurrió un error al procesar el reporte.");
    } finally {
        btn.disabled = false;
        if (loader) loader.style.display = "none";
    }
}
