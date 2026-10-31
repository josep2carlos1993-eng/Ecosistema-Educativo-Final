// publico/js/modulos/flashcards.js · Módulo interactivo de Tarjetas de Memoria
import { montarPlantilla } from '../nucleo/plantilla.js';
import api from '../nucleo/api.js';
import { barajar } from '../nucleo/util.js';
import { escapar, aviso } from '../nucleo/ui.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';

await montarPlantilla({ titulo: 'Tarjetas de Memoria (Flashcards)', roles: ['estudiante', 'docente', 'admin'] });

const contenido = document.getElementById('contenido');
if (!contenido) {
  throw new Error('Contenedor #contenido no encontrado');
}

let temaActual = null;
let tarjetas = [];
let indiceActual = 0;
let aciertos = 0;
let errores = 0;
let tiempoInicio = Date.now();
let tarjetaVolteada = false;

async function iniciarActividad() {
  try {
    temaActual = await obtenerTemaActividad();
    if (!temaActual) return;

    // Cargar glosario del tema
    const itemsGlosario = await api.listar('glosario', { temaId: temaActual.id });

    if (itemsGlosario && itemsGlosario.length > 0) {
      tarjetas = barajar([...itemsGlosario]);
    } else {
      // Fallback pedagógico si el glosario no tiene datos aún para este tema
      tarjetas = [
        {
          termino: temaActual.titulo,
          definicion: temaActual.resumen || 'Concepto principal de la unidad temática.',
          pista: 'Concepto central del tema',
          retroalimentacion: 'Revisa periódicamente el resumen del tema para afianzar tus conocimientos.'
        }
      ];

      if (temaActual.ejemplos && temaActual.ejemplos.length > 0) {
        temaActual.ejemplos.forEach((ej, idx) => {
          tarjetas.push({
            termino: `Ejemplo aplicado ${idx + 1}`,
            definicion: ej,
            pista: 'Aplicación práctica histórica',
            retroalimentacion: 'Los ejemplos concretos permiten contextualizar la teoría histórica y social.'
          });
        });
      }
    }

    reiniciarEstado();
    renderizarEstructura();
    mostrarTarjetaActual();
  } catch (error) {
    contenido.innerHTML = `
      <div class="tarjeta" style="text-align: center; color: var(--color-error); padding: var(--espacio-xl);">
        ${escapar(error.message || 'Error al inicializar la actividad de tarjetas.')}
      </div>
    `;
  }
}

function reiniciarEstado() {
  indiceActual = 0;
  aciertos = 0;
  errores = 0;
  tiempoInicio = Date.now();
  tarjetaVolteada = false;
}

function renderizarEstructura() {
  contenido.innerHTML = `
    <div class="flashcards-contenedor">
      <nav class="migas" aria-label="Ruta de navegación">
        <a href="/paginas/asignaturas.html">Mis asignaturas</a>
        <span class="migas__separador">/</span>
        <a href="/paginas/tema.html?id=${escapar(temaActual.id)}">${escapar(temaActual.titulo)}</a>
        <span class="migas__separador">/</span>
        <span class="migas__actual">Flashcards</span>
      </nav>

      <div class="flashcards-encabezado">
        <div>
          <h2 style="margin: 0; color: var(--color-primario); font-size: var(--texto-xl);">
            🃏 Flashcards: ${escapar(temaActual.titulo)}
          </h2>
          <p style="margin: var(--espacio-xs) 0 0 0; color: var(--color-texto-suave); font-size: var(--texto-s);">
            Toca o pulsa Espacio para voltear la tarjeta y repasar la definición.
          </p>
        </div>

        <div style="display: flex; gap: var(--espacio-m); align-items: center; flex-wrap: wrap;">
          <button type="button" class="btn btn--acento btn--pequeno" id="btn-ia-flashcards" title="Generar nuevas tarjetas de memoria con Inteligencia Artificial">
            ✨ Generar con IA
          </button>
          <div class="flashcards-marcador">
            <span class="flashcards-marcador__badge flashcards-marcador__badge--aciertos" id="marcador-aciertos">
              ✅ 0
            </span>
            <span class="flashcards-marcador__badge flashcards-marcador__badge--errores" id="marcador-errores">
              ❌ 0
            </span>
            <span style="font-weight: var(--peso-seminegrita);" id="indicador-contador">
              1 / ${tarjetas.length}
            </span>
          </div>
        </div>
      </div>

      <div class="barra-progreso" aria-label="Progreso de tarjetas" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="${tarjetas.length}">
        <div class="barra-progreso__relleno" id="barra-progreso-tarjetas" style="width: 0%;"></div>
      </div>

      <!-- Escena interactiva 3D -->
      <div class="flashcard-escena">
        <div class="flashcard-tarjeta" id="tarjeta-interactiva" tabindex="0" role="button" aria-pressed="false" aria-label="Tarjeta interactiva. Pulsa para voltear.">
          <div class="flashcard-cara flashcard-cara--frente" id="cara-frente">
            <div class="flashcard-indicador-giro">
              <span>🔄 Haz clic para voltear</span>
            </div>
            <div class="flashcard-contenido-central">
              <h3 class="flashcard-termino" id="texto-termino">Cargando...</h3>
              <span class="flashcard-pista" id="texto-pista">Pista</span>
            </div>
            <div style="font-size: var(--texto-xs); color: var(--color-texto-suave); text-align: center;">
              ¿Recuerdas su definición o significado?
            </div>
          </div>

          <div class="flashcard-cara flashcard-cara--dorso" id="cara-dorso">
            <div class="flashcard-indicador-giro">
              <span>📖 Definición y contexto</span>
            </div>
            <div class="flashcard-contenido-central">
              <p class="flashcard-definicion" id="texto-definicion">Cargando definición...</p>
              <div class="flashcard-retro" id="texto-retro">Información complementaria</div>
            </div>
            <div style="font-size: var(--texto-xs); color: var(--color-info); text-align: center;">
              Evalúa tu respuesta honestamente abajo:
            </div>
          </div>
        </div>
      </div>

      <!-- Acciones de control -->
      <div class="flashcards-acciones">
        <button type="button" class="btn btn--peligro" id="btn-no-se" aria-label="No me lo sé, necesito repasar">
          ❌ Aún no me lo sé
        </button>

        <button type="button" class="btn btn--secundario" id="btn-voltear" aria-label="Voltear tarjeta">
          🔄 Voltear
        </button>

        <button type="button" class="btn btn--primario" id="btn-si-se" aria-label="Sí me lo sé">
          ✅ ¡Me lo sé!
        </button>
      </div>
    </div>
  `;

  conectarEventos();
}

function conectarEventos() {
  const tarjetaEl = document.getElementById('tarjeta-interactiva');
  const btnVoltear = document.getElementById('btn-voltear');
  const btnSiSe = document.getElementById('btn-si-se');
  const btnNoSe = document.getElementById('btn-no-se');

  const alternarGiro = () => {
    tarjetaVolteada = !tarjetaVolteada;
    tarjetaEl.classList.toggle('volteada', tarjetaVolteada);
    tarjetaEl.setAttribute('aria-pressed', tarjetaVolteada ? 'true' : 'false');
  };

  tarjetaEl.addEventListener('click', alternarGiro);
  tarjetaEl.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      alternarGiro();
    }
  });

  btnVoltear.addEventListener('click', alternarGiro);

  btnSiSe.addEventListener('click', () => registrarRespuesta(true));
  btnNoSe.addEventListener('click', () => registrarRespuesta(false));

  const btnIa = document.getElementById('btn-ia-flashcards');
  if (btnIa) {
    btnIa.addEventListener('click', manejarGenerarFlashcardsIA);
  }
}

function mostrarTarjetaActual() {
  const item = tarjetas[indiceActual];
  if (!item) return;

  tarjetaVolteada = false;
  const tarjetaEl = document.getElementById('tarjeta-interactiva');
  if (tarjetaEl) {
    tarjetaEl.classList.remove('volteada');
    tarjetaEl.setAttribute('aria-pressed', 'false');
  }

  const terminoEl = document.getElementById('texto-termino');
  const pistaEl = document.getElementById('texto-pista');
  const definicionEl = document.getElementById('texto-definicion');
  const retroEl = document.getElementById('texto-retro');
  const indicadorEl = document.getElementById('indicador-contador');
  const barraEl = document.getElementById('barra-progreso-tarjetas');

  if (terminoEl) terminoEl.textContent = item.termino || 'Concepto';
  if (pistaEl) {
    pistaEl.textContent = item.pista ? `Pista: ${item.pista}` : 'Concepto del tema';
  }
  if (definicionEl) definicionEl.textContent = item.definicion || '';
  if (retroEl) {
    retroEl.textContent = item.retroalimentacion || 'Repasa frecuentemente este término para afianzar el aprendizaje.';
  }

  if (indicadorEl) {
    indicadorEl.textContent = `${indiceActual + 1} / ${tarjetas.length}`;
  }

  if (barraEl) {
    const porcentaje = Math.round((indiceActual / tarjetas.length) * 100);
    barraEl.style.width = `${porcentaje}%`;
  }
}

async function registrarRespuesta(esCorrecta) {
  const itemActual = tarjetas[indiceActual];

  if (esCorrecta) {
    aciertos++;
  } else {
    errores++;
  }

  const marcadorAciertos = document.getElementById('marcador-aciertos');
  const marcadorErrores = document.getElementById('marcador-errores');
  if (marcadorAciertos) marcadorAciertos.textContent = `✅ ${aciertos}`;
  if (marcadorErrores) marcadorErrores.textContent = `❌ ${errores}`;

  // Mostrar retroalimentación didáctica inmediata
  await mostrarRetro({
    correcto: esCorrecta,
    explicacion: esCorrecta 
      ? `¡Correcto! Has memorizado adecuadamente el significado de "${itemActual.termino}".`
      : `Necesitas reforzar el concepto de "${itemActual.termino}": ${itemActual.definicion}`,
    sugerencia: itemActual.retroalimentacion || 'Usa la pista y lee con atención el glosario temático.',
    enlaceTema: `/paginas/tema.html?id=${temaActual.id}`
  });

  indiceActual++;

  if (indiceActual < tarjetas.length) {
    mostrarTarjetaActual();
  } else {
    await finalizarActividad();
  }
}

async function finalizarActividad() {
  const duracionSeg = Math.round((Date.now() - tiempoInicio) / 1000);
  const total = tarjetas.length;

  try {
    await registrarIntento({
      actividad: 'flashcards',
      temaId: temaActual.id,
      nivel: 1,
      puntaje: aciertos,
      maximo: total,
      errores,
      duracionSeg,
      detalle: {
        totalTarjetas: total,
        aciertos,
        errores
      }
    });
  } catch (err) {
    // Error al registrar intento no debe impedir ver el resumen
  }

  const recomendaciones = [];
  if (errores === 0) {
    recomendaciones.push('¡Excelente dominio memorístico y conceptual! Estás listo para desafíos más avanzados.');
  } else {
    recomendaciones.push('Te recomendamos leer nuevamente la ficha del tema para consolidar los términos fallidos.');
    recomendaciones.push('Practicar con flashcards 10 minutos al día incrementa exponencialmente la retención a largo plazo.');
  }

  const decision = await mostrarResumen({
    titulo: 'Sesión de Flashcards Completada',
    aciertos,
    errores,
    recomendaciones,
    enlaceTema: `/paginas/tema.html?id=${temaActual.id}`
  });

  if (decision === 'repetir') {
    tarjetas = barajar([...tarjetas]);
    reiniciarEstado();
    renderizarEstructura();
    mostrarTarjetaActual();
  } else {
    window.location.href = `/paginas/tema.html?id=${temaActual.id}`;
  }
}

async function manejarGenerarFlashcardsIA() {
  const btnIa = document.getElementById('btn-ia-flashcards');
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
        mensaje: 'No se generaron tarjetas nuevas en este momento. Inténtalo de nuevo.'
      });
      return;
    }

    let agregadas = 0;
    nuevos.forEach(item => {
      if (!item || !item.termino) return;
      const existe = tarjetas.some(t => t && t.termino && t.termino.toLowerCase() === item.termino.trim().toLowerCase());
      if (!existe) {
        tarjetas.push({
          id: item.id || `glo_ia_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          termino: item.termino.trim(),
          definicion: item.definicion ? item.definicion.trim() : 'Definición conceptual.',
          pista: item.pista ? item.pista.trim() : 'Pista temática',
          retroalimentacion: item.retroalimentacion || `Término formativo sobre ${item.termino}.`
        });
        agregadas++;
      }
    });

    tarjetas = barajar([...tarjetas]);
    reiniciarEstado();
    renderizarEstructura();
    mostrarTarjetaActual();

    mostrarRetro({
      correcto: true,
      mensaje: `¡Se incorporaron ${agregadas > 0 ? agregadas : 'nuevas'} tarjetas de memoria generadas con IA!`
    });
  } catch (error) {
    mostrarRetro({
      correcto: false,
      mensaje: error.message || 'No se pudo conectar con el modelo de IA. Inténtalo más tarde.'
    });
  } finally {
    const btnActual = document.getElementById('btn-ia-flashcards');
    if (btnActual) {
      btnActual.disabled = false;
      btnActual.innerHTML = textoOriginal || '✨ Generar con IA';
    }
  }
}

iniciarActividad();
