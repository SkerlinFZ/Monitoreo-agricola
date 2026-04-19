// ===============================
// ACCESO SIMPLE
// ===============================
const clave = prompt("Ingrese clave de acceso");
if (clave !== "Roman Valverde") {
  document.body.innerHTML = `
    <div style="display:grid;place-items:center;height:100vh;background:#080c0f;font-family:'DM Sans',sans-serif;">
      <div style="text-align:center;">
        <div style="font-size:48px;margin-bottom:16px;">⛔</div>
        <h1 style="color:#f87171;font-family:'Syne',sans-serif;font-size:22px;margin-bottom:8px;">Acceso Denegado</h1>
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
  getFirestore, collection, addDoc, getDocs, query, where,
  deleteDoc, doc, updateDoc, increment
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
// RESUMEN
// ===============================
async function actualizarResumen() {
  const totalEl = document.getElementById("totalEquipos");
  const cuarentenaEl = document.getElementById("equiposCuarentena");
  const urgenteEl = document.getElementById("mantenimientoUrgente");
  if (!totalEl || !cuarentenaEl || !urgenteEl) return;

  const snap = await getDocs(collection(db, "equipos"));
  let total = 0, cuarentena = 0, urgente = 0;

  snap.forEach(d => {
    const data = d.data();
    total++;
    if ((data.estado || "").toLowerCase() === "cuarentena") cuarentena++;
    if ((data.limiteMantenimiento - data.horasTotales) <= 0) urgente++;
  });

  totalEl.textContent = total;
  cuarentenaEl.textContent = cuarentena;
  urgenteEl.textContent = urgente;
}

// ===============================
// CREAR EQUIPO
// ===============================
window.crearEquipoUI = async () => {
  const nombre = document.getElementById("nombreEquipo").value.trim();
  const limite = Number(document.getElementById("limiteEquipo").value);

  if (!nombre || limite < 10) {
    showToast("Completá todos los campos correctamente", "error");
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
  refrescarUI();
};

// ===============================
// REGISTRAR HORAS
// ===============================
window.registrarHorasUI = async () => {
  const equipoId = document.getElementById("equipoSelect").value;
  const fecha = document.getElementById("fecha").value;
  const horas = Number(document.getElementById("horas").value);

  if (!equipoId || !fecha || horas <= 0) {
    showToast("Completá todos los campos", "error");
    return;
  }

  await addDoc(collection(db, "registros"), {
    equipoId,
    fecha,
    horasTrabajadas: horas
  });

  await updateDoc(doc(db, "equipos", equipoId), {
    horasTotales: increment(horas)
  });

  document.getElementById("horas").value = "";
  showToast(`${horas}h registradas correctamente`);
  refrescarUI();
};

// ===============================
// HISTORIAL
// ===============================
window.verHistorialUI = async () => {
  const id = document.getElementById("equipoHistorial").value;
  const contenedor = document.getElementById("historial");
  contenedor.innerHTML = "";

  const q = query(collection(db, "registros"), where("equipoId", "==", id));
  const snap = await getDocs(q);

  if (snap.empty) {
    contenedor.innerHTML = `<div class="historial-empty">Sin registros para este equipo</div>`;
    return;
  }

  const registros = [];
  snap.forEach(d => registros.push(d.data()));
  registros.sort((a, b) => b.fecha.localeCompare(a.fecha));

  registros.forEach(r => {
    const div = document.createElement("div");
    div.className = "historial-item";
    div.innerHTML = `
      <span class="historial-fecha">${formatFecha(r.fecha)}</span>
      <span class="historial-horas">${r.horasTrabajadas}h</span>
    `;
    contenedor.appendChild(div);
  });
};

function formatFecha(fechaStr) {
  if (!fechaStr) return "—";
  const [y, m, d] = fechaStr.split("-");
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${d} ${meses[parseInt(m)-1]} ${y}`;
}

// ===============================
// MANTENIMIENTO
// ===============================
window.hacerMantenimiento = async (id, horasActuales) => {
  const confirmacion = prompt("Escriba MANTENIMIENTO para confirmar");
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
  refrescarUI();
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
    const restantes = data.limiteMantenimiento - data.horasTotales;
    const pct = Math.min((data.horasTotales / data.limiteMantenimiento) * 100, 100);
    const esCuarentena = (data.estado || "").toLowerCase() === "cuarentena";
    const esUrgente = restantes <= 0;

    let progressClass = "safe";
    if (pct >= 90) progressClass = "danger";
    else if (pct >= 70) progressClass = "warn";

    const card = document.createElement("div");
    card.className = `equipo-card${esCuarentena ? " cuarentena" : ""}${esUrgente ? " urgente" : ""}`;

    card.innerHTML = `
      <div class="equipo-card-top">
        <div class="equipo-nombre">${data.nombre}</div>
        <span class="equipo-badge ${esCuarentena ? "badge-cuarentena" : "badge-activo"}">
          ${esCuarentena ? "CUARENTENA" : "ACTIVO"}
        </span>
      </div>

      <div class="equipo-progreso">
        <div class="progreso-label">
          <span>${data.horasTotales}h usadas</span>
          <span>Límite: ${data.limiteMantenimiento}h</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${progressClass}" style="width:${pct}%"></div>
        </div>
      </div>

      <div class="equipo-restantes ${esUrgente ? 'peligro' : ''}">
        <strong>${esUrgente ? "⚠ Mantenimiento requerido" : `${restantes}h restantes`}</strong>
      </div>

      <div class="equipo-actions">
        <button class="eq-btn" onclick="cambiarEstado('${d.id}', '${data.estado}')">
          ${esCuarentena ? "↩ Activar" : "⚑ Cuarentena"}
        </button>
        <button class="eq-btn btn-mant" onclick="hacerMantenimiento('${d.id}', ${data.horasTotales})">
          ✓ Mantto
        </button>
        <button class="eq-btn btn-del" onclick="eliminarEquipo('${d.id}')">
          ✕
        </button>
      </div>
    `;

    contenedor.appendChild(card);
  });
}

// ===============================
// ACCIONES
// ===============================
window.cambiarEstado = async (id, estado) => {
  const nuevoEstado = estado === "Activo" ? "Cuarentena" : "Activo";
  await updateDoc(doc(db, "equipos", id), { estado: nuevoEstado });
  showToast(`Equipo en estado: ${nuevoEstado}`);
  refrescarUI();
};

window.eliminarEquipo = async (id) => {
  const conf = confirm("¿Eliminar este equipo?");
  if (!conf) return;
  await deleteDoc(doc(db, "equipos", id));
  showToast("Equipo eliminado", "error");
  refrescarUI();
};

// ===============================
// SELECTS
// ===============================
async function cargarSelect(id) {
  const select = document.getElementById(id);
  if (!select) return;
  select.innerHTML = "";

  const snap = await getDocs(collection(db, "equipos"));

  if (snap.empty) {
    const op = document.createElement("option");
    op.textContent = "— Sin equipos —";
    op.disabled = true;
    select.appendChild(op);
    return;
  }

  snap.forEach(d => {
    const op = document.createElement("option");
    op.value = d.id;
    op.textContent = d.data().nombre;
    select.appendChild(op);
  });
}

// ===============================
// REFRESCAR
// ===============================
async function refrescarUI() {
  await obtenerEquiposUI();
  await cargarSelect("equipoSelect");
  await cargarSelect("equipoHistorial");
  await actualizarResumen();
}

// ===============================
// INICIO
// ===============================
refrescarUI();
