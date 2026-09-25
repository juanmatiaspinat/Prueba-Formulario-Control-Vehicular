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

// URL del Web App de Google Apps Script
const SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbwoK_DKWL6-1W3cY207i8rsG79flYGsusOaHtczS1djHXbhmLrCCmsDoqsi2kQcDV5Eng/exec";

// Configuración del flujo de inspección
const totalSteps = 12;
let currentStep = 1;
let tipoReporteActual = "dia";

// Diccionario de patentes asociadas por vehículo
const patentes = {
    "Renault - Duster": "AB299UW",
    "Chevrolet - Montana": "LDU005",
    "Ford - Ecosport": "OQF461",
    "Toyota - Hilux": "AC381EC",
};

/* ==============================================================================
   2. NAVEGACIÓN ENTRE VISTAS PRINCIPALES (HOME, FORM, REPORTES)
   ============================================================================== */

/**
 * Muestra el contenedor del formulario y oculta las demás vistas.
 */
function mostrarFormulario() {
    const home = document.getElementById("homeView");
    const report = document.getElementById("reportContainerView");
    const form = document.getElementById("formContainerView");

    if (home) home.style.display = "none";
    if (report) report.style.display = "none";
    if (form) form.style.display = "block";

    updateProgress();
}

/**
 * Muestra la vista de reportes e inicia la carga de inspecciones registradas.
 */
async function mostrarReportes() {
    const home = document.getElementById("homeView");
    const form = document.getElementById("formContainerView");
    const report = document.getElementById("reportContainerView");

    if (home) home.style.display = "none";
    if (form) form.style.display = "none";
    if (report) report.style.display = "block";

    await cargarFechasDisponiblesReporte();
}

/**
 * Regresa a la pantalla principal del panel de control.
 */
function volverAlMenu() {
    const home = document.getElementById("homeView");
    const form = document.getElementById("formContainerView");
    const report = document.getElementById("reportContainerView");

    if (home) home.style.display = "block";
    if (form) form.style.display = "none";
    if (report) report.style.display = "none";
}

/**
 * Cierra la pantalla de confirmación (feedback) y regresa al menú.
 */
function volverAlMenuDesdeFeedback() {
    const feedback = document.getElementById("feedbackMsg");
    if (feedback) feedback.style.display = "none";
    resetForm();
    volverAlMenu();
}

/* ==============================================================================
   3. CONTROL DE PASOS (STEP WIZARD) Y BARRA DE PROGRESO
   ============================================================================== */

/**
 * Actualiza la barra superior de porcentaje y sincroniza el selector rápido.
 */
function updateProgress() {
    const total = document.querySelectorAll(".step").length || totalSteps;
    const progress = (currentStep / total) * 100;
    const bar = document.getElementById("progressBar");
    if (bar) bar.style.width = `${progress}%`;

    const selector = document.getElementById("quickStepSelector");
    if (selector) selector.value = currentStep;
}

/**
 * Avanza al paso siguiente previa validación de campos obligatorios visibles.
 */
function nextStep(step) {
    const currentContainer = document.querySelector(`.step[data-step="${step}"]`);
    if (currentContainer) {
        const inputs = currentContainer.querySelectorAll("input, select, textarea");
        for (let input of inputs) {
            // Se ignoran elementos deshabilitados o no visibles en el DOM
            if (input.disabled || input.offsetParent === null) continue;

            const valor = (input.value !== undefined && input.value !== null) ? String(input.value).trim() : "";

            if (input.hasAttribute("required") && !valor) {
                input.focus();
                input.style.outline = "2px solid #ef4444";

                // Se remueve la advertencia visual apenas el usuario interactúa
                input.addEventListener("input", () => { input.style.outline = ""; }, { once: true });
                input.addEventListener("change", () => { input.style.outline = ""; }, { once: true });

                const labelText = input.closest(".input-group")?.querySelector("label")?.innerText || input.name || "campo obligatorio";
                alert(`Por favor completá: ${labelText}`);
                return;
            }
        }

        // Resguardo de datos en pasos críticos antes de avanzar
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
                try {
                    precargarMantenimientoPrevio();
                } catch (err) {
                    console.error("Error al precargar datos:", err);
                }
            }, 50);
        }
    }
}

/**
 * Retrocede al paso anterior guardando cambios parciales.
 */
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
    }
}

/**
 * Permite la navegación directa entre pasos desde el menú desplegable.
 */
function irAlPasoDirecto(nuevoPaso) {
    if (nuevoPaso === currentStep) return;

    // Bloquea el salto si el paso 1 no tiene los datos primarios obligatorios
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
                try { precargarMantenimientoPrevio(); } catch (e) { }
            }, 50);
        }
    }
}

/* ==============================================================================
   4. GESTIÓN Y NORMALIZACIÓN DE FECHAS / TIEMPO
   ============================================================================== */

/**
 * Establece la fecha y hora actual en el input datetime-local del Paso 1.
 */
function setFechaHoraActual() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const el = document.getElementById("fechaHora");
    if (el) el.value = now.toISOString().slice(0, 16);
}

/**
 * Asigna la fecha actual en formato YYYY-MM-DD a un input de tipo fecha.
 */
function setFechaHoy(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.value = new Date().toISOString().split("T")[0];
}

/**
 * Asigna la fecha de hoy al campo del filtro de reporte diario.
 */
function setFechaHoyFiltro() {
    const inputDia = document.getElementById("filtroFechaDia");
    if (inputDia) inputDia.value = new Date().toISOString().split("T")[0];
}

/**
 * Convierte cualquier formato de fecha a estándar ISO (YYYY-MM-DD).
 */
function normalizarFecha(val) {
    if (!val) return "";
    const str = val.toString().trim();

    // Formato ISO: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        return str.slice(0, 10);
    }

    // Formato DD/MM/YYYY o D/M/YYYY
    const partes = str.split(",")[0].split("/");
    if (partes.length === 3) {
        const dia = partes[0].padStart(2, "0");
        const mes = partes[1].padStart(2, "0");
        const anio = partes[2].length === 2 ? `20${partes[2]}` : partes[2];
        return `${anio}-${mes}-${dia}`;
    }

    // Parseo nativo alternativo
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }

    return "";
}

/**
 * Formatea una fecha cruda asegurando compatibilidad con inputs date.
 */
function formatearFechaParaInput(fechaRaw) {
    if (!fechaRaw) return "";
    const d = new Date(fechaRaw);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
}

/**
 * Suma una cantidad determinada de meses a una fecha origen y escribe en destino.
 */
function sumarMeses(origenId, destinoId, meses) {
    const origen = document.getElementById(origenId);
    const destino = document.getElementById(destinoId);
    if (!origen || !destino) return;

    const baseVal = origen.value;
    const fechaBase = baseVal ? new Date(baseVal) : new Date();
    fechaBase.setMonth(fechaBase.getMonth() + meses);
    destino.value = fechaBase.toISOString().split("T")[0];
}

/**
 * Suma una cantidad determinada de días a una fecha origen y escribe en destino.
 */
function sumarDias(origenId, destinoId, dias) {
    const origen = document.getElementById(origenId);
    const destino = document.getElementById(destinoId);
    if (!origen || !destino) return;

    const baseVal = origen.value;
    const fechaBase = baseVal ? new Date(baseVal) : new Date();
    fechaBase.setDate(fechaBase.getDate() + dias);
    destino.value = fechaBase.toISOString().split("T")[0];
}

/* ==============================================================================
   5. CÁLCULOS DINÁMICOS Y FORMATEO DE KILOMETRAJES
   ============================================================================== */

/**
 * Aplica formato con separador de miles en tiempo real.
 */
function formatearKmSimple(input) {
    if (!input) return;
    const valorLimpio = input.value.replace(/\D/g, "");
    if (!valorLimpio) {
        input.value = "";
        return;
    }
    input.value = parseInt(valorLimpio, 10).toLocaleString("es-AR");
}

/**
 * Formatea kilómetros de Service Mecánico y proyecta automáticamente +10.000 km.
 */
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

/**
 * Formatea kilómetros de Alineado y proyecta automáticamente +10.000 km.
 */
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

/**
 * Calcula la fecha sugerida para el próximo alineado (+6 meses).
 */
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

/**
 * Asigna la fecha de hoy para el alineado y calcula los 6 meses posteriores.
 */
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

/**
 * Muestra u oculta la caja de observaciones según la selección (OK o Revisar).
 */
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

/**
 * Ajusta ítems especiales del checklist según el modelo (ej. luneta trasera en pick-ups).
 */
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

        // Pick-ups o vehículos sin limpia luneta trasera
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

/**
 * Autocompleta la patente según el vehículo seleccionado en el Paso 1.
 */
function autocompletarPatente() {
    const select = document.getElementById("selectVehiculo");
    const inputPatente = document.getElementById("inputPatente");
    if (!select || !inputPatente) return;
    inputPatente.value = patentes[select.value] || "";
}

/* ==============================================================================
   7. PERSISTENCIA LOCAL (LOCALSTORAGE) Y PRECARGA DE HISTORIAL
   ============================================================================== */

/**
 * Obtiene la clave única normalizada del vehículo actual para almacenamiento.
 */
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

/**
 * Guarda en localStorage las fechas de Mantenimiento y Documentación editadas.
 */
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

/**
 * Guarda en localStorage los datos operativos de Inspección General (Paso 2).
 */
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

/**
 * Precarga en los inputs del Paso 2 los datos persistidos localmente.
 */
function precargarInspeccionGeneralPrevio() {
    const vehiculoId = getVehiculoIdActual();
    const kmInput = document.getElementById("kilometraje");
    const hintKm = document.getElementById("hint_kilometraje");
    const combSelect = document.getElementById("combustible");
    const hintComb = document.getElementById("hint_combustible");
    const batSelect = document.getElementById("estado_bateria");
    const hintBat = document.getElementById("hint_estado_bateria");

    if (vehiculoId === "SIN_VEHICULO") {
        if (hintKm) hintKm.innerText = "Anterior: ---";
        if (hintComb) hintComb.innerText = "Anterior: ---";
        if (hintBat) hintBat.innerText = "Anterior: ---";
        return;
    }

    const rawData = localStorage.getItem(`inspeccion_general_${vehiculoId}`);
    if (rawData) {
        try {
            const data = JSON.parse(rawData);
            if (kmInput && data.kilometraje) {
                kmInput.value = data.kilometraje;
                if (typeof formatearKmSimple === "function") formatearKmSimple(kmInput);
            }
            if (hintKm) hintKm.innerText = data.kilometraje ? `Anterior: ${data.kilometraje} km` : "Anterior: ---";
            if (combSelect && data.combustible) combSelect.value = data.combustible;
            if (hintComb) hintComb.innerText = data.combustible ? `Anterior: ${data.combustible}` : "Anterior: ---";
            if (batSelect && data.estado_bateria) batSelect.value = data.estado_bateria;
            if (hintBat) hintBat.innerText = data.estado_bateria ? `Anterior: ${data.estado_bateria}` : "Anterior: ---";
        } catch (err) {
            console.error("Error al parsear datos de inspección general:", err);
            if (hintKm) hintKm.innerText = "Anterior: ---";
            if (hintComb) hintComb.innerText = "Anterior: ---";
            if (hintBat) hintBat.innerText = "Anterior: ---";
        }
    } else {
        if (hintKm) hintKm.innerText = "Anterior: ---";
        if (hintComb) hintComb.innerText = "Anterior: ---";
        if (hintBat) hintBat.innerText = "Anterior: ---";
    }
}

/**
 * Precarga en Documentación y Mantenimiento los datos persistidos localmente.
 */
/**
 * Precarga en Documentación y Mantenimiento los datos persistidos localmente
 * o restablece todo a "Anterior: ---" si el vehículo no tiene historial.
 */
function precargarMantenimientoPrevio() {
    const vehiculoId = getVehiculoIdActual();

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

    // Función auxiliar para resetear esta vista específica
    const resetearVistaMantenimiento = () => {
        if (batInput) batInput.value = "";
        if (hintBat) hintBat.innerText = "Anterior: ---";

        if (lavInput) lavInput.value = "";
        if (hintLav) hintLav.innerText = "Anterior: ---";

        if (servInput) servInput.value = "";
        if (hintServ) hintServ.innerText = "Anterior: ---";
        if (kmServInput) kmServInput.value = "";
        if (kmProxServ) kmProxServ.value = "";

        if (alnInput) alnInput.value = "";
        if (hintAln) hintAln.innerText = "Anterior: ---";
        if (kmAlnInput) kmAlnInput.value = "";
        if (kmProxAln) kmProxAln.value = "";

        if (segInicioInput) segInicioInput.value = "";
        if (hintSegInicio) hintSegInicio.innerText = "Anterior: ---";
        if (segVencInput) segVencInput.value = "";
        if (hintSegVenc) hintSegVenc.innerText = "Anterior: ---";

        if (vtvInspInput) vtvInspInput.value = "";
        if (hintVtvInsp) hintVtvInsp.innerText = "Anterior: ---";
        if (vtvVencInput) vtvVencInput.value = "";
        if (hintVtvVenc) hintVtvVenc.innerText = "Anterior: ---";
    };

    if (vehiculoId === "SIN_VEHICULO") {
        resetearVistaMantenimiento();
        return;
    }

    const rawData = localStorage.getItem(`mantenimiento_${vehiculoId}`);

    if (rawData) {
        try {
            const data = JSON.parse(rawData);

            // Batería
            if (batInput) batInput.value = data.fecha_ult_bateria || "";
            if (hintBat) {
                hintBat.innerText = (data.fecha_ult_bateria && data.fecha_ult_bateria.includes("-"))
                    ? `Anterior: ${data.fecha_ult_bateria.split("-").reverse().join("/")}`
                    : "Anterior: ---";
            }

            // Lavado
            if (lavInput) lavInput.value = data.fecha_ult_lavado || "";
            if (hintLav) {
                hintLav.innerText = (data.fecha_ult_lavado && data.fecha_ult_lavado.includes("-"))
                    ? `Anterior: ${data.fecha_ult_lavado.split("-").reverse().join("/")}`
                    : "Anterior: ---";
            }

            // Service
            if (servInput) servInput.value = data.fecha_ult_service || "";
            if (hintServ) {
                hintServ.innerText = (data.fecha_ult_service && data.fecha_ult_service.includes("-"))
                    ? `Anterior: ${data.fecha_ult_service.split("-").reverse().join("/")}`
                    : "Anterior: ---";
            }
            if (kmServInput) {
                kmServInput.value = data.kms_ult_service || "";
                if (typeof formatearYCalcularKm === "function") formatearYCalcularKm(kmServInput);
            }

            // Alineado
            if (alnInput) {
                alnInput.value = data.fecha_ult_alineado || "";
                if (typeof calcularProximoAlineadoFecha === "function" && data.fecha_ult_alineado) {
                    calcularProximoAlineadoFecha(data.fecha_ult_alineado);
                } else {
                    const proxAln = document.getElementById("prox_alineado_fecha");
                    if (proxAln) proxAln.value = "";
                }
            }
            if (hintAln) {
                hintAln.innerText = (data.fecha_ult_alineado && data.fecha_ult_alineado.includes("-"))
                    ? `Anterior: ${data.fecha_ult_alineado.split("-").reverse().join("/")}`
                    : "Anterior: ---";
            }
            if (kmAlnInput) {
                kmAlnInput.value = data.kms_ult_alineado || "";
                if (typeof formatearYCalcularKmAlineado === "function") formatearYCalcularKmAlineado(kmAlnInput);
            }

            // Documentación (Seguro y VTV)
            if (segInicioInput) segInicioInput.value = data.doc_seguro_inicio || "";
            if (hintSegInicio) {
                hintSegInicio.innerText = (data.doc_seguro_inicio && data.doc_seguro_inicio.includes("-"))
                    ? `Anterior: ${data.doc_seguro_inicio.split("-").reverse().join("/")}`
                    : "Anterior: ---";
            }

            if (segVencInput) segVencInput.value = data.doc_seguro_vencimiento || "";
            if (hintSegVenc) {
                hintSegVenc.innerText = (data.doc_seguro_vencimiento && data.doc_seguro_vencimiento.includes("-"))
                    ? `Anterior: ${data.doc_seguro_vencimiento.split("-").reverse().join("/")}`
                    : "Anterior: ---";
            }

            if (vtvInspInput) vtvInspInput.value = data.doc_vtv_inspeccion || "";
            if (hintVtvInsp) {
                hintVtvInsp.innerText = (data.doc_vtv_inspeccion && data.doc_vtv_inspeccion.includes("-"))
                    ? `Anterior: ${data.doc_vtv_inspeccion.split("-").reverse().join("/")}`
                    : "Anterior: ---";
            }

            if (vtvVencInput) vtvVencInput.value = data.doc_vtv_vencimiento || "";
            if (hintVtvVenc) {
                hintVtvVenc.innerText = (data.doc_vtv_vencimiento && data.doc_vtv_vencimiento.includes("-"))
                    ? `Anterior: ${data.doc_vtv_vencimiento.split("-").reverse().join("/")}`
                    : "Anterior: ---";
            }
        } catch (e) {
            console.error("Error al parsear datos de mantenimiento:", e);
            resetearVistaMantenimiento();
        }
    } else {
        // Si no hay datos para ese vehículo en localStorage, vaciar inputs y setear 'Anterior: ---'
        resetearVistaMantenimiento();
    }
}

/* ==============================================================================
   8. COMUNICACIÓN CON GOOGLE APPS SCRIPT (ENVÍO Y CONSULTA)
   ============================================================================== */

/**
 * Consulta la última fila registrada del vehículo y actualiza inputs e hints.
 */
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

    // 1. Limpieza total inmediata antes de consultar
    limpiarCamposHistorial();

    if (!valorVehiculo && !valorPatente) return;

    const hintKm = document.getElementById("hint_kilometraje");
    if (hintKm) hintKm.innerText = "Consultando último registro...";

    try {
        const url = `${SCRIPT_URL}?vehiculo=${encodeURIComponent(valorVehiculo)}&patente=${encodeURIComponent(valorPatente)}`;
        const res = await fetch(url);
        const json = await res.json();

        // 2. Validación estricta: debe tener respuesta exitosa, datos reales y pertenecer a este vehículo
        const tieneDatosValidos = json.status === "success" && json.data && Object.keys(json.data).length > 0;

        let coincideVehiculo = true;
        if (tieneDatosValidos && json.data.vehiculo) {
            coincideVehiculo = json.data.vehiculo.toString().trim().toUpperCase() === valorVehiculo.toUpperCase();
        }

        if (tieneDatosValidos && coincideVehiculo) {
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

            // Guardar datos en localStorage
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

            // Inyectar en inputs e hints
            const kmInput = document.getElementById("kilometraje");
            const combSelect = document.getElementById("combustible");
            const batSelect = document.getElementById("estado_bateria");
            const hintComb = document.getElementById("hint_combustible");
            const hintBat = document.getElementById("hint_estado_bateria");

            if (kmInput) {
                kmInput.value = data.kilometraje || "";
                if (typeof formatearKmSimple === "function") formatearKmSimple(kmInput);
            }
            if (hintKm) hintKm.innerText = data.kilometraje ? `Anterior: ${data.kilometraje} km` : "Anterior: ---";
            if (combSelect && data.combustible) combSelect.value = data.combustible;
            if (hintComb) hintComb.innerText = data.combustible ? `Anterior: ${data.combustible}` : "Anterior: ---";
            if (batSelect && data.estado_bateria) batSelect.value = data.estado_bateria;
            if (hintBat) hintBat.innerText = data.estado_bateria ? `Anterior: ${data.estado_bateria}` : "Anterior: ---";

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
                if (typeof formatearYCalcularKm === "function") formatearYCalcularKm(kmServInput);
            }

            const alnInput = document.getElementById("ult_alineado");
            const hintAln = document.getElementById("hint_alineado");
            const kmAlnInput = document.getElementById("kms_ult_alineado");
            if (alnInput) {
                alnInput.value = fAln;
                if (typeof calcularProximoAlineadoFecha === "function") calcularProximoAlineadoFecha(fAln);
            }
            if (hintAln) hintAln.innerText = fAln ? `Anterior: ${fAln.split("-").reverse().join("/")}` : "Anterior: ---";
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
            // Si la unidad no tiene inspecciones previas registradas
            limpiarCamposHistorial();
        }
    } catch (err) {
        console.error("Error al obtener datos previos desde Sheets:", err);
        limpiarCamposHistorial();
    }
}

/**
 * Manejador del envío final del formulario al Web App de Google.
 */
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

    // Extracción de datos
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

    // Guardado en localStorage previo al POST
    guardarMantenimientoActual();
    guardarInspeccionGeneralActual();

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

/* ==============================================================================
   9. GENERACIÓN Y DESCARGA DE REPORTES PDF
   ============================================================================== */

/**
 * Inicializa valores por defecto (hoy y mes actual) en los campos de filtro.
 */
function initReportView() {
    const hoy = new Date().toISOString().split("T")[0];
    const mesActual = hoy.slice(0, 7);
    const inputDia = document.getElementById("filtroFechaDia");
    const inputMes = document.getElementById("filtroFechaMes");
    if (inputDia) inputDia.value = hoy;
    if (inputMes) inputMes.value = mesActual;
}

/**
 * Conmuta entre la vista de reporte por Día y por Mes.
 */
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

/**
 * Helper promisificado para cargar recursos de imagen antes de inyectar al PDF.
 */
function cargarImagen(ruta) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = ruta;
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("No se pudo cargar la imagen: " + ruta));
    });
}

/**
 * Consulta a la planilla las fechas de inspecciones disponibles para el dropdown.
 */
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

/**
 * Descarga y filtra los registros seleccionados generando un PDF con jsPDF y AutoTable.
 */
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

        // Filtrado por fecha diaria o mensual
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

        // Filtrado por vehículo
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

            // Tabla 1: Resumen de unidad
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

            // Tabla 2: Checklist en dos columnas simétricas
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

            // Tabla 3: Fechas de mantenimiento
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

            // Bloque 4: Observaciones finales
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

/* ==============================================================================
   10. LIMPIEZA DE FORMULARIOS Y RESIDUALES
   ============================================================================== */

/**
 * Limpia los inputs del Paso 1 (Inspector y Vehículo).
 */
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

/**
 * Limpia inputs de fechas vinculados a documentación legal.
 */
function limpiarCamposHistorial() {
    // 1. Limpiar inputs operativos (Paso 2)
    const kmInput = document.getElementById("kilometraje");
    const combSelect = document.getElementById("combustible");
    const batSelect = document.getElementById("estado_bateria");

    if (kmInput) kmInput.value = "";
    if (combSelect) combSelect.selectedIndex = 0;
    if (batSelect) batSelect.selectedIndex = 0;

    // 2. Limpiar inputs de Documentación y Mantenimiento
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

    // 3. Dejar todas las leyendas de referencia celestes en "Anterior: ---"
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
}

/**
 * Limpia la vista activa actual en el flujo de inspección.
 * Deja los checklists en OK, vacía y oculta los detalles de observaciones,
 * sin alterar leyendas de registros anteriores.
 */
function limpiarVistaActual() {
    if (typeof currentStep !== "undefined" && currentStep === 1) {
        limpiarPaso1();
        return;
    }

    const pasoActual = (typeof currentStep !== "undefined"
        ? document.querySelector(`.step[data-step="${currentStep}"]`)
        : null) || document.querySelector('.step.active');

    if (!pasoActual) return;

    // 1. Limpiar inputs comunes (textos, números, fechas)
    pasoActual.querySelectorAll("input:not([readonly]):not([type='radio']):not([type='checkbox']):not([type='hidden'])").forEach(input => {
        input.value = "";
    });

    // 2. Resetear selectores de la vista (combustible, batería, etc.)
    pasoActual.querySelectorAll("select:not(#quickStepSelector)").forEach(sel => {
        sel.selectedIndex = 0;
    });

    // 3. Resetear check-items de inspección a "OK" y cerrar observaciones
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

    // 4. Limpiar cualquier textarea fuera de un checklist (ej. Paso 12)
    pasoActual.querySelectorAll("textarea:not(.obs-detail-container textarea)").forEach(ta => {
        ta.value = "";
    });
}

/**
 * Restablece los filtros del reporte conservando la solapa activa (Por Día o Por Mes).
 */
function limpiarFiltrosReporte() {
    const selVehiculo = document.getElementById("filtroVehiculo");
    if (selVehiculo) selVehiculo.value = "TODOS";

    const selDia = document.getElementById("filtroFechaDia");
    if (selDia) selDia.selectedIndex = 0;

    const inMes = document.getElementById("filtroFechaMes");
    if (inMes) inMes.value = "";
}

/**
 * Limpia campos de Mantenimiento Programado.
 */
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

/**
 * Limpia la totalidad del formulario general y regresa al Paso 1.
 */
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

/**
 * Restablece los valores y dispara clics en OK simulando acción de usuario.
 */
function resetearValoresVista(btn) {
    const pasoActual = btn ? btn.closest(".step") : document.querySelector(".step.active");
    if (!pasoActual) return;

    pasoActual.querySelectorAll("textarea").forEach(txt => {
        txt.value = "";
        txt.dispatchEvent(new Event("input"));
    });

    const radioNames = new Set();
    pasoActual.querySelectorAll("input[type='radio']").forEach(r => radioNames.add(r.name));

    radioNames.forEach(name => {
        const radioOk = pasoActual.querySelector(`input[type='radio'][name='${name}'][value='OK']`);
        if (radioOk) {
            radioOk.click();
        }
    });

    pasoActual.querySelectorAll("input:not([type='radio']):not([type='checkbox']):not([type='hidden']):not([readonly])").forEach(inp => {
        inp.value = "";
        inp.dispatchEvent(new Event("input"));
    });

    pasoActual.querySelectorAll("input[type='checkbox']").forEach(chk => {
        chk.checked = false;
        chk.dispatchEvent(new Event("change"));
    });

    pasoActual.querySelectorAll("select").forEach(sel => {
        sel.selectedIndex = 0;
        sel.dispatchEvent(new Event("change"));
    });

    pasoActual.querySelectorAll("[id^='hint_'], [id^='ant_']").forEach(h => {
        h.innerText = "";
    });
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
            // 1. Limpieza total inmediata de cualquier dato previo en pantalla
            limpiarCamposHistorial();

            // 2. Autocompletar la patente de la unidad seleccionada
            autocompletarPatente();

            // 3. Verificar elementos especiales (Montana / Hilux)
            if (typeof verificarElementosPorVehiculo === "function") {
                verificarElementosPorVehiculo();
            }

            // 4. Intentar precargar sólo si esta unidad tiene datos guardados
            precargarMantenimientoPrevio();
            precargarInspeccionGeneralPrevio();

            // 5. Consultar a Sheets por registros históricos remotos
            cargarUltimosDatosDesdeSheets();
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
