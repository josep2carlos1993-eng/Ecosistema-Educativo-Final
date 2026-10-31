// publico/js/modulos/admin-asignaturas.js · Gestión de asignaturas (admin)
import { montarPlantilla } from '../nucleo/plantilla.js';
import api from '../nucleo/api.js';
import { confirmar, modal, aviso, escapar } from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Asignaturas', roles: ['admin'] });

const contenido = document.getElementById('contenido');
if (contenido) {
  let asignaturas = [];
  let grupos = [];

  contenido.innerHTML = `
    <div class="pila pila--media">
      <div class="asignaturas-herramientas">
        <div>
          <h2 style="font-size: var(--texto-xl); color: var(--color-primario);">Catálogo de Asignaturas</h2>
          <p style="font-size: var(--texto-s); color: var(--color-texto-suave);">Gestiona las asignaturas y niveles del plan de estudios.</p>
        </div>
        <button type="button" id="btn-nueva-asignatura" class="btn btn--primario">
          + Nueva Asignatura
        </button>
      </div>

      <div id="grid-asignaturas" class="asignaturas-grid">
        <p style="color: var(--color-texto-suave);">Cargando asignaturas...</p>
      </div>
    </div>
  `;

  const gridAsignaturas = document.getElementById('grid-asignaturas');
  const btnNueva = document.getElementById('btn-nueva-asignatura');

  async function cargarDatos() {
    try {
      const [asigs, dists] = await Promise.all([
        api.listar('asignaturas'),
        api.listar('distributivo')
      ]);
      asignaturas = asigs || [];
      grupos = dists || [];
      renderizarGrid();
    } catch (err) {
      gridAsignaturas.innerHTML = `<p style="color: var(--color-error);">${escapar(err.message || 'Error al cargar asignaturas')}</p>`;
      aviso(err.message || 'Error al cargar asignaturas', 'error');
    }
  }

  function renderizarGrid() {
    if (asignaturas.length === 0) {
      gridAsignaturas.innerHTML = `
        <div class="tarjeta" style="grid-column: 1 / -1; text-align: center; padding: var(--espacio-xl);">
          <p style="color: var(--color-texto-suave);">No hay asignaturas registradas. Haz clic en "+ Nueva Asignatura" para crear la primera.</p>
        </div>
      `;
      return;
    }

    gridAsignaturas.innerHTML = asignaturas.map(a => {
      const numGrupos = grupos.filter(g => g.asignaturaId === a.id).length;

      return `
        <article class="tarjeta asignatura-tarjeta" data-id="${escapar(a.id)}">
          <div class="asignatura-cuerpo">
            <div class="fila" style="justify-content: space-between; align-items: flex-start; gap: var(--espacio-xs);">
              <h3 class="asignatura-titulo">${escapar(a.nombre)}</h3>
              <span class="insignia insignia--secundario">${escapar(a.nivel || 'General')}</span>
            </div>
            <p class="asignatura-descripcion">${escapar(a.descripcion || 'Sin descripción.')}</p>
            <div style="margin-top: var(--espacio-xs);">
              <span class="insignia insignia--info" style="font-size: var(--texto-xs);">
                ${numGrupos} ${numGrupos === 1 ? 'grupo' : 'grupos'}
              </span>
            </div>
          </div>
          <div class="asignatura-acciones">
            <button type="button" class="btn btn--secundario btn--pequeno btn-editar" data-id="${escapar(a.id)}">
              Editar
            </button>
            <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar" data-id="${escapar(a.id)}">
              Eliminar
            </button>
          </div>
        </article>
      `;
    }).join('');

    // Asignar eventos de editar y eliminar
    gridAsignaturas.querySelectorAll('.btn-editar').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const asig = asignaturas.find(x => x.id === id);
        if (asig) abrirModalFormulario(asig);
      });
    });

    gridAsignaturas.querySelectorAll('.btn-eliminar').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const asig = asignaturas.find(x => x.id === id);
        if (!asig) return;

        // Comprobar si tiene grupos en distributivo
        const tieneGrupos = grupos.some(g => g.asignaturaId === asig.id);
        if (tieneGrupos) {
          aviso('No se puede eliminar la asignatura porque tiene grupos asociados en el distributivo.', 'error');
          return;
        }

        const confirmado = await confirmar(`¿Estás seguro de eliminar la asignatura "${asig.nombre}"?`);
        if (!confirmado) return;

        try {
          await api.eliminar('asignaturas', asig.id);
          aviso('Asignatura eliminada con éxito', 'exito');
          await cargarDatos();
        } catch (err) {
          aviso(err.message || 'Error al eliminar la asignatura', 'error');
        }
      });
    });
  }

  async function abrirModalFormulario(existente = null) {
    const esEdicion = !!existente;

    const formWrapper = document.createElement('form');
    formWrapper.className = 'pila pila--media';
    formWrapper.setAttribute('novalidate', '');

    formWrapper.innerHTML = `
      <div class="campo">
        <label for="asig-nombre">Nombre de la asignatura</label>
        <input type="text" id="asig-nombre" value="${escapar(existente?.nombre || '')}" required placeholder="Ej. Ciencias Naturales">
        <span class="campo__error" id="error-asig-nombre" aria-live="polite"></span>
      </div>

      <div class="campo">
        <label for="asig-nivel">Nivel académico</label>
        <input type="text" id="asig-nivel" value="${escapar(existente?.nivel || '')}" required placeholder="Ej. Décimo año básico">
        <span class="campo__error" id="error-asig-nivel" aria-live="polite"></span>
      </div>

      <div class="campo">
        <label for="asig-descripcion">Descripción</label>
        <textarea id="asig-descripcion" rows="3" placeholder="Breve descripción del currículo o contenido...">${escapar(existente?.descripcion || '')}</textarea>
        <span class="campo__error" id="error-asig-desc" aria-live="polite"></span>
      </div>
    `;

    const inputNombre = formWrapper.querySelector('#asig-nombre');
    const inputNivel = formWrapper.querySelector('#asig-nivel');
    const inputDesc = formWrapper.querySelector('#asig-descripcion');
    const errorNombre = formWrapper.querySelector('#error-asig-nombre');
    const errorNivel = formWrapper.querySelector('#error-asig-nivel');

    const accionElegida = await modal({
      titulo: esEdicion ? 'Editar Asignatura' : 'Nueva Asignatura',
      contenido: formWrapper,
      acciones: [
        { texto: 'Cancelar', clase: 'btn btn--texto', valor: null },
        { texto: esEdicion ? 'Guardar Cambios' : 'Crear Asignatura', clase: 'btn btn--primario', valor: 'guardar' }
      ]
    });

    if (accionElegida === 'guardar') {
      const nombre = inputNombre.value.trim();
      const nivel = inputNivel.value.trim();
      const descripcion = inputDesc.value.trim();

      if (!nombre || !nivel) {
        aviso('El nombre y el nivel son obligatorios.', 'error');
        return;
      }

      try {
        if (esEdicion) {
          await api.actualizar('asignaturas', existente.id, { nombre, nivel, descripcion });
          aviso('Asignatura actualizada con éxito', 'exito');
        } else {
          await api.crear('asignaturas', { nombre, nivel, descripcion });
          aviso('Asignatura creada con éxito', 'exito');
        }
        await cargarDatos();
      } catch (err) {
        aviso(err.message || 'Error al guardar la asignatura', 'error');
      }
    }
  }

  btnNueva.addEventListener('click', () => abrirModalFormulario());

  await cargarDatos();
}
