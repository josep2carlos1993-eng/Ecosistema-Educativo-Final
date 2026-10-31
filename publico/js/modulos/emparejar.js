// publico/js/modulos/emparejar.js · Módulo interactivo de Emparejar Conceptos
import { montarPlantilla } from '../nucleo/plantilla.js';
import api from '../nucleo/api.js';
import { barajar } from '../nucleo/util.js';
import { escapar, aviso } from '../nucleo/ui.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';

await montarPlantilla({ titulo: 'Emparejar Conceptos', roles: ['estudiante', 'docente', 'admin'] });

const contenido = document.getElementById('contenido');
if (!contenido) {
  throw new Error('Contenedor #contenido no encontrado');
}

let temaActual = null;
let paresCompletos = [];
let terminoSeleccionado = null;
let definicionSeleccionada = null;
let paresResueltos = 0;
let errores = 0;
let tiempoInicio = Date.now();
const MAX_PARES_POR_RONDA = 5;

async function iniciarActividad() {
  try {
    temaActual = await obtenerTemaActividad();
    if (!temaActual) return;

    const glosario = await api.listar('glosario', { temaId: temaActual.id });

    if (glosario && glosario.length > 0) {
      paresCompletos = glosario.slice(0, MAX_PARES_POR_RONDA);
    } else {
      paresCompletos = [
        {
          id: 'p1',
          termino: temaActual.titulo,
          definicion: temaActual.resumen || 'Tema de aprendizaje principal.',
          retroalimentacion: 'Concepto clave central.'
        }
      ];
      if (temaActual.ejemplos && temaActual.ejemplos.length > 0) {
        temaActual.ejemplos.forEach((ej, idx) => {
          paresCompletos.push({
            id: `p_ej_${idx}`,
            termino: `Ejemplo histórico ${idx + 1}`,
            definicion: ej,
            retroalimentacion: 'Caso histórico concreto.'
          });
        });
      }
    }

    reiniciarEstado();
    renderizarTablero();
  } catch (error) {
    contenido.innerHTML = `
      <div class="tarjeta" style="text-align: center; color: var(--color-error); padding: var(--espacio-xl);">
        ${escapar(error.message || 'Error al iniciar la actividad de emparejar.')}
      </div>
    `;
  }
}

function reiniciarEstado() {
  terminoSeleccionado = null;
  definicionSeleccionada = null;
  paresResueltos = 0;
  errores = 0;
  tiempoInicio = Date.now();
}

function renderizarTablero() {
  const terminosBarajados = barajar([...paresCompletos]);
  const definicionesBarajadas = barajar([...paresCompletos]);

  contenido.innerHTML = `
    <div class="emparejar-contenedor">
      <nav class="migas" aria-label="Ruta de navegación">
        <a href="/paginas/asignaturas.html">Mis asignaturas</a>
        <span class="migas__separador">/</span>
        <a href="/paginas/tema.html?id=${escapar(temaActual.id)}">${escapar(temaActual.titulo)}</a>
        <span class="migas__separador">/</span>
        <span class="migas__actual">Emparejar</span>
      </nav>

      <div class="emparejar-encabezado">
        <div>
          <h2 style="margin: 0; color: var(--color-primario); font-size: var(--texto-xl);">
            🧩 Emparejar: ${escapar(temaActual.titulo)}
          </h2>
          <p style="margin: var(--espacio-xs) 0 0 0; color: var(--color-texto-suave); font-size: var(--texto-s);">
            Selecciona un término de la izquierda y luego su definición correspondiente en la derecha.
          </p>
        </div>

        <div style="display: flex; align-items: center; gap: var(--espacio-m);">
          <span class="badge" style="background-color: var(--color-exito-fondo); color: var(--color-exito); font-weight: var(--peso-seminegrita);" id="marcador-pares">
            ✅ 0 / ${paresCompletos.length}
          </span>
          <span class="badge" style="background-color: var(--color-error-fondo); color: var(--color-error); font-weight: var(--peso-seminegrita);" id="marcador-fallos">
            ❌ 0 fallos
          </span>
        </div>
      </div>

      <div class="barra-progreso" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="${paresCompletos.length}">
        <div class="barra-progreso__relleno" id="barra-progreso" style="width: 0%;"></div>
      </div>

      <div class="emparejar-tablero">
        <div class="emparejar-columna" id="columna-terminos">
          <div class="emparejar-columna__titulo">Términos Clave</div>
          ${terminosBarajados.map(item => `
            <button type="button" class="emparejar-tarjeta emparejar-tarjeta--termino btn-termino" data-id="${escapar(item.id || item.termino)}">
              ${escapar(item.termino)}
            </button>
          `).join('')}
        </div>

        <div class="emparejar-columna" id="columna-definiciones">
          <div class="emparejar-columna__titulo">Definiciones Pedagógicas</div>
          ${definicionesBarajadas.map(item => `
            <button type="button" class="emparejar-tarjeta btn-definicion" data-id="${escapar(item.id || item.termino)}">
              ${escapar(item.definicion)}
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  conectarEventos();
}

function conectarEventos() {
  const botonesTermino = document.querySelectorAll('.btn-termino');
  const botonesDefinicion = document.querySelectorAll('.btn-definicion');

  botonesTermino.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('emparejar-tarjeta--emparejada')) return;

      botonesTermino.forEach(b => b.classList.remove('emparejar-tarjeta--seleccionada'));
      btn.classList.add('emparejar-tarjeta--seleccionada');
      terminoSeleccionado = btn;

      if (definicionSeleccionada) {
        verificarEmparejamiento();
      }
    });
  });

  botonesDefinicion.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('emparejar-tarjeta--emparejada')) return;

      botonesDefinicion.forEach(b => b.classList.remove('emparejar-tarjeta--seleccionada'));
      btn.classList.add('emparejar-tarjeta--seleccionada');
      definicionSeleccionada = btn;

      if (terminoSeleccionado) {
        verificarEmparejamiento();
      }
    });
  });
}

async function verificarEmparejamiento() {
  const idTermino = terminoSeleccionado.getAttribute('data-id');
  const idDefinicion = definicionSeleccionada.getAttribute('data-id');

  const btnTerm = terminoSeleccionado;
  const btnDef = definicionSeleccionada;

  if (idTermino === idDefinicion) {
    // ¡Acierto!
    btnTerm.classList.remove('emparejar-tarjeta--seleccionada');
    btnDef.classList.remove('emparejar-tarjeta--seleccionada');

    btnTerm.classList.add('emparejar-tarjeta--emparejada');
    btnDef.classList.add('emparejar-tarjeta--emparejada');

    paresResueltos++;
    terminoSeleccionado = null;
    definicionSeleccionada = null;

    actualizarMarcadores();

    if (paresResueltos >= paresCompletos.length) {
      await finalizarActividad();
    }
  } else {
    // Fallo
    errores++;
    btnTerm.classList.add('emparejar-tarjeta--error');
    btnDef.classList.add('emparejar-tarjeta--error');

    actualizarMarcadores();

    setTimeout(() => {
      btnTerm.classList.remove('emparejar-tarjeta--seleccionada', 'emparejar-tarjeta--error');
      btnDef.classList.remove('emparejar-tarjeta--seleccionada', 'emparejar-tarjeta--error');
      terminoSeleccionado = null;
      definicionSeleccionada = null;
    }, 500);
  }
}

function actualizarMarcadores() {
  const marcadorPares = document.getElementById('marcador-pares');
  const marcadorFallos = document.getElementById('marcador-fallos');
  const barraEl = document.getElementById('barra-progreso');

  if (marcadorPares) {
    marcadorPares.textContent = `✅ ${paresResueltos} / ${paresCompletos.length}`;
  }
  if (marcadorFallos) {
    marcadorFallos.textContent = `❌ ${errores} fallos`;
  }
  if (barraEl) {
    const pct = Math.round((paresResueltos / paresCompletos.length) * 100);
    barraEl.style.width = `${pct}%`;
  }
}

async function finalizarActividad() {
  const duracionSeg = Math.round((Date.now() - tiempoInicio) / 1000);
  const total = paresCompletos.length;

  try {
    await registrarIntento({
      actividad: 'emparejar',
      temaId: temaActual.id,
      nivel: 1,
      puntaje: paresResueltos,
      maximo: total,
      errores,
      duracionSeg,
      detalle: {
        totalPares: total,
        errores
      }
    });
  } catch (err) {
    // Manejado por gamificacion.js
  }

  const recomendaciones = [];
  if (errores === 0) {
    recomendaciones.push('¡Relación conceptual impecable! Tienes claridad total sobre las definiciones del tema.');
  } else {
    recomendaciones.push('Te sugerimos asociar cada término con un evento o elemento histórico representativo.');
  }

  const decision = await mostrarResumen({
    titulo: 'Emparejamiento de Conceptos Finalizado',
    aciertos: paresResueltos,
    errores,
    recomendaciones,
    enlaceTema: `/paginas/tema.html?id=${temaActual.id}`
  });

  if (decision === 'repetir') {
    reiniciarEstado();
    renderizarTablero();
  } else {
    window.location.href = `/paginas/tema.html?id=${temaActual.id}`;
  }
}

iniciarActividad();
