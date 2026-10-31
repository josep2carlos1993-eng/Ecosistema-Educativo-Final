// publico/js/modulos/completar.js · Módulo interactivo de Completar Conceptos
import { montarPlantilla } from '../nucleo/plantilla.js';
import api from '../nucleo/api.js';
import { normalizar, barajar } from '../nucleo/util.js';
import { escapar, aviso } from '../nucleo/ui.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';

await montarPlantilla({ titulo: 'Completar Conceptos Clave', roles: ['estudiante', 'docente', 'admin'] });

const contenido = document.getElementById('contenido');
if (!contenido) {
  throw new Error('Contenedor #contenido no encontrado');
}

let temaActual = null;
let retos = [];
let indiceActual = 0;
let aciertos = 0;
let errores = 0;
let tiempoInicio = Date.now();
let palabraUsuario = '';

async function iniciarActividad() {
  try {
    temaActual = await obtenerTemaActividad();
    if (!temaActual) return;

    const glosario = await api.listar('glosario', { temaId: temaActual.id });

    if (glosario && glosario.length > 0) {
      retos = barajar([...glosario]);
    } else {
      retos = [
        {
          termino: temaActual.palabrasClave?.[0] || 'revolucion',
          definicion: temaActual.resumen || 'Concepto clave del tema pedagógico.',
          pista: 'Palabra clave fundamental',
          retroalimentacion: 'Revisa las palabras clave del tema para afianzar conceptos.'
        }
      ];
    }

    reiniciarEstado();
    renderizarEstructura();
    mostrarRetoActual();
  } catch (error) {
    contenido.innerHTML = `
      <div class="tarjeta" style="text-align: center; color: var(--color-error); padding: var(--espacio-xl);">
        ${escapar(error.message || 'Error al iniciar la actividad de completar.')}
      </div>
    `;
  }
}

function reiniciarEstado() {
  indiceActual = 0;
  aciertos = 0;
  errores = 0;
  tiempoInicio = Date.now();
  palabraUsuario = '';
}

function renderizarEstructura() {
  contenido.innerHTML = `
    <div class="completar-contenedor">
      <nav class="migas" aria-label="Ruta de navegación">
        <a href="/paginas/asignaturas.html">Mis asignaturas</a>
        <span class="migas__separador">/</span>
        <a href="/paginas/tema.html?id=${escapar(temaActual.id)}">${escapar(temaActual.titulo)}</a>
        <span class="migas__separador">/</span>
        <span class="migas__actual">Completar</span>
      </nav>

      <div class="completar-encabezado">
        <div>
          <h2 style="margin: 0; color: var(--color-primario); font-size: var(--texto-xl);">
            ✍️ Completar Conceptos: ${escapar(temaActual.titulo)}
          </h2>
          <p style="margin: var(--espacio-xs) 0 0 0; color: var(--color-texto-suave); font-size: var(--texto-s);">
            Lee la definición y escribe el término exacto para completar el concepto.
          </p>
        </div>

        <div style="display: flex; align-items: center; gap: var(--espacio-m); flex-wrap: wrap;">
          <button type="button" class="btn btn--acento btn--pequeno" id="btn-ia-completar" title="Generar nuevos conceptos con Inteligencia Artificial">
            ✨ Generar con IA
          </button>
          <div style="display: flex; align-items: center; gap: var(--espacio-m);">
            <span class="badge" style="background-color: var(--color-exito-fondo); color: var(--color-exito); font-weight: var(--peso-seminegrita);" id="marcador-aciertos">
              ✅ 0
            </span>
            <span class="badge" style="background-color: var(--color-error-fondo); color: var(--color-error); font-weight: var(--peso-seminegrita);" id="marcador-errores">
              ❌ 0
            </span>
            <span style="font-weight: var(--peso-seminegrita); color: var(--color-texto);" id="indicador-contador">
              1 / ${retos.length}
            </span>
          </div>
        </div>
      </div>

      <div class="barra-progreso" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="${retos.length}">
        <div class="barra-progreso__relleno" id="barra-progreso" style="width: 0%;"></div>
      </div>

      <div class="completar-tarjeta-juego">
        <div class="completar-pista-caja">
          <span aria-hidden="true">💡</span>
          <span id="pista-texto">Pista didáctica</span>
        </div>

        <div class="completar-definicion-bloque">
          <p id="definicion-texto">Cargando definición...</p>
        </div>

        <!-- Casillas visuales para las letras -->
        <div class="completar-casillas" id="casillas-letras" aria-hidden="true"></div>

        <!-- Formulario accesible -->
        <form id="form-respuesta" class="completar-formulario" autocomplete="off">
          <label for="input-palabra" class="sr-only" style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0);">
            Término a completar
          </label>
          <input 
            type="text" 
            id="input-palabra" 
            class="completar-input" 
            placeholder="Escribe el término aquí..." 
            required 
            aria-required="true"
            spellcheck="false"
          >
          <button type="submit" class="btn btn--primario" id="btn-comprobar">
            Comprobar término →
          </button>
        </form>

        <!-- Banco de letras para ayuda táctil o teclado -->
        <div style="text-align: center; margin-top: var(--espacio-s);">
          <span style="font-size: var(--texto-xs); color: var(--color-texto-suave); display: block; margin-bottom: var(--espacio-xs);">
            Letras sugeridas:
          </span>
          <div class="completar-banco-letras" id="banco-letras"></div>
        </div>
      </div>
    </div>
  `;

  conectarEventos();
}

function conectarEventos() {
  const form = document.getElementById('form-respuesta');
  const input = document.getElementById('input-palabra');

  if (input) {
    input.addEventListener('input', e => {
      actualizarCasillasVisuales(e.target.value);
    });
  }

  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      await comprobarRespuesta();
    });
  }

  const btnIa = document.getElementById('btn-ia-completar');
  if (btnIa) {
    btnIa.addEventListener('click', manejarGenerarCompletarIA);
  }
}

function mostrarRetoActual() {
  const reto = retos[indiceActual];
  if (!reto) return;

  palabraUsuario = '';
  const input = document.getElementById('input-palabra');
  const pistaEl = document.getElementById('pista-texto');
  const defEl = document.getElementById('definicion-texto');
  const indicadorEl = document.getElementById('indicador-contador');
  const barraEl = document.getElementById('barra-progreso');

  if (input) {
    input.value = '';
    input.focus();
  }

  if (pistaEl) {
    pistaEl.textContent = reto.pista ? `Pista: ${reto.pista}` : 'Definición clave';
  }

  if (defEl) {
    defEl.textContent = `"${reto.definicion}"`;
  }

  if (indicadorEl) {
    indicadorEl.textContent = `${indiceActual + 1} / ${retos.length}`;
  }

  if (barraEl) {
    const pct = Math.round((indiceActual / retos.length) * 100);
    barraEl.style.width = `${pct}%`;
  }

  // Generar casillas vacías
  actualizarCasillasVisuales('');

  // Generar letras en desorden para el banco táctil
  generarBancoLetras(reto.termino);
}

function actualizarCasillasVisuales(valor) {
  const reto = retos[indiceActual];
  if (!reto) return;

  const terminoLimpio = reto.termino.trim();
  const casillasContenedor = document.getElementById('casillas-letras');
  if (!casillasContenedor) return;

  casillasContenedor.innerHTML = '';
  const valorLimpio = valor.trim();

  for (let i = 0; i < terminoLimpio.length; i++) {
    const charTermino = terminoLimpio[i];
    const casilla = document.createElement('div');

    if (charTermino === ' ') {
      casilla.className = 'completar-casilla completar-casilla--espacio';
    } else {
      const letraIngresada = valorLimpio[i] || '';
      casilla.className = `completar-casilla ${letraIngresada ? 'completar-casilla--llena' : ''}`;
      casilla.textContent = letraIngresada;
    }
    casillasContenedor.appendChild(casilla);
  }
}

function generarBancoLetras(termino) {
  const contenedor = document.getElementById('banco-letras');
  if (!contenedor) return;

  contenedor.innerHTML = '';
  const letrasUnicas = Array.from(new Set(termino.toLowerCase().replace(/[^a-záéíóúñ]/g, '').split('')));
  // Agregar un par de distractores
  const distractores = ['a', 'e', 'o', 's', 'r', 'l'].filter(l => !letrasUnicas.includes(l)).slice(0, 3);
  const todas = barajar([...letrasUnicas, ...distractores]);

  todas.forEach(letra => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'completar-letra-btn';
    btn.textContent = letra.toUpperCase();
    btn.setAttribute('aria-label', `Insertar letra ${letra}`);
    btn.addEventListener('click', () => {
      const input = document.getElementById('input-palabra');
      if (input) {
        input.value += letra;
        actualizarCasillasVisuales(input.value);
        input.focus();
      }
    });
    contenedor.appendChild(btn);
  });
}

async function comprobarRespuesta() {
  const reto = retos[indiceActual];
  const input = document.getElementById('input-palabra');
  if (!reto || !input) return;

  const respuestaUsuario = normalizar(input.value.trim());
  const respuestaCorrecta = normalizar(reto.termino.trim());

  const esCorrecta = respuestaUsuario === respuestaCorrecta;

  if (esCorrecta) {
    aciertos++;
  } else {
    errores++;
  }

  const marcadorAciertos = document.getElementById('marcador-aciertos');
  const marcadorErrores = document.getElementById('marcador-errores');
  if (marcadorAciertos) marcadorAciertos.textContent = `✅ ${aciertos}`;
  if (marcadorErrores) marcadorErrores.textContent = `❌ ${errores}`;

  await mostrarRetro({
    correcto: esCorrecta,
    explicacion: esCorrecta
      ? `¡Exacto! El término buscado es "${reto.termino}".`
      : `El término correcto era "${reto.termino}".`,
    sugerencia: reto.retroalimentacion || 'Recuerda relacionar las pistas con las transformaciones históricas.',
    enlaceTema: `/paginas/tema.html?id=${temaActual.id}`
  });

  indiceActual++;

  if (indiceActual < retos.length) {
    mostrarRetoActual();
  } else {
    await finalizarActividad();
  }
}

async function finalizarActividad() {
  const duracionSeg = Math.round((Date.now() - tiempoInicio) / 1000);
  const total = retos.length;

  try {
    await registrarIntento({
      actividad: 'completar',
      temaId: temaActual.id,
      nivel: 1,
      puntaje: aciertos,
      maximo: total,
      errores,
      duracionSeg,
      detalle: {
        totalRetos: total,
        aciertos,
        errores
      }
    });
  } catch (err) {
    // Manejado por gamificacion.js
  }

  const recomendaciones = [];
  if (errores === 0) {
    recomendaciones.push('¡Ortografía y precisión conceptual perfectas!');
  } else {
    recomendaciones.push('Revisa el glosario de términos para familiarizarte con las palabras clave.');
    recomendaciones.push('Presta atención a las pistas contextuales al resolver actividades de completar.');
  }

  const decision = await mostrarResumen({
    titulo: 'Completar Conceptos Finalizado',
    aciertos,
    errores,
    recomendaciones,
    enlaceTema: `/paginas/tema.html?id=${temaActual.id}`
  });

  if (decision === 'repetir') {
    retos = barajar([...retos]);
    reiniciarEstado();
    renderizarEstructura();
    mostrarRetoActual();
  } else {
    window.location.href = `/paginas/tema.html?id=${temaActual.id}`;
  }
}

async function manejarGenerarCompletarIA() {
  const btnIa = document.getElementById('btn-ia-completar');
  if (!temaActual) return;

  const textoOriginal = btnIa ? btnIa.innerHTML : '';
  if (btnIa) {
    btnIa.disabled = true;
    btnIa.innerHTML = '⏳ Generando con IA...';
  }

  try {
    const resp = await api.crear('ia/generar-glosario', {
      temaId: temaActual.id,
      cantidad: 10
    });

    const nuevos = (resp && Array.isArray(resp.guardados) && resp.guardados.length > 0)
      ? resp.guardados
      : (resp?.generados || resp?.palabras || []);

    if (!nuevos || nuevos.length === 0) {
      mostrarRetro({
        correcto: false,
        mensaje: 'No se generaron conceptos nuevos en este momento. Inténtalo de nuevo.'
      });
      return;
    }

    let agregadas = 0;
    nuevos.forEach(item => {
      if (!item || !item.termino || !item.definicion) return;
      const existe = retos.some(r => r && r.termino && r.termino.toLowerCase() === item.termino.trim().toLowerCase());
      if (!existe) {
        retos.push({
          id: item.id || `glo_ia_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          termino: item.termino.trim(),
          definicion: item.definicion.trim(),
          pista: item.pista ? item.pista.trim() : 'Pista conceptual clave',
          retroalimentacion: item.retroalimentacion || `Término didáctico sobre ${item.termino}.`
        });
        agregadas++;
      }
    });

    retos = barajar([...retos]);
    reiniciarEstado();
    renderizarEstructura();
    mostrarRetoActual();

    mostrarRetro({
      correcto: true,
      mensaje: `¡Se incorporaron ${agregadas > 0 ? agregadas : 'nuevos'} conceptos formativos generados con IA!`
    });
  } catch (error) {
    mostrarRetro({
      correcto: false,
      mensaje: error.message || 'No se pudo conectar con el modelo de IA. Inténtalo más tarde.'
    });
  } finally {
    const btnActual = document.getElementById('btn-ia-completar');
    if (btnActual) {
      btnActual.disabled = false;
      btnActual.innerHTML = textoOriginal || '✨ Generar con IA';
    }
  }
}

iniciarActividad();
