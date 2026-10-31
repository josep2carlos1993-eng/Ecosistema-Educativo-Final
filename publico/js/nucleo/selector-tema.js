// publico/js/nucleo/selector-tema.js · Selector pedagógico de temas para actividades
import api from './api.js';
import { parametro } from './util.js';
import { modal, aviso, escapar } from './ui.js';

export async function obtenerTemaActividad() {
  const temaId = parametro('temaId');

  if (temaId) {
    try {
      const tema = await api.obtener('temas', temaId);
      if (tema && tema.id) {
        return tema;
      }
    } catch {
      // Si falla obtener por parámetro temaId, continúa a mostrar el selector modal
    }
  }

  try {
    const [temas, unidades, asignaturas] = await Promise.all([
      api.listar('temas'),
      api.listar('unidades').catch(() => []),
      api.listar('asignaturas').catch(() => [])
    ]);

    // Solo temas publicados
    const temasPublicados = (temas || []).filter(t => t && t.id && t.estado === 'publicado');

    if (temasPublicados.length === 0) {
      aviso('No hay temas publicados disponibles.', 'error');
      window.location.href = '/paginas/asignaturas.html';
      throw new Error('No hay temas disponibles');
    }

    const idsUnidadesConTemas = new Set(temasPublicados.map(t => t.unidadId));
    const unidadesConTemas = (unidades || []).filter(u => u && u.id && idsUnidadesConTemas.has(u.id));
    const idsAsignaturasConTemas = new Set(unidadesConTemas.map(u => u.asignaturaId));

    let asignaturasDisponibles = (asignaturas || []).filter(a => a && a.id && idsAsignaturasConTemas.has(a.id));
    if (asignaturasDisponibles.length === 0) {
      asignaturasDisponibles = asignaturas || [];
    }

    const contenedor = document.createElement('div');
    contenedor.className = 'pila pila--media';

    contenedor.innerHTML = `
      <p style="color: var(--color-texto-suave); font-size: var(--texto-s); margin-bottom: var(--espacio-s);">
        Selecciona la asignatura, unidad y tema sobre el que deseas realizar la actividad formativa:
      </p>

      <div class="campo">
        <label for="sel-asignatura" class="campo__etiqueta">Asignatura</label>
        <select id="sel-asignatura" class="campo__control">
          <option value="">-- Selecciona una asignatura --</option>
          ${asignaturasDisponibles.map(a => `<option value="${escapar(a.id)}">${escapar(a.nombre)}</option>`).join('')}
        </select>
      </div>

      <div class="campo">
        <label for="sel-unidad" class="campo__etiqueta">Unidad</label>
        <select id="sel-unidad" class="campo__control" disabled>
          <option value="">-- Primero selecciona una asignatura --</option>
        </select>
      </div>

      <div class="campo">
        <label for="sel-tema" class="campo__etiqueta">Tema (solo publicados)</label>
        <select id="sel-tema" class="campo__control" disabled>
          <option value="">-- Primero selecciona una unidad --</option>
        </select>
      </div>
    `;

    return new Promise((resolve, reject) => {
      let temaElegido = null;

      const selAsignatura = contenedor.querySelector('#sel-asignatura');
      const selUnidad = contenedor.querySelector('#sel-unidad');
      const selTema = contenedor.querySelector('#sel-tema');

      const actualizarBotonConfirmar = () => {
        const btnConfirmar = document.querySelector('.modal-acciones .btn--primario');
        if (btnConfirmar) {
          btnConfirmar.disabled = !temaElegido;
        }
      };

      selAsignatura.addEventListener('change', () => {
        const asigId = selAsignatura.value;
        temaElegido = null;
        actualizarBotonConfirmar();

        selTema.innerHTML = '<option value="">-- Primero selecciona una unidad --</option>';
        selTema.disabled = true;

        if (!asigId) {
          selUnidad.innerHTML = '<option value="">-- Primero selecciona una asignatura --</option>';
          selUnidad.disabled = true;
          return;
        }

        const unidadesFiltradas = (unidades || []).filter(
          u => u && u.asignaturaId === asigId && idsUnidadesConTemas.has(u.id)
        );

        if (unidadesFiltradas.length === 0) {
          selUnidad.innerHTML = '<option value="">-- No hay unidades con temas publicados --</option>';
          selUnidad.disabled = true;
        } else {
          selUnidad.innerHTML = '<option value="">-- Selecciona una unidad --</option>' +
            unidadesFiltradas.map(u => `<option value="${escapar(u.id)}">${escapar(u.titulo)}</option>`).join('');
          selUnidad.disabled = false;
        }
      });

      selUnidad.addEventListener('change', () => {
        const uniId = selUnidad.value;
        temaElegido = null;
        actualizarBotonConfirmar();

        if (!uniId) {
          selTema.innerHTML = '<option value="">-- Primero selecciona una unidad --</option>';
          selTema.disabled = true;
          return;
        }

        const temasFiltrados = temasPublicados.filter(t => t && t.unidadId === uniId);

        if (temasFiltrados.length === 0) {
          selTema.innerHTML = '<option value="">-- No hay temas publicados en esta unidad --</option>';
          selTema.disabled = true;
        } else {
          selTema.innerHTML = '<option value="">-- Selecciona un tema --</option>' +
            temasFiltrados.map(t => `<option value="${escapar(t.id)}">${escapar(t.titulo)}</option>`).join('');
          selTema.disabled = false;
        }
      });

      selTema.addEventListener('change', () => {
        const temaIdSel = selTema.value;
        temaElegido = temasPublicados.find(t => t.id === temaIdSel) || null;
        actualizarBotonConfirmar();
      });

      modal({
        titulo: 'Seleccionar Tema de Estudio',
        contenido: contenedor,
        acciones: [
          { texto: 'Cancelar y volver', valor: 'cancelar', clase: 'btn btn--secundario' },
          { texto: 'Comenzar actividad', valor: 'confirmar', clase: 'btn btn--primario' }
        ]
      }).then(res => {
        if (res === 'confirmar' && temaElegido) {
          if (typeof history !== 'undefined' && history.pushState) {
            const nuevaUrl = new URL(window.location.href);
            nuevaUrl.searchParams.set('temaId', temaElegido.id);
            history.pushState({}, '', nuevaUrl);
          }
          resolve(temaElegido);
        } else {
          window.location.href = '/paginas/asignaturas.html';
          reject(new Error('Selección cancelada'));
        }
      });

      // Deshabilitar botón confirmar hasta que se elija un tema
      setTimeout(actualizarBotonConfirmar, 0);
    });

  } catch (error) {
    aviso('Error al cargar temas para la actividad', 'error');
    window.location.href = '/paginas/asignaturas.html';
    throw error;
  }
}

export default {
  obtenerTemaActividad
};

