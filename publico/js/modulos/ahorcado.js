// publico/js/modulos/ahorcado.js · Juego pedagógico del Ahorcado (6 letras, figura globo)
import { montarPlantilla } from '../nucleo/plantilla.js';
import api from '../nucleo/api.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { normalizar, barajar } from '../nucleo/util.js';
import { mostrarRetro } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import { escapar, aviso } from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Juego del Ahorcado', roles: ['estudiante', 'docente'] });

const TECLAS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'Ñ', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
];

const MAX_ERRORES = 4; // Se permiten 3 errores, termina en el cuarto

let temaActual = null;
let palabrasDisponibles = [];
const palabrasUsadas = new Set();

let terminoActual = null;
let palabraObjetivo = '';
let letrasDescubiertas = [];
let letrasJugadas = new Set();
let errores = 0;
let tiempoInicio = 0;
let juegoTerminado = false;

const contenido = document.getElementById('contenido');

async function iniciarJuego() {
  if (!contenido) return;

  try {
    temaActual = await obtenerTemaActividad();
    if (!temaActual || !temaActual.id) {
      window.location.href = '/paginas/asignaturas.html';
      return;
    }

    // Consultar términos del glosario para este tema
    const terminos = await api.listar('glosario', { temaId: temaActual.id });
    const palabrasValidas = (terminos || []).filter(t => {
      if (!t || !t.termino) return false;
      const norm = normalizar(t.termino);
      return /^[A-ZÑ]+$/.test(norm) && norm.length >= 3 && norm.length <= 10;
    });

    // Preferir palabras de 6 letras; si no hay, admitir términos del tema de 4 a 10 letras
    const palabrasDe6 = palabrasValidas.filter(p => normalizar(p.termino).length === 6);
    if (palabrasDe6.length > 0) {
      palabrasDisponibles = palabrasDe6;
    } else if (palabrasValidas.length > 0) {
      palabrasDisponibles = palabrasValidas;
    } else if (Array.isArray(temaActual.palabrasClave) && temaActual.palabrasClave.length > 0) {
      // Fallback con palabras clave registradas en el tema
      palabrasDisponibles = temaActual.palabrasClave
        .map((kw, i) => {
          const norm = normalizar(kw);
          if (/^[A-ZÑ]+$/.test(norm) && norm.length >= 4 && norm.length <= 10) {
            return {
              id: `kw_${i}`,
              termino: kw,
              pista: `Palabra clave del tema "${temaActual.titulo}".`,
              definicion: `Concepto esencial vinculado a ${temaActual.titulo}.`
            };
          }
          return null;
        })
        .filter(Boolean);
    }

    if (palabrasDisponibles.length === 0) {
      mostrarVistaVacio('No hay palabras registradas en el glosario para este tema pedagógico.');
      return;
    }

    iniciarRonda();

    // Event listener para teclado físico
    document.addEventListener('keydown', manejarTecladoFisico);
  } catch (error) {
    if (error.message !== 'Selección cancelada') {
      aviso(error.message || 'Error al iniciar el juego del ahorcado', 'error');
    }
  }
}

function mostrarVistaVacio(mensaje) {
  if (!contenido) return;
  contenido.innerHTML = `
    <div class="pila pila--amplia">
      <nav class="migas" aria-label="Ruta de navegación">
        <a href="/paginas/asignaturas.html">Mis asignaturas</a>
        <span class="migas__separador">/</span>
        <a href="/paginas/tema.html?id=${escapar(temaActual.id)}">${escapar(temaActual.titulo)}</a>
        <span class="migas__separador">/</span>
        <span class="migas__actual">Ahorcado</span>
      </nav>

      <div class="tarjeta vacio" style="text-align: center; padding: var(--espacio-2xl);">
        <div style="font-size: var(--texto-3xl); margin-bottom: var(--espacio-s);" aria-hidden="true">📖</div>
        <h2 style="color: var(--color-primario); margin-bottom: var(--espacio-s);">Sin términos disponibles</h2>
        <p style="color: var(--color-texto-suave); margin-bottom: var(--espacio-l); max-width: 500px; margin-left: auto; margin-right: auto;">
          ${escapar(mensaje)}
        </p>
        <div style="display: flex; gap: var(--espacio-m); justify-content: center; flex-wrap: wrap;">
          <a href="/paginas/tema.html?id=${escapar(temaActual.id)}" class="btn btn--primario">
            Repasar el tema pedagógico
          </a>
          ${palabrasUsadas.size > 0 ? `
            <button type="button" id="btn-reiniciar-palabras" class="btn btn--secundario">
              Reiniciar palabras jugadas
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  const btnReiniciar = document.getElementById('btn-reiniciar-palabras');
  if (btnReiniciar) {
    btnReiniciar.addEventListener('click', () => {
      palabrasUsadas.clear();
      iniciarRonda();
    });
  }
}

function iniciarRonda() {
  const candidatas = palabrasDisponibles.filter(p => !palabrasUsadas.has(p.id));

  if (candidatas.length === 0) {
    mostrarVistaVacio('¡Felicitaciones! Has completado todas las palabras disponibles en este tema.');
    return;
  }

  // Elegir una al azar
  terminoActual = barajar(candidatas)[0];
  palabrasUsadas.add(terminoActual.id);

  palabraObjetivo = normalizar(terminoActual.termino);
  letrasDescubiertas = new Array(palabraObjetivo.length).fill(false);
  letrasJugadas = new Set();
  errores = 0;
  tiempoInicio = Date.now();
  juegoTerminado = false;

  renderizarTablero();
}

function renderizarTablero() {
  if (!contenido) return;

  contenido.innerHTML = `
    <div class="ahorcado-contenedor">
      <nav class="migas" aria-label="Ruta de navegación">
        <a href="/paginas/asignaturas.html">Mis asignaturas</a>
        <span class="migas__separador">/</span>
        <a href="/paginas/tema.html?id=${escapar(temaActual.id)}">${escapar(temaActual.titulo)}</a>
        <span class="migas__separador">/</span>
        <span class="migas__actual">Ahorcado</span>
      </nav>

      <header class="ahorcado-cabecera">
        <div class="ahorcado-cabecera__info">
          <h1 class="ahorcado-cabecera__titulo">Adivina la Palabra</h1>
          <span class="ahorcado-cabecera__tema">Tema: ${escapar(temaActual.titulo)}</span>
        </div>
        <div style="font-size: var(--texto-s); color: var(--color-texto-suave);">
          Palabras resueltas: <strong>${palabrasUsadas.size} / ${palabrasDisponibles.length}</strong>
        </div>
      </header>

      <div class="ahorcado-tablero">
        <!-- Ilustración no violenta de 4 estados (Globo aerostático) -->
        <div class="ahorcado-ilustracion globo--0" id="contenedor-globo">
          <svg class="globo-svg" viewBox="0 0 200 240" aria-label="Globo aerostático indicando tus intentos restantes" role="img">
            <!-- Cuerdas del globo -->
            <line x1="80" y1="130" x2="90" y2="180" stroke="var(--color-borde)" stroke-width="2" class="globo-cuerda" />
            <line x1="120" y1="130" x2="110" y2="180" stroke="var(--color-borde)" stroke-width="2" class="globo-cuerda" />
            <!-- Canastilla -->
            <g class="globo-canastilla">
              <rect x="85" y="180" width="30" height="22" rx="4" fill="var(--color-secundario)" />
              <line x1="85" y1="187" x2="115" y2="187" stroke="rgba(255,255,255,0.3)" stroke-width="2" />
            </g>
            <!-- Nudo del globo -->
            <polygon points="95,135 105,135 100,142" fill="var(--color-acento)" class="globo-cuerpo" />
            <!-- Cuerpo del globo -->
            <ellipse cx="100" cy="80" rx="55" ry="60" fill="var(--color-acento)" class="globo-cuerpo" />
            <!-- Brillo de volumen -->
            <ellipse cx="80" cy="65" rx="14" ry="24" transform="rotate(-25 80 65)" fill="rgba(255, 255, 255, 0.45)" class="globo-brillo" />
          </svg>

          <div class="ahorcado-marcador-errores" id="marcador-errores" aria-live="polite">
            Errores: 0 / 4 (3 permitidos)
          </div>
        </div>

        <!-- Panel de juego: pista, casillas, teclado y acción -->
        <div class="ahorcado-juego">
          <div class="ahorcado-pista" role="region" aria-label="Pista pedagógica">
            <strong>💡 Pista:</strong> ${escapar(terminoActual.pista || 'Descubre la palabra formativa relacionada con este tema.')}
          </div>

          <div class="ahorcado__casillas" id="contenedor-casillas" role="region" aria-label="Casillas de la palabra de ${palabraObjetivo.length} letras">
            ${Array.from({ length: palabraObjetivo.length }).map((_, i) => `
              <div class="casilla" data-indice="${i}" aria-label="Letra ${i + 1} oculta">_</div>
            `).join('')}
          </div>

          <div class="teclado" id="teclado-pantalla" role="group" aria-label="Teclado en pantalla">
            ${TECLAS.map(letra => `
              <button type="button" class="tecla" data-letra="${letra}" aria-label="Letra ${letra}">
                ${letra}
              </button>
            `).join('')}
          </div>

          <div class="ahorcado-acciones">
            <button type="button" id="btn-otra-palabra" class="btn btn--secundario" style="display: none;">
              Otra palabra →
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Asignar eventos de clic al teclado en pantalla
  const botonesTeclas = contenido.querySelectorAll('.teclado .tecla');
  botonesTeclas.forEach(btn => {
    btn.addEventListener('click', () => {
      const letra = btn.getAttribute('data-letra');
      if (letra) procesarLetra(letra);
    });
  });

  // Evento botón "Otra palabra"
  const btnOtra = document.getElementById('btn-otra-palabra');
  if (btnOtra) {
    btnOtra.addEventListener('click', () => {
      iniciarRonda();
    });
  }
}

function procesarLetra(letra) {
  if (juegoTerminado || letrasJugadas.has(letra)) return;

  letrasJugadas.add(letra);

  const btnTecla = document.querySelector(`.teclado .tecla[data-letra="${letra}"]`);
  const acierto = palabraObjetivo.includes(letra);

  if (acierto) {
    if (btnTecla) {
      btnTecla.classList.add('tecla--acierto');
      btnTecla.disabled = true;
    }

    // Revelar letra en las casillas correspondientes
    for (let i = 0; i < palabraObjetivo.length; i++) {
      if (palabraObjetivo[i] === letra) {
        letrasDescubiertas[i] = true;
        const casilla = document.querySelector(`.casilla[data-indice="${i}"]`);
        if (casilla) {
          casilla.textContent = letra;
          casilla.classList.add('casilla--acierto');
          casilla.setAttribute('aria-label', `Letra ${i + 1}: ${letra}`);
        }
      }
    }

    // Verificar si descubrió todas las letras
    const gano = letrasDescubiertas.every(b => b === true);
    if (gano) {
      finalizarRonda(true);
    }
  } else {
    errores++;
    if (btnTecla) {
      btnTecla.classList.add('tecla--fallo');
      btnTecla.disabled = true;
    }

    actualizarEstadoGlobo();

    // 4 errores = juego terminado (derrota)
    if (errores >= MAX_ERRORES) {
      finalizarRonda(false);
    }
  }
}

function actualizarEstadoGlobo() {
  const contGlobo = document.getElementById('contenedor-globo');
  const marcador = document.getElementById('marcador-errores');

  if (contGlobo) {
    contGlobo.className = `ahorcado-ilustracion globo--${Math.min(errores, 4)}`;
  }

  if (marcador) {
    if (errores < 3) {
      marcador.textContent = `Errores: ${errores} / 4 (${3 - errores} permitidos antes de desinflarse)`;
      marcador.classList.remove('ahorcado-marcador-errores--alerta');
    } else if (errores === 3) {
      marcador.textContent = `⚠️ Errores: 3 / 4 (¡Cuidado! El próximo error desinflará el globo)`;
      marcador.classList.add('ahorcado-marcador-errores--alerta');
    } else {
      marcador.textContent = `❌ Errores: 4 / 4 (El globo se desinfló por completo)`;
      marcador.classList.add('ahorcado-marcador-errores--alerta');
    }
  }
}

async function finalizarRonda(gano) {
  juegoTerminado = true;

  // Deshabilitar todas las teclas restantes
  const botonesTeclas = document.querySelectorAll('.teclado .tecla');
  botonesTeclas.forEach(b => (b.disabled = true));

  // Revelar la palabra completa en las casillas
  for (let i = 0; i < palabraObjetivo.length; i++) {
    const casilla = document.querySelector(`.casilla[data-indice="${i}"]`);
    if (casilla) {
      casilla.textContent = palabraObjetivo[i];
      if (!letrasDescubiertas[i]) {
        casilla.classList.add('casilla--revelada');
      }
    }
  }

  // Mostrar botón "Otra palabra"
  const btnOtra = document.getElementById('btn-otra-palabra');
  if (btnOtra) {
    btnOtra.style.display = 'inline-flex';
    btnOtra.focus();
  }

  const duracionSeg = Math.round((Date.now() - tiempoInicio) / 1000);
  const puntaje = gano ? Math.max(0, 10 - errores * 2) : 0;

  // Retroalimentación formativa y registro
  await mostrarRetro({
    correcto: gano,
    explicacion: terminoActual.definicion || `La palabra correcta era "${terminoActual.termino}".`,
    sugerencia: terminoActual.retroalimentacion || 'Repasa frecuentemente el glosario para afianzar conceptos.',
    enlaceTema: `/paginas/tema.html?id=${temaActual.id}`
  });

  try {
    await registrarIntento({
      actividad: 'ahorcado',
      temaId: temaActual.id,
      puntaje,
      maximo: 10,
      errores,
      duracionSeg
    });
  } catch {
    // Manejado por gamificacion.js
  }
}

function manejarTecladoFisico(e) {
  if (juegoTerminado) return;
  if (e.ctrlKey || e.altKey || e.metaKey) return;

  const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  if (document.querySelector('.modal-fondo')) return;

  const letra = normalizar(e.key);
  if (TECLAS.includes(letra)) {
    e.preventDefault();
    procesarLetra(letra);
  }
}

iniciarJuego();
