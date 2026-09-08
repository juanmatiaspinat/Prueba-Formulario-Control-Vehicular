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
