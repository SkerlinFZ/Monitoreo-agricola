
 // ===============================
 // ACCESO SIMPLE
 // ===============================
const clave = prompt("Ingrese clave de acceso");

if (clave !== "Roman Valverde") {
  document.body.innerHTML = `
    <div style="display:grid;place-items:center;height:100vh;background:#080c0f;font-family:sans-serif;">
      <div style="text-align:center;">
        <div style="font-size:48px;margin-bottom:16px;">⛔</div>
        <h1 style="color:#f87171;font-size:22px;">Acceso Denegado</h1>
        <p style="color:#4a6070;font-size:14px;">Clave incorrecta</p>
      </div>
    </div>
  `;

  throw new Error("Bloqueado");
}

// ===============================
// FIREBASE
// ===============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  updateDoc,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAwBH1jsZQWI2E5N2FcvNZXSoIwa3TwtpA",
  authDomain: "monitoreo-agricola-3394b.firebaseapp.com",
  projectId: "monitoreo-agricola-3394b",
  storageBucket: "monitoreo-agricola-3394b.firebasestorage.app",
  messagingSenderId: "373892428043",
  appId: "1:373892428043:web:164917410ed916722b320e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===============================
// FECHA ACTUAL AUTOMÁTICA
// ===============================
function obtenerFechaLocal() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
}

function establecerFechaActual() {
  const campoFecha = document.getElementById("fecha");

  if (campoFecha && !campoFecha.value) {
    campoFecha.value = obtenerFechaLocal();
  }
}

// Cargar la fecha inicial.
establecerFechaActual();

// ===============================
// MANEJO DE ERRORES
// ===============================
function mostrarError(error) {
  console.error(error);

  showToast(
    "Ocurrió un error. Revisá tu conexión e intentá de nuevo.",
    "error"
  );
}

// ===============================
// RESUMEN
// ===============================
async function actualizarResumen() {
  const totalEl = document.getElementById("totalEquipos");
  const cuarentenaEl = document.getElementById("equiposCuarentena");
  const urgenteEl = document.getElementById("mantenimientoUrgente");

  if (!totalEl || !cuarentenaEl || !urgenteEl) return;

  const snap = await getDocs(collection(db, "equipos"));

  let total = 0;
  let cuarentena = 0;
  let urgente = 0;

  snap.forEach(d => {
    const data = d.data();

    total++;

    if ((data.estado || "").toLowerCase() === "cuarentena") {
      cuarentena++;
    }

    if (
      Number(data.limiteMantenimiento) -
      Number(data.horasTotales) <= 0
    ) {
      urgente++;
    }
  });

  totalEl.textContent = total;
  cuarentenaEl.textContent = cuarentena;
  urgenteEl.textContent = urgente;
}

// ===============================
// CREAR EQUIPO
// ===============================
window.crearEquipoUI = async () => {
  try {
    const nombre = document.getElementById("nombreEquipo").value.trim();
    const limite = Number(document.getElementById("limiteEquipo").value);

    if (!nombre || !Number.isFinite(limite) || limite < 10) {
      showToast(
        "Ingresá el nombre y un límite de al menos 10 horas.",
        "error"
      );
      return;
    }

    await addDoc(collection(db, "equipos"), {
      nombre,
      estado: "Activo",
      horasTotales: 0,
      limiteMantenimiento: limite
    });

    document.getElementById("nombreEquipo").value = "";
    document.getElementById("limiteEquipo").value = "";

    showToast(`Equipo "${nombre}" creado exitosamente`);

    await refrescarUI();
  } catch (error) {
    mostrarError(error);
  }
};

// ===============================
// REGISTRAR HORAS
// ===============================
window.registrarHorasUI = async () => {
  try {
    const equipoId = document.getElementById("equipoSelect").value;
    const campoFecha = document.getElementById("fecha");
    const fecha = campoFecha.value;
    const horas = Number(document.getElementById("horas").value);

    if (!equipoId || !fecha || !Number.isFinite(horas) || horas <= 0) {
      showToast(
        "Seleccioná un equipo, una fecha y horas válidas.",
        "error"
      );
      return;
    }

    // Verificar que la fecha tenga el formato esperado.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      showToast("La fecha seleccionada no es válida.", "error");
      return;
    }

    // Confirmar que el equipo todavía exista.
    const equipoRef = doc(db, "equipos", equipoId);

    // Guardar el registro.
    await addDoc(collection(db, "registros"), {
      equipoId,
      fecha,
      horasTrabajadas: horas
    });

    // Sumar las horas al contador del equipo.
    await updateDoc(equipoRef, {
      horasTotales: increment(horas)
    });

    document.getElementById("horas").value = "";

    // Si se registró una fecha anterior, conservarla.
    // La fecha actual no se fuerza sobre una fecha elegida.
    showToast(`${horas} horas registradas correctamente`);

    await refrescarUI();
  } catch (error) {
    mostrarError(error);
  }
};

// ===============================
// HISTORIAL
// ===============================
window.verHistorialUI = async () => {
  try {
    const id = document.getElementById("equipoHistorial").value;
    const contenedor = document.getElementById("historial");

    contenedor.innerHTML = "";

    if (!id) {
      showToast("Seleccioná un equipo.", "error");
      return;
    }

    const q = query(
      collection(db, "registros"),
      where("equipoId", "==", id)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      contenedor.innerHTML =
        `<div class="historial-empty">Sin registros para este equipo</div>`;
      return;
    }

    const registros = [];

    snap.forEach(d => registros.push(d.data()));

    registros.sort((a, b) => b.fecha.localeCompare(a.fecha));

    registros.forEach(r => {
      const div = document.createElement("div");
      div.className = "historial-item";

      const fecha = document.createElement("span");
      fecha.className = "historial-fecha";
      fecha.textContent = formatFecha(r.fecha);

      const horas = document.createElement("span");
      horas.className = "historial-horas";
      horas.textContent = `${r.horasTrabajadas}h`;

      div.appendChild(fecha);
      div.appendChild(horas);

      contenedor.appendChild(div);
    });
  } catch (error) {
    mostrarError(error);
  }
};

function formatFecha(fechaStr) {
  if (!fechaStr) return "—";

  const [y, m, d] = fechaStr.split("-");

  const meses = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
  ];

  return `${d} ${meses[parseInt(m, 10) - 1]} ${y}`;
}

// ===============================
// MANTENIMIENTO
// ===============================
window.hacerMantenimiento = async (id, horasActuales) => {
  try {
    const confirmacion = prompt(
      "Escriba MANTENIMIENTO para confirmar"
    );

    if (confirmacion !== "MANTENIMIENTO") {
      showToast("Mantenimiento cancelado", "error");
      return;
    }

    await addDoc(collection(db, "mantenimientos"), {
      equipoId: id,
      horasAntes: horasActuales,
      fecha: new Date().toISOString()
    });

    await updateDoc(doc(db, "equipos", id), {
      horasTotales: 0
    });

    showToast("Mantenimiento registrado. Contador reiniciado.");

    await refrescarUI();
  } catch (error) {
    mostrarError(error);
  }
};

// ===============================
// EQUIPOS UI
// ===============================
async function obtenerEquiposUI() {
  const contenedor = document.getElementById("listaEquipos");
  contenedor.innerHTML = "";

  const snap = await getDocs(collection(db, "equipos"));

  if (snap.empty) {
    contenedor.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--text-muted);font-size:14px;">
        No hay equipos registrados aún
      </div>
    `;
    return;
  }

  snap.forEach(d => {
    const data = d.data();

    const nombre = data.nombre || "Equipo sin nombre";
    const estado = data.estado || "Activo";
    const horasTotales = Number(data.horasTotales) || 0;
    const limite = Number(data.limiteMantenimiento) || 10;

    const restantes = limite - horasTotales;
    const pct = Math.min(
      Math.max((horasTotales / limite) * 100, 0),
      100
    );

    const esCuarentena = estado.toLowerCase() === "cuarentena";
    const esUrgente = restantes <= 0;

    let progressClass = "safe";

    if (pct >= 90) {
      progressClass = "danger";
    } else if (pct >= 70) {
      progressClass = "warn";
    }

    const card = document.createElement("div");

    card.className =
      `equipo-card${esCuarentena ? " cuarentena" : ""}${esUrgente ? " urgente" : ""}`;

    // Construir el contenido usando textContent para los datos del equipo.
    const top = document.createElement("div");
    top.className = "equipo-card-top";

    const nombreEl = document.createElement("div");
    nombreEl.className = "equipo-nombre";
    nombreEl.textContent = nombre;

    const badge = document.createElement("span");
    badge.className =
      `equipo-badge ${esCuarentena ? "badge-cuarentena" : "badge-activo"}`;
    badge.textContent = esCuarentena ? "CUARENTENA" : "ACTIVO";

    top.appendChild(nombreEl);
    top.appendChild(badge);

    const progreso = document.createElement("div");
    progreso.className = "equipo-progreso";

    const progresoLabel = document.createElement("div");
    progresoLabel.className = "progreso-label";

    const usadas = document.createElement("span");
    usadas.textContent = `${horasTotales}h usadas`;

    const limiteEl = document.createElement("span");
    limiteEl.textContent = `Límite: ${limite}h`;

    progresoLabel.appendChild(usadas);
    progresoLabel.appendChild(limiteEl);

    const barra = document.createElement("div");
    barra.className = "progress-bar";

    const relleno = document.createElement("div");
    relleno.className = `progress-fill ${progressClass}`;
    relleno.style.width = `${pct}%`;

    barra.appendChild(relleno);
    progreso.appendChild(progresoLabel);
    progreso.appendChild(barra);

    const restantesEl = document.createElement("div");
    restantesEl.className =
      `equipo-restantes${esUrgente ? " peligro" : ""}`;

    const restantesTexto = document.createElement("strong");
    restantesTexto.textContent = esUrgente
      ? "⚠ Mantenimiento requerido"
      : `${restantes}h restantes`;

    restantesEl.appendChild(restantesTexto);

    const acciones = document.createElement("div");
    acciones.className = "equipo-actions";

    const btnEstado = document.createElement("button");
    btnEstado.className = "eq-btn";
    btnEstado.textContent = esCuarentena ? "↩ Activar" : "⚑ Cuarentena";
    btnEstado.addEventListener("click", () => {
      cambiarEstado(d.id, estado);
    });

    const btnMant = document.createElement("button");
    btnMant.className = "eq-btn btn-mant";
    btnMant.textContent = "✓ Mantto";
    btnMant.addEventListener("click", () => {
      hacerMantenimiento(d.id, horasTotales);
    });

    const btnDel = document.createElement("button");
    btnDel.className = "eq-btn btn-del";
    btnDel.textContent = "✕";
    btnDel.addEventListener("click", () => {
      eliminarEquipo(d.id);
    });

    acciones.appendChild(btnEstado);
    acciones.appendChild(btnMant);
    acciones.appendChild(btnDel);

    card.appendChild(top);
    card.appendChild(progreso);
    card.appendChild(restantesEl);
    card.appendChild(acciones);

    contenedor.appendChild(card);
  });
}

// ===============================
// CAMBIAR ESTADO
// ===============================
window.cambiarEstado = async (id, estado) => {
  try {
    const nuevoEstado =
      estado === "Activo" ? "Cuarentena" : "Activo";

    await updateDoc(doc(db, "equipos", id), {
      estado: nuevoEstado
    });

    showToast(`Equipo en estado: ${nuevoEstado}`);

    await refrescarUI();
  } catch (error) {
    mostrarError(error);
  }
};

// ===============================
// ELIMINAR EQUIPO
// ===============================
window.eliminarEquipo = async (id) => {
  try {
    const conf = confirm("¿Eliminar este equipo?");

    if (!conf) return;

    await deleteDoc(doc(db, "equipos", id));

    showToast("Equipo eliminado", "error");

    await refrescarUI();
  } catch (error) {
    mostrarError(error);
  }
};

// ===============================
// SELECTS
// ===============================
async function cargarSelect(id) {
  const select = document.getElementById(id);

  if (!select) return;

  const seleccionAnterior = select.value;
  select.innerHTML = "";

  const snap = await getDocs(collection(db, "equipos"));

  if (snap.empty) {
    const op = document.createElement("option");
    op.value = "";
    op.textContent = "— Sin equipos —";
    op.disabled = true;
    op.selected = true;

    select.appendChild(op);
    return;
  }

  snap.forEach(d => {
    const op = document.createElement("option");
    op.value = d.id;
    op.textContent = d.data().nombre || "Equipo sin nombre";

    select.appendChild(op);
  });

  // Mantener el equipo seleccionado si todavía existe.
  if (
    seleccionAnterior &&
    [...select.options].some(op => op.value === seleccionAnterior)
  ) {
    select.value = seleccionAnterior;
  }
}

// ===============================
// REFRESCAR INTERFAZ
// ===============================
async function refrescarUI() {
  try {
    await Promise.all([
      obtenerEquiposUI(),
      cargarSelect("equipoSelect"),
      cargarSelect("equipoHistorial"),
      actualizarResumen()
    ]);
  } catch (error) {
    mostrarError(error);
  }
}

// ===============================
// INICIO
// ===============================
refrescarUI();
