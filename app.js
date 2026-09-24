// PEGA TU URL DE GOOGLE APPS SCRIPT ACÁ:
const SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbwoK_DKWL6-1W3cY207i8rsG79flYGsusOaHtczS1djHXbhmLrCCmsDoqsi2kQcDV5Eng/exec";

const totalSteps = 12;
let currentStep = 1;

function updateProgress() {
    const total = document.querySelectorAll(".step").length || totalSteps;
    const progress = (currentStep / total) * 100;
    const bar = document.getElementById("progressBar");
    if (bar) bar.style.width = `${progress}%`;
    const selector = document.getElementById("quickStepSelector");
    if (selector) selector.value = currentStep;
}

function nextStep(step) {
    const currentContainer = document.querySelector(`.step[data-step="${step}"]`);
    if (currentContainer) {
        const inputs = currentContainer.querySelectorAll("input, select, textarea");
        for (let input of inputs) {
            // Ignorar elementos deshabilitados o no visibles
            if (input.disabled || input.offsetParent === null) continue;

            const valor = (input.value !== undefined && input.value !== null) ? String(input.value).trim() : "";

            if (input.hasAttribute("required") && !valor) {
                input.focus();
                input.style.outline = "2px solid #ef4444";

                // Quita el borde rojo apenas el usuario interactúa
                input.addEventListener("input", () => { input.style.outline = ""; }, { once: true });
                input.addEventListener("change", () => { input.style.outline = ""; }, { once: true });

                const labelText = input.closest(".input-group")?.querySelector("label")?.innerText || input.name || "campo obligatorio";
                alert(`Por favor completá: ${labelText}`);
                return;
            }
        }

        // Si estamos saliendo de Documentación (10) o Mantenimiento (11), guardamos lo que el usuario editó
        if (step === 10 || step === 11) {
            guardarMantenimientoActual();
        }
        if (step === 2) {
            guardarInspeccionGeneralActual();
        }

        currentContainer.classList.remove("active");
    }

    currentStep = step + 1;

    const nextContainer = document.querySelector(`.step[data-step="${currentStep}"]`);
    if (nextContainer) {
        nextContainer.classList.add("active");
        updateProgress();

        if (currentStep === 2) {
            setTimeout(() => { precargarInspeccionGeneralPrevio(); }, 50);
        }
        if (currentStep === 10 || currentStep === 11) {
            setTimeout(() => {
                try {
                    precargarMantenimientoPrevio();
                } catch (err) {
                    console.error("Error al precargar datos:", err);
                }
            }, 50);
        }
    }
}

function prevStep(step) {
    const currentContainer = document.querySelector(`.step[data-step="${step}"]`);
    if (currentContainer) {
        // Guardamos antes de volver atrás para no perder lo escrito
        if (step === 10 || step === 11) {
            guardarMantenimientoActual();
        }
        if (step === 2) {
            guardarInspeccionGeneralActual();
        }
        currentContainer.classList.remove("active");
    }

    currentStep = step - 1;
    const prevContainer = document.querySelector(`.step[data-step="${currentStep}"]`);
    if (prevContainer) {
        prevContainer.classList.add("active");
        updateProgress();
    }
}

document.getElementById("vehicleForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnSubmit");
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Guardando en planilla...";
    }

    const form = e.target;

    // 1. Extracción exhaustiva de todos los controles del formulario
    const data = {};
    const elementos = form.querySelectorAll("input, select, textarea");
    elementos.forEach((el) => {
        if (!el.name) return;

        if (el.type === "checkbox") {
            data[el.name] = el.checked ? el.value || "SI" : "NO";
        } else if (el.type === "radio") {
            if (el.checked) {
                data[el.name] = el.value;
            } else if (!data[el.name]) {
                data[el.name] = "";
            }
        } else {
            data[el.name] = el.value !== undefined ? el.value.trim() : "";
        }
    });

    // 2. Persistencia local por vehículo
    guardarMantenimientoActual();
    guardarInspeccionGeneralActual();

    // 3. Verificación en consola (F12)
    console.log("DATOS COMPLETOS SALIENDO A GOOGLE SHEETS:", data);

    try {
        await fetch(SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: {
                "Content-Type": "text/plain;charset=utf-8",
            },
            body: JSON.stringify(data),
        });

        form.style.display = "none";
        const feedback = document.getElementById("feedbackMsg");
        if (feedback) feedback.style.display = "block";
    } catch (err) {
        console.error("Error capturado al guardar:", err);
        form.style.display = "none";
        const feedback = document.getElementById("feedbackMsg");
        if (feedback) feedback.style.display = "block";
    }
});

function resetForm() {
    const form = document.getElementById("vehicleForm");
    if (form) {
        form.reset();
        form.style.display = "block";
    }
    const feedback = document.getElementById("feedbackMsg");
    if (feedback) feedback.style.display = "none";

    document.querySelectorAll(".step").forEach((s) => s.classList.remove("active"));
    currentStep = 1;
    const firstStep = document.querySelector('.step[data-step="1"]');
    if (firstStep) firstStep.classList.add("active");
    updateProgress();

    const btn = document.getElementById("btnSubmit");
    if (btn) {
        btn.disabled = false;
        btn.innerText = "Finalizar y Guardar";
    }
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
    if (!select || !inputPatente) return;
    const pat = patentes[select.value] || "";
    inputPatente.value = pat;
}

// Carga la fecha y hora actual en el input
function setFechaHoraActual() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const el = document.getElementById("fechaHora");
    if (el) el.value = now.toISOString().slice(0, 16);
}

// Muestra u oculta la caja de detalle según la opción marcada
function toggleObsField(boxId, show) {
    const box = document.getElementById(boxId);
    if (!box) return;
    if (show) {
        box.classList.add("visible");
        const textarea = box.querySelector("textarea");
        if (textarea) textarea.focus();
    } else {
        box.classList.remove("visible");
        const textarea = box.querySelector("textarea");
        if (textarea) textarea.value = "";
    }
}

function formatearFechaParaInput(fechaRaw) {
    if (!fechaRaw) return "";
    const d = new Date(fechaRaw);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
}

// Helpers para botones rápidos de fechas
function setFechaHoy(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.value = new Date().toISOString().split("T")[0];
}

function sumarMeses(origenId, destinoId, meses) {
    const origen = document.getElementById(origenId);
    const destino = document.getElementById(destinoId);
    if (!origen || !destino) return;
    const baseVal = origen.value;
    const fechaBase = baseVal ? new Date(baseVal) : new Date();
    fechaBase.setMonth(fechaBase.getMonth() + meses);
    destino.value = fechaBase.toISOString().split("T")[0];
}

function sumarDias(origenId, destinoId, dias) {
    const origen = document.getElementById(origenId);
    const destino = document.getElementById(destinoId);
    if (!origen || !destino) return;
    const baseVal = origen.value;
    const fechaBase = baseVal ? new Date(baseVal) : new Date();
    fechaBase.setDate(fechaBase.getDate() + dias);
    destino.value = fechaBase.toISOString().split("T")[0];
}

// Navegación entre vistas principales
function mostrarFormulario() {
    const home = document.getElementById("homeView");
    const report = document.getElementById("reportContainerView");
    const form = document.getElementById("formContainerView");
    if (home) home.style.display = "none";
    if (report) report.style.display = "none";
    if (form) form.style.display = "block";
    updateProgress();
}

async function mostrarReportes() {
    const home = document.getElementById("homeView");
    const form = document.getElementById("formContainerView");
    const report = document.getElementById("reportContainerView");
    if (home) home.style.display = "none";
    if (form) form.style.display = "none";
    if (report) report.style.display = "block";

    await cargarFechasDisponiblesReporte();
}

function volverAlMenuDesdeFeedback() {
    const feedback = document.getElementById("feedbackMsg");
    if (feedback) feedback.style.display = "none";
    resetForm();
    volverAlMenu();
}

function volverAlMenu() {
    const home = document.getElementById("homeView");
    const form = document.getElementById("formContainerView");
    const report = document.getElementById("reportContainerView");
    if (home) home.style.display = "block";
    if (form) form.style.display = "none";
    if (report) report.style.display = "none";
}

let tipoReporteActual = "dia";

function initReportView() {
    const hoy = new Date().toISOString().split("T")[0];
    const mesActual = hoy.slice(0, 7);
    const inputDia = document.getElementById("filtroFechaDia");
    const inputMes = document.getElementById("filtroFechaMes");
    if (inputDia) inputDia.value = hoy;
    if (inputMes) inputMes.value = mesActual;
}

function setFechaHoyFiltro() {
    const inputDia = document.getElementById("filtroFechaDia");
    if (inputDia) inputDia.value = new Date().toISOString().split("T")[0];
}

function cambiarTipoReporte(tipo) {
    tipoReporteActual = tipo;
    const btnDia = document.getElementById("btnTipoDia");
    const btnMes = document.getElementById("btnTipoMes");
    const grupoDia = document.getElementById("grupoFiltroDia");
    const grupoMes = document.getElementById("grupoFiltroMes");

    if (tipo === "dia") {
        if (btnDia) btnDia.className = "btn-primary";
        if (btnMes) btnMes.className = "btn-secondary";
        if (grupoDia) grupoDia.style.display = "block";
        if (grupoMes) grupoMes.style.display = "none";
    } else {
        if (btnDia) btnDia.className = "btn-secondary";
        if (btnMes) btnMes.className = "btn-primary";
        if (grupoDia) grupoDia.style.display = "none";
        if (grupoMes) grupoMes.style.display = "block";
    }
}

function normalizarFecha(val) {
    if (!val) return "";
    const str = val.toString().trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        return str.slice(0, 10);
    }
    const partes = str.split(",")[0].split("/");
    if (partes.length === 3) {
        const dia = partes[0].padStart(2, "0");
        const mes = partes[1].padStart(2, "0");
        const anio = partes[2].length === 2 ? `20${partes[2]}` : partes[2];
        return `${anio}-${mes}-${dia}`;
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }
    return "";
}

function cargarImagen(ruta) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = ruta;
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("No se pudo cargar la imagen: " + ruta));
    });
}

async function cargarFechasDisponiblesReporte() {
    const selectFechas = document.getElementById("filtroFechaDia");
    if (!selectFechas) return;

    selectFechas.innerHTML = '<option value="">Cargando fechas de inspecciones...</option>';

    try {
        const res = await fetch(`${SCRIPT_URL}?action=getAll`);
        const json = await res.json();

        if (json.status !== "success" || !json.data || json.data.length === 0) {
            selectFechas.innerHTML = '<option value="">Sin inspecciones registradas</option>';
            return;
        }

        const fechasSet = new Set();
        json.data.forEach((r) => {
            const raw = (r.fecha_hora || r["fecha_hora"] || r["Fecha y Hora"] || r.fecha || "").toString().trim();
            if (!raw) return;
            const fechaLimpia = normalizarFecha(raw);
            if (fechaLimpia) fechasSet.add(fechaLimpia);
        });

        const listaFechas = Array.from(fechasSet);
        if (listaFechas.length === 0) {
            selectFechas.innerHTML = '<option value="">Sin fechas encontradas</option>';
            return;
        }

        listaFechas.sort((a, b) => b.localeCompare(a));

        const formatearTextoFecha = (isoStr) => {
            const [y, m, d] = isoStr.split("-").map(Number);
            const fechaObj = new Date(y, m - 1, d);
            const nombreDia = new Intl.DateTimeFormat("es-ES", { weekday: "long" }).format(fechaObj);
            const diaCap = nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1);
            const diaFormateado = String(d).padStart(2, "0");
            const mesFormateado = String(m).padStart(2, "0");
            return `${diaCap} ${diaFormateado}/${mesFormateado}/${y}`;
        };

        selectFechas.innerHTML =
            '<option value="">Seleccionar una fecha...</option>' +
            listaFechas.map((f) => `<option value="${f}">${formatearTextoFecha(f)}</option>`).join("");
    } catch (err) {
        console.error("Error al cargar las fechas de inspección:", err);
        selectFechas.innerHTML = '<option value="">Error al cargar fechas</option>';
    }
}

async function generarReportePDF() {
    const btn = document.getElementById("btnGenerarPDF");
    const loader = document.getElementById("reportLoading");

    if (btn) btn.disabled = true;
    if (loader) loader.style.display = "block";

    try {
        const res = await fetch(`${SCRIPT_URL}?action=getAll`);
        const json = await res.json();

        if (json.status !== "success" || !json.data || json.data.length === 0) {
            alert("No se encontraron datos en la planilla.");
            return;
        }

        const vehiculoSeleccionado = document.getElementById("filtroVehiculo").value;
        let registros = json.data;

        if (tipoReporteActual === "dia") {
            const diaBuscado = document.getElementById("filtroFechaDia").value.trim();
            if (!diaBuscado) {
                alert("Por favor seleccioná una fecha del listado.");
                return;
            }
            registros = registros.filter((r) => {
                const fechaRaw = r.fecha_hora || r["Fecha y Hora"] || "";
                const fechaNorm = normalizarFecha(fechaRaw);
                return fechaNorm === diaBuscado || fechaRaw.toString().includes(diaBuscado);
            });
        } else {
            const mesBuscado = document.getElementById("filtroFechaMes").value;
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

        if (vehiculoSeleccionado !== "TODOS") {
            registros = registros.filter(
                (r) => (r.vehiculo || "").trim() === vehiculoSeleccionado.trim(),
            );
        }

        if (registros.length === 0) {
            alert("No hay inspecciones registradas para los filtros seleccionados.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
        });

        let bannerImg = null;
        try {
            bannerImg = await cargarImagen("assets/banner.png");
        } catch (e) {
            console.warn("Banner no encontrado en assets/banner.png");
        }

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

        const formatearFechaCorta = (val) => {
            if (!val) return "-";
            const str = val.toString().trim();
            if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
                const [y, m, d] = str.slice(0, 10).split("-");
                return `${d}/${m}/${y}`;
            }
            return str;
        };

        const fItem = (estado, detalle) => {
            if (!estado || estado.toString().trim() === "") return "-";
            const est = estado.toString().trim().toUpperCase();
            if (est === "REVISAR") {
                const det = detalle && detalle.toString().trim() ? detalle.toString().trim() : "Sin detalle";
                return `REVISAR: ${det}`;
            }
            return "OK";
        };

        registros.forEach((item, index) => {
            if (index > 0) doc.addPage();

            if (bannerImg) {
                doc.addImage(bannerImg, "PNG", 12, 8, 186, 22);
            }
            doc.setDrawColor(200, 200, 200);
            doc.line(12, 32, 198, 32);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(10.5);
            doc.setTextColor(30, 41, 59);
            doc.text("FICHA DE INSPECCIÓN TÉCNICA VEHICULAR", 12, 38);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(`Fecha y hora: ${formatearFechaHora(item.fecha_hora || item["Fecha y Hora"])}`, 12, 43);
            doc.text(`Inspector: ${item.inspector || "-"}`, 95, 43);
            doc.text(`Unidad: ${index + 1} de ${registros.length}`, 172, 43);

            doc.autoTable({
                startY: 46,
                head: [["VEHÍCULO", "PATENTE", "KILOMETRAJE", "COMBUSTIBLE", "BATERÍA"]],
                body: [[
                    item.vehiculo || "-",
                    item.patente || "-",
                    item.kilometraje ? `${item.kilometraje} km` : "-",
                    item.combustible || "-",
                    item.estado_bateria || "-",
                ]],
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

            const checklistPorVistas = [
                [headerSeccion("INSPECCIÓN DE LUCES"), headerSeccion("ELEMENTOS DE SEGURIDAD")],
                ["Luces Bajas", fItem(item.luces_bajas_estado, item.luces_bajas_detalle), "Matafuego Reglam.", fItem(item.seguridad_matafuego_estado, item.seguridad_matafuego_detalle)],
                ["Luces Altas", fItem(item.luces_altas_estado, item.luces_altas_detalle), "Balizas Portátiles", fItem(item.seguridad_balizas_estado, item.seguridad_balizas_detalle)],
                ["Luces de Giro (Guiños)", fItem(item.luces_giros_estado || item.luces_giro_estado, item.luces_giros_detalle || item.luces_giro_detalle), headerSeccion("ELEMENTOS DE AUXILIO")],
                ["Balizas (Emergencia)", fItem(item.luces_balizas_estado, item.luces_balizas_detalle), "Gato Hidráulico", fItem(item.auxilio_gato_estado, item.auxilio_gato_detalle)],
                [headerSeccion("INSPECCIÓN DE FRENOS"), "Llave Cruz", fItem(item.auxilio_llave_estado, item.auxilio_llave_detalle)],
                ["Frenos de Servicio (Pedal)", fItem(item.frenos_servicio_estado, item.frenos_servicio_detalle), "Rueda de Auxilio", fItem(item.auxilio_rueda_estado, item.auxilio_rueda_detalle)],
                ["Freno de Mano", fItem(item.freno_mano_estado, item.freno_mano_detalle), headerSeccion("ESCOBILLAS LIMPIAPARABRISAS")],
                [headerSeccion("INSPECCIÓN DE CUBIERTAS (RODADO)"), "Escobillas Delanteras", fItem(item.escobillas_delanteras_estado, item.escobillas_delanteras_detalle)],
                ["Cubierta Delantera Izq.", fItem(item.cubierta_di_estado, item.cubierta_di_detalle), "Escobilla Trasera", fItem(item.escobilla_trasera_estado, item.escobilla_trasera_detalle)],
                ["Cubierta Delantera Der.", fItem(item.cubierta_dd_estado, item.cubierta_dd_detalle), headerSeccion("DOCUMENTACIÓN OBLIGATORIA")],
                ["Cubierta Trasera Izq.", fItem(item.cubierta_ti_estado, item.cubierta_ti_detalle), "Cédula Vehicular", fItem(item.doc_cedula_estado, item.doc_cedula_detalle)],
                ["Cubierta Trasera Der.", fItem(item.cubierta_td_estado, item.cubierta_td_detalle), "Comprobante de Seguro", fItem(item.doc_seguro_estado, item.doc_seguro_detalle)],
                [headerSeccion("INSPECCIÓN DE FLUIDOS"), "VTV / RTO Vigente", fItem(item.doc_vtv_estado, item.doc_vtv_detalle)],
                ["Nivel de Aceite", fItem(item.fluido_aceite_estado, item.fluido_aceite_detalle), "", ""],
                ["Agua / Refrigerante", fItem(item.fluido_agua_estado, item.fluido_agua_detalle), "", ""],
            ];

            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 3,
                margin: { left: 12, right: 12 },
                tableWidth: 186,
                head: [["COMPONENTE / SISTEMA", "ESTADO", "COMPONENTE / SISTEMA", "ESTADO"]],
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
                didParseCell: function (dataCell) {
                    if ((dataCell.column.index === 1 || dataCell.column.index === 3) && dataCell.cell.raw && typeof dataCell.cell.raw === "string") {
                        const val = dataCell.cell.raw.trim();
                        if (val.startsWith("REVISAR")) {
                            dataCell.cell.styles.textColor = [185, 28, 28];
                            dataCell.cell.styles.fontStyle = "bold";
                        } else if (val === "OK") {
                            dataCell.cell.styles.textColor = [21, 128, 61];
                            dataCell.cell.styles.fontStyle = "bold";
                        }
                    }
                },
            });

            const mantenimientos = [
                ["Control de Batería", formatearFechaCorta(item.fecha_ult_bateria), formatearFechaCorta(item.fecha_prox_bateria)],
                ["Lavado de Unidad", formatearFechaCorta(item.fecha_ult_lavado), formatearFechaCorta(item.fecha_prox_lavado)],
                ["Service Mecánico", formatearFechaCorta(item.fecha_ult_service), formatearFechaCorta(item.fecha_prox_service)],
            ];

            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 3.5,
                head: [["CONTROL DE MANTENIMIENTO", "ÚLTIMO REALIZADO", "PRÓXIMO PROGRAMADO"]],
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

            const yObs = doc.lastAutoTable.finalY + 4;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(30, 41, 59);
            doc.text("Observaciones Generales / Novedades del Vehículo", 12, yObs);

            const obsFinal = item.observaciones_generales && item.observaciones_generales.toString().trim()
                ? item.observaciones_generales.toString().trim()
                : "Sin observaciones reportadas.";

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            doc.setDrawColor(203, 213, 225);
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(12, yObs + 2, 186, 18, 1, 1, "FD");
            doc.text(obsFinal, 14, yObs + 7, { maxWidth: 182 });
        });

        const ahora = new Date();
        const dia = String(ahora.getDate()).padStart(2, "0");
        const mes = String(ahora.getMonth() + 1).padStart(2, "0");
        const anio = ahora.getFullYear();

        const nombreArchivo = `Reporte_DEA_Inspeccion_${dia}-${mes}-${anio}.pdf`;
        doc.save(nombreArchivo);
    } catch (err) {
        console.error("Error al exportar reporte:", err);
        alert("Ocurrió un error al procesar el reporte.");
    } finally {
        if (btn) btn.disabled = false;
        if (loader) loader.style.display = "none";
    }
}

// Obtiene el identificador del vehículo de forma segura
function getVehiculoIdActual() {
    const input =
        document.querySelector("[name='vehiculo']") ||
        document.getElementById("selectVehiculo") ||
        document.getElementById("vehiculo") ||
        document.querySelector("[name='patente']") ||
        document.getElementById("inputPatente") ||
        document.getElementById("patente");

    if (input && input.value && input.value.trim() !== "") {
        return input.value.trim().toUpperCase().replace(/\s+/g, "_");
    }
    return "SIN_VEHICULO";
}

// Guarda los valores actuales para que queden fijados en el próximo control
function guardarMantenimientoActual() {
    const vehiculoId = getVehiculoIdActual();
    if (!vehiculoId || vehiculoId === "SIN_VEHICULO") return;

    const datos = {
        fecha_ult_bateria: document.getElementById("ult_bateria")?.value || "",
        fecha_ult_lavado: document.getElementById("ult_lavado")?.value || "",
        fecha_ult_service: document.getElementById("ult_service")?.value || "",
        kms_ult_service: document.getElementById("kms_ult_service")?.value || "",
        fecha_ult_alineado: document.getElementById("ult_alineado")?.value || "",
        kms_ult_alineado: document.getElementById("kms_ult_alineado")?.value || "",
        doc_seguro_inicio: document.getElementById("doc_seguro_inicio")?.value || "",
        doc_seguro_vencimiento: document.getElementById("doc_seguro_vencimiento")?.value || "",
        doc_vtv_inspeccion: document.getElementById("doc_vtv_inspeccion")?.value || "",
        doc_vtv_vencimiento: document.getElementById("doc_vtv_vencimiento")?.value || "",
    };
    localStorage.setItem(`mantenimiento_${vehiculoId}`, JSON.stringify(datos));
}

// Guarda los valores de Inspección General vinculados al vehículo actual
function guardarInspeccionGeneralActual() {
    const vehiculoId = getVehiculoIdActual();
    if (!vehiculoId || vehiculoId === "SIN_VEHICULO") return;

    const datos = {
        kilometraje: document.getElementById("kilometraje")?.value || "",
        combustible: document.getElementById("combustible")?.value || "",
        estado_bateria: document.getElementById("estado_bateria")?.value || "",
    };
    localStorage.setItem(`inspeccion_general_${vehiculoId}`, JSON.stringify(datos));
}

// Carga últimos datos desde Sheets e inyecta directo a localStorage
async function cargarUltimosDatosDesdeSheets() {
    const selectVehiculo =
        document.querySelector("[name='vehiculo']") ||
        document.getElementById("selectVehiculo") ||
        document.getElementById("vehiculo");
    const inputPatente =
        document.querySelector("[name='patente']") ||
        document.getElementById("inputPatente") ||
        document.getElementById("patente");

    const valorVehiculo = selectVehiculo ? selectVehiculo.value.trim() : "";
    const valorPatente = inputPatente ? inputPatente.value.trim() : "";

    if (!valorVehiculo && !valorPatente) {
        limpiarCamposHistorial();
        return;
    }

    const hintKm = document.getElementById("hint_kilometraje");
    if (hintKm) hintKm.innerText = "Consultando último registro...";

    try {
        const url = `${SCRIPT_URL}?vehiculo=${encodeURIComponent(valorVehiculo)}&patente=${encodeURIComponent(valorPatente)}`;
        const res = await fetch(url);
        const json = await res.json();

        if (json.status === "success" && json.data) {
            const data = json.data;

            // Formateador robusto compatible con DD/MM/YYYY y fechas ISO para inputs type="date"
            const formatearFecha = (f) => {
                if (!f) return "";
                const str = f.toString().trim();

                // Si ya viene en formato YYYY-MM-DD
                if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
                    return str.slice(0, 10);
                }

                // Si viene como DD/MM/YYYY o D/M/YYYY
                const partes = str.split(",")[0].split("/");
                if (partes.length === 3) {
                    const dia = partes[0].padStart(2, "0");
                    const mes = partes[1].padStart(2, "0");
                    const anio = partes[2].length === 2 ? `20${partes[2]}` : partes[2];
                    return `${anio}-${mes}-${dia}`;
                }

                // Fallback para objetos Date o formatos estándar parseables
                const d = new Date(str);
                if (!isNaN(d.getTime())) {
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, "0");
                    const dd = String(d.getDate()).padStart(2, "0");
                    return `${yyyy}-${mm}-${dd}`;
                }
                return "";
            };

            const fBat = formatearFecha(data.fecha_ult_bateria);
            const fLav = formatearFecha(data.fecha_ult_lavado);
            const fServ = formatearFecha(data.fecha_ult_service);
            const fAln = formatearFecha(data.fecha_ult_alineado);
            const fSegInicio = formatearFecha(data.doc_seguro_inicio);
            const fSegVenc = formatearFecha(data.doc_seguro_vencimiento);
            const fVtvInsp = formatearFecha(data.doc_vtv_inspeccion);
            const fVtvVenc = formatearFecha(data.doc_vtv_vencimiento);

            const vehiculoId = (valorVehiculo || valorPatente).toUpperCase().replace(/\s+/g, "_");

            // 1. Guardar en localStorage para garantizar modo incógnito y dispositivos nuevos
            const objInspeccion = {
                kilometraje: data.kilometraje ? data.kilometraje.toString() : "",
                combustible: data.combustible || "",
                estado_bateria: data.estado_bateria || ""
            };
            localStorage.setItem(`inspeccion_general_${vehiculoId}`, JSON.stringify(objInspeccion));

            const objMantenimiento = {
                fecha_ult_bateria: fBat,
                fecha_ult_lavado: fLav,
                fecha_ult_service: fServ,
                kms_ult_service: data.kms_ult_service ? data.kms_ult_service.toString() : "",
                fecha_ult_alineado: fAln,
                kms_ult_alineado: data.kms_ult_alineado ? data.kms_ult_alineado.toString() : "",
                doc_seguro_inicio: fSegInicio,
                doc_seguro_vencimiento: fSegVenc,
                doc_vtv_inspeccion: fVtvInsp,
                doc_vtv_vencimiento: fVtvVenc
            };
            localStorage.setItem(`mantenimiento_${vehiculoId}`, JSON.stringify(objMantenimiento));

            // 2. Reflejo directo en los inputs del formulario
            const kmInput = document.getElementById("kilometraje");
            const combSelect = document.getElementById("combustible");
            const batSelect = document.getElementById("estado_bateria");
            const hintComb = document.getElementById("hint_combustible");
            const hintBat = document.getElementById("hint_estado_bateria");

            if (kmInput) {
                kmInput.value = data.kilometraje || "";
                if (typeof formatearKmSimple === "function") formatearKmSimple(kmInput);
            }
            if (hintKm) hintKm.innerText = data.kilometraje ? `Anterior: ${data.kilometraje} km` : "";
            if (combSelect && data.combustible) combSelect.value = data.combustible;
            if (hintComb) hintComb.innerText = data.combustible ? `Anterior: ${data.combustible}` : "";
            if (batSelect && data.estado_bateria) batSelect.value = data.estado_bateria;
            if (hintBat) hintBat.innerText = data.estado_bateria ? `Anterior: ${data.estado_bateria}` : "";

            const batInput = document.getElementById("ult_bateria");
            const hintBatMant = document.getElementById("hint_bateria");
            if (batInput) batInput.value = fBat;
            if (hintBatMant) hintBatMant.innerText = fBat ? `Anterior: ${fBat.split("-").reverse().join("/")}` : "";

            const lavInput = document.getElementById("ult_lavado");
            const hintLav = document.getElementById("hint_lavado");
            if (lavInput) lavInput.value = fLav;
            if (hintLav) hintLav.innerText = fLav ? `Anterior: ${fLav.split("-").reverse().join("/")}` : "";

            const servInput = document.getElementById("ult_service");
            const hintServ = document.getElementById("hint_service");
            const kmServInput = document.getElementById("kms_ult_service");
            if (servInput) servInput.value = fServ;
            if (hintServ) hintServ.innerText = fServ ? `Anterior: ${fServ.split("-").reverse().join("/")}` : "";
            if (kmServInput) {
                kmServInput.value = data.kms_ult_service || "";
                if (typeof formatearYCalcularKm === "function") formatearYCalcularKm(kmServInput);
            }

            const alnInput = document.getElementById("ult_alineado");
            const hintAln = document.getElementById("hint_alineado");
            const kmAlnInput = document.getElementById("kms_ult_alineado");
            if (alnInput) {
                alnInput.value = fAln;
                if (typeof calcularProximoAlineadoFecha === "function") calcularProximoAlineadoFecha(fAln);
            }
            if (hintAln) hintAln.innerText = fAln ? `Anterior: ${fAln.split("-").reverse().join("/")}` : "";
            if (kmAlnInput) {
                kmAlnInput.value = data.kms_ult_alineado || "";
                if (typeof formatearYCalcularKmAlineado === "function") formatearYCalcularKmAlineado(kmAlnInput);
            }

            const segInicioInput = document.getElementById("doc_seguro_inicio");
            const hintSegInicio = document.getElementById("ant_doc_seguro_inicio");
            if (segInicioInput) segInicioInput.value = fSegInicio;
            if (hintSegInicio) hintSegInicio.innerText = fSegInicio ? `Anterior: ${fSegInicio.split("-").reverse().join("/")}` : "Anterior: ---";

            const segVencInput = document.getElementById("doc_seguro_vencimiento");
            const hintSegVenc = document.getElementById("ant_doc_seguro_vencimiento");
            if (segVencInput) segVencInput.value = fSegVenc;
            if (hintSegVenc) hintSegVenc.innerText = fSegVenc ? `Anterior: ${fSegVenc.split("-").reverse().join("/")}` : "Anterior: ---";

            const vtvInspInput = document.getElementById("doc_vtv_inspeccion");
            const hintVtvInsp = document.getElementById("ant_doc_vtv_inspeccion");
            if (vtvInspInput) vtvInspInput.value = fVtvInsp;
            if (hintVtvInsp) hintVtvInsp.innerText = fVtvInsp ? `Anterior: ${fVtvInsp.split("-").reverse().join("/")}` : "Anterior: ---";

            const vtvVencInput = document.getElementById("doc_vtv_vencimiento");
            const hintVtvVenc = document.getElementById("ant_doc_vtv_vencimiento");
            if (vtvVencInput) vtvVencInput.value = fVtvVenc;
            if (hintVtvVenc) hintVtvVenc.innerText = fVtvVenc ? `Anterior: ${fVtvVenc.split("-").reverse().join("/")}` : "Anterior: ---";

        } else {
            limpiarCamposHistorial();
        }
    } catch (err) {
        console.error("Error al obtener datos previos desde Sheets:", err);
        limpiarCamposHistorial();
    }
}

// Precarga valores de Mantenimiento + Documentación sin pisar datos válidos
function precargarMantenimientoPrevio() {
    const vehiculoId = getVehiculoIdActual();
    if (vehiculoId === "SIN_VEHICULO") return;

    const rawData = localStorage.getItem(`mantenimiento_${vehiculoId}`);

    const batInput = document.getElementById("ult_bateria");
    const hintBat = document.getElementById("hint_bateria");
    const lavInput = document.getElementById("ult_lavado");
    const hintLav = document.getElementById("hint_lavado");
    const servInput = document.getElementById("ult_service");
    const hintServ = document.getElementById("hint_service");
    const kmServInput = document.getElementById("kms_ult_service");
    const kmProxServ = document.getElementById("kms_prox_service");
    const alnInput = document.getElementById("ult_alineado");
    const hintAln = document.getElementById("hint_alineado");
    const kmAlnInput = document.getElementById("kms_ult_alineado");
    const kmProxAln = document.getElementById("kms_prox_alineado");

    const segInicioInput = document.getElementById("doc_seguro_inicio");
    const hintSegInicio = document.getElementById("ant_doc_seguro_inicio");
    const segVencInput = document.getElementById("doc_seguro_vencimiento");
    const hintSegVenc = document.getElementById("ant_doc_seguro_vencimiento");
    const vtvInspInput = document.getElementById("doc_vtv_inspeccion");
    const hintVtvInsp = document.getElementById("ant_doc_vtv_inspeccion");
    const vtvVencInput = document.getElementById("doc_vtv_vencimiento");
    const hintVtvVenc = document.getElementById("ant_doc_vtv_vencimiento");

    if (rawData) {
        try {
            const data = JSON.parse(rawData);

            if (batInput && data.fecha_ult_bateria) batInput.value = data.fecha_ult_bateria;
            if (hintBat && data.fecha_ult_bateria && data.fecha_ult_bateria.includes("-")) {
                hintBat.innerText = `Anterior: ${data.fecha_ult_bateria.split("-").reverse().join("/")}`;
            }

            if (lavInput && data.fecha_ult_lavado) lavInput.value = data.fecha_ult_lavado;
            if (hintLav && data.fecha_ult_lavado && data.fecha_ult_lavado.includes("-")) {
                hintLav.innerText = `Anterior: ${data.fecha_ult_lavado.split("-").reverse().join("/")}`;
            }

            if (servInput && data.fecha_ult_service) servInput.value = data.fecha_ult_service;
            if (hintServ && data.fecha_ult_service && data.fecha_ult_service.includes("-")) {
                hintServ.innerText = `Anterior: ${data.fecha_ult_service.split("-").reverse().join("/")}`;
            }
            if (kmServInput && data.kms_ult_service) {
                kmServInput.value = data.kms_ult_service;
                if (typeof formatearYCalcularKm === "function") formatearYCalcularKm(kmServInput);
            }

            if (alnInput && data.fecha_ult_alineado) {
                alnInput.value = data.fecha_ult_alineado;
                if (typeof calcularProximoAlineadoFecha === "function") calcularProximoAlineadoFecha(data.fecha_ult_alineado);
            }
            if (hintAln && data.fecha_ult_alineado && data.fecha_ult_alineado.includes("-")) {
                hintAln.innerText = `Anterior: ${data.fecha_ult_alineado.split("-").reverse().join("/")}`;
            }
            if (kmAlnInput && data.kms_ult_alineado) {
                kmAlnInput.value = data.kms_ult_alineado;
                if (typeof formatearYCalcularKmAlineado === "function") formatearYCalcularKmAlineado(kmAlnInput);
            }

            if (segInicioInput && data.doc_seguro_inicio) segInicioInput.value = data.doc_seguro_inicio;
            if (hintSegInicio && data.doc_seguro_inicio && data.doc_seguro_inicio.includes("-")) {
                hintSegInicio.innerText = `Anterior: ${data.doc_seguro_inicio.split("-").reverse().join("/")}`;
            }

            if (segVencInput && data.doc_seguro_vencimiento) segVencInput.value = data.doc_seguro_vencimiento;
            if (hintSegVenc && data.doc_seguro_vencimiento && data.doc_seguro_vencimiento.includes("-")) {
                hintSegVenc.innerText = `Anterior: ${data.doc_seguro_vencimiento.split("-").reverse().join("/")}`;
            }

            if (vtvInspInput && data.doc_vtv_inspeccion) vtvInspInput.value = data.doc_vtv_inspeccion;
            if (hintVtvInsp && data.doc_vtv_inspeccion && data.doc_vtv_inspeccion.includes("-")) {
                hintVtvInsp.innerText = `Anterior: ${data.doc_vtv_inspeccion.split("-").reverse().join("/")}`;
            }

            if (vtvVencInput && data.doc_vtv_vencimiento) vtvVencInput.value = data.doc_vtv_vencimiento;
            if (hintVtvVenc && data.doc_vtv_vencimiento && data.doc_vtv_vencimiento.includes("-")) {
                hintVtvVenc.innerText = `Anterior: ${data.doc_vtv_vencimiento.split("-").reverse().join("/")}`;
            }

        } catch (e) {
            console.error("Error al parsear datos de mantenimiento:", e);
        }
    }
}

// Precarga los valores de Inspección General
function precargarInspeccionGeneralPrevio() {
    const vehiculoId = getVehiculoIdActual();
    const kmInput = document.getElementById("kilometraje");
    const hintKm = document.getElementById("hint_kilometraje");
    const combSelect = document.getElementById("combustible");
    const hintComb = document.getElementById("hint_combustible");
    const batSelect = document.getElementById("estado_bateria");
    const hintBat = document.getElementById("hint_estado_bateria");

    if (vehiculoId === "SIN_VEHICULO") return;

    const rawData = localStorage.getItem(`inspeccion_general_${vehiculoId}`);
    if (rawData) {
        try {
            const data = JSON.parse(rawData);
            if (kmInput && data.kilometraje) {
                kmInput.value = data.kilometraje;
                if (typeof formatearKmSimple === "function") formatearKmSimple(kmInput);
            }
            if (hintKm && data.kilometraje) hintKm.innerText = `Anterior: ${data.kilometraje} km`;
            if (combSelect && data.combustible) combSelect.value = data.combustible;
            if (hintComb && data.combustible) hintComb.innerText = `Anterior: ${data.combustible}`;
            if (batSelect && data.estado_bateria) batSelect.value = data.estado_bateria;
            if (hintBat && data.estado_bateria) hintBat.innerText = `Anterior: ${data.estado_bateria}`;
        } catch (err) {
            console.error("Error al parsear datos de inspección general:", err);
        }
    }
}

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

function calcularProximoAlineadoFecha(fechaStr) {
    const inputProx = document.getElementById("prox_alineado_fecha");
    if (!fechaStr || !inputProx) return;

    const partes = fechaStr.split("-");
    if (partes.length < 3) return;
    const fecha = new Date(partes[0], partes[1] - 1, partes[2]);
    fecha.setMonth(fecha.getMonth() + 6);

    const yyyy = fecha.getFullYear();
    const mm = String(fecha.getMonth() + 1).padStart(2, "0");
    const dd = String(fecha.getDate()).padStart(2, "0");

    inputProx.value = `${yyyy}-${mm}-${dd}`;
}

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

function formatearKmSimple(input) {
    if (!input) return;
    const valorLimpio = input.value.replace(/\D/g, "");
    if (!valorLimpio) {
        input.value = "";
        return;
    }
    input.value = parseInt(valorLimpio, 10).toLocaleString("es-AR");
}

function limpiarCamposHistorial() {
    resetearValoresVista();
    resetearMantenimientoVista();

    const idsDoc = [
        "doc_seguro_inicio",
        "doc_seguro_vencimiento",
        "doc_vtv_inspeccion",
        "doc_vtv_vencimiento",
    ];
    idsDoc.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    const labelsDoc = [
        "ant_doc_seguro_inicio",
        "ant_doc_seguro_vencimiento",
        "ant_doc_vtv_inspeccion",
        "ant_doc_vtv_vencimiento",
    ];
    labelsDoc.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.innerText = "Anterior: ---";
    });
}

// Restablece la vista actual a su estado por defecto
function resetearValoresVista(btn) {
    const pasoActual = btn ? btn.closest(".step") : document.querySelector(".step.active");
    if (!pasoActual) return;

    // 1. Limpiar el contenido de los textareas sin tocar sus estilos display
    pasoActual.querySelectorAll("textarea").forEach(txt => {
        txt.value = "";
        txt.dispatchEvent(new Event("input"));
    });

    // 2. Para cada grupo de radios, simular clic en la opción OK
    const radioNames = new Set();
    pasoActual.querySelectorAll("input[type='radio']").forEach(r => radioNames.add(r.name));

    radioNames.forEach(name => {
        const radioOk = pasoActual.querySelector(`input[type='radio'][name='${name}'][value='OK']`);
        if (radioOk) {
            // El .click() activa el radio y ejecuta su toggleObsField nativo
            radioOk.click();
        }
    });

    // 3. Limpieza de inputs tradicionales (si hubiera números, fechas o texto en este paso)
    pasoActual.querySelectorAll("input:not([type='radio']):not([type='checkbox']):not([type='hidden']):not([readonly])").forEach(inp => {
        inp.value = "";
        inp.dispatchEvent(new Event("input"));
    });

    // 4. Checkboxes sueltos (si los hay)
    pasoActual.querySelectorAll("input[type='checkbox']").forEach(chk => {
        chk.checked = false;
        chk.dispatchEvent(new Event("change"));
    });

    // 5. Selects
    pasoActual.querySelectorAll("select").forEach(sel => {
        sel.selectedIndex = 0;
        sel.dispatchEvent(new Event("change"));
    });

    // 6. Limpieza de hints previos
    pasoActual.querySelectorAll("[id^='hint_'], [id^='ant_']").forEach(h => {
        h.innerText = "";
    });
}

function resetearMantenimientoVista() {
    const ids = [
        "ult_bateria",
        "hint_bateria",
        "ult_lavado",
        "hint_lavado",
        "ult_service",
        "hint_service",
        "kms_ult_service",
        "kms_prox_service",
        "ult_alineado",
        "hint_alineado",
        "prox_alineado_fecha",
        "kms_ult_alineado",
        "kms_prox_alineado",
    ];

    ids.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.tagName === "INPUT") el.value = "";
        else el.innerText = "";
    });
}

function verificarElementosPorVehiculo() {
    try {
        const selectorVehiculo =
            document.querySelector("[name='vehiculo']") ||
            document.getElementById("selectVehiculo") ||
            document.getElementById("vehiculo");
        const cardTrasera = document.getElementById("card_limpiaparabrisas_trasera");

        if (!selectorVehiculo || !cardTrasera) return;

        const valorVehiculo = (selectorVehiculo.value || "").toString().trim().toUpperCase();
        if (!valorVehiculo) return;

        const esMontana = valorVehiculo.includes("MONTANA");
        const radioOk = document.getElementById("esco_tras_ok");
        const radioRev = document.getElementById("esco_tras_rev");
        const textareaObs = cardTrasera.querySelector("textarea");

        if (esMontana) {
            cardTrasera.style.display = "none";
            if (radioOk) {
                radioOk.checked = false;
                radioOk.disabled = true;
            }
            if (radioRev) {
                radioRev.checked = false;
                radioRev.disabled = true;
            }
            if (textareaObs) {
                textareaObs.value = "N/A";
                textareaObs.disabled = true;
            }
        } else {
            cardTrasera.style.display = "";
            if (radioOk) {
                radioOk.disabled = false;
                radioOk.checked = true;
            }
            if (radioRev) radioRev.disabled = false;
            if (textareaObs) {
                textareaObs.disabled = false;
                if (textareaObs.value === "N/A") textareaObs.value = "";
            }
        }
    } catch (err) {
        console.warn("Aviso en verificarElementosPorVehiculo:", err);
    }
}

// Inicialización global
document.addEventListener("DOMContentLoaded", () => {
    setFechaHoraActual();
    initReportView();

    const selectorVehiculo =
        document.querySelector("[name='vehiculo']") ||
        document.getElementById("selectVehiculo") ||
        document.getElementById("vehiculo");

    if (selectorVehiculo) {
        selectorVehiculo.addEventListener("change", () => {
            autocompletarPatente();
            precargarMantenimientoPrevio();
            precargarInspeccionGeneralPrevio();
            cargarUltimosDatosDesdeSheets();
            if (typeof verificarElementosPorVehiculo === "function") {
                verificarElementosPorVehiculo();
            }
        });
    }

    // Escucha cambios manuales en documentación para que persistan inmediatamente
    const inputsDoc = [
        "doc_seguro_inicio",
        "doc_seguro_vencimiento",
        "doc_vtv_inspeccion",
        "doc_vtv_vencimiento"
    ];

    inputsDoc.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("change", () => {
                guardarMantenimientoActual();
            });
        }
    });
});

function limpiarPaso1() {
    const selInspector = document.querySelector("[name='inspector']");
    const selVehiculo = document.getElementById("selectVehiculo");
    const inPatente = document.getElementById("inputPatente");

    if (selInspector) selInspector.value = "";
    if (selVehiculo) selVehiculo.value = "";
    if (inPatente) inPatente.value = "";

    setFechaHoraActual();
    limpiarCamposHistorial();
}

function irAlPasoDirecto(nuevoPaso) {
    if (nuevoPaso === currentStep) return;

    // Validación obligatoria si intenta saltar hacia adelante desde el paso 1 sin completar
    if (currentStep === 1 && nuevoPaso > 1) {
        const paso1 = document.querySelector('.step[data-step="1"]');
        if (paso1) {
            const inputs = paso1.querySelectorAll("input[required], select[required]");
            for (let inp of inputs) {
                const val = (inp.value !== undefined && inp.value !== null) ? String(inp.value).trim() : "";
                if (!val) {
                    alert("Por favor completá los datos obligatorios del vehículo antes de cambiar de sección.");
                    const selector = document.getElementById("quickStepSelector");
                    if (selector) selector.value = currentStep;
                    inp.focus();
                    return;
                }
            }
        }
    }

    // Resguardo de datos si salimos de pasos específicos
    if (currentStep === 10 || currentStep === 11) {
        guardarMantenimientoActual();
    }
    if (currentStep === 2) {
        guardarInspeccionGeneralActual();
    }

    // Ocultar paso actual
    const pasoActualEl = document.querySelector(`.step[data-step="${currentStep}"]`);
    if (pasoActualEl) pasoActualEl.classList.remove("active");

    // Activar nuevo paso
    currentStep = nuevoPaso;
    const nuevoPasoEl = document.querySelector(`.step[data-step="${currentStep}"]`);
    if (nuevoPasoEl) {
        nuevoPasoEl.classList.add("active");
        updateProgress();

        // Precargas si aplica
        if (currentStep === 2) {
            setTimeout(() => { precargarInspeccionGeneralPrevio(); }, 50);
        }
        if (currentStep === 10 || currentStep === 11) {
            setTimeout(() => {
                try { precargarMantenimientoPrevio(); } catch (e) { }
            }, 50);
        }
    }
}
