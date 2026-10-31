// publico/js/modulos/pareja.js · Módulo interactivo de Encuentra la pareja
import { montarPlantilla } from '../nucleo/plantilla.js';
import api from '../nucleo/api.js';
import { barajar } from '../nucleo/util.js';
import { escapar } from '../nucleo/ui.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';

await montarPlantilla({ titulo: 'Encuentra la pareja', roles: ['estudiante', 'docente', 'admin'] });

const contenido = document.getElementById('contenido');
if (!contenido) {
  throw new Error('Contenedor #contenido no encontrado');
}

let temaActual = null;
let glosarioTerminos = [];
let dificultad = 6;
let totalParejas = 6;
let tarjetas = [];

let primeraTarjeta = null;
let segundaTarjeta = null;
let bloqueoTablero = false;

let parejasEncontradas = 0;
let intentos = 0;
let tiempoInicio = 0;
let intervaloTiempo = null;

async function iniciarActividad() {
  try {
    temaActual = await obtenerTemaActividad();
    if (!temaActual) return;

    const glosario = await api.listar('glosario', { temaId: temaActual.id });
    glosarioTerminos = (glosario || []).filter(item => item && item.termino && item.definicion);

    // Si hay menos de 4 términos, complementar con elementos del tema
    if (glosarioTerminos.length < 4 && temaActual) {
      if (temaActual.resumen && !glosarioTerminos.some(t => t.termino === temaActual.titulo)) {
        glosarioTerminos.push({
          id: 'glo_auto_resumen',
          termino: temaActual.titulo || 'Concepto principal',
          definicion: temaActual.resumen,
          retroalimentacion: 'Concepto eje del tema.'
        });
      }
      if (Array.isArray(temaActual.palabrasClave)) {
        temaActual.palabrasClave.forEach((palabra, idx) => {
          if (glosarioTerminos.length < 4 && !glosarioTerminos.some(t => t.termino.toLowerCase() === palabra.toLowerCase())) {
            glosarioTerminos.push({
              id: `glo_auto_pc_${idx}`,
              termino: palabra,
              definicion: `Concepto clave esencial en ${temaActual.titulo}.`,
              retroalimentacion: `Término fundamental para comprender ${temaActual.titulo}.`
            });
          }
        });
      }
      if (Array.isArray(temaActual.ejemplos)) {
        temaActual.ejemplos.forEach((ej, idx) => {
          if (glosarioTerminos.length < 4) {
            glosarioTerminos.push({
              id: `glo_auto_ej_${idx}`,
              termino: `Ejemplo histórico ${idx + 1}`,
              definicion: ej,
              retroalimentacion: 'Caso histórico aplicativo.'
            });
          }
        });
      }
    }

    iniciarPartida();
  } catch (error) {
    contenido.innerHTML = `
      <div class="tarjeta" style="text-align: center; color: var(--color-error); padding: var(--espacio-xl);">
        ${escapar(error.message || 'Error al iniciar la actividad Encuentra la pareja.')}
      </div>
    `;
  }
}

function iniciarPartida() {
  detenerTemporizador();

  primeraTarjeta = null;
  segundaTarjeta = null;
  bloqueoTablero = false;
  intentos = 0;
  parejasEncontradas = 0;

  // Dificultad de 6, 8 o 10 parejas (si hay menos términos, usa los disponibles; mínimo 4)
  totalParejas = Math.max(4, Math.min(dificultad, glosarioTerminos.length));

  const seleccionados = barajar([...glosarioTerminos]).slice(0, totalParejas);

  const cartasLista = [];
  seleccionados.forEach(item => {
    cartasLista.push({
      id: `t_${item.id}`,
      parId: item.id,
      tipo: 'termino',
      texto: item.termino,
      definicion: item.definicion,
      retroalimentacion: item.retroalimentacion || ''
    });
    cartasLista.push({
      id: `d_${item.id}`,
      parId: item.id,
      tipo: 'definicion',
      texto: item.definicion,
      definicion: item.definicion,
      retroalimentacion: item.retroalimentacion || ''
    });
  });

  tarjetas = barajar(cartasLista);
  renderizarTablero();
  iniciarTemporizador();
}

function renderizarTablero() {
  contenido.innerHTML = `
    <div class="pareja-contenedor">
      <nav class="migas" aria-label="Ruta de navegación">
        <a href="/paginas/asignaturas.html">Mis asignaturas</a>
        <span class="migas__separador">/</span>
        <a href="/paginas/tema.html?id=${escapar(temaActual.id)}">${escapar(temaActual.titulo)}</a>
        <span class="migas__separador">/</span>
        <span class="migas__actual">Encuentra la pareja</span>
      </nav>

      <header class="pareja-encabezado">
        <div class="pareja-encabezado__titulo-fila">
          <div>
            <h1 class="pareja-titulo">🃏 Encuentra la pareja: ${escapar(temaActual.titulo)}</h1>
            <p class="pareja-subtitulo">
              Voltea dos tarjetas para relacionar cada concepto con su definición correcta.
            </p>
          </div>
          <button type="button" class="btn btn--secundario btn--pequeno" id="btn-reiniciar">
            🔄 Reiniciar
          </button>
        </div>

        <div class="pareja-panel">
          <div class="pareja-dificultad" role="group" aria-label="Seleccionar dificultad">
            <span class="pareja-dificultad__etiqueta">Dificultad:</span>
            <button type="button" class="pareja-dificultad__btn ${dificultad === 6 ? 'pareja-dificultad__btn--activo' : ''}" data-dif="6">
              6 parejas
            </button>
            <button type="button" class="pareja-dificultad__btn ${dificultad === 8 ? 'pareja-dificultad__btn--activo' : ''}" data-dif="8">
              8 parejas
            </button>
            <button type="button" class="pareja-dificultad__btn ${dificultad === 10 ? 'pareja-dificultad__btn--activo' : ''}" data-dif="10">
              10 parejas
            </button>
          </div>

          <div class="pareja-marcadores" aria-label="Marcadores de la partida">
            <span class="pareja-marcador-item pareja-marcador-item--exito" id="marcador-parejas">
              ✨ 0 / ${totalParejas}
            </span>
            <span class="pareja-marcador-item pareja-marcador-item--info" id="marcador-intentos">
              🎯 0 intentos
            </span>
            <span class="pareja-marcador-item pareja-marcador-item--advertencia" id="marcador-tiempo">
              ⏱️ 00:00
            </span>
          </div>
        </div>

        <div class="barra-progreso" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="${totalParejas}" aria-label="Progreso de parejas encontradas">
          <div class="barra-progreso__relleno" id="barra-progreso" style="width: 0%;"></div>
        </div>
      </header>

      <section class="pareja-cuadricula" aria-label="Tablero de tarjetas">
        ${tarjetas.map((c, idx) => `
          <button type="button"
                  class="pareja-tarjeta"
                  data-idx="${idx}"
                  aria-label="Tarjeta ${idx + 1}, oculta"
                  aria-pressed="false">
            <span class="pareja-tarjeta__interior">
              <span class="pareja-tarjeta__dorso" aria-hidden="true">
                <span class="pareja-tarjeta__icono-dorso">🎴</span>
                <span class="pareja-tarjeta__num-dorso">${idx + 1}</span>
              </span>
              <span class="pareja-tarjeta__frente" aria-hidden="true">
                <span class="pareja-tarjeta__badge ${c.tipo === 'termino' ? 'pareja-tarjeta__badge--termino' : 'pareja-tarjeta__badge--definicion'}">
                  ${c.tipo === 'termino' ? 'Término' : 'Definición'}
                </span>
                <span class="pareja-tarjeta__texto ${c.tipo === 'termino' ? 'pareja-tarjeta__texto--termino' : ''}">
                  ${escapar(c.texto)}
                </span>
              </span>
            </span>
          </button>
        `).join('')}
      </section>
    </div>
  `;

  conectarEventos();
}

function conectarEventos() {
  const btnReiniciar = document.getElementById('btn-reiniciar');
  if (btnReiniciar) {
    btnReiniciar.addEventListener('click', () => {
      iniciarPartida();
    });
  }

  const botonesDif = document.querySelectorAll('.pareja-dificultad__btn');
  botonesDif.forEach(btn => {
    btn.addEventListener('click', () => {
      const nuevaDif = parseInt(btn.getAttribute('data-dif'), 10);
      if (nuevaDif && nuevaDif !== dificultad) {
        dificultad = nuevaDif;
        iniciarPartida();
      }
    });
  });

  const botonesTarjetas = document.querySelectorAll('.pareja-tarjeta');
  botonesTarjetas.forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      manejarClickTarjeta(btn, idx);
    });
  });
}

async function manejarClickTarjeta(btn, idx) {
  if (bloqueoTablero) return;
  if (btn.classList.contains('esta-volteada') || btn.classList.contains('esta-emparejada')) return;

  const cardData = tarjetas[idx];
  if (!cardData) return;

  // Voltear tarjeta boca arriba
  btn.classList.add('esta-volteada');
  btn.setAttribute('aria-pressed', 'true');
  btn.setAttribute('aria-label', `Tarjeta ${idx + 1}: ${cardData.tipo === 'termino' ? 'Término' : 'Definición'}, ${cardData.texto}`);

  if (!primeraTarjeta) {
    primeraTarjeta = { btn, idx, ...cardData };
    return;
  }

  // Segunda tarjeta volteada
  segundaTarjeta = { btn, idx, ...cardData };
  bloqueoTablero = true;
  intentos++;
  actualizarMarcadores();

  const esPareja = primeraTarjeta.parId === segundaTarjeta.parId && primeraTarjeta.tipo !== segundaTarjeta.tipo;

  if (esPareja) {
    // Si forman pareja quedan descubiertas
    primeraTarjeta.btn.classList.add('esta-emparejada');
    segundaTarjeta.btn.classList.add('esta-emparejada');
    primeraTarjeta.btn.disabled = true;
    segundaTarjeta.btn.disabled = true;
    primeraTarjeta.btn.setAttribute('aria-label', `Tarjeta ${primeraTarjeta.idx + 1}: Pareja encontrada, ${primeraTarjeta.texto}`);
    segundaTarjeta.btn.setAttribute('aria-label', `Tarjeta ${segundaTarjeta.idx + 1}: Pareja encontrada, ${segundaTarjeta.texto}`);

    parejasEncontradas++;
    actualizarMarcadores();

    const explicacion = primeraTarjeta.definicion || segundaTarjeta.definicion;
    await mostrarRetro({ correcto: true, explicacion });

    primeraTarjeta = null;
    segundaTarjeta = null;
    bloqueoTablero = false;

    if (parejasEncontradas >= totalParejas) {
      await finalizarPartida();
    }
  } else {
    // Si no, se voltean a los 1,2 s
    primeraTarjeta.btn.classList.add('error-pareja');
    segundaTarjeta.btn.classList.add('error-pareja');

    await new Promise(resolve => setTimeout(resolve, 1200));

    primeraTarjeta.btn.classList.remove('esta-volteada', 'error-pareja');
    segundaTarjeta.btn.classList.remove('esta-volteada', 'error-pareja');
    primeraTarjeta.btn.setAttribute('aria-pressed', 'false');
    segundaTarjeta.btn.setAttribute('aria-pressed', 'false');
    primeraTarjeta.btn.setAttribute('aria-label', `Tarjeta ${primeraTarjeta.idx + 1}, oculta`);
    segundaTarjeta.btn.setAttribute('aria-label', `Tarjeta ${segundaTarjeta.idx + 1}, oculta`);

    primeraTarjeta = null;
    segundaTarjeta = null;
    bloqueoTablero = false;
  }
}

function iniciarTemporizador() {
  tiempoInicio = Date.now();
  actualizarTiempo();
  intervaloTiempo = setInterval(actualizarTiempo, 1000);
}

function detenerTemporizador() {
  if (intervaloTiempo) {
    clearInterval(intervaloTiempo);
    intervaloTiempo = null;
  }
}

function actualizarTiempo() {
  const marcador = document.getElementById('marcador-tiempo');
  if (!marcador) return;
  const duracionSeg = Math.floor((Date.now() - tiempoInicio) / 1000);
  const min = Math.floor(duracionSeg / 60).toString().padStart(2, '0');
  const seg = (duracionSeg % 60).toString().padStart(2, '0');
  marcador.textContent = `⏱️ ${min}:${seg}`;
}

function actualizarMarcadores() {
  const elParejas = document.getElementById('marcador-parejas');
  const elIntentos = document.getElementById('marcador-intentos');
  const elBarra = document.getElementById('barra-progreso');

  if (elParejas) {
    elParejas.textContent = `✨ ${parejasEncontradas} / ${totalParejas}`;
  }
  if (elIntentos) {
    elIntentos.textContent = `🎯 ${intentos} ${intentos === 1 ? 'intento' : 'intentos'}`;
  }
  if (elBarra) {
    const porcentaje = Math.round((parejasEncontradas / totalParejas) * 100);
    elBarra.style.width = `${porcentaje}%`;
    const contProgreso = elBarra.closest('.barra-progreso');
    if (contProgreso) {
      contProgreso.setAttribute('aria-valuenow', parejasEncontradas.toString());
    }
  }
}

async function finalizarPartida() {
  detenerTemporizador();

  const duracionSeg = Math.max(1, Math.round((Date.now() - tiempoInicio) / 1000));
  const errores = Math.max(0, intentos - totalParejas);
  const puntaje = Math.max(0, 10 - errores);
  const maximo = 10;

  try {
    await registrarIntento({
      actividad: 'pareja',
      temaId: temaActual.id,
      puntaje,
      maximo,
      errores,
      duracionSeg
    });
  } catch {
    // El aviso de error es gestionado por gamificacion.js
  }

  const recomendaciones = [];
  if (errores === 0) {
    recomendaciones.push('¡Memoria y comprensión impecables! Encontraste todas las parejas en el mínimo de intentos.');
  } else if (errores <= 4) {
    recomendaciones.push('¡Excelente trabajo relacionando los conceptos y sus definiciones!');
  } else {
    recomendaciones.push('Te recomendamos revisar el glosario del tema para familiarizarte mejor con los términos clave.');
  }

  const decision = await mostrarResumen({
    titulo: '¡Encuentra la pareja completado!',
    aciertos: totalParejas,
    errores,
    recomendaciones,
    enlaceTema: `/paginas/tema.html?id=${temaActual.id}`
  });

  if (decision === 'repetir') {
    iniciarPartida();
  } else {
    window.location.href = `/paginas/tema.html?id=${temaActual.id}`;
  }
}

iniciarActividad();

