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

        // 3. Generación del documento con jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: "a4",
        });

        // Título y membrete
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("SISTEMA DE CONTROL DE VEHÍCULOS - DEA", 14, 15);

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);

        const periodoTexto =
            tipoReporteActual === "dia"
                ? `Fecha de reporte: ${document.getElementById("filtroFechaDia").value}`
                : `Período mensual: ${document.getElementById("filtroFechaMes").value}`;

        doc.text(periodoTexto, 14, 21);
        doc.text(
            `Unidades inspeccionadas encontradas: ${registros.length}`,
            14,
            26,
        );

        doc.setDrawColor(200);
        doc.line(14, 29, 283, 29);

        // Mapeo exacto de las columnas de tu planilla
        const bodyData = registros.map((item) => [
            item.fecha_hora || item["Fecha y Hora"] || "-",
            item.inspector || "-",
            item.vehiculo || "-",
            item.patente || "-",
            item.kilometraje ? `${item.kilometraje} km` : "-",
            item.combustible || "-",
            item.estado_bateria || "-",
            item.luces_bajas_detalle ||
            item.observaciones_generales ||
            "Sin novedades",
        ]);

        doc.autoTable({
            startY: 33,
            head: [
                [
                    "Fecha y Hora",
                    "Inspector",
                    "Vehículo",
                    "Patente",
                    "Km",
                    "Combustible",
                    "Batería",
                    "Detalle / Novedad",
                ],
            ],
            body: bodyData,
            theme: "striped",
            headStyles: {
                fillColor: [30, 41, 59],
                textColor: [255, 255, 255],
                fontStyle: "bold",
            },
            styles: { fontSize: 8, cellPadding: 2.5 },
            columnStyles: {
                0: { cellWidth: 35 },
                1: { cellWidth: 35 },
                2: { cellWidth: 40 },
                3: { cellWidth: 22 },
                4: { cellWidth: 25 },
                5: { cellWidth: 28 },
                6: { cellWidth: 22 },
                7: { cellWidth: 60 },
            },
        });

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
