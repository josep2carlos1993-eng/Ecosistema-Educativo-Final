// publico/js/modulos/editor-contenidos.js · Editor de contenidos: unidades y temas
import { montarPlantilla } from '../nucleo/plantilla.js';
import api from '../nucleo/api.js';
import { modal, aviso, escapar } from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Editor de Contenidos', roles: ['docente', 'admin'] });

const contenido = document.getElementById('contenido');
if (contenido) {
  let asignaturas = [];
  let asignaturaActual = null;
  let unidades = [];
  let unidadActual = null;
  let temas = [];

  contenido.innerHTML = `
    <div class="pila pila--media">
      <div class="editor-cabecera">
        <div class="editor-selector-asig campo">
          <label for="selector-asignatura"><strong>Asignatura:</strong></label>
          <select id="selector-asignatura" aria-label="Seleccionar asignatura para editar contenidos">
            <option value="">Cargando asignaturas...</option>
          </select>
        </div>
        <div id="info-asignatura" style="font-size: var(--texto-s); color: var(--color-texto-suave);"></div>
      </div>

      <div class="editor-grid">
        <!-- Columna de Unidades -->
        <section class="unidades-columna">
          <div class="columna-encabezado">
            <h2 class="columna-titulo">Unidades</h2>
            <button type="button" id="btn-nueva-unidad" class="btn btn--primario btn--pequeno" disabled>
              + Nueva Unidad
            </button>
          </div>
          <div id="lista-unidades" class="unidades-lista">
            <p style="color: var(--color-texto-suave); font-size: var(--texto-s);">Selecciona una asignatura para ver sus unidades.</p>
          </div>
        </section>

        <!-- Columna de Temas -->
        <section class="temas-columna">
          <div class="columna-encabezado">
            <h2 class="columna-titulo" id="titulo-columna-temas">Temas</h2>
            <button type="button" id="btn-nuevo-tema" class="btn btn--primario btn--pequeno" disabled>
              + Nuevo Tema
            </button>
          </div>
          <div id="lista-temas" class="temas-lista">
            <p style="color: var(--color-texto-suave); font-size: var(--texto-s);">Selecciona una unidad para gestionar sus temas.</p>
          </div>
        </section>
      </div>
    </div>
  `;

  const selectAsignatura = document.getElementById('selector-asignatura');
  const infoAsignatura = document.getElementById('info-asignatura');
  const listaUnidades = document.getElementById('lista-unidades');
  const listaTemas = document.getElementById('lista-temas');
  const btnNuevaUnidad = document.getElementById('btn-nueva-unidad');
  const btnNuevoTema = document.getElementById('btn-nuevo-tema');
  const tituloColumnaTemas = document.getElementById('titulo-columna-temas');

  async function inicializar() {
    try {
      asignaturas = await api.listar('asignaturas');
      if (asignaturas.length === 0) {
        selectAsignatura.innerHTML = '<option value="">No tienes asignaturas asignadas</option>';
        listaUnidades.innerHTML = '<p style="color: var(--color-texto-suave);">No hay asignaturas disponibles para tu usuario.</p>';
        return;
      }

      selectAsignatura.innerHTML = asignaturas.map(a => {
        return `<option value="${escapar(a.id)}">${escapar(a.nombre)} - ${escapar(a.nivel || 'General')}</option>`;
      }).join('');

      asignaturaActual = asignaturas[0];
      infoAsignatura.textContent = asignaturaActual.descripcion || '';
      btnNuevaUnidad.disabled = false;

      selectAsignatura.addEventListener('change', async () => {
        const id = selectAsignatura.value;
        asignaturaActual = asignaturas.find(a => a.id === id);
        infoAsignatura.textContent = asignaturaActual ? (asignaturaActual.descripcion || '') : '';
        unidadActual = null;
        await cargarUnidades();
      });

      await cargarUnidades();
    } catch (err) {
      aviso(err.message || 'Error al cargar asignaturas', 'error');
    }
  }

  async function cargarUnidades() {
    if (!asignaturaActual) return;
    try {
      const todas = await api.listar('unidades', { asignaturaId: asignaturaActual.id });
      unidades = (todas || []).sort((a, b) => (a.orden || 0) - (b.orden || 0));

      // Mantener seleccionada la unidad actual si sigue existiendo, o seleccionar la primera
      if (unidadActual) {
        unidadActual = unidades.find(u => u.id === unidadActual.id) || null;
      }
      if (!unidadActual && unidades.length > 0) {
        unidadActual = unidades[0];
      }

      renderizarUnidades();
      await cargarTemas();
    } catch (err) {
      aviso(err.message || 'Error al cargar unidades', 'error');
    }
  }

  function renderizarUnidades() {
    if (unidades.length === 0) {
      listaUnidades.innerHTML = `
        <div class="tarjeta" style="text-align: center; padding: var(--espacio-m);">
          <p style="color: var(--color-texto-suave); font-size: var(--texto-s);">Esta asignatura no tiene unidades creadas aún.</p>
        </div>
      `;
      btnNuevoTema.disabled = true;
      return;
    }

    listaUnidades.innerHTML = unidades.map((u, index) => {
      const esActiva = unidadActual && unidadActual.id === u.id;
      const esVisible = u.visible !== false;
      const esPrimera = index === 0;
      const esUltima = index === unidades.length - 1;

      return `
        <article class="unidad-tarjeta ${esActiva ? 'activa' : ''} ${!esVisible ? 'unidad-tarjeta--oculta' : ''}" data-id="${escapar(u.id)}">
          <div class="unidad-fila-superior">
            <div>
              <span style="font-size: var(--texto-xs); font-weight: var(--peso-negrita); color: var(--color-primario);">
                Unidad ${u.orden || (index + 1)}
              </span>
              <h3 class="unidad-nombre">${escapar(u.titulo)}</h3>
            </div>
            <span class="insignia ${esVisible ? 'insignia--exito' : 'insignia--advertencia'}" style="font-size: var(--texto-xs);">
              ${esVisible ? 'Visible' : 'Oculta'}
            </span>
          </div>

          <div class="unidad-herramientas" onclick="event.stopPropagation();">
            <button type="button" class="btn btn--texto btn--pequeno btn-subir-uni" data-id="${escapar(u.id)}" ${esPrimera ? 'disabled' : ''} title="Subir orden" aria-label="Subir orden">▲</button>
            <button type="button" class="btn btn--texto btn--pequeno btn-bajar-uni" data-id="${escapar(u.id)}" ${esUltima ? 'disabled' : ''} title="Bajar orden" aria-label="Bajar orden">▼</button>
            <button type="button" class="btn btn--secundario btn--pequeno btn-renombrar-uni" data-id="${escapar(u.id)}">Renombrar</button>
            <button type="button" class="btn btn--texto btn--pequeno btn-visibilidad-uni" data-id="${escapar(u.id)}">
              ${esVisible ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </article>
      `;
    }).join('');

    // Selección de unidad
    listaUnidades.querySelectorAll('.unidad-tarjeta').forEach(tarjeta => {
      tarjeta.addEventListener('click', async () => {
        const id = tarjeta.getAttribute('data-id');
        unidadActual = unidades.find(u => u.id === id);
        renderizarUnidades();
        await cargarTemas();
      });
    });

    // Subir unidad
    listaUnidades.querySelectorAll('.btn-subir-uni').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const idx = unidades.findIndex(u => u.id === id);
        if (idx > 0) {
          const anterior = unidades[idx - 1];
          const actual = unidades[idx];
          const ordenTemp = anterior.orden || idx;
          anterior.orden = actual.orden || (idx + 1);
          actual.orden = ordenTemp;

          try {
            await Promise.all([
              api.actualizar('unidades', actual.id, { orden: actual.orden }),
              api.actualizar('unidades', anterior.id, { orden: anterior.orden })
            ]);
            await cargarUnidades();
          } catch (err) {
            aviso(err.message || 'Error al cambiar orden', 'error');
          }
        }
      });
    });

    // Bajar unidad
    listaUnidades.querySelectorAll('.btn-bajar-uni').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const idx = unidades.findIndex(u => u.id === id);
        if (idx < unidades.length - 1) {
          const siguiente = unidades[idx + 1];
          const actual = unidades[idx];
          const ordenTemp = siguiente.orden || (idx + 2);
          siguiente.orden = actual.orden || (idx + 1);
          actual.orden = ordenTemp;

          try {
            await Promise.all([
              api.actualizar('unidades', actual.id, { orden: actual.orden }),
              api.actualizar('unidades', siguiente.id, { orden: siguiente.orden })
            ]);
            await cargarUnidades();
          } catch (err) {
            aviso(err.message || 'Error al cambiar orden', 'error');
          }
        }
      });
    });

    // Renombrar unidad
    listaUnidades.querySelectorAll('.btn-renombrar-uni').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const uni = unidades.find(u => u.id === id);
        if (uni) abrirModalRenombrarUnidad(uni);
      });
    });

    // Cambiar visibilidad unidad
    listaUnidades.querySelectorAll('.btn-visibilidad-uni').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const uni = unidades.find(u => u.id === id);
        if (!uni) return;

        const nuevoVisible = !(uni.visible !== false);
        try {
          await api.actualizar('unidades', uni.id, { visible: nuevoVisible });
          uni.visible = nuevoVisible;
          aviso(`Unidad ${nuevoVisible ? 'ahora es visible' : 'ha sido ocultada'}`, 'info');
          renderizarUnidades();
        } catch (err) {
          aviso(err.message || 'Error al cambiar visibilidad', 'error');
        }
      });
    });
  }

  async function cargarTemas() {
    if (!unidadActual) {
      tituloColumnaTemas.textContent = 'Temas';
      btnNuevoTema.disabled = true;
      listaTemas.innerHTML = '<p style="color: var(--color-texto-suave); font-size: var(--texto-s);">Selecciona una unidad para ver sus temas.</p>';
      temas = [];
      return;
    }

    tituloColumnaTemas.textContent = `Temas de: ${unidadActual.titulo}`;
    btnNuevoTema.disabled = false;

    try {
      const todos = await api.listar('temas', { unidadId: unidadActual.id });
      temas = (todos || []).sort((a, b) => (a.orden || 0) - (b.orden || 0));
      renderizarTemas();
    } catch (err) {
      aviso(err.message || 'Error al cargar temas', 'error');
    }
  }

  function renderizarTemas() {
    if (temas.length === 0) {
      listaTemas.innerHTML = `
        <div class="tarjeta" style="text-align: center; padding: var(--espacio-m);">
          <p style="color: var(--color-texto-suave); font-size: var(--texto-s);">No hay temas en esta unidad. Haz clic en "+ Nuevo Tema" para agregar uno.</p>
        </div>
      `;
      return;
    }

    listaTemas.innerHTML = temas.map((t, index) => {
      const esPublicado = t.estado === 'publicado';
      const esPrimero = index === 0;
      const esUltimo = index === temas.length - 1;

      return `
        <article class="tema-tarjeta ${esPublicado ? 'tema-tarjeta--publicado' : 'tema-tarjeta--borrador'}" data-id="${escapar(t.id)}">
          <div class="tema-fila-superior">
            <div>
              <span style="font-size: var(--texto-xs); font-weight: var(--peso-negrita); color: var(--color-secundario);">
                Tema ${t.orden || (index + 1)}
              </span>
              <h3 class="tema-titulo">${escapar(t.titulo)}</h3>
            </div>
            <select class="select-estado-tema" data-id="${escapar(t.id)}" aria-label="Estado del tema">
              <option value="borrador" ${!esPublicado ? 'selected' : ''}>Borrador</option>
              <option value="publicado" ${esPublicado ? 'selected' : ''}>Publicado</option>
            </select>
          </div>

          <div class="tema-herramientas">
            <div class="fila" style="gap: var(--espacio-xs);">
              <button type="button" class="btn btn--texto btn--pequeno btn-subir-tema" data-id="${escapar(t.id)}" ${esPrimero ? 'disabled' : ''} title="Subir orden" aria-label="Subir orden">▲</button>
              <button type="button" class="btn btn--texto btn--pequeno btn-bajar-tema" data-id="${escapar(t.id)}" ${esUltimo ? 'disabled' : ''} title="Bajar orden" aria-label="Bajar orden">▼</button>
              <button type="button" class="btn btn--secundario btn--pequeno btn-renombrar-tema" data-id="${escapar(t.id)}">Renombrar</button>
            </div>
            <a href="/paginas/editor-tema.html?id=${encodeURIComponent(t.id)}" class="btn btn--primario btn--pequeno">
              Editar ficha →
            </a>
          </div>
        </article>
      `;
    }).join('');

    // Cambiar estado del tema
    listaTemas.querySelectorAll('.select-estado-tema').forEach(sel => {
      sel.addEventListener('change', async e => {
        const id = e.target.getAttribute('data-id');
        const nuevoEstado = e.target.value;
        const tema = temas.find(t => t.id === id);
        const estadoAnterior = tema ? tema.estado : nuevoEstado;

        try {
          await api.actualizar('temas', id, { estado: nuevoEstado });
          if (tema) tema.estado = nuevoEstado;
          aviso(`Tema marcado como ${nuevoEstado}`, 'exito');
          renderizarTemas();
        } catch (err) {
          e.target.value = estadoAnterior;
          aviso(err.message || 'Error al cambiar estado del tema', 'error');
        }
      });
    });

    // Subir tema
    listaTemas.querySelectorAll('.btn-subir-tema').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const idx = temas.findIndex(t => t.id === id);
        if (idx > 0) {
          const anterior = temas[idx - 1];
          const actual = temas[idx];
          const ordenTemp = anterior.orden || idx;
          anterior.orden = actual.orden || (idx + 1);
          actual.orden = ordenTemp;

          try {
            await Promise.all([
              api.actualizar('temas', actual.id, { orden: actual.orden }),
              api.actualizar('temas', anterior.id, { orden: anterior.orden })
            ]);
            await cargarTemas();
          } catch (err) {
            aviso(err.message || 'Error al cambiar orden', 'error');
          }
        }
      });
    });

    // Bajar tema
    listaTemas.querySelectorAll('.btn-bajar-tema').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const idx = temas.findIndex(t => t.id === id);
        if (idx < temas.length - 1) {
          const siguiente = temas[idx + 1];
          const actual = temas[idx];
          const ordenTemp = siguiente.orden || (idx + 2);
          siguiente.orden = actual.orden || (idx + 1);
          actual.orden = ordenTemp;

          try {
            await Promise.all([
              api.actualizar('temas', actual.id, { orden: actual.orden }),
              api.actualizar('temas', siguiente.id, { orden: siguiente.orden })
            ]);
            await cargarTemas();
          } catch (err) {
            aviso(err.message || 'Error al cambiar orden', 'error');
          }
        }
      });
    });

    // Renombrar tema
    listaTemas.querySelectorAll('.btn-renombrar-tema').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const t = temas.find(x => x.id === id);
        if (t) abrirModalRenombrarTema(t);
      });
    });
  }

  // Modal Nueva Unidad
  async function abrirModalNuevaUnidad() {
    if (!asignaturaActual) return;

    const form = document.createElement('form');
    form.className = 'pila pila--media';
    form.innerHTML = `
      <div class="campo">
        <label for="input-uni-titulo">Título de la unidad</label>
        <input type="text" id="input-uni-titulo" placeholder="Ej. El desarrollo industrial del siglo XX" required>
      </div>
    `;

    const inputTitulo = form.querySelector('#input-uni-titulo');

    const accion = await modal({
      titulo: 'Nueva Unidad',
      contenido: form,
      acciones: [
        { texto: 'Cancelar', clase: 'btn btn--texto', valor: null },
        { texto: 'Crear Unidad', clase: 'btn btn--primario', valor: 'crear' }
      ]
    });

    if (accion === 'crear') {
      const titulo = inputTitulo.value.trim();
      if (!titulo) {
        aviso('El título de la unidad es obligatorio', 'error');
        return;
      }

      const maxOrden = unidades.reduce((max, u) => Math.max(max, u.orden || 0), 0);
      try {
        const creada = await api.crear('unidades', {
          asignaturaId: asignaturaActual.id,
          titulo,
          orden: maxOrden + 1,
          visible: true
        });
        aviso('Unidad creada con éxito', 'exito');
        unidadActual = creada;
        await cargarUnidades();
      } catch (err) {
        aviso(err.message || 'Error al crear la unidad', 'error');
      }
    }
  }

  // Modal Renombrar Unidad
  async function abrirModalRenombrarUnidad(uni) {
    const form = document.createElement('form');
    form.className = 'pila pila--media';
    form.innerHTML = `
      <div class="campo">
        <label for="input-renombrar-uni">Nuevo título de la unidad</label>
        <input type="text" id="input-renombrar-uni" value="${escapar(uni.titulo)}" required>
      </div>
    `;

    const inputTitulo = form.querySelector('#input-renombrar-uni');

    const accion = await modal({
      titulo: 'Renombrar Unidad',
      contenido: form,
      acciones: [
        { texto: 'Cancelar', clase: 'btn btn--texto', valor: null },
        { texto: 'Guardar', clase: 'btn btn--primario', valor: 'guardar' }
      ]
    });

    if (accion === 'guardar') {
      const titulo = inputTitulo.value.trim();
      if (!titulo) {
        aviso('El título no puede estar vacío', 'error');
        return;
      }

      try {
        await api.actualizar('unidades', uni.id, { titulo });
        uni.titulo = titulo;
        aviso('Unidad renombrada con éxito', 'exito');
        renderizarUnidades();
        if (unidadActual && unidadActual.id === uni.id) {
          tituloColumnaTemas.textContent = `Temas de: ${uni.titulo}`;
        }
      } catch (err) {
        aviso(err.message || 'Error al renombrar la unidad', 'error');
      }
    }
  }

  // Modal Nuevo Tema
  async function abrirModalNuevoTema() {
    if (!unidadActual) return;

    const form = document.createElement('form');
    form.className = 'pila pila--media';
    form.innerHTML = `
      <div class="campo">
        <label for="input-tema-titulo">Título del tema</label>
        <input type="text" id="input-tema-titulo" placeholder="Ej. El auge del ferrocarril trasandino" required>
        <span style="font-size: var(--texto-xs); color: var(--color-texto-suave);">El tema se creará inicialmente en estado Borrador.</span>
      </div>
    `;

    const inputTitulo = form.querySelector('#input-tema-titulo');

    const accion = await modal({
      titulo: 'Nuevo Tema',
      contenido: form,
      acciones: [
        { texto: 'Cancelar', clase: 'btn btn--texto', valor: null },
        { texto: 'Crear Tema', clase: 'btn btn--primario', valor: 'crear' }
      ]
    });

    if (accion === 'crear') {
      const titulo = inputTitulo.value.trim();
      if (!titulo) {
        aviso('El título del tema es obligatorio', 'error');
        return;
      }

      const maxOrden = temas.reduce((max, t) => Math.max(max, t.orden || 0), 0);
      try {
        await api.crear('temas', {
          unidadId: unidadActual.id,
          titulo,
          orden: maxOrden + 1,
          estado: 'borrador'
        });
        aviso('Tema creado en estado Borrador', 'exito');
        await cargarTemas();
      } catch (err) {
        aviso(err.message || 'Error al crear tema', 'error');
      }
    }
  }

  // Modal Renombrar Tema
  async function abrirModalRenombrarTema(t) {
    const form = document.createElement('form');
    form.className = 'pila pila--media';
    form.innerHTML = `
      <div class="campo">
        <label for="input-renombrar-tema">Nuevo título del tema</label>
        <input type="text" id="input-renombrar-tema" value="${escapar(t.titulo)}" required>
      </div>
    `;

    const inputTitulo = form.querySelector('#input-renombrar-tema');

    const accion = await modal({
      titulo: 'Renombrar Tema',
      contenido: form,
      acciones: [
        { texto: 'Cancelar', clase: 'btn btn--texto', valor: null },
        { texto: 'Guardar', clase: 'btn btn--primario', valor: 'guardar' }
      ]
    });

    if (accion === 'guardar') {
      const titulo = inputTitulo.value.trim();
      if (!titulo) {
        aviso('El título no puede estar vacío', 'error');
        return;
      }

      try {
        await api.actualizar('temas', t.id, { titulo });
        t.titulo = titulo;
        aviso('Tema renombrado con éxito', 'exito');
        renderizarTemas();
      } catch (err) {
        aviso(err.message || 'Error al renombrar el tema', 'error');
      }
    }
  }

  btnNuevaUnidad.addEventListener('click', abrirModalNuevaUnidad);
  btnNuevoTema.addEventListener('click', abrirModalNuevoTema);

  await inicializar();
}
