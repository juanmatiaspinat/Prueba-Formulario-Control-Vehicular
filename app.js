/**
 * ==============================================================================
 * SISTEMA DE CONTROL DE VEHÍCULOS - LÓGICA PRINCIPAL (APP.JS)
 * ==============================================================================
 * 
 * 1. CONFIGURACIÓN Y CONSTANTES GLOBALES
 * 2. NAVEGACIÓN ENTRE VISTAS PRINCIPALES (HOME, FORM, REPORTES)
 * 3. CONTROL DE PASOS (STEP WIZARD) Y BARRA DE PROGRESO
 * 4. GESTIÓN Y NORMALIZACIÓN DE FECHAS / TIEMPO
 * 5. CÁLCULOS DINÁMICOS Y FORMATEO DE KILOMETRAJES
 * 6. CHECKLISTS E INTERACCIÓN DE OBSERVACIONES
 * 7. PERSISTENCIA LOCAL (LOCALSTORAGE) Y PRECARGA DE HISTORIAL
 * 8. COMUNICACIÓN CON GOOGLE APPS SCRIPT (ENVÍO Y CONSULTA)
 * 9. GENERACIÓN Y DESCARGA DE REPORTES PDF
 * 10. LIMPIEZA DE FORMULARIOS Y RESIDUALES
 * 11. INICIALIZACIÓN Y EVENT LISTENERS GLOBALES
 */

/* ==============================================================================
   1. CONFIGURACIÓN Y CONSTANTES GLOBALES
   ============================================================================== */

const SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbwoK_DKWL6-1W3cY207i8rsG79flYGsusOaHtczS1djHXbhmLrCCmsDoqsi2kQcDV5Eng/exec";

const totalSteps = 12;
let currentStep = 1;
let tipoReporteActual = "dia";

const patentes = {
    "Renault - Duster": "AB299UW",
    "Chevrolet - Montana": "LDU005",
    "Ford - Ecosport": "OQF461",
    "Toyota - Hilux": "AC381EC",
};

/* ==============================================================================
   2. NAVEGACIÓN ENTRE VISTAS PRINCIPALES (HOME, FORM, REPORTES)
   ============================================================================== */

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

function volverAlMenu() {
    const home = document.getElementById("homeView");
    const form = document.getElementById("formContainerView");
    const report = document.getElementById("reportContainerView");

    if (home) home.style.display = "block";
    if (form) form.style.display = "none";
    if (report) report.style.display = "none";
}

function volverAlMenuDesdeFeedback() {
    const feedback = document.getElementById("feedbackMsg");
    if (feedback) feedback.style.display = "none";
    resetForm();
    volverAlMenu();
}

/* ==============================================================================
   3. CONTROL DE PASOS (STEP WIZARD) Y BARRA DE PROGRESO
   ============================================================================== */

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
            if (input.disabled || input.offsetParent === null) continue;

            const valor = (input.value !== undefined && input.value !== null) ? String(input.value).trim() : "";

            if (input.hasAttribute("required") && !valor) {
                input.focus();
                input.style.outline = "2px solid #ef4444";
                input.addEventListener("input", () => { input.style.outline = ""; }, { once: true });
                input.addEventListener("change", () => { input.style.outline = ""; }, { once: true });

                const labelText = input.closest(".input-group")?.querySelector("label")?.innerText || input.name || "campo obligatorio";
                alert(`Por favor completá: ${labelText}`);
                return;
            }
        }

        if (step === 10 || step === 11) {
            guardarMantenimientoActual();
        }
        if (step === 2) {
            guardarInspeccionGeneralActual();
        }

        currentContainer.classList.remove("active");
    }

    currentStep = step + 1;

    const nextContainer = document.querySelector(`.step[data-step="${step + 1}"]`);
    if (nextContainer) {
        nextContainer.classList.add("active");
        updateProgress();

        if (currentStep === 2) {
            setTimeout(() => { precargarInspeccionGeneralPrevio(); }, 50);
        }
        if (currentStep === 10 || currentStep === 11) {
            setTimeout(() => {
                recalcularTodasLasAlertas();
            }, 50);
        }
    }
}

function prevStep(step) {
    const currentContainer = document.querySelector(`.step[data-step="${step}"]`);
    if (currentContainer) {
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

        if (currentStep === 10 || currentStep === 11) {
            setTimeout(() => {
                recalcularTodasLasAlertas();
            }, 50);
        }
    }
}

function irAlPasoDirecto(nuevoPaso) {
    if (nuevoPaso === currentStep) return;

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

    if (currentStep === 10 || currentStep === 11) {
        guardarMantenimientoActual();
    }
    if (currentStep === 2) {
        guardarInspeccionGeneralActual();
    }

    const pasoActualEl = document.querySelector(`.step[data-step="${currentStep}"]`);
    if (pasoActualEl) pasoActualEl.classList.remove("active");

    currentStep = nuevoPaso;
    const nuevoPasoEl = document.querySelector(`.step[data-step="${currentStep}"]`);
    if (nuevoPasoEl) {
        nuevoPasoEl.classList.add("active");
        updateProgress();

        if (currentStep === 2) {
            setTimeout(() => { precargarInspeccionGeneralPrevio(); }, 50);
        }
        if (currentStep === 10 || currentStep === 11) {
            setTimeout(() => {
                recalcularTodasLasAlertas();
            }, 50);
        }
    }
}

/* ==============================================================================
   4. GESTIÓN Y NORMALIZACIÓN DE FECHAS / TIEMPO
   ============================================================================== */

function setFechaHoraActual() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const el = document.getElementById("fechaHora");
    if (el) el.value = now.toISOString().slice(0, 16);
}

function setFechaHoy(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.value = new Date().toISOString().split("T")[0];

    if (inputId === "ult_service") {
        actualizarAlertaService();
    }
}

function setFechaHoyFiltro() {
    const inputDia = document.getElementById("filtroFechaDia");
    if (inputDia) inputDia.value = new Date().toISOString().split("T")[0];
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

function formatearFechaParaInput(fechaRaw) {
    if (!fechaRaw) return "";
    const d = new Date(fechaRaw);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
}

/* ==============================================================================
   5. CÁLCULOS DINÁMICOS Y FORMATEO DE KILOMETRAJES
   ============================================================================== */

function formatearKmSimple(input) {
    if (!input) return;
    const valorLimpio = input.value.replace(/\D/g, "");
    if (!valorLimpio) {
        input.value = "";
        actualizarAlertaService();
        actualizarAlertaAlineado();
        return;
    }
    input.value = parseInt(valorLimpio, 10).toLocaleString("es-AR");

    actualizarAlertaService();
    actualizarAlertaAlineado();
}

function formatearYCalcularKm(input) {
    if (!input) return;
    const proxInput = document.getElementById("kms_prox_service");
    const valorLimpio = input.value.replace(/\D/g, "");

    if (!valorLimpio) {
        input.value = "";
        if (proxInput) proxInput.value = "";
        actualizarAlertaService();
        return;
    }

    const numero = parseInt(valorLimpio, 10);
    input.value = numero.toLocaleString("es-AR");

    if (proxInput) {
        proxInput.value = (numero + 10000).toLocaleString("es-AR");
    }

    actualizarAlertaService();
}

function formatearYCalcularKmAlineado(input) {
    if (!input) return;
    const proxInput = document.getElementById("kms_prox_alineado");
    const valorLimpio = input.value.replace(/\D/g, "");

    if (!valorLimpio) {
        input.value = "";
        if (proxInput) proxInput.value = "";
        actualizarAlertaAlineado();
        return;
    }

    const numero = parseInt(valorLimpio, 10);
    input.value = numero.toLocaleString("es-AR");

    if (proxInput) {
        proxInput.value = (numero + 10000).toLocaleString("es-AR");
    }

    actualizarAlertaAlineado();
}

function calcularProximoAlineadoFecha(fechaStr) {
    const inputProx = document.getElementById("prox_alineado_fecha");
    if (!fechaStr || !inputProx) {
        if (inputProx) inputProx.value = "";
        actualizarAlertaAlineado();
        return;
    }

    const partes = fechaStr.split("-");
    if (partes.length < 3) return;

    const fecha = new Date(parseInt(partes[0], 10), parseInt(partes[1], 10) - 1, parseInt(partes[2], 10));
    fecha.setMonth(fecha.getMonth() + 6);

    const yyyy = fecha.getFullYear();
    const mm = String(fecha.getMonth() + 1).padStart(2, "0");
    const dd = String(fecha.getDate()).padStart(2, "0");

    inputProx.value = `${yyyy}-${mm}-${dd}`;
    actualizarAlertaAlineado();
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

/* ==============================================================================
   6. CHECKLISTS E INTERACCIÓN DE OBSERVACIONES
   ============================================================================== */

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

        const sinLimpiaTrasero = valorVehiculo.includes("MONTANA") || valorVehiculo.includes("HILUX");
        const radioOk = document.getElementById("esco_tras_ok");
        const radioRev = document.getElementById("esco_tras_rev");
        const textareaObs = cardTrasera.querySelector("textarea");

        if (sinLimpiaTrasero) {
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

function autocompletarPatente() {
    const select = document.getElementById("selectVehiculo");
    const inputPatente = document.getElementById("inputPatente");
    if (!select || !inputPatente) return;
    inputPatente.value = patentes[select.value] || "";
}

/* ==============================================================================
   7. PERSISTENCIA LOCAL (LOCALSTORAGE) Y PRECARGA DE HISTORIAL
   ============================================================================== */

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
            if (kmInput && data.kilometraje && !kmInput.value) {
                kmInput.value = data.kilometraje;
                formatearKmSimple(kmInput);
            }
            if (hintKm && data.kilometraje) hintKm.innerText = `Anterior: ${data.kilometraje} km`;
            if (combSelect && data.combustible && !combSelect.value) combSelect.value = data.combustible;
            if (hintComb && data.combustible) hintComb.innerText = `Anterior: ${data.combustible}`;
            if (batSelect && data.estado_bateria && !batSelect.value) batSelect.value = data.estado_bateria;
            if (hintBat && data.estado_bateria) hintBat.innerText = `Anterior: ${data.estado_bateria}`;
        } catch (err) {
            console.error("Error al parsear datos de inspección general:", err);
        }
    }
}

function precargarMantenimientoPrevio() {
    const vehiculoId = getVehiculoIdActual();
    if (vehiculoId === "SIN_VEHICULO") return;

    const rawData = localStorage.getItem(`mantenimiento_${vehiculoId}`);
    if (rawData) {
        try {
            const data = JSON.parse(rawData);

            const batInput = document.getElementById("ult_bateria");
            const hintBat = document.getElementById("hint_bateria");
            if (batInput && !batInput.value) batInput.value = data.fecha_ult_bateria || "";
            if (hintBat && data.fecha_ult_bateria && data.fecha_ult_bateria.includes("-")) {
                hintBat.innerText = `Anterior: ${data.fecha_ult_bateria.split("-").reverse().join("/")}`;
            }

            const lavInput = document.getElementById("ult_lavado");
            const hintLav = document.getElementById("hint_lavado");
            if (lavInput && !lavInput.value) lavInput.value = data.fecha_ult_lavado || "";
            if (hintLav && data.fecha_ult_lavado && data.fecha_ult_lavado.includes("-")) {
                hintLav.innerText = `Anterior: ${data.fecha_ult_lavado.split("-").reverse().join("/")}`;
            }

            const servInput = document.getElementById("ult_service");
            const hintServ = document.getElementById("hint_service");
            const kmServInput = document.getElementById("kms_ult_service");
            if (servInput && !servInput.value) servInput.value = data.fecha_ult_service || "";
            if (hintServ && data.fecha_ult_service && data.fecha_ult_service.includes("-")) {
                hintServ.innerText = `Anterior: ${data.fecha_ult_service.split("-").reverse().join("/")}`;
            }
            if (kmServInput && !kmServInput.value && data.kms_ult_service) {
                kmServInput.value = data.kms_ult_service;
                formatearYCalcularKm(kmServInput);
            }

            const alnInput = document.getElementById("ult_alineado");
            const hintAln = document.getElementById("hint_alineado");
            const kmAlnInput = document.getElementById("kms_ult_alineado");
            if (alnInput && !alnInput.value) {
                alnInput.value = data.fecha_ult_alineado || "";
                if (data.fecha_ult_alineado) calcularProximoAlineadoFecha(data.fecha_ult_alineado);
            }
            if (hintAln && data.fecha_ult_alineado && data.fecha_ult_alineado.includes("-")) {
                hintAln.innerText = `Anterior: ${data.fecha_ult_alineado.split("-").reverse().join("/")}`;
            }
            if (kmAlnInput && !kmAlnInput.value && data.kms_ult_alineado) {
                kmAlnInput.value = data.kms_ult_alineado;
                formatearYCalcularKmAlineado(kmAlnInput);
            }

            const segInicioInput = document.getElementById("doc_seguro_inicio");
            const hintSegInicio = document.getElementById("ant_doc_seguro_inicio");
            if (segInicioInput && !segInicioInput.value) segInicioInput.value = data.doc_seguro_inicio || "";
            if (hintSegInicio && data.doc_seguro_inicio && data.doc_seguro_inicio.includes("-")) {
                hintSegInicio.innerText = `Anterior: ${data.doc_seguro_inicio.split("-").reverse().join("/")}`;
            }

            const segVencInput = document.getElementById("doc_seguro_vencimiento");
            const hintSegVenc = document.getElementById("ant_doc_seguro_vencimiento");
            if (segVencInput && !segVencInput.value) segVencInput.value = data.doc_seguro_vencimiento || "";
            if (hintSegVenc && data.doc_seguro_vencimiento && data.doc_seguro_vencimiento.includes("-")) {
                hintSegVenc.innerText = `Anterior: ${data.doc_seguro_vencimiento.split("-").reverse().join("/")}`;
            }

            const vtvInspInput = document.getElementById("doc_vtv_inspeccion");
            const hintVtvInsp = document.getElementById("ant_doc_vtv_inspeccion");
            if (vtvInspInput && !vtvInspInput.value) vtvInspInput.value = data.doc_vtv_inspeccion || "";
            if (hintVtvInsp && data.doc_vtv_inspeccion && data.doc_vtv_inspeccion.includes("-")) {
                hintVtvInsp.innerText = `Anterior: ${data.doc_vtv_inspeccion.split("-").reverse().join("/")}`;
            }

            const vtvVencInput = document.getElementById("doc_vtv_vencimiento");
            const hintVtvVenc = document.getElementById("ant_doc_vtv_vencimiento");
            if (vtvVencInput && !vtvVencInput.value) vtvVencInput.value = data.doc_vtv_vencimiento || "";
            if (hintVtvVenc && data.doc_vtv_vencimiento && data.doc_vtv_vencimiento.includes("-")) {
                hintVtvVenc.innerText = `Anterior: ${data.doc_vtv_vencimiento.split("-").reverse().join("/")}`;
            }

            recalcularTodasLasAlertas();
        } catch (e) {
            console.error("Error al parsear datos de mantenimiento:", e);
        }
    }
}

/* ==============================================================================
   CÁLCULOS DINÁMICOS DE ALERTAS VISUALES (ROJO)
   ============================================================================== */

function calcularDiferenciaMesesDias(fechaStr) {
    if (!fechaStr) return null;
    const partes = fechaStr.split("-");
    if (partes.length !== 3) return null;

    const fechaFin = new Date(parseInt(partes[0], 10), parseInt(partes[1], 10) - 1, parseInt(partes[2], 10));
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    fechaFin.setHours(0, 0, 0, 0);

    const diffTiempo = fechaFin.getTime() - hoy.getTime();
    const esVencido = diffTiempo < 0;

    let dInicio = esVencido ? new Date(fechaFin) : new Date(hoy);
    let dFin = esVencido ? new Date(hoy) : new Date(fechaFin);

    let anios = dFin.getFullYear() - dInicio.getFullYear();
    let meses = dFin.getMonth() - dInicio.getMonth() + (anios * 12);
    let dias = dFin.getDate() - dInicio.getDate();

    if (dias < 0) {
        meses--;
        const ultimoDiaMesAnterior = new Date(dFin.getFullYear(), dFin.getMonth(), 0).getDate();
        dias += ultimoDiaMesAnterior;
    }

    let textoTiempo = "";
    if (meses > 0 && dias > 0) {
        textoTiempo = `${meses} ${meses === 1 ? "mes" : "meses"} y ${dias} ${dias === 1 ? "día" : "días"}`;
    } else if (meses > 0) {
        textoTiempo = `${meses} ${meses === 1 ? "mes" : "meses"}`;
    } else if (dias >= 0) {
        textoTiempo = `${dias} ${dias === 1 ? "día" : "días"}`;
    }

    return { esVencido, textoTiempo };
}

function calcularVencimientoSeguro() {
    const input = document.getElementById("doc_seguro_vencimiento");
    const label = document.getElementById("alerta_venc_seguro");
    if (!input || !label) return;

    if (!input.value) {
        label.innerText = "";
        return;
    }

    const res = calcularDiferenciaMesesDias(input.value);
    if (!res) {
        label.innerText = "";
        return;
    }

    if (res.esVencido) {
        label.innerText = `*Vencido hace ${res.textoTiempo}`;
    } else {
        label.innerText = `*Quedan ${res.textoTiempo} para su vencimiento`;
    }
}

function calcularVencimientoVTV() {
    const input = document.getElementById("doc_vtv_vencimiento");
    const label = document.getElementById("alerta_venc_vtv");
    if (!input || !label) return;

    if (!input.value) {
        label.innerText = "";
        return;
    }

    const res = calcularDiferenciaMesesDias(input.value);
    if (!res) {
        label.innerText = "";
        return;
    }

    if (res.esVencido) {
        label.innerText = `*Vencido hace ${res.textoTiempo}`;
    } else {
        label.innerText = `*Quedan ${res.textoTiempo} para su vencimiento`;
    }
}

/**
 * Actualiza el mensaje de Service Mecánico exclusivamente por Kilometraje
 */
function actualizarAlertaService() {
    const inputKmActual = document.getElementById("kilometraje");
    const inputKmProx = document.getElementById("kms_prox_service");
    const label = document.getElementById("alerta_prox_service");
    if (!label) return;

    if (!inputKmActual || !inputKmProx || !inputKmActual.value.trim() || !inputKmProx.value.trim()) {
        label.innerText = "";
        return;
    }

    const kmAct = parseInt(inputKmActual.value.replace(/\D/g, ""), 10);
    const kmPrx = parseInt(inputKmProx.value.replace(/\D/g, ""), 10);

    if (isNaN(kmAct) || isNaN(kmPrx)) {
        label.innerText = "";
        return;
    }

    const diffKm = kmPrx - kmAct;

    if (diffKm <= 0) {
        const excedido = Math.abs(diffKm).toLocaleString("es-AR");
        label.innerText = `*Vencido: excedido por ${excedido} km`;
    } else {
        const faltan = diffKm.toLocaleString("es-AR");
        label.innerText = `*Faltan ${faltan} km para el próximo service mecánico`;
    }
}

/**
 * Actualiza el mensaje de Alineado y Balanceo combinando Tiempo y Kilómetros
 */
function actualizarAlertaAlineado() {
    const inputKmActual = document.getElementById("kilometraje");
    const inputKmProx = document.getElementById("kms_prox_alineado");
    const inputFechaProx = document.getElementById("prox_alineado_fecha");
    const label = document.getElementById("alerta_prox_alineado");
    if (!label) return;

    let resFecha = null;
    if (inputFechaProx && inputFechaProx.value) {
        resFecha = calcularDiferenciaMesesDias(inputFechaProx.value);
    }

    let diffKm = null;
    if (inputKmActual && inputKmProx && inputKmActual.value.trim() && inputKmProx.value.trim()) {
        const kmAct = parseInt(inputKmActual.value.replace(/\D/g, ""), 10);
        const kmPrx = parseInt(inputKmProx.value.replace(/\D/g, ""), 10);
        if (!isNaN(kmAct) && !isNaN(kmPrx)) {
            diffKm = kmPrx - kmAct;
        }
    }

    // Si no hay ninguno cargado
    if (!resFecha && diffKm === null) {
        label.innerText = "";
        return;
    }

    // Caso 1: Ambos están excedidos / vencidos
    const fechaVencida = resFecha ? resFecha.esVencido : false;
    const kmVencido = diffKm !== null ? diffKm <= 0 : false;

    if (fechaVencida && kmVencido) {
        const kmExc = Math.abs(diffKm).toLocaleString("es-AR");
        label.innerText = `*Alineado vencido hace ${resFecha.textoTiempo} y excedido por ${kmExc} km`;
        return;
    }

    // Caso 2: Solo fecha vencida
    if (fechaVencida) {
        const kmRest = diffKm !== null ? ` (restan ${diffKm.toLocaleString("es-AR")} km)` : "";
        label.innerText = `*Alineado vencido por tiempo hace ${resFecha.textoTiempo}${kmRest}`;
        return;
    }

    // Caso 3: Solo kilómetros excedidos
    if (kmVencido) {
        const kmExc = Math.abs(diffKm).toLocaleString("es-AR");
        const tiempoRest = resFecha ? ` (quedaban ${resFecha.textoTiempo})` : "";
        label.innerText = `*Vencido: excedido por ${kmExc} km${tiempoRest}`;
        return;
    }

    // Caso 4: Ambos vigentes (Normal)
    if (resFecha && diffKm !== null) {
        label.innerText = `*Faltan ${resFecha.textoTiempo}, o ${diffKm.toLocaleString("es-AR")} km para el próximo alineado y balanceo`;
    } else if (resFecha) {
        label.innerText = `*Faltan ${resFecha.textoTiempo} para el próximo alineado y balanceo`;
    } else if (diffKm !== null) {
        label.innerText = `*Faltan ${diffKm.toLocaleString("es-AR")} km para el próximo alineado y balanceo`;
    }
}

function recalcularTodasLasAlertas() {
    calcularVencimientoSeguro();
    calcularVencimientoVTV();
    actualizarAlertaService();
    actualizarAlertaAlineado();
}

/* ==============================================================================
   8. COMUNICACIÓN CON GOOGLE APPS SCRIPT (ENVÍO Y CONSULTA)
   ============================================================================== */

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

    limpiarCamposHistorial();

    if (!valorVehiculo && !valorPatente) return;

    const hintKm = document.getElementById("hint_kilometraje");
    if (hintKm) hintKm.innerText = "Consultando último registro...";

    try {
        const url = `${SCRIPT_URL}?vehiculo=${encodeURIComponent(valorVehiculo)}&patente=${encodeURIComponent(valorPatente)}`;
        const res = await fetch(url);
        const json = await res.json();

        const tieneDatos = json.status === "success" && json.data && Object.keys(json.data).length > 0;

        let vehiculoRecibido = "";
        let patenteRecibida = "";
        if (tieneDatos) {
            vehiculoRecibido = (json.data.vehiculo || "").toString().trim().toUpperCase();
            patenteRecibida = (json.data.patente || "").toString().trim().toUpperCase();
        }

        const coincide = tieneDatos && (
            (valorVehiculo && vehiculoRecibido === valorVehiculo.toUpperCase()) ||
            (valorPatente && patenteRecibida === valorPatente.toUpperCase())
        );

        if (!coincide) {
            limpiarCamposHistorial();
            return;
        }

        const data = json.data;

        const formatearFecha = (f) => {
            if (!f) return "";
            const str = f.toString().trim();

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

        // Inyectar en inputs e hints del Paso 2
        const kmInput = document.getElementById("kilometraje");
        const combSelect = document.getElementById("combustible");
        const batSelect = document.getElementById("estado_bateria");
        const hintComb = document.getElementById("hint_combustible");
        const hintBat = document.getElementById("hint_estado_bateria");

        if (kmInput) {
            kmInput.value = data.kilometraje || "";
            formatearKmSimple(kmInput);
        }
        if (hintKm) hintKm.innerText = data.kilometraje ? `Anterior: ${data.kilometraje} km` : "Anterior: ---";
        if (combSelect && data.combustible) combSelect.value = data.combustible;
        if (hintComb) hintComb.innerText = data.combustible ? `Anterior: ${data.combustible}` : "Anterior: ---";
        if (batSelect && data.estado_bateria) batSelect.value = data.estado_bateria;
        if (hintBat) hintBat.innerText = data.estado_bateria ? `Anterior: ${data.estado_bateria}` : "Anterior: ---";

        // Inyectar Mantenimiento (Paso 11)
        const batInput = document.getElementById("ult_bateria");
        const hintBatMant = document.getElementById("hint_bateria");
        if (batInput) batInput.value = fBat;
        if (hintBatMant) hintBatMant.innerText = fBat ? `Anterior: ${fBat.split("-").reverse().join("/")}` : "Anterior: ---";

        const lavInput = document.getElementById("ult_lavado");
        const hintLav = document.getElementById("hint_lavado");
        if (lavInput) lavInput.value = fLav;
        if (hintLav) hintLav.innerText = fLav ? `Anterior: ${fLav.split("-").reverse().join("/")}` : "Anterior: ---";

        const servInput = document.getElementById("ult_service");
        const hintServ = document.getElementById("hint_service");
        const kmServInput = document.getElementById("kms_ult_service");
        if (servInput) servInput.value = fServ;
        if (hintServ) hintServ.innerText = fServ ? `Anterior: ${fServ.split("-").reverse().join("/")}` : "Anterior: ---";
        if (kmServInput) {
            kmServInput.value = data.kms_ult_service || "";
            formatearYCalcularKm(kmServInput);
        }

        const alnInput = document.getElementById("ult_alineado");
        const hintAln = document.getElementById("hint_alineado");
        const kmAlnInput = document.getElementById("kms_ult_alineado");
        if (alnInput) {
            alnInput.value = fAln;
            calcularProximoAlineadoFecha(fAln);
        }
        if (hintAln) hintAln.innerText = fAln ? `Anterior: ${fAln.split("-").reverse().join("/")}` : "Anterior: ---";
        if (kmAlnInput) {
            kmAlnInput.value = data.kms_ult_alineado || "";
            formatearYCalcularKmAlineado(kmAlnInput);
        }

        // Radios de Batería y Lavado (SI/NO)
        if (data.bateria_necesita_cambio) {
            const esSi = data.bateria_necesita_cambio.toString().toUpperCase() === "SI";
            const rBatSi = document.getElementById("bat_si");
            const rBatNo = document.getElementById("bat_no");
            if (rBatSi && rBatNo) {
                rBatSi.checked = esSi;
                rBatNo.checked = !esSi;
            }
        }

        if (data.unidad_necesita_lavado) {
            const esSi = data.unidad_necesita_lavado.toString().toUpperCase() === "SI";
            const rLavSi = document.getElementById("lavado_si");
            const rLavNo = document.getElementById("lavado_no");
            if (rLavSi && rLavNo) {
                rLavSi.checked = esSi;
                rLavNo.checked = !esSi;
            }
        }

        // Inyectar Documentación (Paso 10)
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

        // Checklist
        const aplicarCheckItem = (idOk, idRev, idBox, estado, detalle) => {
            const rOk = document.getElementById(idOk);
            const rRev = document.getElementById(idRev);
            const box = document.getElementById(idBox);
            const txt = box ? box.querySelector("textarea") : null;

            if (!rOk || !rRev) return;

            const est = (estado || "").toString().trim().toUpperCase();

            if (est === "REVISAR") {
                rRev.checked = true;
                rOk.checked = false;
                if (typeof toggleObsField === "function") {
                    toggleObsField(idBox, true);
                } else if (box) {
                    box.classList.add("visible");
                }
                if (txt) {
                    txt.value = (detalle && detalle !== "Sin detalle" && detalle !== "N/A") ? detalle : "";
                }
            } else {
                rOk.checked = true;
                rRev.checked = false;
                if (typeof toggleObsField === "function") {
                    toggleObsField(idBox, false);
                } else if (box) {
                    box.classList.remove("visible");
                }
                if (txt) {
                    txt.value = "";
                }
            }
        };

        // Paso 3: Luces
        aplicarCheckItem("bajas_ok", "bajas_rev", "bajas_obs_box", data.luces_bajas_estado, data.luces_bajas_detalle);
        aplicarCheckItem("altas_ok", "altas_rev", "altas_obs_box", data.luces_altas_estado, data.luces_altas_detalle);
        aplicarCheckItem("giros_ok", "giros_rev", "giros_obs_box", data.luces_giros_estado, data.luces_giros_detalle);
        aplicarCheckItem("balizas_ok", "balizas_rev", "balizas_obs_box", data.luces_balizas_estado, data.luces_balizas_detalle);

        // Paso 4: Frenos
        aplicarCheckItem("frenos_ok", "frenos_rev", "frenos_obs_box", data.frenos_servicio_estado, data.frenos_servicio_detalle);
        aplicarCheckItem("freno_mano_ok", "freno_mano_rev", "freno_mano_obs_box", data.freno_mano_estado, data.freno_mano_detalle);

        // Paso 5: Cubiertas
        aplicarCheckItem("cub_di_ok", "cub_di_rev", "cub_di_obs_box", data.cubierta_di_estado, data.cubierta_di_detalle);
        aplicarCheckItem("cub_dd_ok", "cub_dd_rev", "cub_dd_obs_box", data.cubierta_dd_estado, data.cubierta_dd_detalle);
        aplicarCheckItem("cub_ti_ok", "cub_ti_rev", "cub_ti_obs_box", data.cubierta_ti_estado, data.cubierta_ti_detalle);
        aplicarCheckItem("cub_td_ok", "cub_td_rev", "cub_td_obs_box", data.cubierta_td_estado, data.cubierta_td_detalle);

        // Paso 6: Fluidos
        aplicarCheckItem("aceite_ok", "aceite_rev", "aceite_obs_box", data.fluido_aceite_estado, data.fluido_aceite_detalle);
        aplicarCheckItem("agua_ok", "agua_rev", "agua_obs_box", data.fluido_agua_estado, data.fluido_agua_detalle);
        aplicarCheckItem("limpiaparabrisas_ok", "limpiaparabrisas_rev", "limpiaparabrisas_obs_box", data.fluido_limpiaparabrisas_estado, data.fluido_limpiaparabrisas_detalle);

        // Paso 7: Seguridad
        aplicarCheckItem("matafuego_ok", "matafuego_rev", "matafuego_obs_box", data.seguridad_matafuego_estado, data.seguridad_matafuego_detalle);
        aplicarCheckItem("balizas_seg_ok", "balizas_seg_rev", "balizas_seg_obs_box", data.seguridad_balizas_estado, data.seguridad_balizas_detalle);

        // Paso 8: Auxilio
        aplicarCheckItem("gato_ok", "gato_rev", "gato_obs_box", data.auxilio_gato_estado, data.auxilio_gato_detalle);
        aplicarCheckItem("llave_ok", "llave_rev", "llave_obs_box", data.auxilio_llave_estado, data.auxilio_llave_detalle);
        aplicarCheckItem("rueda_aux_ok", "rueda_aux_rev", "rueda_aux_obs_box", data.auxilio_rueda_estado, data.auxilio_rueda_detalle);

        // Paso 9: Limpiaparabrisas
        aplicarCheckItem("esco_del_ok", "esco_del_rev", "esco_del_obs_box", data.escobillas_delanteras_estado, data.escobillas_delanteras_detalle);

        const esPickUp = valorVehiculo.toUpperCase().includes("MONTANA") || valorVehiculo.toUpperCase().includes("HILUX");
        if (!esPickUp) {
            aplicarCheckItem("esco_tras_ok", "esco_tras_rev", "esco_tras_obs_box", data.escobilla_trasera_estado, data.escobilla_trasera_detalle);
        }

        // Paso 10: Documentación
        aplicarCheckItem("doc_ced_ok", "doc_ced_rev", "doc_ced_obs_box", data.doc_cedula_estado, data.doc_cedula_detalle);
        aplicarCheckItem("seguro_ok", "seguro_rev", "seguro_obs_box", data.doc_seguro_estado, data.doc_seguro_detalle);
        aplicarCheckItem("vtv_ok", "vtv_rev", "vtv_obs_box", data.doc_vtv_estado, data.doc_vtv_detalle);

        // Calcular alertas rojas inmediatamente con los datos inyectados
        recalcularTodasLasAlertas();

    } catch (err) {
        console.error("Error al obtener datos previos desde Sheets:", err);
        limpiarCamposHistorial();
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

    guardarMantenimientoActual();
    guardarInspeccionGeneralActual();

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

/* ==============================================================================
   9. GENERACIÓN Y DESCARGA DE REPORTES PDF
   ============================================================================== */

function initReportView() {
    const hoy = new Date().toISOString().split("T")[0];
    const mesActual = hoy.slice(0, 7);
    const inputDia = document.getElementById("filtroFechaDia");
    const inputMes = document.getElementById("filtroFechaMes");
    if (inputDia) inputDia.value = hoy;
    if (inputMes) inputMes.value = mesActual;
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

function seleccionarFechaHoyReporte() {
    const selectFechas = document.getElementById("filtroFechaDia");
    if (!selectFechas) return;

    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    const dd = String(hoy.getDate()).padStart(2, "0");
    const fechaHoyIso = `${yyyy}-${mm}-${dd}`;

    const opcionExistente = Array.from(selectFechas.options).find(opt => opt.value === fechaHoyIso);

    if (opcionExistente) {
        selectFechas.value = fechaHoyIso;
    } else {
        alert("Hoy no se realizaron inspecciones.");
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
                const fechaRaw = r["Fecha y Hora de Inspección"] || r.fecha_hora || r["Fecha y Hora"] || r["Fecha de Carga"] || "";
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
                const fechaRaw = r["Fecha y Hora de Inspección"] || r.fecha_hora || r["Fecha y Hora"] || r["Fecha de Carga"] || "";
                const fechaNormalizada = normalizarFecha(fechaRaw);
                return fechaNormalizada.startsWith(mesBuscado);
            });
        }

        if (vehiculoSeleccionado !== "TODOS") {
            registros = registros.filter(
                (r) => (r["Vehículo"] || r.vehiculo || "").toString().trim() === vehiculoSeleccionado.trim()
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
            const partes = str.split(",")[0].split("/");
            if (partes.length === 3) {
                return `${partes[0].padStart(2, "0")}/${partes[1].padStart(2, "0")}/${partes[2]}`;
            }
            return str;
        };

        const formatearKmReporte = (val) => {
            if (!val) return "-";
            const limpio = val.toString().replace(/\D/g, "");
            if (!limpio) return "-";
            return `${parseInt(limpio, 10).toLocaleString("es-AR")} km`;
        };

        const fItem = (estado, detalle) => {
            if (estado === undefined || estado === null) return "-";
            const estRaw = String(estado).trim();
            if (!estRaw || estRaw === "-" || estRaw === "") return "-";

            const est = estRaw.toUpperCase();
            if (est === "REVISAR") {
                const det = detalle && String(detalle).trim() && String(detalle).trim() !== "N/A"
                    ? String(detalle).trim()
                    : "Sin detalle";
                return `REVISAR: ${det}`;
            }
            if (est === "OK") return "OK";
            if (est === "N/A") return "N/A";
            return estRaw;
        };

        const getProp = (itemObj, ...claves) => {
            for (let c of claves) {
                if (itemObj[c] !== undefined && itemObj[c] !== null && String(itemObj[c]).trim() !== "") {
                    return itemObj[c];
                }
            }
            return "";
        };

        const esPickUpSinLuneta = (veh) => {
            const v = (veh || "").toString().toUpperCase();
            return v.includes("MONTANA") || v.includes("HILUX");
        };

        registros.forEach((item, index) => {
            if (index > 0) doc.addPage();

            // Header Banner
            if (bannerImg) {
                doc.addImage(bannerImg, "PNG", 12, 7, 186, 21);
            }
            doc.setDrawColor(200, 200, 200);
            doc.line(12, 30, 198, 30);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(30, 41, 59);
            doc.text("FICHA DE INSPECCIÓN TÉCNICA VEHICULAR", 12, 35);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(30, 41, 59);
            doc.text(`Fecha y hora: ${formatearFechaHora(getProp(item, "Fecha y Hora de Inspección", "fecha_hora", "Fecha y Hora", "Fecha de Carga"))}`, 12, 39.5);
            doc.text(`Inspector: ${getProp(item, "Inspector", "inspector") || "-"}`, 95, 39.5);
            doc.text(`Unidad: ${index + 1} de ${registros.length}`, 172, 39.5);

            const nombreVehiculoActual = getProp(item, "Vehículo", "vehiculo") || "-";

            // TABLA 1: Resumen de unidad
            doc.autoTable({
                startY: 42,
                margin: { left: 12, right: 12 },
                tableWidth: 186,
                head: [["VEHÍCULO", "PATENTE", "KILOMETRAJE", "COMBUSTIBLE", "BATERÍA"]],
                body: [[
                    nombreVehiculoActual,
                    getProp(item, "Patente", "patente") || "-",
                    formatearKmReporte(getProp(item, "Kilometraje", "kilometraje")),
                    getProp(item, "Combustible", "combustible") || "-",
                    getProp(item, "Batería (Estado)", "estado_bateria", "Batería: Estado") || "-",
                ]],
                theme: "plain",
                headStyles: {
                    fillColor: [30, 41, 59],
                    textColor: [255, 255, 255],
                    fontStyle: "bold",
                    fontSize: 7.2,
                    halign: "center",
                },
                styles: {
                    fontSize: 7.5,
                    halign: "center",
                    fontStyle: "bold",
                    textColor: [30, 41, 59],
                    cellPadding: 1.8,
                },
                tableLineColor: [203, 213, 225],
                tableLineWidth: 0.15,
            });

            const headerSeccion = (texto) => ({
                content: texto,
                colSpan: 2,
                styles: {
                    fillColor: [226, 232, 240], // Gris pizarra suave para destacar sección
                    textColor: [15, 23, 42],
                    fontStyle: "bold",
                    fontSize: 6.8,
                    halign: "left",
                },
            });

            const escobillaTraseraFinal = esPickUpSinLuneta(nombreVehiculoActual)
                ? "N/A"
                : fItem(getProp(item, "Escobilla Trasera", "ESCOBILLA TRASERA: ESTADO"), getProp(item, "Detalle Escobilla Tras.", "ESCOBILLA TRASERA: DETALLE"));

            // TABLA 2: Checklist estructurado en orden estricto de pasos
            const checklistFilas = [
                // -------------------------------------------------------------
                // BLOQUE 1: Paso 3 (Luces) vs Paso 6 (Fluidos) + Paso 7 (Seguridad)
                // -------------------------------------------------------------
                [headerSeccion("INSPECCIÓN DE LUCES"), headerSeccion("INSPECCIÓN DE FLUIDOS")],
                ["Luces Bajas", fItem(getProp(item, "Luces Bajas", "LUCES BAJAS: ESTADO"), getProp(item, "Detalle Luces Bajas", "LUCES BAJAS: DETALLE")), "Nivel de Aceite", fItem(getProp(item, "Aceite", "ACEITE: ESTADO"), getProp(item, "Detalle Aceite", "ACEITE: DETALLE"))],
                ["Luces Altas", fItem(getProp(item, "Luces Altas", "LUCES ALTAS: ESTADO"), getProp(item, "Detalle Luces Altas", "LUCES ALTAS: DETALLE")), "Agua / Refrigerante", fItem(getProp(item, "Agua / Refrigerante", "AGUA / REFRIGERANTE: ESTADO"), getProp(item, "Detalle Agua", "AGUA / REFRIGERANTE: DETALLE"))],
                ["Luces de Giro (Guiños)", fItem(getProp(item, "Giros", "GIROS: ESTADO"), getProp(item, "Detalle Giros", "GIROS: DETALLE")), "Líquido Limpiaparabrisas", fItem(getProp(item, "Limpia Parabrisas (Fluido)", "LIMPIAPARABRISAS: ESTADO"), getProp(item, "Detalle Limpia Parabrisas", "LIMPIAPARABRISAS: DETALLE"))],
                ["Balizas (Emergencia)", fItem(getProp(item, "Balizas", "BALIZAS: ESTADO"), getProp(item, "Detalle Balizas", "BALIZAS: DETALLE")), headerSeccion("ELEMENTOS DE SEGURIDAD"), ""],

                // -------------------------------------------------------------
                // BLOQUE 2: Paso 4 (Frenos) vs Paso 7 (Seguridad cont.) + Paso 8 (Auxilio)
                // -------------------------------------------------------------
                [headerSeccion("INSPECCIÓN DE FRENOS"), "Matafuego Reglam.", fItem(getProp(item, "Matafuego Reglam.", "MATAFUEGO: ESTADO"), getProp(item, "Detalle Matafuego", "MATAFUEGO: DETALLE")), ""],
                ["Frenos de Servicio (Pedal)", fItem(getProp(item, "Frenos Servicio", "FRENO SERVICIO: ESTADO"), getProp(item, "Detalle Frenos", "FRENO SERVICIO: DETALLE")), "Balizas Portátiles", fItem(getProp(item, "Balizas Portátiles", "BALIZAS EMERGENCIA: ESTADO"), getProp(item, "Detalle Balizas Portátiles", "BALIZAS EMERGENCIA: DETALLE"))],
                ["Freno de Mano", fItem(getProp(item, "Freno Mano", "FRENO MANO: ESTADO"), getProp(item, "Detalle Freno Mano", "FRENO MANO: DETALLE")), headerSeccion("ELEMENTOS DE AUXILIO"), ""],
                ["", "", "Gato Hidráulico", fItem(getProp(item, "Gato Hidráulico", "AUXILIO GATO: ESTADO"), getProp(item, "Detalle Gato", "AUXILIO GATO: DETALLE"))],

                // -------------------------------------------------------------
                // BLOQUE 3: Paso 5 (Cubiertas) vs Paso 8 (Auxilio cont.) + Paso 9 (Escobillas)
                // -------------------------------------------------------------
                [headerSeccion("CUBIERTAS (RODADO)"), "Llave Cruz", fItem(getProp(item, "Llave Cruz", "AUXILIO LLAVE: ESTADO"), getProp(item, "Detalle Llave", "AUXILIO LLAVE: DETALLE")), ""],
                ["Cubierta Delantera Izq.", fItem(getProp(item, "Cubierta Del. Izq.", "CUBIERTA DEL. IZQ: ESTADO"), getProp(item, "Detalle Del. Izq.", "CUBIERTA DEL. IZQ: DETALLE")), "Rueda de Auxilio", fItem(getProp(item, "Rueda Auxilio", "AUXILIO RUEDA: ESTADO"), getProp(item, "Detalle Rueda Auxilio", "AUXILIO RUEDA: DETALLE"))],
                ["Cubierta Delantera Der.", fItem(getProp(item, "Cubierta Del. Der.", "CUBIERTA DEL. DER: ESTADO"), getProp(item, "Detalle Del. Der.", "CUBIERTA DEL. DER: DETALLE")), headerSeccion("ESCOBILLAS LIMPIAPARABRISAS"), ""],
                ["Cubierta Trasera Izq.", fItem(getProp(item, "Cubierta Tras. Izq.", "CUBIERTA TRAS. IZQ: ESTADO"), getProp(item, "Detalle Tras. Izq.", "CUBIERTA TRAS. IZQ: DETALLE")), "Escobillas Delanteras", fItem(getProp(item, "Escobillas Delanteras", "ESCOBILLAS DELANTERAS: ESTADO"), getProp(item, "Detalle Escobillas Del.", "ESCOBILLAS DELANTERAS: DETALLE"))],
                ["Cubierta Trasera Der.", fItem(getProp(item, "Cubierta Tras. Der.", "CUBIERTA TRAS. DER: ESTADO"), getProp(item, "Detalle Tras. Der.", "CUBIERTA TRAS. DER: DETALLE")), "Escobilla Trasera", escobillaTraseraFinal]
            ];

            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 2.5,
                margin: { left: 12, right: 12 },
                tableWidth: 186,
                head: [["COMPONENTE / SISTEMA", "ESTADO", "COMPONENTE / SISTEMA", "ESTADO"]],
                body: checklistFilas,
                theme: "plain",
                headStyles: {
                    fillColor: [30, 41, 59],
                    textColor: [255, 255, 255],
                    fontStyle: "bold",
                    fontSize: 6.8,
                },
                styles: { fontSize: 6.5, cellPadding: 1.1, textColor: [30, 41, 59] },
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
                        } else if (val === "N/A") {
                            dataCell.cell.styles.textColor = [100, 116, 139];
                            dataCell.cell.styles.fontStyle = "bold";
                        }
                    }
                },
            });

            // ==============================================================
            // CÁLCULO DE ALERTAS DE DOCUMENTACIÓN Y MANTENIMIENTO
            // ==============================================================
            const fVencSeguroRaw = normalizarFecha(getProp(item, "Seguro Vencimiento", "SEGURO: VENCIMIENTO"));
            let alertaSeguroPdf = "";
            if (fVencSeguroRaw) {
                const resSeg = calcularDiferenciaMesesDias(fVencSeguroRaw);
                if (resSeg) {
                    alertaSeguroPdf = resSeg.esVencido
                        ? `*Vencido hace ${resSeg.textoTiempo}`
                        : (resSeg.textoTiempo === "0 días" || resSeg.textoTiempo === "" ? `*Vence hoy` : `*Quedan ${resSeg.textoTiempo}`);
                }
            }

            const fVencVtvRaw = normalizarFecha(getProp(item, "VTV Vencimiento", "VTV: VENCIMIENTO"));
            let alertaVtvPdf = "";
            if (fVencVtvRaw) {
                const resVtv = calcularDiferenciaMesesDias(fVencVtvRaw);
                if (resVtv) {
                    alertaVtvPdf = resVtv.esVencido
                        ? `*Vencido hace ${resVtv.textoTiempo}`
                        : (resVtv.textoTiempo === "0 días" || resVtv.textoTiempo === "" ? `*Vence hoy` : `*Quedan ${resVtv.textoTiempo}`);
                }
            }

            const kmActualVehiculo = parseInt(String(getProp(item, "Kilometraje", "kilometraje")).replace(/\D/g, ""), 10);
            const kmProxServRaw = parseInt(String(getProp(item, "Kms Próx. Service", "SERVICE: PRÓXIMO KM")).replace(/\D/g, ""), 10);
            let alertaServicePdf = "";
            if (!isNaN(kmActualVehiculo) && !isNaN(kmProxServRaw)) {
                const diffKmServ = kmProxServRaw - kmActualVehiculo;
                if (diffKmServ <= 0) {
                    alertaServicePdf = `*Excedido por ${Math.abs(diffKmServ).toLocaleString("es-AR")} km`;
                } else {
                    alertaServicePdf = `*Faltan ${diffKmServ.toLocaleString("es-AR")} km`;
                }
            }

            const fProxAlnRaw = normalizarFecha(getProp(item, "Próx. Alineado (Fecha)", "ALINEADO: PRÓXIMA FECHA"));
            const kmProxAlnRaw = parseInt(String(getProp(item, "Kms Próx. Alineado", "ALINEADO: PRÓXIMO KM")).replace(/\D/g, ""), 10);
            let alertaAlineadoPdf = "";
            let resAlnFecha = fProxAlnRaw ? calcularDiferenciaMesesDias(fProxAlnRaw) : null;
            let diffKmAln = (!isNaN(kmActualVehiculo) && !isNaN(kmProxAlnRaw)) ? (kmProxAlnRaw - kmActualVehiculo) : null;

            if (resAlnFecha && diffKmAln !== null) {
                if (resAlnFecha.esVencido && diffKmAln <= 0) {
                    alertaAlineadoPdf = `*Vencido (${Math.abs(diffKmAln).toLocaleString("es-AR")} km exc.)`;
                } else if (resAlnFecha.esVencido) {
                    alertaAlineadoPdf = `*Vencido por tiempo`;
                } else if (diffKmAln <= 0) {
                    alertaAlineadoPdf = `*Excedido por ${Math.abs(diffKmAln).toLocaleString("es-AR")} km`;
                } else {
                    alertaAlineadoPdf = `*Faltan ${resAlnFecha.textoTiempo} o ${diffKmAln.toLocaleString("es-AR")} km`;
                }
            } else if (diffKmAln !== null) {
                alertaAlineadoPdf = diffKmAln <= 0 ? `*Excedido por ${Math.abs(diffKmAln).toLocaleString("es-AR")} km` : `*Faltan ${diffKmAln.toLocaleString("es-AR")} km`;
            } else if (resAlnFecha) {
                alertaAlineadoPdf = resAlnFecha.esVencido ? `*Vencido hace ${resAlnFecha.textoTiempo}` : `*Faltan ${resAlnFecha.textoTiempo}`;
            }

            // TABLA 3: DOCUMENTACIÓN OBLIGATORIA
            const fechaSeguroVencFormateada = formatearFechaCorta(getProp(item, "Seguro Vencimiento", "SEGURO: VENCIMIENTO"));
            const celdaVencSeguro = alertaSeguroPdf
                ? `${fechaSeguroVencFormateada}\n${alertaSeguroPdf}`
                : (fechaSeguroVencFormateada || "-");

            const fechaVtvVencFormateada = formatearFechaCorta(getProp(item, "VTV Vencimiento", "VTV: VENCIMIENTO"));
            const celdaVencVtv = alertaVtvPdf
                ? `${fechaVtvVencFormateada}\n${alertaVtvPdf}`
                : (fechaVtvVencFormateada || "-");

            const documentacionData = [
                [
                    "Cédula Vehicular (Verde)",
                    fItem(getProp(item, "Cédula Vehicular", "CÉDULA: ESTADO"), getProp(item, "Detalle Cédula", "CÉDULA: DETALLE")),
                    "-",
                    "-"
                ],
                [
                    "Comprobante de Seguro (Póliza / Tarjeta)",
                    fItem(getProp(item, "Seguro Estado", "SEGURO: ESTADO"), getProp(item, "Detalle Seguro", "SEGURO: DETALLE")),
                    formatearFechaCorta(getProp(item, "Seguro Vigencia Inicio", "SEGURO: INICIO VIGENCIA")) || "-",
                    celdaVencSeguro
                ],
                [
                    "Verificación Técnica Vehicular (VTV / RTO)",
                    fItem(getProp(item, "VTV Estado", "VTV: ESTADO"), getProp(item, "Detalle VTV", "VTV: DETALLE")),
                    formatearFechaCorta(getProp(item, "VTV Inspección", "VTV: FECHA INSPECCIÓN")) || "-",
                    celdaVencVtv
                ]
            ];

            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 3.5,
                margin: { left: 12, right: 12 },
                tableWidth: 186,
                head: [["DOCUMENTACIÓN OBLIGATORIA", "ESTADO", "INICIO / INSPECCIÓN", "VENCIMIENTO / ALERTA"]],
                body: documentacionData,
                theme: "grid",
                headStyles: {
                    fillColor: [30, 41, 59],
                    textColor: [255, 255, 255],
                    fontStyle: "bold",
                    fontSize: 7.2,
                    halign: "center",
                    valign: "middle",
                    cellPadding: 2,
                },
                styles: {
                    fontSize: 7,
                    cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
                    textColor: [30, 41, 59],
                    valign: "middle",
                    lineColor: [226, 232, 240],
                    lineWidth: 0.25,
                },
                columnStyles: {
                    0: { fontStyle: "bold", cellWidth: 58, halign: "left" },
                    1: { cellWidth: 30, halign: "center" },
                    2: { cellWidth: 44, halign: "center" },
                    3: { cellWidth: 54, halign: "center" }
                },
                didParseCell: function (dataCell) {
                    if (dataCell.section === "head" && dataCell.column.index === 0) {
                        dataCell.cell.styles.halign = "left";
                    }

                    if (dataCell.section === "body") {
                        if (dataCell.column.index === 1 && typeof dataCell.cell.raw === "string") {
                            const val = dataCell.cell.raw.trim();
                            if (val.startsWith("REVISAR")) {
                                dataCell.cell.styles.textColor = [185, 28, 28];
                                dataCell.cell.styles.fontStyle = "bold";
                            } else if (val === "OK") {
                                dataCell.cell.styles.textColor = [21, 128, 61];
                                dataCell.cell.styles.fontStyle = "bold";
                            }
                        }

                        // Si tiene salto de línea (fecha + alerta), vaciamos el texto nativo para evitar superposición
                        if (dataCell.column.index === 3 && typeof dataCell.cell.raw === "string" && dataCell.cell.raw.includes("\n")) {
                            dataCell.cell.text = [];
                        }
                    }
                },
                didDrawCell: function (dataCell) {
                    if (dataCell.section === "body" && dataCell.column.index === 3 && typeof dataCell.cell.raw === "string" && dataCell.cell.raw.includes("\n")) {
                        const partes = dataCell.cell.raw.split("\n");
                        const x = dataCell.cell.x + (dataCell.cell.width / 2);
                        const yCentro = dataCell.cell.y + (dataCell.cell.height / 2);

                        // Línea 1: Fecha (texto normal, sin negrita)
                        doc.setFont("helvetica", "normal");
                        doc.setFontSize(6.8);
                        doc.setTextColor(30, 41, 59);
                        doc.text(partes[0].trim(), x, yCentro - 1.2, { align: "center" });

                        // Línea 2: Alerta (rojo y en negrita)
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(6.5);
                        doc.setTextColor(220, 38, 38);
                        doc.text(partes[1].trim(), x, yCentro + 2.4, { align: "center" });
                    }
                }
            });

            // TABLA 4: CONTROL DE MANTENIMIENTO
            const formatearKmPunto = (val) => {
                if (!val) return "";
                const limp = val.toString().replace(/\D/g, "");
                return limp ? ` (${parseInt(limp, 10).toLocaleString("es-AR")} km)` : "";
            };

            const kmUltServ = formatearKmPunto(getProp(item, "Kms Últ. Service", "SERVICE: ÚLTIMO KM"));
            const kmProxServ = formatearKmPunto(getProp(item, "Kms Próx. Service", "SERVICE: PRÓXIMO KM"));
            const kmUltAln = formatearKmPunto(getProp(item, "Kms Últ. Alineado", "ALINEADO: ÚLTIMO KM"));
            const kmProxAln = formatearKmPunto(getProp(item, "Kms Próx. Alineado", "ALINEADO: PRÓXIMO KM"));

            const prefijoAbc = "Fecha y kilometros último: ";

            const fechaUltServ = formatearFechaCorta(getProp(item, "Últ. Service", "SERVICE: ÚLTIMA FECHA"));
            const valorServLimpio = fechaUltServ !== "-" ? `${fechaUltServ}${kmUltServ}` : (kmUltServ ? kmUltServ.trim() : "-");
            const textoUltServ = valorServLimpio !== "-" ? `${prefijoAbc}${valorServLimpio}` : "-";

            const fechaUltAln = formatearFechaCorta(getProp(item, "Últ. Alineado", "ALINEADO: ÚLTIMA FECHA"));
            const valorAlnLimpio = fechaUltAln !== "-" ? `${fechaUltAln}${kmUltAln}` : (kmUltAln ? kmUltAln.trim() : "-");
            const textoUltAln = valorAlnLimpio !== "-" ? `${prefijoAbc}${valorAlnLimpio}` : "-";

            const fechaProxAln = formatearFechaCorta(getProp(item, "Próx. Alineado (Fecha)", "ALINEADO: PRÓXIMA FECHA"));

            const prefijoProx = "Próximo: "; // Altere aqui para o texto que deseja exibir na frente

            // Próximo Service com alerta e prefixo
            let celdaProxServ = kmProxServ ? `${prefijoProx}${kmProxServ}` : "-";
            if (alertaServicePdf) {
                celdaProxServ = `${celdaProxServ}\n${alertaServicePdf}`;
            }

            // Próximo Alineado com alerta e prefixo
            let baseAln = fechaProxAln !== "-"
                ? `${fechaProxAln}${kmProxAln ? " " + kmProxAln.trim() : ""}`
                : (kmProxAln ? kmProxAln.trim() : "-");

            let celdaProxAln = baseAln !== "-" ? `${prefijoProx}${baseAln}` : "-";
            if (alertaAlineadoPdf) {
                celdaProxAln = `${celdaProxAln}\n${alertaAlineadoPdf}`;
            }

            const mantenimientos = [
                [
                    "Control de Batería",
                    (() => {
                        const f = formatearFechaCorta(getProp(item, "Últ. Batería", "BATERÍA: ÚLTIMO CAMBIO"));
                        return (f && f !== "-") ? `Fecha compra: ${f}` : "-";
                    })(),
                    getProp(item, "Batería Necesita Cambio?", "BATERÍA: NECESITA CAMBIO") ? `Necesita cambio: ${getProp(item, "Batería Necesita Cambio?", "BATERÍA: NECESITA CAMBIO")}` : "-"
                ],
                [
                    "Lavado de Unidad",
                    (() => {
                        const f = formatearFechaCorta(getProp(item, "Últ. Lavado", "LAVADO: ÚLTIMA FECHA"));
                        return (f && f !== "-") ? `Fecha ultimo: ${f}` : "-";
                    })(),
                    getProp(item, "Unidad Necesita Lavado?", "LAVADO: NECESITA LAVADO") ? `Necesita lavado: ${getProp(item, "Unidad Necesita Lavado?", "LAVADO: NECESITA LAVADO")}` : "-"
                ],
                [
                    "Service Mecánico",
                    textoUltServ,
                    celdaProxServ
                ],
                [
                    "Alineado y Balanceo",
                    textoUltAln,
                    celdaProxAln
                ]
            ];

            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 3,
                margin: { left: 12, right: 12 },
                tableWidth: 186,
                head: [["CONTROL DE MANTENIMIENTO", "ÚLTIMO REALIZADO", "PRÓXIMO PROGRAMADO / ESTADO"]],
                body: mantenimientos,
                theme: "grid",
                headStyles: {
                    fillColor: [30, 41, 59],
                    textColor: [255, 255, 255],
                    fontStyle: "bold",
                    fontSize: 7.2,
                    halign: "center",
                    valign: "middle",
                    cellPadding: 2,
                },
                styles: {
                    fontSize: 7,
                    cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
                    textColor: [30, 41, 59],
                    valign: "middle",
                    lineColor: [226, 232, 240],
                    lineWidth: 0.25,
                },
                columnStyles: {
                    0: { fontStyle: "bold", cellWidth: 54, halign: "left" },
                    1: { cellWidth: 62, halign: "center" },
                    2: { cellWidth: 70, halign: "center" }
                },
                didParseCell: function (dataCell) {
                    if (dataCell.section === "head" && dataCell.column.index === 0) {
                        dataCell.cell.styles.halign = "left";
                    }

                    // Vaciamos el texto nativo para que solo pinte el bloque en didDrawCell
                    if (dataCell.section === "body" && dataCell.column.index === 2 && typeof dataCell.cell.raw === "string" && dataCell.cell.raw.includes("\n")) {
                        dataCell.cell.text = [];
                    }
                },
                didDrawCell: function (dataCell) {
                    if (dataCell.section === "body" && dataCell.column.index === 2 && typeof dataCell.cell.raw === "string" && dataCell.cell.raw.includes("\n")) {
                        const partes = dataCell.cell.raw.split("\n");
                        const x = dataCell.cell.x + (dataCell.cell.width / 2);
                        const yCentro = dataCell.cell.y + (dataCell.cell.height / 2);

                        // Línea 1: Próximo programado (texto normal, sin negrita)
                        doc.setFont("helvetica", "normal");
                        doc.setFontSize(6.8);
                        doc.setTextColor(30, 41, 59);
                        doc.text(partes[0].trim(), x, yCentro - 1.2, { align: "center" });

                        // Línea 2: Advertencia/Aviso (rojo y en negrita)
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(6.5);
                        doc.setTextColor(220, 38, 38);
                        doc.text(partes[1].trim(), x, yCentro + 2.4, { align: "center" });
                    }
                }
            });

            // TABLA 5: Observaciones Generales
            const yObs = doc.lastAutoTable.finalY + 4;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(30, 41, 59);
            doc.text("Observaciones Generales / Novedades del Vehículo", 12, yObs);

            const obsFinal = getProp(item, "Observaciones Generales", "OBSERVACIONES GENERALES")
                ? String(getProp(item, "Observaciones Generales", "OBSERVACIONES GENERALES")).trim()
                : "Sin observaciones reportadas.";

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(71, 85, 105);
            doc.setDrawColor(203, 213, 225);
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(12, yObs + 1.8, 186, 12, 1, 1, "FD");
            doc.text(obsFinal, 14, yObs + 5.5, { maxWidth: 182 });
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

/* ==============================================================================
   10. LIMPIEZA DE FORMULARIOS Y RESIDUALES
   ============================================================================== */

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

function limpiarCamposHistorial() {
    const kmInput = document.getElementById("kilometraje");
    const combSelect = document.getElementById("combustible");
    const batSelect = document.getElementById("estado_bateria");

    if (kmInput) kmInput.value = "";
    if (combSelect) combSelect.selectedIndex = 0;
    if (batSelect) batSelect.selectedIndex = 0;

    const inputsParaVaciar = [
        "doc_seguro_inicio",
        "doc_seguro_vencimiento",
        "doc_vtv_inspeccion",
        "doc_vtv_vencimiento",
        "ult_bateria",
        "ult_lavado",
        "ult_service",
        "kms_ult_service",
        "kms_prox_service",
        "ult_alineado",
        "prox_alineado_fecha",
        "kms_ult_alineado",
        "kms_prox_alineado"
    ];

    inputsParaVaciar.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    const hintsParaResetear = [
        "hint_kilometraje",
        "hint_combustible",
        "hint_estado_bateria",
        "hint_bateria",
        "hint_lavado",
        "hint_service",
        "hint_alineado",
        "ant_doc_seguro_inicio",
        "ant_doc_seguro_vencimiento",
        "ant_doc_vtv_inspeccion",
        "ant_doc_vtv_vencimiento"
    ];

    hintsParaResetear.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = "Anterior: ---";
    });

    const itemsChecklist = [
        { ok: "bajas_ok", rev: "bajas_rev", box: "bajas_obs_box" },
        { ok: "altas_ok", rev: "altas_rev", box: "altas_obs_box" },
        { ok: "giros_ok", rev: "giros_rev", box: "giros_obs_box" },
        { ok: "balizas_ok", rev: "balizas_rev", box: "balizas_obs_box" },
        { ok: "frenos_ok", rev: "frenos_rev", box: "frenos_obs_box" },
        { ok: "freno_mano_ok", rev: "freno_mano_rev", box: "freno_mano_obs_box" },
        { ok: "cub_di_ok", rev: "cub_di_rev", box: "cub_di_obs_box" },
        { ok: "cub_dd_ok", rev: "cub_dd_rev", box: "cub_dd_obs_box" },
        { ok: "cub_ti_ok", rev: "cub_ti_rev", box: "cub_ti_obs_box" },
        { ok: "cub_td_ok", rev: "cub_td_rev", box: "cub_td_obs_box" },
        { ok: "aceite_ok", rev: "aceite_rev", box: "aceite_obs_box" },
        { ok: "agua_ok", rev: "agua_rev", box: "agua_obs_box" },
        { ok: "limpiaparabrisas_ok", rev: "limpiaparabrisas_rev", box: "limpiaparabrisas_obs_box" },
        { ok: "matafuego_ok", rev: "matafuego_rev", box: "matafuego_obs_box" },
        { ok: "balizas_seg_ok", rev: "balizas_seg_rev", box: "balizas_seg_obs_box" },
        { ok: "gato_ok", rev: "gato_rev", box: "gato_obs_box" },
        { ok: "llave_ok", rev: "llave_rev", box: "llave_obs_box" },
        { ok: "rueda_aux_ok", rev: "rueda_aux_rev", box: "rueda_aux_obs_box" },
        { ok: "esco_del_ok", rev: "esco_del_rev", box: "esco_del_obs_box" },
        { ok: "esco_tras_ok", rev: "esco_tras_rev", box: "esco_tras_obs_box" },
        { ok: "doc_ced_ok", rev: "doc_ced_rev", box: "doc_ced_obs_box" },
        { ok: "seguro_ok", rev: "seguro_rev", box: "seguro_obs_box" },
        { ok: "vtv_ok", rev: "vtv_rev", box: "vtv_obs_box" }
    ];

    itemsChecklist.forEach(item => {
        const rOk = document.getElementById(item.ok);
        const rRev = document.getElementById(item.rev);
        const box = document.getElementById(item.box);

        if (rOk) rOk.checked = true;
        if (rRev) rRev.checked = false;
        if (box) {
            box.classList.remove("visible");
            const txt = box.querySelector("textarea");
            if (txt) txt.value = "";
        }
    });

    const rBatNo = document.getElementById("bat_no");
    if (rBatNo) rBatNo.checked = true;
    const rLavNo = document.getElementById("lavado_no");
    if (rLavNo) rLavNo.checked = true;

    // Limpiar alertas rojas
    ["alerta_venc_seguro", "alerta_venc_vtv", "alerta_prox_service", "alerta_prox_alineado"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = "";
    });
}

function limpiarVistaActual() {
    if (typeof currentStep !== "undefined" && currentStep === 1) {
        limpiarPaso1();
        return;
    }

    const pasoActual = (typeof currentStep !== "undefined"
        ? document.querySelector(`.step[data-step="${currentStep}"]`)
        : null) || document.querySelector('.step.active');

    if (!pasoActual) return;

    pasoActual.querySelectorAll("input:not([readonly]):not([type='radio']):not([type='checkbox']):not([type='hidden'])").forEach(input => {
        input.value = "";
    });

    pasoActual.querySelectorAll("select:not(#quickStepSelector)").forEach(sel => {
        sel.selectedIndex = 0;
    });

    const checkItems = pasoActual.querySelectorAll(".check-item");
    checkItems.forEach(item => {
        const radioOk = item.querySelector("input[type='radio'][value='OK']");
        if (radioOk) radioOk.checked = true;

        const radioRev = item.querySelector("input[type='radio'][value='Revisar']");
        if (radioRev) radioRev.checked = false;

        const textarea = item.querySelector("textarea");
        if (textarea) textarea.value = "";

        const obsBox = item.querySelector(".obs-detail-container");
        if (obsBox) {
            if (typeof toggleObsField === "function" && obsBox.id) {
                toggleObsField(obsBox.id, false);
            } else {
                obsBox.classList.remove("visible");
                obsBox.style.display = "none";
            }
        }
    });

    pasoActual.querySelectorAll("textarea:not(.obs-detail-container textarea)").forEach(ta => {
        ta.value = "";
    });

    if (currentStep === 10 || currentStep === 11) {
        recalcularTodasLasAlertas();
    }
}

function limpiarFiltrosReporte() {
    const selVehiculo = document.getElementById("filtroVehiculo");
    if (selVehiculo) selVehiculo.value = "TODOS";

    const selDia = document.getElementById("filtroFechaDia");
    if (selDia) selDia.selectedIndex = 0;

    const inMes = document.getElementById("filtroFechaMes");
    if (inMes) inMes.value = "";
}

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
        btn.innerText = "Finalizar Inspección";
    }
}

/* ==============================================================================
   11. INICIALIZACIÓN Y EVENT LISTENERS GLOBALES
   ============================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    setFechaHoraActual();
    initReportView();

    const selectorVehiculo =
        document.querySelector("[name='vehiculo']") ||
        document.getElementById("selectVehiculo") ||
        document.getElementById("vehiculo");

    if (selectorVehiculo) {
        selectorVehiculo.addEventListener("change", () => {
            // 1. Limpieza total inmediata
            limpiarCamposHistorial();

            // 2. Autocompletar patente
            autocompletarPatente();

            // 3. Verificar elementos especiales (Montana / Hilux)
            verificarElementosPorVehiculo();

            // 4. Consultar a Sheets (que a su vez guarda localmente y calcula las alertas al recibir datos)
            cargarUltimosDatosDesdeSheets();
        });
    }

    // Escucha cambios manuales en documentación para persistir y recalcular alertas
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
                recalcularTodasLasAlertas();
            });
        }
    });

    const inputUltService = document.getElementById("ult_service");
    if (inputUltService) {
        inputUltService.addEventListener("change", () => {
            actualizarAlertaService();
        });
    }
});
