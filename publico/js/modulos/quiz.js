// publico/js/modulos/quiz.js · Quiz formativo y adaptativo por niveles de Bloom
import { montarPlantilla } from '../nucleo/plantilla.js';
import api from '../nucleo/api.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { mostrarLogros } from '../nucleo/gamificacion.js';
import { generarDiploma } from '../nucleo/pdf.js';
import { aviso, escapar } from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Quiz por Niveles', roles: ['estudiante'] });

const contenido = document.getElementById('contenido');

const ICONOS_NIVELES = {
  1: '🧠',
  2: '💡',
  3: '🛠️',
  4: '🔍',
  5: '⚖️'
};

const DESCRIPCIONES_BLOOM = {
  1: 'Reconoce y recuerda hechos y conceptos esenciales.',
  2: 'Explica ideas y demuestra comprensión del tema.',
  3: 'Aplica el conocimiento en situaciones didácticas.',
  4: 'Descompone y examina relaciones causales.',
  5: 'Emite juicios críticos y evalúa fundamentos.'
};

let temaActual = null;
let sesionQuiz = null;
let preguntasNivel = [];
let indicePregunta = 0;
let nivelEnJuego = 1;
let respuestaSeleccionada = null;
let estadoNivelesCache = [];

async function iniciarModulo() {
  if (!contenido) return;

  try {
    temaActual = await obtenerTemaActividad();
    if (!temaActual) return;

    await renderizarPantallaNiveles();
  } catch (err) {
    contenido.innerHTML = `
      <div class="tarjeta" style="text-align: center; padding: var(--espacio-xl); color: var(--color-error);">
        <p>${escapar(err.message || 'No se pudo cargar el tema para el quiz.')}</p>
        <a href="/paginas/asignaturas.html" class="btn btn--primario" style="margin-top: var(--espacio-m);">Volver a asignaturas</a>
      </div>
    `;
  }
}

async function renderizarPantallaNiveles() {
  contenido.innerHTML = `
    <div class="quiz-contenedor">
      <div class="quiz-cabecera">
        <span class="quiz-tema-badge">${escapar(temaActual.titulo)}</span>
        <h1 class="h2">Desafío de Quiz por Niveles</h1>
        <p class="texto-secundario">Supera los 5 niveles cognitivos de la taxonomía de Bloom, desbloquea etapas y obtén tus diplomas de certificación.</p>
      </div>

      <div id="contenedor-niveles" class="quiz-niveles-grid">
        <div style="grid-column: 1 / -1; text-align: center; padding: var(--espacio-l);">
          <span class="insignia insignia--info">Cargando niveles disponibles...</span>
        </div>
      </div>
    </div>
  `;

  try {
    const data = await api.llamar('GET', `/api/quiz/estado?temaId=${encodeURIComponent(temaActual.id)}`);
    estadoNivelesCache = data.niveles || [];
    mostrarTarjetasNiveles(estadoNivelesCache);
  } catch (err) {
    const cont = document.getElementById('contenedor-niveles');
    if (cont) {
      cont.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; color: var(--color-error); padding: var(--espacio-m);">
          ${escapar(err.message || 'Error al obtener estado de los niveles')}
        </div>
      `;
    }
  }
}

function mostrarTarjetasNiveles(niveles) {
  const cont = document.getElementById('contenedor-niveles');
  if (!cont) return;

  cont.innerHTML = niveles.map(n => {
    const estado = n.estado; // 'bloqueado' | 'disponible' | 'aprobado'
    const esBloqueado = estado === 'bloqueado';
    const esAprobado = estado === 'aprobado';
    const icono = ICONOS_NIVELES[n.nivel] || '🎯';
    const descBloom = DESCRIPCIONES_BLOOM[n.nivel] || '';

    let badgeClass = 'insignia--alerta';
    let textoBadge = 'Disponible';
    if (esBloqueado) {
      badgeClass = 'insignia--secundario';
      textoBadge = '🔒 Bloqueado';
    } else if (esAprobado) {
      badgeClass = 'insignia--exito';
      textoBadge = '✅ Aprobado';
    }

    return `
      <article class="tarjeta-nivel tarjeta-nivel--${estado}">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--espacio-xs);">
            <span class="tarjeta-nivel__icono" aria-hidden="true">${icono}</span>
            <span class="insignia ${badgeClass}">${textoBadge}</span>
          </div>
          <div class="tarjeta-nivel__bloom">Nivel ${n.nivel} · ${escapar(n.nombre)}</div>
          <h2 class="tarjeta-nivel__titulo">${escapar(n.nombre)}</h2>
          <p class="texto-secundario" style="font-size: var(--texto-s);">${escapar(descBloom)}</p>
        </div>

        <div>
          <div class="tarjeta-nivel__porcentaje">
            <strong>Mejor puntaje:</strong> ${n.mejorPorcentaje || 0}%
          </div>

          <div class="tarjeta-nivel__acciones">
            ${esBloqueado ? `
              <button type="button" class="btn btn--deshabilitado" disabled>
                Supera el Nivel ${n.nivel - 1} para desbloquear
              </button>
            ` : `
              <button type="button" class="btn ${esAprobado ? 'btn--secundario' : 'btn--primario'} btn-iniciar-nivel" data-nivel="${n.nivel}">
                ${esAprobado ? '🔄 Repetir nivel' : '▶️ Comenzar quiz'}
              </button>
            `}
            ${esAprobado ? `
              <button type="button" class="btn btn--fantasma btn-diploma-nivel" data-nivel="${n.nivel}" title="Descargar diploma oficial">
                🎓 Descargar diploma
              </button>
            ` : ''}
          </div>
        </div>
      </article>
    `;
  }).join('');

  // Eventos de botones
  cont.querySelectorAll('.btn-iniciar-nivel').forEach(btn => {
    btn.addEventListener('click', () => {
      const nivel = Number(btn.getAttribute('data-nivel'));
      iniciarQuizNivel(nivel);
    });
  });

  cont.querySelectorAll('.btn-diploma-nivel').forEach(btn => {
    btn.addEventListener('click', async () => {
      const nivel = Number(btn.getAttribute('data-nivel'));
      await descargarDiplomaNivel(nivel, btn);
    });
  });
}

async function descargarDiplomaNivel(nivel, boton = null) {
  if (boton) {
    boton.disabled = true;
    boton.textContent = '⏳ Generando...';
  }

  try {
    await generarDiploma({
      tipo: 'nivel-quiz',
      temaId: temaActual.id,
      nivel
    });
    aviso('Diploma generado y descargado exitosamente.', 'exito');
  } catch (err) {
    aviso('No se pudo generar el diploma: ' + err.message, 'error');
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.textContent = '🎓 Descargar diploma';
    }
  }
}

async function iniciarQuizNivel(nivel) {
  nivelEnJuego = nivel;
  contenido.innerHTML = `
    <div class="quiz-contenedor" style="text-align: center; padding: var(--espacio-xl);">
      <span class="insignia insignia--primario" style="margin-bottom: var(--espacio-m);">Cargando Quiz...</span>
      <h2 class="h3">Preparando preguntas del Nivel ${nivel}...</h2>
    </div>
  `;

  try {
    const data = await api.llamar('POST', '/api/quiz/iniciar', {
      temaId: temaActual.id,
      nivel
    });

    sesionQuiz = data.sesionId;
    preguntasNivel = data.preguntas || [];
    indicePregunta = 0;
    respuestaSeleccionada = null;

    if (preguntasNivel.length === 0) {
      throw new Error('No se recibieron preguntas para este nivel.');
    }

    renderizarPreguntaActual();
  } catch (err) {
    aviso('No se pudo iniciar el quiz: ' + err.message, 'error');
    await renderizarPantallaNiveles();
  }
}

function renderizarPreguntaActual() {
  const total = preguntasNivel.length;
  const numActual = indicePregunta + 1;
  const pctProgreso = Math.round((numActual / total) * 100);
  const p = preguntasNivel[indicePregunta];

  respuestaSeleccionada = null;

  contenido.innerHTML = `
    <div class="quiz-contenedor">
      <div class="quiz-activo">
        <div class="quiz-progreso-barra">
          <div class="quiz-progreso-relleno" style="width: ${pctProgreso}%;"></div>
        </div>

        <div class="quiz-pregunta-header">
          <div class="quiz-tema-badge">Nivel ${nivelEnJuego} · ${escapar(temaActual.titulo)}</div>
          <div class="quiz-pregunta-contador">Pregunta ${numActual} de ${total}</div>
        </div>

        <h2 class="quiz-enunciado">${escapar(p.enunciado)}</h2>

        <div id="zona-respuesta">
          ${renderizarControlRespuesta(p)}
        </div>

        <div id="ranura-retro" class="quiz-retro-slot"></div>

        <div class="quiz-acciones-barra">
          <button type="button" class="btn btn--fantasma" id="btn-cancelar-quiz">
            Salir del quiz
          </button>
          <button type="button" class="btn btn--primario" id="btn-responder" disabled>
            Responder
          </button>
          <button type="button" class="btn btn--primario" id="btn-siguiente" style="display: none;">
            ${numActual === total ? 'Finalizar quiz' : 'Siguiente pregunta ▶️'}
          </button>
        </div>
      </div>
    </div>
  `;

  vincularEventosPregunta(p);
}

function renderizarControlRespuesta(pregunta) {
  if (pregunta.tipo === 'opcion') {
    const opciones = Array.isArray(pregunta.opciones) ? pregunta.opciones : [];
    return `
      <div class="quiz-opciones-radio" role="radiogroup" aria-label="Opciones de respuesta">
        ${opciones.map((opc, idx) => `
          <label class="quiz-opcion-item" id="label-opcion-${idx}">
            <input type="radio" name="respuesta-quiz" value="${idx}">
            <span>${escapar(opc)}</span>
          </label>
        `).join('')}
      </div>
    `;
  }

  if (pregunta.tipo === 'vf') {
    return `
      <div class="quiz-vf-grid" role="group" aria-label="Selecciona Verdadero o Falso">
        <button type="button" class="quiz-boton-vf" id="btn-vf-v" data-valor="true">
          👍 Verdadero
        </button>
        <button type="button" class="quiz-boton-vf" id="btn-vf-f" data-valor="false">
          👎 Falso
        </button>
      </div>
    `;
  }

  // Por defecto 'completar'
  return `
    <div class="quiz-completar-wrapper">
      <label for="input-completar" style="display:block; margin-bottom: var(--espacio-xs); font-weight: var(--peso-seminegrita);">
        Escribe el término que completa la frase:
      </label>
      <input
        type="text"
        id="input-completar"
        class="quiz-completar-input"
        placeholder="Escribe tu respuesta aquí..."
        autocomplete="off"
      >
    </div>
  `;
}

function vincularEventosPregunta(pregunta) {
  const btnResponder = document.getElementById('btn-responder');
  const btnSiguiente = document.getElementById('btn-siguiente');
  const btnCancelar = document.getElementById('btn-cancelar-quiz');
  const ranuraRetro = document.getElementById('ranura-retro');

  btnCancelar?.addEventListener('click', () => {
    if (confirm('¿Seguro que deseas salir? El progreso no guardado de esta sesión se perderá.')) {
      renderizarPantallaNiveles();
    }
  });

  if (pregunta.tipo === 'opcion') {
    const radios = document.querySelectorAll('input[name="respuesta-quiz"]');
    radios.forEach(radio => {
      radio.addEventListener('change', () => {
        document.querySelectorAll('.quiz-opcion-item').forEach(el => el.classList.remove('quiz-opcion-item--seleccionado'));
        radio.closest('.quiz-opcion-item')?.classList.add('quiz-opcion-item--seleccionado');
        respuestaSeleccionada = radio.value;
        btnResponder.disabled = false;
      });
    });
  } else if (pregunta.tipo === 'vf') {
    const btnV = document.getElementById('btn-vf-v');
    const btnF = document.getElementById('btn-vf-f');

    btnV?.addEventListener('click', () => {
      btnV.classList.add('quiz-boton-vf--activo');
      btnF?.classList.remove('quiz-boton-vf--activo');
      respuestaSeleccionada = true;
      btnResponder.disabled = false;
    });

    btnF?.addEventListener('click', () => {
      btnF.classList.add('quiz-boton-vf--activo');
      btnV?.classList.remove('quiz-boton-vf--activo');
      respuestaSeleccionada = false;
      btnResponder.disabled = false;
    });
  } else {
    // Tipo completar
    const inputComp = document.getElementById('input-completar');
    inputComp?.focus();
    inputComp?.addEventListener('input', () => {
      const val = inputComp.value.trim();
      respuestaSeleccionada = val;
      btnResponder.disabled = val.length === 0;
    });
    inputComp?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !btnResponder.disabled) {
        btnResponder.click();
      }
    });
  }

  // Acción Responder
  btnResponder?.addEventListener('click', async () => {
    if (respuestaSeleccionada === null || respuestaSeleccionada === undefined || respuestaSeleccionada === '') {
      return;
    }

    btnResponder.disabled = true;
    btnResponder.textContent = '⏳ Verificando...';

    // Deshabilitar entradas
    deshabilitarEntradasPregunta();

    try {
      const evaluacion = await api.llamar('POST', '/api/quiz/responder', {
        sesionId: sesionQuiz,
        preguntaId: pregunta.id,
        respuesta: respuestaSeleccionada
      });

      // Mostrar retroalimentación con el componente del núcleo
      mostrarRetro({
        correcto: evaluacion.correcto,
        explicacion: evaluacion.retroalimentacion || (evaluacion.correcto ? '¡Has respondido con precisión!' : 'Respuesta registrada.'),
        sugerencia: !evaluacion.correcto && evaluacion.correcta ? `La respuesta esperada era: "${evaluacion.correcta}".` : '',
        enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`,
        contenedor: ranuraRetro
      });

      btnResponder.style.display = 'none';
      btnSiguiente.style.display = 'inline-block';
      btnSiguiente.focus();
    } catch (err) {
      aviso('Error al enviar la respuesta: ' + err.message, 'error');
      btnResponder.disabled = false;
      btnResponder.textContent = 'Responder';
    }
  });

  // Acción Siguiente
  btnSiguiente?.addEventListener('click', async () => {
    btnSiguiente.disabled = true;
    indicePregunta++;

    if (indicePregunta < preguntasNivel.length) {
      renderizarPreguntaActual();
    } else {
      await finalizarQuiz();
    }
  });
}

function deshabilitarEntradasPregunta() {
  document.querySelectorAll('input[name="respuesta-quiz"]').forEach(r => r.disabled = true);
  document.querySelectorAll('.quiz-boton-vf').forEach(b => b.disabled = true);
  const inputComp = document.getElementById('input-completar');
  if (inputComp) inputComp.disabled = true;
}

async function finalizarQuiz() {
  contenido.innerHTML = `
    <div class="quiz-contenedor" style="text-align: center; padding: var(--espacio-xl);">
      <span class="insignia insignia--primario" style="margin-bottom: var(--espacio-m);">Calculando resultados...</span>
      <h2 class="h3">Consolidando tu progreso en el Nivel ${nivelEnJuego}...</h2>
    </div>
  `;

  try {
    const resFinal = await api.llamar('POST', '/api/quiz/finalizar', {
      sesionId: sesionQuiz
    });

    // 1. Mostrar resumen en modal pedagógico
    await mostrarResumen({
      titulo: `Resumen - Nivel ${nivelEnJuego} (${resFinal.aprobado ? 'Aprobado' : 'No superado'})`,
      aciertos: resFinal.aciertos,
      errores: resFinal.errores !== undefined ? resFinal.errores : (resFinal.total - resFinal.aciertos),
      recomendaciones: resFinal.repasar || [],
      enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`
    });

    // 2. Si aprobó, mostrar logros
    if (resFinal.aprobado) {
      await mostrarLogros({
        puntosGanados: resFinal.puntosGanados,
        insigniasNuevas: resFinal.insigniasNuevas
      });
    }

    // 3. Renderizar vista de resultados finales con diplomas y botones de reintento
    renderizarPantallaResultado(resFinal);
  } catch (err) {
    aviso('Error al finalizar el quiz: ' + err.message, 'error');
    await renderizarPantallaNiveles();
  }
}

function renderizarPantallaResultado(res) {
  const aprobado = res.aprobado;

  contenido.innerHTML = `
    <div class="quiz-contenedor">
      <div class="quiz-activo quiz-resultado-card">
        <div class="quiz-resultado-icono" aria-hidden="true">${aprobado ? '🏆' : '💪'}</div>
        <div class="quiz-resultado-porcentaje">${res.porcentaje}%</div>
        <h2 class="h2">${aprobado ? `¡Felicidades! Superaste el Nivel ${nivelEnJuego}` : `Nivel ${nivelEnJuego} no superado`}</h2>
        <p class="texto-secundario">
          ${aprobado
            ? `Has respondido correctamente ${res.aciertos} de ${res.total} preguntas y acreditado tu nivel en este tema.`
            : `Obtuviste ${res.aciertos} aciertos de ${res.total}. Necesitas al menos 70% para aprobar y desbloquear la siguiente etapa.`}
        </p>

        ${aprobado ? `
          <div style="margin: var(--espacio-l) 0; padding: var(--espacio-m); background-color: var(--color-exito-fondo, #e6f4ea); border: 1px solid var(--color-exito); border-radius: var(--radio-m);">
            <strong style="color: var(--color-exito, #137333);">🎓 Certificación oficial disponible:</strong>
            <p style="margin: var(--espacio-xs) 0 0 0; font-size: var(--texto-s);">
              Tu logro ha sido registrado en tu expediente digital. Puedes descargar tu diploma A4 con código de validación único.
            </p>
          </div>
        ` : ''}

        <div class="quiz-resultado-acciones">
          ${aprobado ? `
            <button type="button" class="btn btn--primario" id="btn-descargar-diploma-final">
              🎓 Descargar diploma del Nivel ${nivelEnJuego}
            </button>
            ${nivelEnJuego < 5 ? `
              <button type="button" class="btn btn--secundario" id="btn-siguiente-nivel">
                ▶️ Continuar al Nivel ${nivelEnJuego + 1}
              </button>
            ` : ''}
          ` : `
            <button type="button" class="btn btn--primario" id="btn-reintentar-quiz">
              🔄 Reintentar nivel (preguntas nuevas)
            </button>
            <a href="/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}" class="btn btn--secundario">
              📖 Repasar contenido del tema
            </a>
          `}
          <button type="button" class="btn btn--fantasma" id="btn-volver-niveles">
            📋 Volver al listado de niveles
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-descargar-diploma-final')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    await descargarDiplomaNivel(nivelEnJuego, btn);
  });

  document.getElementById('btn-siguiente-nivel')?.addEventListener('click', () => {
    iniciarQuizNivel(nivelEnJuego + 1);
  });

  document.getElementById('btn-reintentar-quiz')?.addEventListener('click', () => {
    iniciarQuizNivel(nivelEnJuego);
  });

  document.getElementById('btn-volver-niveles')?.addEventListener('click', () => {
    renderizarPantallaNiveles();
  });
}

// Inicializar módulo
iniciarModulo();

