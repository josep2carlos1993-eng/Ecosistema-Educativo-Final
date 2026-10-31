// publico/js/modulos/banco-preguntas.js · Gestión del Banco de Preguntas para docentes y admin
import { montarPlantilla } from '../nucleo/plantilla.js';
import api from '../nucleo/api.js';
import { parametro } from '../nucleo/util.js';
import { aviso, confirmar, modal, escapar } from '../nucleo/ui.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Banco de Preguntas', roles: ['docente', 'admin'] });

const contenido = document.getElementById('contenido');
if (!contenido) {
  throw new Error('Contenedor #contenido no encontrado');
}

const NOMBRES_BLOOM = {
  1: 'Recordar',
  2: 'Comprender',
  3: 'Aplicar',
  4: 'Analizar',
  5: 'Evaluar'
};

let temasDisponibles = [];
let temaActual = null;
let nivelActual = 1;
let todasPreguntas = [];

async function iniciar() {
  try {
    const [temas, unidades, asignaturas] = await Promise.all([
      api.listar('temas'),
      api.listar('unidades').catch(() => []),
      api.listar('asignaturas').catch(() => [])
    ]);

    const mapaAsignatura = new Map((asignaturas || []).map(a => [a.id, a.nombre]));
    const mapaUnidad = new Map((unidades || []).map(u => [u.id, u]));

    temasDisponibles = (temas || []).map(t => {
      const u = mapaUnidad.get(t.unidadId);
      const asigNombre = u ? (mapaAsignatura.get(u.asignaturaId) || 'Asignatura') : 'General';
      return {
        ...t,
        nombreCompleto: `${asigNombre} · ${t.titulo}`
      };
    });

    if (temasDisponibles.length === 0) {
      contenido.innerHTML = `
        <div class="tarjeta" style="text-align: center; padding: var(--espacio-xl); color: var(--color-texto-suave);">
          No hay temas registrados en el sistema para gestionar preguntas.
        </div>
      `;
      return;
    }

    const temaIdParam = parametro('temaId');
    temaActual = temasDisponibles.find(t => t.id === temaIdParam) || temasDisponibles[0];

    await cargarPreguntas();
    renderizarInterfaz();
  } catch (error) {
    contenido.innerHTML = `
      <div class="alerta alerta--error">
        ${escapar(error.message || 'Error al cargar los temas del banco de preguntas')}
      </div>
    `;
  }
}

async function cargarPreguntas() {
  if (!temaActual) return;
  try {
    const preguntas = await api.listar('preguntas', { temaId: temaActual.id });
    todasPreguntas = preguntas || [];
  } catch (err) {
    todasPreguntas = [];
    aviso(err.message || 'Error al cargar preguntas', 'error');
  }
}

function renderizarInterfaz() {
  const preguntasNivel = todasPreguntas.filter(p => Number(p.nivel) === nivelActual);
  const aprobadasNivel = preguntasNivel.filter(p => p.estado === 'aprobado').length;

  contenido.innerHTML = `
    <div class="banco-contenedor">
      <header class="banco-cabecera">
        <div>
          <h1 class="banco-titulo">📚 Banco de Preguntas</h1>
          <p class="banco-subtitulo">
            Gestiona, edita y genera con Inteligencia Artificial las preguntas evaluativas clasificadas por niveles cognitivos.
          </p>
        </div>
      </header>

      <!-- Selector de Tema -->
      <section class="banco-selector-tema" aria-label="Selección de tema">
        <label for="select-tema" class="banco-selector-tema__label">Tema formativo:</label>
        <select id="select-tema" class="campo__control banco-selector-tema__select">
          ${temasDisponibles.map(t => `
            <option value="${escapar(t.id)}" ${t.id === temaActual.id ? 'selected' : ''}>
              ${escapar(t.nombreCompleto)}
            </option>
          `).join('')}
        </select>
      </section>

      <!-- Pestañas de niveles 1 a 5 -->
      <nav class="banco-pestanas" aria-label="Niveles de preguntas">
        ${[1, 2, 3, 4, 5].map(n => {
          const aprobadas = todasPreguntas.filter(p => Number(p.nivel) === n && p.estado === 'aprobado').length;
          return `
            <button type="button"
                    class="banco-pestana ${n === nivelActual ? 'banco-pestana--activa' : ''}"
                    data-nivel="${n}">
              <span>Nivel ${n}: ${NOMBRES_BLOOM[n]}</span>
              <span class="banco-pestana__conteo">${aprobadas}</span>
            </button>
          `;
        }).join('')}
      </nav>

      <!-- Aviso si hay menos de 20 preguntas aprobadas en el nivel activo -->
      ${aprobadasNivel < 20 ? `
        <div class="alerta alerta--advertencia" style="display: flex; align-items: center; gap: var(--espacio-s);">
          <span style="font-size: var(--texto-l);" aria-hidden="true">⚠️</span>
          <div>
            <strong>Recomendación pedagógica:</strong>
            Actualmente hay <strong>${aprobadasNivel}</strong> preguntas aprobadas en el Nivel ${nivelActual} (${NOMBRES_BLOOM[nivelActual]}).
            Se sugiere contar con al menos <strong>20 preguntas</strong> para garantizar variedad y rotación adecuada en las evaluaciones de quiz.
          </div>
        </div>
      ` : ''}

      <!-- Barra de herramientas -->
      <div class="banco-herramientas">
        <div style="font-size: var(--texto-s); color: var(--color-texto-suave);">
          Mostrando <strong>${preguntasNivel.length}</strong> preguntas en este nivel
        </div>
        <div class="banco-acciones">
          ${usuarioActual()?.rol === 'admin' ? `
            <a href="/paginas/admin-ajustes.html" class="btn btn--fantasma" title="Configurar modelo y API de IA">
              ⚙️ Configurar IA
            </a>
          ` : ''}
          <button type="button" class="btn btn--secundario" id="btn-ia">
            🤖 Generar con IA
          </button>
          <button type="button" class="btn btn--primario" id="btn-nueva-pregunta">
            + Nueva pregunta
          </button>
        </div>
      </div>

      <!-- Lista de preguntas -->
      <section class="banco-lista-preguntas" aria-label="Lista de preguntas del nivel actual">
        ${preguntasNivel.length === 0 ? `
          <div class="tarjeta" style="text-align: center; padding: var(--espacio-xl); color: var(--color-texto-suave);">
            No hay preguntas registradas en el Nivel ${nivelActual}. Puedes crear una manualmente o utilizar "Generar con IA".
          </div>
        ` : preguntasNivel.map(p => `
          <article class="tarjeta-pregunta">
            <div class="tarjeta-pregunta__cabecera">
              <div class="tarjeta-pregunta__etiquetas">
                <span class="insignia insignia--primario">${formatearTipo(p.tipo)}</span>
                <span class="insignia ${p.estado === 'aprobado' ? 'insignia--exito' : 'insignia--advertencia'}">
                  ${p.estado === 'aprobado' ? '✅ Aprobada' : '⏳ ' + escapar(p.estado || 'Pendiente')}
                </span>
                ${p.origen === 'ia' ? `<span class="insignia insignia--acento">🤖 Generada por IA</span>` : ''}
              </div>
            </div>

            <p class="tarjeta-pregunta__enunciado">${escapar(p.enunciado)}</p>

            ${renderizarOpcionesPregunta(p)}

            ${p.retroalimentacion ? `
              <p class="tarjeta-pregunta__retro">
                <strong>Retroalimentación:</strong> ${escapar(p.retroalimentacion)}
              </p>
            ` : ''}

            <div class="tarjeta-pregunta__acciones">
              <button type="button" class="btn btn--texto btn--pequeno btn-editar" data-id="${escapar(p.id)}">
                ✏️ Editar
              </button>
              <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar" data-id="${escapar(p.id)}">
                🗑️ Eliminar
              </button>
            </div>
          </article>
        `).join('')}
      </section>
    </div>
  `;

  conectarEventos();
}

function formatearTipo(tipo) {
  if (tipo === 'opcion') return 'Opción múltiple';
  if (tipo === 'vf') return 'Verdadero / Falso';
  if (tipo === 'completar') return 'Completar';
  return tipo || 'Pregunta';
}

function renderizarOpcionesPregunta(p) {
  if (p.tipo === 'opcion' && Array.isArray(p.opciones)) {
    return `
      <ul class="tarjeta-pregunta__opciones">
        ${p.opciones.map((op, idx) => `
          <li class="tarjeta-pregunta__opcion ${Number(p.correcta) === idx ? 'tarjeta-pregunta__opcion--correcta' : ''}">
            <span>${idx + 1}.</span>
            <span>${escapar(op)}</span>
            ${Number(p.correcta) === idx ? '<span>(Correcta)</span>' : ''}
          </li>
        `).join('')}
      </ul>
    `;
  }
  if (p.tipo === 'vf') {
    return `
      <div style="font-size: var(--texto-xs); color: var(--color-texto);">
        <strong>Respuesta correcta:</strong>
        <span class="insignia ${p.correcta === true || p.correcta === 'true' ? 'insignia--exito' : 'insignia--advertencia'}">
          ${p.correcta === true || p.correcta === 'true' ? 'Verdadero' : 'Falso'}
        </span>
      </div>
    `;
  }
  if (p.tipo === 'completar') {
    return `
      <div style="font-size: var(--texto-xs); color: var(--color-texto);">
        <strong>Respuesta exacta requerida:</strong>
        <code>${escapar(String(p.correcta || ''))}</code>
      </div>
    `;
  }
  return '';
}

function conectarEventos() {
  // Cambio de tema
  const selTema = document.getElementById('select-tema');
  if (selTema) {
    selTema.addEventListener('change', async () => {
      const id = selTema.value;
      temaActual = temasDisponibles.find(t => t.id === id) || temaActual;
      await cargarPreguntas();
      renderizarInterfaz();
    });
  }

  // Cambio de nivel por pestaña
  const botonesPestana = document.querySelectorAll('.banco-pestana');
  botonesPestana.forEach(btn => {
    btn.addEventListener('click', () => {
      const n = parseInt(btn.getAttribute('data-nivel'), 10);
      if (n && n !== nivelActual) {
        nivelActual = n;
        renderizarInterfaz();
      }
    });
  });

  // Botón nueva pregunta manual
  const btnNueva = document.getElementById('btn-nueva-pregunta');
  if (btnNueva) {
    btnNueva.addEventListener('click', () => abrirModalPregunta());
  }

  // Botón Generar con IA
  const btnIa = document.getElementById('btn-ia');
  if (btnIa) {
    btnIa.addEventListener('click', () => abrirGeneradorIA());
  }

  // Botones editar y eliminar
  document.querySelectorAll('.btn-editar').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const preg = todasPreguntas.find(p => p.id === id);
      if (preg) abrirModalPregunta(preg);
    });
  });

  document.querySelectorAll('.btn-eliminar').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const confirmado = await confirmar('¿Estás seguro de que deseas eliminar esta pregunta permanentemente?');
      if (confirmado) {
        try {
          await api.eliminar('preguntas', id);
          aviso('Pregunta eliminada con éxito', 'exito');
          await cargarPreguntas();
          renderizarInterfaz();
        } catch (err) {
          aviso(err.message || 'Error al eliminar la pregunta', 'error');
        }
      }
    });
  });
}

/**
 * Modal unificado de edición / creación manual de pregunta
 */
async function abrirModalPregunta(preguntaExistente = null) {
  const esEdicion = Boolean(preguntaExistente && preguntaExistente.id);
  const tipoInicial = preguntaExistente?.tipo || 'opcion';

  const contenedorModal = document.createElement('div');
  contenedorModal.className = 'pila pila--media';

  function construirFormulario(tipo) {
    const opciones = Array.isArray(preguntaExistente?.opciones) ? preguntaExistente.opciones : ['', '', '', ''];
    const correcta = preguntaExistente?.correcta;

    let htmlOpciones = '';
    if (tipo === 'opcion') {
      htmlOpciones = `
        <div class="pila pila--compacta" id="caja-opciones">
          <label class="campo__etiqueta">4 Opciones de respuesta y selección de la correcta:</label>
          ${[0, 1, 2, 3].map(i => `
            <div style="display: flex; align-items: center; gap: var(--espacio-s);">
              <input type="radio" name="modal-correcta" value="${i}" id="rad-corr-${i}" ${Number(correcta) === i ? 'checked' : (i === 0 && correcta === undefined ? 'checked' : '')}>
              <input type="text" id="modal-opcion-${i}" class="campo__control" placeholder="Opción ${i + 1}" value="${escapar(opciones[i] || '')}" required>
            </div>
          `).join('')}
        </div>
      `;
    } else if (tipo === 'vf') {
      const valVerdadero = correcta === true || correcta === 'true';
      htmlOpciones = `
        <div class="campo" id="caja-vf">
          <label class="campo__etiqueta">Respuesta Correcta:</label>
          <select id="modal-correcta-vf" class="campo__control">
            <option value="true" ${valVerdadero ? 'selected' : ''}>Verdadero</option>
            <option value="false" ${!valVerdadero ? 'selected' : ''}>Falso</option>
          </select>
        </div>
      `;
    } else {
      htmlOpciones = `
        <div class="campo" id="caja-completar">
          <label for="modal-correcta-completar" class="campo__etiqueta">Palabra o frase exacta que completa el espacio ("____"):</label>
          <input type="text" id="modal-correcta-completar" class="campo__control" value="${escapar(String(correcta || ''))}" placeholder="Término exacto" required>
        </div>
      `;
    }

    return `
      <div class="campo">
        <label for="modal-tipo" class="campo__etiqueta">Tipo de Pregunta</label>
        <select id="modal-tipo" class="campo__control">
          <option value="opcion" ${tipo === 'opcion' ? 'selected' : ''}>Opción múltiple (4 opciones)</option>
          <option value="vf" ${tipo === 'vf' ? 'selected' : ''}>Verdadero / Falso</option>
          <option value="completar" ${tipo === 'completar' ? 'selected' : ''}>Completar espacio en blanco</option>
        </select>
      </div>

      <div class="campo">
        <label for="modal-enunciado" class="campo__etiqueta">Enunciado de la Pregunta</label>
        <textarea id="modal-enunciado" class="campo__control" rows="3" required placeholder="Redacta la pregunta formativa...">${escapar(preguntaExistente?.enunciado || '')}</textarea>
      </div>

      <div id="contenedor-dinamico-opciones">
        ${htmlOpciones}
      </div>

      <div class="campo">
        <label for="modal-retro" class="campo__etiqueta">Retroalimentación Didáctica</label>
        <textarea id="modal-retro" class="campo__control" rows="2" placeholder="Explica por qué es correcta y orienta al estudiante...">${escapar(preguntaExistente?.retroalimentacion || '')}</textarea>
      </div>

      <div class="campo">
        <label for="modal-estado" class="campo__etiqueta">Estado de la Pregunta</label>
        <select id="modal-estado" class="campo__control">
          <option value="aprobado" ${preguntaExistente?.estado !== 'borrador' ? 'selected' : ''}>Aprobada (disponible en el quiz)</option>
          <option value="borrador" ${preguntaExistente?.estado === 'borrador' ? 'selected' : ''}>Borrador (en revisión)</option>
        </select>
      </div>
    `;
  }

  contenedorModal.innerHTML = construirFormulario(tipoInicial);

  contenedorModal.addEventListener('change', e => {
    if (e.target.id === 'modal-tipo') {
      const nuevoTipo = e.target.value;
      const dynContainer = contenedorModal.querySelector('#contenedor-dinamico-opciones');
      if (dynContainer) {
        if (nuevoTipo === 'opcion') {
          dynContainer.innerHTML = `
            <div class="pila pila--compacta" id="caja-opciones">
              <label class="campo__etiqueta">4 Opciones de respuesta y selección de la correcta:</label>
              ${[0, 1, 2, 3].map(i => `
                <div style="display: flex; align-items: center; gap: var(--espacio-s);">
                  <input type="radio" name="modal-correcta" value="${i}" id="rad-corr-${i}" ${i === 0 ? 'checked' : ''}>
                  <input type="text" id="modal-opcion-${i}" class="campo__control" placeholder="Opción ${i + 1}" required>
                </div>
              `).join('')}
            </div>
          `;
        } else if (nuevoTipo === 'vf') {
          dynContainer.innerHTML = `
            <div class="campo" id="caja-vf">
              <label class="campo__etiqueta">Respuesta Correcta:</label>
              <select id="modal-correcta-vf" class="campo__control">
                <option value="true">Verdadero</option>
                <option value="false">Falso</option>
              </select>
            </div>
          `;
        } else {
          dynContainer.innerHTML = `
            <div class="campo" id="caja-completar">
              <label for="modal-correcta-completar" class="campo__etiqueta">Palabra o frase exacta que completa el espacio ("____"):</label>
              <input type="text" id="modal-correcta-completar" class="campo__control" placeholder="Término exacto" required>
            </div>
          `;
        }
      }
    }
  });

  const respuestaModal = await modal({
    titulo: esEdicion ? 'Editar Pregunta' : `Nueva Pregunta · Nivel ${nivelActual} (${NOMBRES_BLOOM[nivelActual]})`,
    contenido: contenedorModal,
    acciones: [
      { texto: 'Cancelar', valor: null, clase: 'btn btn--secundario' },
      { texto: 'Guardar Pregunta', valor: 'guardar', clase: 'btn btn--primario' }
    ]
  });

  if (respuestaModal === 'guardar') {
    const selTipo = contenedorModal.querySelector('#modal-tipo');
    const txtEnunciado = contenedorModal.querySelector('#modal-enunciado');
    const txtRetro = contenedorModal.querySelector('#modal-retro');
    const selEstado = contenedorModal.querySelector('#modal-estado');

    const tipo = selTipo.value;
    const enunciado = txtEnunciado.value.trim();
    const retroalimentacion = txtRetro.value.trim();
    const estado = selEstado.value;

    if (!enunciado) {
      aviso('El enunciado de la pregunta no puede estar vacío.', 'error');
      return;
    }

    let opciones = [];
    let correcta = null;

    if (tipo === 'opcion') {
      opciones = [
        contenedorModal.querySelector('#modal-opcion-0')?.value.trim() || '',
        contenedorModal.querySelector('#modal-opcion-1')?.value.trim() || '',
        contenedorModal.querySelector('#modal-opcion-2')?.value.trim() || '',
        contenedorModal.querySelector('#modal-opcion-3')?.value.trim() || ''
      ];
      if (opciones.some(op => !op)) {
        aviso('Debes completar las 4 opciones de respuesta.', 'error');
        return;
      }
      const radChecked = contenedorModal.querySelector('input[name="modal-correcta"]:checked');
      correcta = radChecked ? parseInt(radChecked.value, 10) : 0;
    } else if (tipo === 'vf') {
      opciones = ['Verdadero', 'Falso'];
      const selVf = contenedorModal.querySelector('#modal-correcta-vf');
      correcta = selVf.value === 'true';
    } else if (tipo === 'completar') {
      opciones = [];
      const txtComp = contenedorModal.querySelector('#modal-correcta-completar');
      correcta = txtComp ? txtComp.value.trim() : '';
      if (!correcta) {
        aviso('Debes indicar la palabra correcta para completar.', 'error');
        return;
      }
    }

    const payload = {
      temaId: temaActual.id,
      nivel: nivelActual,
      tipo,
      enunciado,
      opciones,
      correcta,
      retroalimentacion,
      estado,
      origen: preguntaExistente?.origen || 'docente'
    };

    try {
      if (esEdicion) {
        await api.actualizar('preguntas', preguntaExistente.id, payload);
        aviso('Pregunta actualizada correctamente', 'exito');
      } else {
        await api.crear('preguntas', payload);
        aviso('Pregunta creada exitosamente', 'exito');
      }
      await cargarPreguntas();
      renderizarInterfaz();
    } catch (err) {
      aviso(err.message || 'Error al guardar la pregunta', 'error');
    }
  }
}

/**
 * Generador interactivo de preguntas mediante IA
 */
async function abrirGeneradorIA() {
  const panel = document.createElement('div');
  panel.className = 'pila pila--media';
  panel.innerHTML = `
    <p style="font-size: var(--texto-s); color: var(--color-texto-suave); margin: 0;">
      Se generarán preguntas alineadas al <strong>Nivel ${nivelActual}: ${NOMBRES_BLOOM[nivelActual]}</strong> del tema <strong>${escapar(temaActual.titulo)}</strong>.
    </p>
    <div class="campo">
      <label for="cant-ia" class="campo__etiqueta">Cantidad de preguntas a proponer (5 a 15):</label>
      <input type="number" id="cant-ia" class="campo__control" value="5" min="5" max="15">
    </div>
  `;

  const conf = await modal({
    titulo: 'Generar Preguntas con Inteligencia Artificial',
    contenido: panel,
    acciones: [
      { texto: 'Cancelar', valor: false, clase: 'btn btn--secundario' },
      { texto: 'Generar Propuestas', valor: true, clase: 'btn btn--primario' }
    ]
  });

  if (!conf) return;

  const inputCant = panel.querySelector('#cant-ia');
  const cantidad = Math.max(5, Math.min(15, parseInt(inputCant?.value || '5', 10)));

  const panelCargando = document.createElement('div');
  panelCargando.style.textAlign = 'center';
  panelCargando.style.padding = 'var(--espacio-xl)';
  panelCargando.innerHTML = `
    <div style="font-size: var(--texto-3xl); margin-bottom: var(--espacio-s);">🤖</div>
    <div style="font-weight: var(--peso-seminegrita); color: var(--color-primario);">La Inteligencia Artificial está analizando los contenidos pedagógicos...</div>
    <p style="font-size: var(--texto-s); color: var(--color-texto-suave);">Formulando preguntas en base al nivel Bloom seleccionado.</p>
  `;

  let resultadoIA = [];
  try {
    resultadoIA = await api.ia('generar-preguntas', {
      temaId: temaActual.id,
      nivel: nivelActual,
      cantidad
    });
  } catch (err) {
    aviso(err.message || 'Error al generar preguntas con IA', 'error');
    return;
  }

  if (!Array.isArray(resultadoIA) || resultadoIA.length === 0) {
    aviso('No se recibieron propuestas de preguntas.', 'error');
    return;
  }

  // Panel de revisión de propuestas generadas
  let propuestas = resultadoIA.map((p, idx) => ({ ...p, _idx: idx, _estado: 'pendiente' }));

  const panelPropuestas = document.createElement('div');
  panelPropuestas.className = 'propuestas-ia-contenedor';

  function renderizarListaPropuestas() {
    panelPropuestas.innerHTML = propuestas.map(p => `
      <div class="tarjeta-propuesta ${p._estado === 'aprobado' ? 'tarjeta-propuesta--aprobada' : (p._estado === 'descartado' ? 'tarjeta-propuesta--descartada' : '')}" id="propuesta-${p._idx}">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espacio-xs);">
          <span class="insignia insignia--primario">${formatearTipo(p.tipo)}</span>
          <span class="insignia ${p._estado === 'aprobado' ? 'insignia--exito' : 'insignia--advertencia'}">
            ${p._estado === 'aprobado' ? 'Aprobada y guardada' : (p._estado === 'descartado' ? 'Descartada' : 'Propuesta IA')}
          </span>
        </div>
        <div style="font-weight: var(--peso-seminegrita); font-size: var(--texto-s);">${escapar(p.enunciado)}</div>
        ${renderizarOpcionesPregunta(p)}
        ${p.retroalimentacion ? `
          <div style="font-size: var(--texto-xs); color: var(--color-info);">
            <strong>Retroalimentación:</strong> ${escapar(p.retroalimentacion)}
          </div>
        ` : ''}
        ${p._estado === 'pendiente' ? `
          <div style="display: flex; justify-content: flex-end; gap: var(--espacio-xs); margin-top: var(--espacio-xs);">
            <button type="button" class="btn btn--exito btn--pequeno btn-aprobar-ia" data-idx="${p._idx}">
              ✅ Aprobar
            </button>
            <button type="button" class="btn btn--secundario btn--pequeno btn-editar-ia" data-idx="${p._idx}">
              ✏️ Editar
            </button>
            <button type="button" class="btn btn--peligro btn--pequeno btn-descartar-ia" data-idx="${p._idx}">
              🗑️ Descartar
            </button>
          </div>
        ` : ''}
      </div>
    `).join('');

    conectarEventosPropuestas();
  }

  function conectarEventosPropuestas() {
    panelPropuestas.querySelectorAll('.btn-aprobar-ia').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        const item = propuestas.find(pr => pr._idx === idx);
        if (item) {
          try {
            await api.crear('preguntas', {
              temaId: temaActual.id,
              nivel: nivelActual,
              tipo: item.tipo,
              enunciado: item.enunciado,
              opciones: item.opciones || [],
              correcta: item.correcta,
              retroalimentacion: item.retroalimentacion || '',
              origen: 'ia',
              estado: 'aprobado'
            });
            item._estado = 'aprobado';
            aviso('Pregunta aprobada y guardada', 'exito');
            renderizarListaPropuestas();
            await cargarPreguntas();
          } catch (err) {
            aviso(err.message || 'Error al aprobar pregunta', 'error');
          }
        }
      });
    });

    panelPropuestas.querySelectorAll('.btn-descartar-ia').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        const item = propuestas.find(pr => pr._idx === idx);
        if (item) {
          item._estado = 'descartado';
          renderizarListaPropuestas();
        }
      });
    });

    panelPropuestas.querySelectorAll('.btn-editar-ia').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        const item = propuestas.find(pr => pr._idx === idx);
        if (item) {
          await abrirModalPregunta({ ...item, origen: 'ia', estado: 'aprobado' });
          item._estado = 'aprobado';
          renderizarListaPropuestas();
        }
      });
    });
  }

  renderizarListaPropuestas();

  await modal({
    titulo: `Propuestas de Preguntas con IA (${propuestas.length})`,
    contenido: panelPropuestas,
    acciones: [
      {
        texto: 'Aprobar todas las pendientes',
        valor: 'aprobar-todas',
        clase: 'btn btn--primario'
      },
      {
        texto: 'Finalizar revisión',
        valor: 'cerrar',
        clase: 'btn btn--secundario'
      }
    ]
  }).then(async accion => {
    if (accion === 'aprobar-todas') {
      const pendientes = propuestas.filter(pr => pr._estado === 'pendiente');
      for (const item of pendientes) {
        try {
          await api.crear('preguntas', {
            temaId: temaActual.id,
            nivel: nivelActual,
            tipo: item.tipo,
            enunciado: item.enunciado,
            opciones: item.opciones || [],
            correcta: item.correcta,
            retroalimentacion: item.retroalimentacion || '',
            origen: 'ia',
            estado: 'aprobado'
          });
        } catch {}
      }
      aviso('Todas las preguntas pendientes fueron aprobadas y guardadas', 'exito');
      await cargarPreguntas();
    }
    renderizarInterfaz();
  });
}

iniciar();

