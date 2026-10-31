// publico/js/modulos/sopa-letras.js · Módulo interactivo de Sopa de letras
import { montarPlantilla } from '../nucleo/plantilla.js';
import api from '../nucleo/api.js';
import { normalizar, barajar } from '../nucleo/util.js';
import { escapar, confirmar } from '../nucleo/ui.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';

let contenido = null;
if (typeof window !== 'undefined') {
  await montarPlantilla({ titulo: 'Sopa de letras', roles: ['estudiante', 'docente', 'admin'] });
  contenido = document.getElementById('contenido');
  if (!contenido) {
    throw new Error('Contenedor #contenido no encontrado');
  }
}

const LETRAS_RELLENO = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';

const DIFICULTADES = {
  facil: {
    clave: 'facil',
    tamano: 10,
    maxPalabras: 8,
    direcciones: [
      [0, 1], // horizontal
      [1, 0]  // vertical
    ],
    etiqueta: 'Fácil (10×10)'
  },
  media: {
    clave: 'media',
    tamano: 12,
    maxPalabras: 10,
    direcciones: [
      [0, 1],  // horizontal
      [1, 0],  // vertical
      [1, 1],  // diagonal abajo-derecha
      [-1, 1]  // diagonal arriba-derecha
    ],
    etiqueta: 'Media (12×12)'
  },
  dificil: {
    clave: 'dificil',
    tamano: 15,
    maxPalabras: 12,
    direcciones: [
      [0, 1],   // horizontal normal
      [0, -1],  // horizontal invertida
      [1, 0],   // vertical normal
      [-1, 0],  // vertical invertida
      [1, 1],   // diagonal normal
      [-1, -1], // diagonal invertida
      [1, -1],  // diagonal abajo-izquierda
      [-1, 1]   // diagonal arriba-derecha invertida
    ],
    etiqueta: 'Difícil (15×15)'
  }
};

let temaActual = null;
let mapaPalabras = new Map();
let candidatosTema = [];
let dificultadActual = 'facil';
let sopaActual = null; // { grilla, ubicaciones }
let encontradas = 0;
let tiempoInicio = 0;
let intervaloTiempo = null;
let partidaActiva = false;

// Estado del arrastre (Pointer Events)
let arrastreActivo = false;
let celdaInicio = null;
let celdasSeleccionadas = [];

/**
 * Función pura para generar la sopa de letras
 * @param {Array<string|object>} palabras 
 * @param {number} tamano 
 * @param {Array<[number, number]>} direcciones 
 * @returns {{ grilla: string[][], ubicaciones: Array<object> }}
 */
export function generarSopa(palabras, tamano, direcciones) {
  const grilla = Array.from({ length: tamano }, () => Array(tamano).fill(null));

  // Normalizar y ordenar de la más larga a la más corta
  const lista = (palabras || [])
    .map(item => {
      if (typeof item === 'string') {
        return { palabra: normalizar(item), original: item, definicion: '' };
      }
      const p = normalizar(item.palabra || item.termino || '');
      return { palabra: p, original: item, definicion: item.definicion || item.retroalimentacion || '' };
    })
    .filter(item => item.palabra && item.palabra.length >= 3 && item.palabra.length <= tamano);

  lista.sort((a, b) => b.palabra.length - a.palabra.length);

  const ubicaciones = [];

  for (const item of lista) {
    const palabra = item.palabra;
    const len = palabra.length;
    let colocada = false;

    // Hasta 200 intentos por palabra
    for (let intento = 0; intento < 200 && !colocada; intento++) {
      const dir = direcciones[Math.floor(Math.random() * direcciones.length)];
      const [df, dc] = dir;

      const r = Math.floor(Math.random() * tamano);
      const c = Math.floor(Math.random() * tamano);

      const rFin = r + df * (len - 1);
      const cFin = c + dc * (len - 1);

      if (rFin < 0 || rFin >= tamano || cFin < 0 || cFin >= tamano) {
        continue;
      }

      // Comprobar cruces con letras iguales o celdas vacías
      let esValido = true;
      for (let i = 0; i < len; i++) {
        const filaActual = r + df * i;
        const colActual = c + dc * i;
        const celda = grilla[filaActual][colActual];
        if (celda !== null && celda !== palabra[i]) {
          esValido = false;
          break;
        }
      }

      if (esValido) {
        const celdas = [];
        for (let i = 0; i < len; i++) {
          const filaActual = r + df * i;
          const colActual = c + dc * i;
          grilla[filaActual][colActual] = palabra[i];
          celdas.push({ fila: filaActual, col: colActual });
        }

        ubicaciones.push({
          palabra,
          definicion: item.definicion,
          item: item.original,
          filaInicio: r,
          colInicio: c,
          filaFin: rFin,
          colFin: cFin,
          celdas,
          encontrada: false,
          revelada: false
        });

        colocada = true;
      }
    }
    // Si no cupo en 200 intentos, se descarta automáticamente
  }

  // Rellenar celdas vacías con letras aleatorias A-Z y Ñ
  for (let f = 0; f < tamano; f++) {
    for (let c = 0; c < tamano; c++) {
      if (grilla[f][c] === null) {
        grilla[f][c] = LETRAS_RELLENO[Math.floor(Math.random() * LETRAS_RELLENO.length)];
      }
    }
  }

  return { grilla, ubicaciones };
}

async function iniciarActividad() {
  try {
    temaActual = await obtenerTemaActividad();
    if (!temaActual) return;

    // Obtener términos del glosario
    const glosario = await api.listar('glosario', { temaId: temaActual.id });

    mapaPalabras = new Map();

    (glosario || []).forEach(item => {
      if (!item || !item.termino) return;
      const partes = item.termino.trim().split(/\s+/);
      if (partes.length === 1) {
        const norm = normalizar(partes[0]);
        if (norm.length >= 3 && !mapaPalabras.has(norm)) {
          mapaPalabras.set(norm, {
            termino: norm,
            definicion: item.definicion || item.retroalimentacion || 'Concepto clave del tema.',
            original: item
          });
        }
      }
    });

    // Si hacen falta palabras, complementar con palabras clave del tema
    if (Array.isArray(temaActual.palabrasClave)) {
      temaActual.palabrasClave.forEach(pc => {
        const partes = pc.trim().split(/\s+/);
        if (partes.length === 1) {
          const norm = normalizar(partes[0]);
          if (norm.length >= 3 && !mapaPalabras.has(norm)) {
            mapaPalabras.set(norm, {
              termino: norm,
              definicion: `Concepto clave representativo de ${temaActual.titulo}.`,
              original: { termino: norm }
            });
          }
        }
      });
    }

    candidatosTema = Array.from(mapaPalabras.values());

    iniciarPartida();
  } catch (error) {
    contenido.innerHTML = `
      <div class="tarjeta" style="text-align: center; color: var(--color-error); padding: var(--espacio-xl);">
        ${escapar(error.message || 'Error al iniciar la Sopa de letras.')}
      </div>
    `;
  }
}

function iniciarPartida() {
  detenerTemporizador();
  encontradas = 0;
  arrastreActivo = false;
  celdaInicio = null;
  celdasSeleccionadas = [];
  partidaActiva = true;

  const conf = DIFICULTADES[dificultadActual] || DIFICULTADES.facil;

  // Filtrar candidatos por tamaño de cuadrícula
  const filtrados = candidatosTema.filter(c => c.termino.length <= conf.tamano);
  const barajados = barajar(filtrados).slice(0, conf.maxPalabras);

  sopaActual = generarSopa(barajados, conf.tamano, conf.direcciones);

  renderizarTablero();
  iniciarTemporizador();
}

function renderizarTablero() {
  const conf = DIFICULTADES[dificultadActual] || DIFICULTADES.facil;
  const total = sopaActual.ubicaciones.length;

  contenido.innerHTML = `
    <div class="sopa-contenedor">
      <nav class="migas" aria-label="Ruta de navegación">
        <a href="/paginas/asignaturas.html">Mis asignaturas</a>
        <span class="migas__separador">/</span>
        <a href="/paginas/tema.html?id=${escapar(temaActual.id)}">${escapar(temaActual.titulo)}</a>
        <span class="migas__separador">/</span>
        <span class="migas__actual">Sopa de letras</span>
      </nav>

      <header class="sopa-encabezado">
        <div class="sopa-encabezado__fila">
          <div>
            <h1 class="sopa-titulo">🔍 Sopa de letras: ${escapar(temaActual.titulo)}</h1>
            <p class="sopa-subtitulo">
              Selecciona las letras en línea recta (horizontal, vertical o diagonal) para encontrar las palabras del tema.
            </p>
          </div>
          <div class="sopa-acciones-encabezado">
            <button type="button" class="btn btn--acento btn--pequeno" id="btn-ia-palabras" title="Generar nuevas palabras del tema con Inteligencia Artificial">
              ✨ Generar con IA
            </button>
            <button type="button" class="btn btn--peligro btn--pequeno" id="btn-rendirse">
              🏳️ Rendirse
            </button>
            <button type="button" class="btn btn--secundario btn--pequeno" id="btn-reiniciar">
              🔄 Reiniciar
            </button>
          </div>
        </div>

        <div class="sopa-panel">
          <div class="sopa-dificultad" role="group" aria-label="Nivel de dificultad">
            <span class="sopa-dificultad__etiqueta">Dificultad:</span>
            <button type="button" class="sopa-dificultad__btn ${dificultadActual === 'facil' ? 'sopa-dificultad__btn--activo' : ''}" data-dif="facil">
              Fácil (10×10)
            </button>
            <button type="button" class="sopa-dificultad__btn ${dificultadActual === 'media' ? 'sopa-dificultad__btn--activo' : ''}" data-dif="media">
              Media (12×12)
            </button>
            <button type="button" class="sopa-dificultad__btn ${dificultadActual === 'dificil' ? 'sopa-dificultad__btn--activo' : ''}" data-dif="dificil">
              Difícil (15×15)
            </button>
          </div>

          <div class="sopa-marcadores" aria-label="Marcadores de progreso">
            <span class="sopa-marcador-item sopa-marcador-item--exito" id="marcador-palabras">
              ✨ 0 / ${total}
            </span>
            <span class="sopa-marcador-item sopa-marcador-item--info" id="marcador-tiempo">
              ⏱️ 00:00
            </span>
          </div>
        </div>

        <div class="barra-progreso" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="${total}" aria-label="Progreso de palabras encontradas">
          <div class="barra-progreso__relleno" id="barra-progreso" style="width: 0%;"></div>
        </div>
      </header>

      <div class="sopa-cuerpo">
        <section class="sopa-tablero-envoltura" aria-label="Cuadrícula de la sopa de letras">
          <div class="sopa-grilla" id="sopa-grilla" style="--sopa-columnas: ${conf.tamano};">
            ${sopaActual.grilla.map((fila, f) => 
              fila.map((letra, c) => `
                <div class="sopa-celda"
                     data-fila="${f}"
                     data-col="${c}"
                     role="button"
                     tabindex="0"
                     aria-label="Fila ${f + 1}, Columna ${c + 1}: ${letra}">
                  ${escapar(letra)}
                </div>
              `).join('')
            ).join('')}
          </div>
        </section>

        <aside class="sopa-panel-palabras" aria-label="Lista de palabras a encontrar">
          <h2 class="sopa-panel-palabras__titulo">
            Palabras por encontrar
            <span style="font-size: var(--texto-xs); font-weight: var(--peso-regular); color: var(--color-texto-suave);">
              (${total})
            </span>
          </h2>
          <ul class="sopa-lista-palabras" id="sopa-lista-palabras">
            ${sopaActual.ubicaciones.map(u => `
              <li class="sopa-palabra-item" data-palabra="${escapar(u.palabra)}">
                <span>${escapar(u.palabra)}</span>
                <span class="sopa-palabra-icono" aria-hidden="true">🔍</span>
              </li>
            `).join('')}
          </ul>
        </aside>
      </div>
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

  const btnRendirse = document.getElementById('btn-rendirse');
  if (btnRendirse) {
    btnRendirse.addEventListener('click', manejarRendirse);
  }

  const btnIa = document.getElementById('btn-ia-palabras');
  if (btnIa) {
    btnIa.addEventListener('click', manejarGenerarPalabrasIA);
  }

  const botonesDif = document.querySelectorAll('.sopa-dificultad__btn');
  botonesDif.forEach(btn => {
    btn.addEventListener('click', () => {
      const dif = btn.getAttribute('data-dif');
      if (dif && dif !== dificultadActual) {
        dificultadActual = dif;
        iniciarPartida();
      }
    });
  });

  // Conectar Pointer Events en la cuadrícula
  const grillaEl = document.getElementById('sopa-grilla');
  if (grillaEl) {
    grillaEl.addEventListener('pointerdown', alIniciarPuntero);
    grillaEl.addEventListener('pointermove', alMoverPuntero);
    grillaEl.addEventListener('pointerup', alFinalizarPuntero);
    grillaEl.addEventListener('pointercancel', alFinalizarPuntero);
  }
}

function alIniciarPuntero(e) {
  if (!partidaActiva) return;
  const celdaEl = e.target.closest('.sopa-celda');
  if (!celdaEl) return;

  try {
    e.currentTarget.setPointerCapture(e.pointerId);
  } catch {}

  arrastreActivo = true;
  const fila = parseInt(celdaEl.getAttribute('data-fila'), 10);
  const col = parseInt(celdaEl.getAttribute('data-col'), 10);

  celdaInicio = { fila, col };
  celdasSeleccionadas = [celdaInicio];
  actualizarResaltadoSeleccion();
}

function alMoverPuntero(e) {
  if (!arrastreActivo || !celdaInicio) return;

  const elBajoPuntero = document.elementFromPoint(e.clientX, e.clientY);
  const celdaEl = elBajoPuntero?.closest('.sopa-celda');
  if (!celdaEl) return;

  const fila = parseInt(celdaEl.getAttribute('data-fila'), 10);
  const col = parseInt(celdaEl.getAttribute('data-col'), 10);

  const df = fila - celdaInicio.fila;
  const dc = col - celdaInicio.col;

  const esHorizontal = df === 0;
  const esVertical = dc === 0;
  const esDiagonal = Math.abs(df) === Math.abs(dc);

  if (esHorizontal || esVertical || esDiagonal) {
    const pasos = Math.max(Math.abs(df), Math.abs(dc));
    const pasoF = Math.sign(df);
    const pasoC = Math.sign(dc);

    const nuevasCeldas = [];
    for (let i = 0; i <= pasos; i++) {
      nuevasCeldas.push({
        fila: celdaInicio.fila + pasoF * i,
        col: celdaInicio.col + pasoC * i
      });
    }

    celdasSeleccionadas = nuevasCeldas;
    actualizarResaltadoSeleccion();
  }
}

async function alFinalizarPuntero(e) {
  if (!arrastreActivo) return;
  arrastreActivo = false;

  try {
    e.currentTarget.releasePointerCapture(e.pointerId);
  } catch {}

  if (celdasSeleccionadas.length > 0) {
    const palabraSeleccionada = celdasSeleccionadas
      .map(c => sopaActual.grilla[c.fila][c.col])
      .join('');
    const palabraInvertida = palabraSeleccionada.split('').reverse().join('');

    const coincidencia = sopaActual.ubicaciones.find(
      u => !u.encontrada && !u.revelada && (u.palabra === palabraSeleccionada || u.palabra === palabraInvertida)
    );

    if (coincidencia) {
      coincidencia.encontrada = true;
      encontradas++;

      // Marcar celdas como encontradas
      coincidencia.celdas.forEach(c => {
        const celda = document.querySelector(`.sopa-celda[data-fila="${c.fila}"][data-col="${c.col}"]`);
        if (celda) {
          celda.classList.add('sopa-celda--encontrada');
        }
      });

      // Tachar en la lista
      const itemLista = document.querySelector(`.sopa-palabra-item[data-palabra="${coincidencia.palabra}"]`);
      if (itemLista) {
        itemLista.classList.add('sopa-palabra-item--encontrada');
        const icono = itemLista.querySelector('.sopa-palabra-icono');
        if (icono) icono.textContent = '✅';
      }

      actualizarMarcadores();
      limpiarResaltado();

      const explicacion = coincidencia.definicion || `¡Encontraste la palabra "${coincidencia.palabra}"!`;
      await mostrarRetro({ correcto: true, explicacion });

      if (encontradas >= sopaActual.ubicaciones.length) {
        await finalizarPartida(false);
      }
    }
  }

  limpiarResaltado();
  celdaInicio = null;
  celdasSeleccionadas = [];
}

function actualizarResaltadoSeleccion() {
  document.querySelectorAll('.sopa-celda--seleccionada').forEach(c => {
    c.classList.remove('sopa-celda--seleccionada');
  });

  celdasSeleccionadas.forEach(c => {
    const el = document.querySelector(`.sopa-celda[data-fila="${c.fila}"][data-col="${c.col}"]`);
    if (el) {
      el.classList.add('sopa-celda--seleccionada');
    }
  });
}

function limpiarResaltado() {
  document.querySelectorAll('.sopa-celda--seleccionada').forEach(c => {
    c.classList.remove('sopa-celda--seleccionada');
  });
}

async function manejarRendirse() {
  if (!partidaActiva) return;

  const confirmado = await confirmar('¿Deseas rendirte? Se revelarán las palabras restantes.');
  if (!confirmado) return;

  revelarSolucion();
  await finalizarPartida(true);
}

function revelarSolucion() {
  sopaActual.ubicaciones.forEach(u => {
    if (!u.encontrada) {
      u.revelada = true;
      u.celdas.forEach(c => {
        const el = document.querySelector(`.sopa-celda[data-fila="${c.fila}"][data-col="${c.col}"]`);
        if (el && !el.classList.contains('sopa-celda--encontrada')) {
          el.classList.add('sopa-celda--revelada');
        }
      });

      const itemLista = document.querySelector(`.sopa-palabra-item[data-palabra="${u.palabra}"]`);
      if (itemLista) {
        itemLista.classList.add('sopa-palabra-item--revelada');
        const icono = itemLista.querySelector('.sopa-palabra-icono');
        if (icono) icono.textContent = '👁️';
      }
    }
  });
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
  const elTiempo = document.getElementById('marcador-tiempo');
  if (!elTiempo) return;
  const duracionSeg = Math.floor((Date.now() - tiempoInicio) / 1000);
  const min = Math.floor(duracionSeg / 60).toString().padStart(2, '0');
  const seg = (duracionSeg % 60).toString().padStart(2, '0');
  elTiempo.textContent = `⏱️ ${min}:${seg}`;
}

function actualizarMarcadores() {
  const total = sopaActual.ubicaciones.length;
  const elPalabras = document.getElementById('marcador-palabras');
  const elBarra = document.getElementById('barra-progreso');

  if (elPalabras) {
    elPalabras.textContent = `✨ ${encontradas} / ${total}`;
  }
  if (elBarra) {
    const porcentaje = total > 0 ? Math.round((encontradas / total) * 100) : 0;
    elBarra.style.width = `${porcentaje}%`;
    const contProgreso = elBarra.closest('.barra-progreso');
    if (contProgreso) {
      contProgreso.setAttribute('aria-valuenow', encontradas.toString());
    }
  }
}

async function finalizarPartida(rendido = false) {
  partidaActiva = false;
  detenerTemporizador();

  const total = sopaActual.ubicaciones.length;
  const errores = total - encontradas;
  const duracionSeg = Math.max(1, Math.round((Date.now() - tiempoInicio) / 1000));

  try {
    await registrarIntento({
      actividad: 'sopa-letras',
      temaId: temaActual.id,
      puntaje: encontradas,
      maximo: total,
      errores,
      duracionSeg
    });
  } catch {
    // Manejado por gamificacion.js
  }

  const recomendaciones = [];
  if (rendido) {
    recomendaciones.push('Revisa con detenimiento las definiciones de los conceptos revelados para la próxima partida.');
  } else if (errores === 0) {
    recomendaciones.push('¡Excelente agudeza visual y comprensión conceptual! Encontraste todas las palabras.');
  } else {
    recomendaciones.push('Te recomendamos repasar los conceptos clave del glosario antes de volver a jugar.');
  }

  const decision = await mostrarResumen({
    titulo: rendido ? 'Sopa de letras (Finalizada)' : '¡Sopa de letras completada!',
    aciertos: encontradas,
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

async function manejarGenerarPalabrasIA() {
  const btnIa = document.getElementById('btn-ia-palabras');
  if (!temaActual) return;

  const textoOriginal = btnIa ? btnIa.innerHTML : '';
  if (btnIa) {
    btnIa.disabled = true;
    btnIa.innerHTML = '⏳ Generando con IA...';
  }

  try {
    const resp = await api.crear('ia/generar-glosario', {
      temaId: temaActual.id,
      cantidad: 8
    });

    const nuevos = (resp && Array.isArray(resp.guardados) && resp.guardados.length > 0)
      ? resp.guardados
      : (resp?.generados || resp?.palabras || []);

    if (!nuevos || nuevos.length === 0) {
      mostrarRetro({
        correcto: false,
        mensaje: 'No se generaron palabras nuevas en este momento. Inténtalo de nuevo.'
      });
      return;
    }

    let agregadas = 0;
    nuevos.forEach(item => {
      if (!item) return;
      const termino = item.termino || item.palabra || '';
      const partes = termino.trim().split(/\s+/);
      if (partes.length === 1) {
        const norm = normalizar(partes[0]);
        if (norm.length >= 3) {
          mapaPalabras.set(norm, {
            termino: norm,
            definicion: item.definicion || item.retroalimentacion || `Concepto clave sobre ${temaActual.titulo}.`,
            original: item
          });
          agregadas++;
        }
      }
    });

    candidatosTema = Array.from(mapaPalabras.values());
    iniciarPartida();

    mostrarRetro({
      correcto: true,
      mensaje: `¡Se generaron ${agregadas} nuevas palabras pedagógicas con IA! La sopa de letras ha sido actualizada.`
    });
  } catch (error) {
    mostrarRetro({
      correcto: false,
      mensaje: error.message || 'No se pudo conectar con el modelo de IA. Inténtalo más tarde.'
    });
  } finally {
    const btnActual = document.getElementById('btn-ia-palabras');
    if (btnActual) {
      btnActual.disabled = false;
      btnActual.innerHTML = textoOriginal || '✨ Generar con IA';
    }
  }
}

if (typeof window !== 'undefined') {
  iniciarActividad();
}


