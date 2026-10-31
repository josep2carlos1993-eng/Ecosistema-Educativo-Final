// publico/js/modulos/editor-tema.js · Ficha del tema y glosario
import { montarPlantilla } from '../nucleo/plantilla.js';
import api from '../nucleo/api.js';
import { parametro, normalizar, formatoBasico } from '../nucleo/util.js';
import { confirmar, modal, aviso, escapar } from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Ficha del Tema', roles: ['docente', 'admin'] });

const temaId = parametro('id');
if (!temaId) {
  aviso('No se especificó ningún tema para editar.', 'error');
  window.location.href = '/paginas/editor-contenidos.html';
}

const contenido = document.getElementById('contenido');
async function iniciar() {
  if (!contenido || !temaId) return;

  let tema = null;
  let glosario = [];
  let hayCambiosSinGuardar = false;

  function marcarCambio() {
    hayCambiosSinGuardar = true;
    const indicador = document.getElementById('indicador-cambios');
    if (indicador) indicador.classList.remove('oculto');
  }

  function contarPalabras(texto) {
    if (!texto || typeof texto !== 'string') return 0;
    return texto.trim().split(/\s+/).filter(Boolean).length;
  }

  contenido.innerHTML = `
    <div class="pila pila--amplia">
      <header class="ficha-cabecera">
        <div class="ficha-cabecera__izq">
          <a href="/paginas/editor-contenidos.html" id="btn-volver" class="btn btn--texto btn--pequeno">
            ← Volver a Contenidos
          </a>
          <div>
            <h1 style="font-size: var(--texto-xl); color: var(--color-primario);" id="titulo-tema-cabecera">Cargando tema...</h1>
            <span id="indicador-cambios" class="insignia insignia--advertencia oculto">Cambios sin guardar</span>
          </div>
        </div>
        <div class="ficha-cabecera__acciones">
          <button type="button" id="btn-guardar-ficha" class="btn btn--primario">
            Guardar Cambios
          </button>
        </div>
      </header>

      <div id="cuerpo-editor" class="pila pila--amplia">
        <p style="color: var(--color-texto-suave);">Cargando ficha del tema y glosario...</p>
      </div>
    </div>
  `;

  // Advertir al salir si hay cambios sin guardar
  window.addEventListener('beforeunload', e => {
    if (hayCambiosSinGuardar) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  const btnVolver = document.getElementById('btn-volver');
  btnVolver.addEventListener('click', async e => {
    if (hayCambiosSinGuardar) {
      e.preventDefault();
      const seguro = await confirmar('Tienes cambios sin guardar en esta ficha. ¿Deseas salir sin guardar?');
      if (seguro) {
        hayCambiosSinGuardar = false;
        window.location.href = '/paginas/editor-contenidos.html';
      }
    }
  });

  async function cargarDatos() {
    try {
      const [t, glo] = await Promise.all([
        api.obtener('temas', temaId),
        api.listar('glosario', { temaId })
      ]);
      tema = t;
      glosario = glo || [];
      document.getElementById('titulo-tema-cabecera').textContent = tema.titulo || 'Ficha del Tema';
      renderizarTodo();
    } catch (err) {
      document.getElementById('cuerpo-editor').innerHTML = `
        <div class="tarjeta" style="text-align: center; color: var(--color-error); padding: var(--espacio-xl);">
          ${escapar(err.message || 'Error al cargar el tema.')}
        </div>
      `;
      aviso(err.message || 'Error al cargar datos del tema', 'error');
    }
  }

  function renderizarTodo() {
    const cuerpo = document.getElementById('cuerpo-editor');
    cuerpo.innerHTML = `
      <!-- 1. Información General y Resumen Pedagógico -->
      <section class="tarjeta pila pila--media">
        <header class="tarjeta__encabezado">
          <h2>1. Información General y Resumen</h2>
          <p>Define el título, nivel de dificultad, estado de publicación y el resumen curricular.</p>
        </header>

        <div class="grid-auto">
          <div class="campo" style="grid-column: span 2;">
            <label for="campo-titulo">Título del tema</label>
            <input type="text" id="campo-titulo" value="${escapar(tema.titulo || '')}" required>
          </div>
          <div class="campo">
            <label for="campo-dificultad">Dificultad</label>
            <select id="campo-dificultad">
              <option value="baja" ${tema.dificultad === 'baja' ? 'selected' : ''}>Baja</option>
              <option value="media" ${(!tema.dificultad || tema.dificultad === 'media') ? 'selected' : ''}>Media</option>
              <option value="alta" ${tema.dificultad === 'alta' ? 'selected' : ''}>Alta</option>
            </select>
          </div>
          <div class="campo">
            <label for="campo-estado">Estado de publicación</label>
            <select id="campo-estado">
              <option value="borrador" ${tema.estado === 'borrador' ? 'selected' : ''}>Borrador</option>
              <option value="publicado" ${tema.estado === 'publicado' ? 'selected' : ''}>Publicado</option>
            </select>
          </div>
        </div>

        <div class="campo">
          <div class="fila" style="justify-content: space-between; align-items: baseline;">
            <label for="campo-resumen">Resumen pedagógico (admite negrita **texto** y listas con - item)</label>
            <button type="button" id="btn-toggle-vista-resumen" class="btn btn--texto btn--pequeno">Ver vista previa</button>
          </div>
          <textarea id="campo-resumen" rows="8" placeholder="Escribe el resumen del tema (recomendado de 300 a 800 palabras)...">${escapar(tema.resumen || '')}</textarea>
          <div id="vista-previa-resumen" class="oculto" style="padding: var(--espacio-m); background: var(--color-fondo); border: 1px solid var(--color-borde); border-radius: var(--radio-s); margin-top: var(--espacio-xs);"></div>
          <div id="contador-palabras-resumen" class="contador-palabras">0 palabras</div>
        </div>

        <div class="grid-auto">
          <div class="campo">
            <label for="campo-palabras-clave">Palabras clave (separadas por comas)</label>
            <input type="text" id="campo-palabras-clave" value="${escapar(Array.isArray(tema.palabrasClave) ? tema.palabrasClave.join(', ') : (tema.palabrasClave || ''))}" placeholder="Ej. alfarismo, ferrocarril, estado laico">
          </div>
          <div class="campo">
            <label for="campo-fuentes">Fuentes bibliográficas</label>
            <input type="text" id="campo-fuentes" value="${escapar(tema.fuentes || '')}" placeholder="Ej. Ayala Mora, E. (2008). Resumen de Historia...">
          </div>
        </div>
      </section>

      <!-- 2. Objetivos y Preguntas Guía -->
      <section class="tarjeta pila pila--media">
        <header class="tarjeta__encabezado">
          <h2>2. Objetivos y Preguntas Guía</h2>
        </header>

        <div class="grid-auto">
          <!-- Objetivos -->
          <div class="campo">
            <div class="fila" style="justify-content: space-between; align-items: center;">
              <label>Objetivos de aprendizaje</label>
              <button type="button" id="btn-add-objetivo" class="btn btn--secundario btn--pequeno">+ Agregar</button>
            </div>
            <div id="lista-objetivos" class="lista-editable-items"></div>
          </div>

          <!-- Preguntas Guía -->
          <div class="campo">
            <div class="fila" style="justify-content: space-between; align-items: center;">
              <label>Preguntas guía de reflexión</label>
              <button type="button" id="btn-add-pregunta" class="btn btn--secundario btn--pequeno">+ Agregar</button>
            </div>
            <div id="lista-preguntas" class="lista-editable-items"></div>
          </div>
        </div>
      </section>

      <!-- 3. Ejemplos y Errores Frecuentes -->
      <section class="tarjeta pila pila--media">
        <header class="tarjeta__encabezado">
          <h2>3. Ejemplos y Errores Frecuentes</h2>
        </header>

        <div class="grid-auto">
          <!-- Ejemplos -->
          <div class="campo">
            <div class="fila" style="justify-content: space-between; align-items: center;">
              <label>Ejemplos y casos de aplicación</label>
              <button type="button" id="btn-add-ejemplo" class="btn btn--secundario btn--pequeno">+ Agregar</button>
            </div>
            <div id="lista-ejemplos" class="lista-editable-items"></div>
          </div>

          <!-- Errores Frecuentes -->
          <div class="campo">
            <div class="fila" style="justify-content: space-between; align-items: center;">
              <label>Errores conceptuales frecuentes</label>
              <button type="button" id="btn-add-error" class="btn btn--secundario btn--pequeno">+ Agregar</button>
            </div>
            <div id="lista-errores" class="lista-editable-items"></div>
          </div>
        </div>
      </section>

      <!-- 4. Recursos Didácticos -->
      <section class="tarjeta pila pila--media">
        <header class="tarjeta__encabezado">
          <div class="fila" style="justify-content: space-between; align-items: center;">
            <div>
              <h2>4. Recursos Didácticos</h2>
              <p>Enlaces, vídeos, imágenes y documentos PDF complementarios.</p>
            </div>
            <button type="button" id="btn-add-recurso" class="btn btn--secundario btn--pequeno">+ Agregar Recurso</button>
          </div>
        </header>

        <div id="lista-recursos" class="recursos-lista-editable"></div>
      </section>

      <!-- 5. Glosario Didáctico -->
      <section class="tarjeta pila pila--media" id="seccion-glosario">
        <header class="tarjeta__encabezado">
          <h2>5. Glosario del Tema</h2>
          <p>Términos clave para el glosario interactivo y los juegos pedagógicos.</p>
        </header>

        <div class="glosario-panel-superior">
          <div class="glosario-metricas" id="metricas-glosario">
            <!-- Se llena dinámicamente -->
          </div>
          <div class="fila" style="gap: var(--espacio-s);">
            <button type="button" id="btn-generar-ia" class="btn btn--secundario" disabled title="Disponible en Sprint 7">
              Generar con IA
            </button>
            <button type="button" id="btn-add-termino" class="btn btn--primario">
              + Agregar Término
            </button>
          </div>
        </div>

        <div class="glosario-tabla-wrapper">
          <table class="glosario-tabla" aria-label="Términos del glosario">
            <thead>
              <tr>
                <th style="width: 15%;">Término</th>
                <th style="width: 35%;">Definición</th>
                <th style="width: 20%;">Pista</th>
                <th style="width: 20%;">Retroalimentación</th>
                <th style="width: 10%;">Acciones</th>
              </tr>
            </thead>
            <tbody id="cuerpo-tabla-glosario">
              <!-- Se llena dinámicamente -->
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;

  // Control del Resumen y contador de palabras
  const textareaResumen = document.getElementById('campo-resumen');
  const contadorResumen = document.getElementById('contador-palabras-resumen');
  const btnToggleVista = document.getElementById('btn-toggle-vista-resumen');
  const vistaPreviaResumen = document.getElementById('vista-previa-resumen');

  function actualizarContadorResumen() {
    const cant = contarPalabras(textareaResumen.value);
    contadorResumen.textContent = `${cant} palabras (recomendado: 300 a 800)`;
    if (cant >= 300 && cant <= 800) {
      contadorResumen.className = 'contador-palabras adecuado';
    } else if (cant > 0) {
      contadorResumen.className = 'contador-palabras fuera-rango';
    } else {
      contadorResumen.className = 'contador-palabras';
    }
  }

  textareaResumen.addEventListener('input', () => {
    marcarCambio();
    actualizarContadorResumen();
  });
  actualizarContadorResumen();

  btnToggleVista.addEventListener('click', () => {
    const oculto = vistaPreviaResumen.classList.toggle('oculto');
    if (!oculto) {
      btnToggleVista.textContent = 'Ocultar vista previa';
      vistaPreviaResumen.innerHTML = formatoBasico(textareaResumen.value) || '<em>Sin contenido</em>';
    } else {
      btnToggleVista.textContent = 'Ver vista previa';
    }
  });

  // Escuchar cambios en campos simples
  ['campo-titulo', 'campo-dificultad', 'campo-estado', 'campo-palabras-clave', 'campo-fuentes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', marcarCambio);
  });

  // Gestores de Listas de Texto (Objetivos, Preguntas, Ejemplos, Errores)
  function montarListaSimple(contenedorId, btnAddId, itemsIniciales = [], placeholder = '') {
    const contenedor = document.getElementById(contenedorId);
    const btnAdd = document.getElementById(btnAddId);
    let items = Array.isArray(itemsIniciales) ? [...itemsIniciales] : [];

    function render() {
      if (items.length === 0) {
        contenedor.innerHTML = `<p style="font-size: var(--texto-xs); color: var(--color-texto-suave);">No hay elementos agregados.</p>`;
        return;
      }
      contenedor.innerHTML = items.map((val, idx) => `
        <div class="item-editable-fila" data-idx="${idx}">
          <input type="text" value="${escapar(val)}" placeholder="${escapar(placeholder)}" data-idx="${idx}">
          <button type="button" class="btn btn--peligro btn--pequeno btn-quitar" data-idx="${idx}" title="Eliminar" aria-label="Eliminar">✕</button>
        </div>
      `).join('');

      contenedor.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', e => {
          const idx = parseInt(e.target.getAttribute('data-idx'), 10);
          items[idx] = e.target.value;
          marcarCambio();
        });
      });

      contenedor.querySelectorAll('.btn-quitar').forEach(btn => {
        btn.addEventListener('click', e => {
          const idx = parseInt(e.target.getAttribute('data-idx'), 10);
          items.splice(idx, 1);
          marcarCambio();
          render();
        });
      });
    }

    btnAdd.addEventListener('click', () => {
      items.push('');
      marcarCambio();
      render();
      const inputs = contenedor.querySelectorAll('input');
      if (inputs.length > 0) inputs[inputs.length - 1].focus();
    });

    render();
    return () => items.map(x => x.trim()).filter(Boolean);
  }

  const obtenerObjetivos = montarListaSimple('lista-objetivos', 'btn-add-objetivo', tema.objetivos, 'Objetivo de aprendizaje...');
  const obtenerPreguntas = montarListaSimple('lista-preguntas', 'btn-add-pregunta', tema.preguntasGuia, 'Pregunta guía...');
  const obtenerEjemplos = montarListaSimple('lista-ejemplos', 'btn-add-ejemplo', tema.ejemplos, 'Ejemplo o caso...');
  const obtenerErrores = montarListaSimple('lista-errores', 'btn-add-error', tema.erroresFrecuentes, 'Error conceptual común...');

  // Gestor de Recursos Didácticos
  let recursos = Array.isArray(tema.recursos) ? JSON.parse(JSON.stringify(tema.recursos)) : [];
  const listaRecursosEl = document.getElementById('lista-recursos');
  const btnAddRecurso = document.getElementById('btn-add-recurso');

  function renderizarRecursos() {
    if (recursos.length === 0) {
      listaRecursosEl.innerHTML = `<p style="font-size: var(--texto-xs); color: var(--color-texto-suave);">No hay recursos didácticos asociados aún.</p>`;
      return;
    }

    listaRecursosEl.innerHTML = recursos.map((r, idx) => `
      <div class="recurso-card" data-idx="${idx}">
        <div class="recurso-fila-inputs">
          <div class="campo" style="min-width: 140px; flex: 1;">
            <label style="font-size: var(--texto-xs);">Tipo</label>
            <select class="recurso-tipo" data-idx="${idx}">
              <option value="enlace" ${r.tipo === 'enlace' ? 'selected' : ''}>Enlace web</option>
              <option value="video" ${r.tipo === 'video' ? 'selected' : ''}>Vídeo</option>
              <option value="pdf" ${r.tipo === 'pdf' ? 'selected' : ''}>Documento PDF</option>
              <option value="imagen" ${r.tipo === 'imagen' ? 'selected' : ''}>Imagen</option>
            </select>
          </div>
          <div class="campo" style="min-width: 200px; flex: 2;">
            <label style="font-size: var(--texto-xs);">Título del recurso</label>
            <input type="text" class="recurso-titulo" data-idx="${idx}" value="${escapar(r.titulo || '')}" placeholder="Título descriptivo">
          </div>
          <div class="campo" style="min-width: 250px; flex: 3;">
            <label style="font-size: var(--texto-xs);">URL / Archivo</label>
            <div class="fila" style="gap: var(--espacio-xs);">
              <input type="text" class="recurso-url" data-idx="${idx}" value="${escapar(r.url || '')}" placeholder="https://..." style="flex: 1;">
              ${(r.tipo === 'pdf' || r.tipo === 'imagen') ? `
                <label class="btn btn--secundario btn--pequeno" style="cursor: pointer; white-space: nowrap;">
                  Subir
                  <input type="file" class="sr-only input-subir-archivo" data-idx="${idx}" accept="${r.tipo === 'pdf' ? 'application/pdf' : 'image/jpeg,image/png,image/webp'}">
                </label>
              ` : ''}
            </div>
          </div>
          <button type="button" class="btn btn--peligro btn--pequeno btn-quitar-recurso" data-idx="${idx}" style="margin-top: 18px;" title="Eliminar recurso">
            ✕
          </button>
        </div>
      </div>
    `).join('');

    listaRecursosEl.querySelectorAll('.recurso-tipo').forEach(sel => {
      sel.addEventListener('change', e => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        recursos[idx].tipo = e.target.value;
        marcarCambio();
        renderizarRecursos();
      });
    });

    listaRecursosEl.querySelectorAll('.recurso-titulo').forEach(inp => {
      inp.addEventListener('input', e => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        recursos[idx].titulo = e.target.value;
        marcarCambio();
      });
    });

    listaRecursosEl.querySelectorAll('.recurso-url').forEach(inp => {
      inp.addEventListener('input', e => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        recursos[idx].url = e.target.value;
        marcarCambio();
      });
    });

    listaRecursosEl.querySelectorAll('.input-subir-archivo').forEach(inp => {
      inp.addEventListener('change', async e => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        const archivo = e.target.files && e.target.files[0];
        if (!archivo) return;

        try {
          aviso('Subiendo archivo...', 'info');
          const resp = await api.subir(archivo);
          if (resp && resp.url) {
            recursos[idx].url = resp.url;
            marcarCambio();
            renderizarRecursos();
            aviso('Archivo subido con éxito.', 'exito');
          }
        } catch (err) {
          aviso(err.message || 'Error al subir archivo', 'error');
        }
      });
    });

    listaRecursosEl.querySelectorAll('.btn-quitar-recurso').forEach(btn => {
      btn.addEventListener('click', e => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        recursos.splice(idx, 1);
        marcarCambio();
        renderizarRecursos();
      });
    });
  }

  btnAddRecurso.addEventListener('click', () => {
    recursos.push({ tipo: 'enlace', titulo: '', url: '' });
    marcarCambio();
    renderizarRecursos();
  });
  renderizarRecursos();

  // Guardar ficha del tema
  const btnGuardarFicha = document.getElementById('btn-guardar-ficha');
  btnGuardarFicha.addEventListener('click', async () => {
    const titulo = document.getElementById('campo-titulo').value.trim();
    if (!titulo) {
      aviso('El título del tema es obligatorio.', 'error');
      return;
    }

    const dificultad = document.getElementById('campo-dificultad').value;
    const estado = document.getElementById('campo-estado').value;
    const resumen = textareaResumen.value.trim();
    const fuentes = document.getElementById('campo-fuentes').value.trim();
    const palabrasRaw = document.getElementById('campo-palabras-clave').value;
    const palabrasClave = palabrasRaw.split(',').map(p => p.trim()).filter(Boolean);

    const payload = {
      titulo,
      dificultad,
      estado,
      resumen,
      fuentes,
      palabrasClave,
      objetivos: obtenerObjetivos(),
      preguntasGuia: obtenerPreguntas(),
      ejemplos: obtenerEjemplos(),
      erroresFrecuentes: obtenerErrores(),
      recursos: recursos.filter(r => r.titulo && r.url)
    };

    btnGuardarFicha.disabled = true;
    const txtOriginal = btnGuardarFicha.textContent;
    btnGuardarFicha.textContent = 'Guardando...';

    try {
      await api.actualizar('temas', tema.id, payload);
      hayCambiosSinGuardar = false;
      document.getElementById('indicador-cambios').classList.add('oculto');
      document.getElementById('titulo-tema-cabecera').textContent = titulo;
      aviso('Ficha del tema guardada con éxito.', 'exito');
    } catch (err) {
      aviso(err.message || 'Error al guardar la ficha del tema', 'error');
    } finally {
      btnGuardarFicha.disabled = false;
      btnGuardarFicha.textContent = txtOriginal;
    }
  });

  // Gestor del Glosario
  const metricasGlosarioEl = document.getElementById('metricas-glosario');
  const cuerpoTablaGlosario = document.getElementById('cuerpo-tabla-glosario');
  const btnAddTermino = document.getElementById('btn-add-termino');

  function actualizarMetricasGlosario() {
    const total = glosario.length;
    const seisLetras = glosario.filter(g => normalizar(g.termino).length === 6).length;
    const esApto = total >= 12 && seisLetras >= 3;

    metricasGlosarioEl.innerHTML = `
      <span class="insignia insignia--primario">${total} ${total === 1 ? 'término' : 'términos'}</span>
      <span class="insignia insignia--secundario">${seisLetras} de 6 letras</span>
      <span class="insignia ${esApto ? 'insignia--exito' : 'insignia--advertencia'}">
        ${esApto ? '✓ Apto para juegos' : `Requiere mín. 12 términos y 3 de 6 letras para juegos (${total}/12 y ${seisLetras}/3)`}
      </span>
    `;
  }

  function renderizarTablaGlosario() {
    actualizarMetricasGlosario();

    if (glosario.length === 0) {
      cuerpoTablaGlosario.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: var(--espacio-l); color: var(--color-texto-suave);">
            No hay términos en el glosario de este tema. Pulsa "+ Agregar Término" para registrar el primero.
          </td>
        </tr>
      `;
      return;
    }

    cuerpoTablaGlosario.innerHTML = glosario.map(g => `
      <tr data-id="${escapar(g.id)}">
        <td>
          <strong>${escapar(g.termino)}</strong>
          <span style="font-size: var(--texto-xs); color: var(--color-texto-suave); display: block;">
            (${normalizar(g.termino).length} letras)
          </span>
        </td>
        <td>${escapar(g.definicion)}</td>
        <td><em>${escapar(g.pista)}</em></td>
        <td>${escapar(g.retroalimentacion || '-')}</td>
        <td>
          <div class="fila" style="gap: var(--espacio-xs);">
            <button type="button" class="btn btn--secundario btn--pequeno btn-editar-glo" data-id="${escapar(g.id)}">
              Editar
            </button>
            <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar-glo" data-id="${escapar(g.id)}">
              Eliminar
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    cuerpoTablaGlosario.querySelectorAll('.btn-editar-glo').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const term = glosario.find(x => x.id === id);
        if (term) abrirModalTermino(term);
      });
    });

    cuerpoTablaGlosario.querySelectorAll('.btn-eliminar-glo').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const term = glosario.find(x => x.id === id);
        if (!term) return;

        const confirmado = await confirmar(`¿Estás seguro de eliminar el término "${term.termino}" del glosario?`);
        if (!confirmado) return;

        try {
          await api.eliminar('glosario', term.id);
          glosario = glosario.filter(x => x.id !== term.id);
          renderizarTablaGlosario();
          aviso('Término eliminado del glosario.', 'exito');
        } catch (err) {
          aviso(err.message || 'Error al eliminar término', 'error');
        }
      });
    });
  }

  async function abrirModalTermino(existente = null) {
    const esEdicion = !!existente;

    const form = document.createElement('form');
    form.className = 'pila pila--media';
    form.innerHTML = `
      <div class="campo">
        <label for="input-glo-termino">Término (una sola palabra)</label>
        <input type="text" id="input-glo-termino" value="${escapar(existente?.termino || '')}" placeholder="Ej. laicismo" required>
        <span class="campo__error" id="error-glo-termino" aria-live="polite"></span>
      </div>

      <div class="campo">
        <div class="fila" style="justify-content: space-between;">
          <label for="input-glo-def">Definición (máximo 25 palabras)</label>
          <span id="palabras-def" style="font-size: var(--texto-xs); color: var(--color-texto-suave);">0 / 25 palabras</span>
        </div>
        <textarea id="input-glo-def" rows="3" placeholder="Definición clara y concisa..." required>${escapar(existente?.definicion || '')}</textarea>
        <span class="campo__error" id="error-glo-def" aria-live="polite"></span>
      </div>

      <div class="campo">
        <div class="fila" style="justify-content: space-between;">
          <label for="input-glo-pista">Pista (máximo 10 palabras)</label>
          <span id="palabras-pista" style="font-size: var(--texto-xs); color: var(--color-texto-suave);">0 / 10 palabras</span>
        </div>
        <input type="text" id="input-glo-pista" value="${escapar(existente?.pista || '')}" placeholder="Pista para juegos interactivos" required>
        <span class="campo__error" id="error-glo-pista" aria-live="polite"></span>
      </div>

      <div class="campo">
        <label for="input-glo-retro">Retroalimentación pedagógica</label>
        <textarea id="input-glo-retro" rows="2" placeholder="Explicación formativa adicional...">${escapar(existente?.retroalimentacion || '')}</textarea>
      </div>
    `;

    const inputTermino = form.querySelector('#input-glo-termino');
    const inputDef = form.querySelector('#input-glo-def');
    const inputPista = form.querySelector('#input-glo-pista');
    const inputRetro = form.querySelector('#input-glo-retro');

    const errorTermino = form.querySelector('#error-glo-termino');
    const errorDef = form.querySelector('#error-glo-def');
    const errorPista = form.querySelector('#error-glo-pista');

    const spanPalabrasDef = form.querySelector('#palabras-def');
    const spanPalabrasPista = form.querySelector('#palabras-pista');

    function actualizarContadoresModal() {
      const cantDef = contarPalabras(inputDef.value);
      spanPalabrasDef.textContent = `${cantDef} / 25 palabras`;
      spanPalabrasDef.style.color = cantDef > 25 ? 'var(--color-error)' : 'var(--color-texto-suave)';

      const cantPista = contarPalabras(inputPista.value);
      spanPalabrasPista.textContent = `${cantPista} / 10 palabras`;
      spanPalabrasPista.style.color = cantPista > 10 ? 'var(--color-error)' : 'var(--color-texto-suave)';
    }

    inputDef.addEventListener('input', actualizarContadoresModal);
    inputPista.addEventListener('input', actualizarContadoresModal);
    actualizarContadoresModal();

    const accion = await modal({
      titulo: esEdicion ? 'Editar Término del Glosario' : 'Nuevo Término en Glosario',
      contenido: form,
      acciones: [
        { texto: 'Cancelar', clase: 'btn btn--texto', valor: null },
        { texto: esEdicion ? 'Guardar Cambios' : 'Agregar Término', clase: 'btn btn--primario', valor: 'guardar' }
      ]
    });

    if (accion === 'guardar') {
      const termino = inputTermino.value.trim().toLowerCase();
      const definicion = inputDef.value.trim();
      const pista = inputPista.value.trim();
      const retroalimentacion = inputRetro.value.trim();

      if (!termino) {
        aviso('El término es obligatorio.', 'error');
        return;
      }
      if (termino.includes(' ')) {
        aviso('El término debe ser de una sola palabra.', 'error');
        return;
      }
      if (!definicion || contarPalabras(definicion) > 25) {
        aviso('La definición es obligatoria y debe tener máximo 25 palabras.', 'error');
        return;
      }
      if (!pista || contarPalabras(pista) > 10) {
        aviso('La pista es obligatoria y debe tener máximo 10 palabras.', 'error');
        return;
      }

      const payload = {
        temaId: tema.id,
        termino,
        definicion,
        pista,
        retroalimentacion,
        origen: 'docente',
        estado: 'aprobado'
      };

      try {
        if (esEdicion) {
          const resp = await api.actualizar('glosario', existente.id, payload);
          const idx = glosario.findIndex(x => x.id === existente.id);
          if (idx !== -1) glosario[idx] = resp;
          aviso('Término actualizado con éxito.', 'exito');
        } else {
          const nuevo = await api.crear('glosario', payload);
          glosario.push(nuevo);
          aviso('Término agregado al glosario.', 'exito');
        }
        renderizarTablaGlosario();
      } catch (err) {
        aviso(err.message || 'Error al guardar término en el glosario', 'error');
      }
    }
  }

  btnAddTermino.addEventListener('click', () => abrirModalTermino());
    renderizarTablaGlosario();
  }

  await cargarDatos();
}

await iniciar();


