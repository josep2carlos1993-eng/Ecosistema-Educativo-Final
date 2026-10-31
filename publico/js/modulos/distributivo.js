// publico/js/modulos/distributivo.js · Gestión de distributivo académico (admin)
import { montarPlantilla } from '../nucleo/plantilla.js';
import api from '../nucleo/api.js';
import { confirmar, modal, aviso, escapar } from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Distributivo', roles: ['admin'] });

const contenido = document.getElementById('contenido');
if (contenido) {
  let distributivo = [];
  let asignaturas = [];
  let usuarios = [];

  contenido.innerHTML = `
    <div class="pila pila--media">
      <div class="distributivo-herramientas">
        <div>
          <h2 style="font-size: var(--texto-xl); color: var(--color-primario);">Distributivo Docente</h2>
          <p style="font-size: var(--texto-s); color: var(--color-texto-suave);">Asignación de asignaturas, paralelos, docentes y estudiantes.</p>
        </div>
        <button type="button" id="btn-nuevo-distributivo" class="btn btn--primario">
          + Nuevo Grupo
        </button>
      </div>

      <div class="distributivo-tabla-wrapper">
        <table class="distributivo-tabla" aria-label="Tabla de grupos del distributivo">
          <thead>
            <tr>
              <th>Asignatura</th>
              <th>Paralelo</th>
              <th>Período</th>
              <th>Docente</th>
              <th>Estudiantes</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="cuerpo-tabla-distributivo">
            <tr>
              <td colspan="6" style="text-align: center; padding: var(--espacio-l);">Cargando distributivo...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  const cuerpoTabla = document.getElementById('cuerpo-tabla-distributivo');
  const btnNuevo = document.getElementById('btn-nuevo-distributivo');

  async function cargarDatos() {
    try {
      const [dists, asigs, usus] = await Promise.all([
        api.listar('distributivo'),
        api.listar('asignaturas'),
        api.listar('usuarios')
      ]);
      distributivo = dists || [];
      asignaturas = asigs || [];
      usuarios = usus || [];
      renderizarTabla();
    } catch (err) {
      cuerpoTabla.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--color-error);">${escapar(err.message || 'Error al cargar datos')}</td></tr>`;
      aviso(err.message || 'Error al cargar distributivo', 'error');
    }
  }

  function renderizarTabla() {
    if (distributivo.length === 0) {
      cuerpoTabla.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: var(--espacio-xl); color: var(--color-texto-suave);">
            No hay grupos registrados en el distributivo. Pulsa "+ Nuevo Grupo" para crear uno.
          </td>
        </tr>
      `;
      return;
    }

    const mapaAsignaturas = new Map(asignaturas.map(a => [a.id, a]));
    const mapaUsuarios = new Map(usuarios.map(u => [u.id, u]));

    cuerpoTabla.innerHTML = distributivo.map(g => {
      const asig = mapaAsignaturas.get(g.asignaturaId);
      const doc = mapaUsuarios.get(g.docenteId);
      const cantEstudiantes = Array.isArray(g.estudiantes) ? g.estudiantes.length : 0;

      const nombreAsignatura = asig ? `${asig.nombre} (${asig.nivel})` : 'Asignatura no encontrada';
      const nombreDocente = doc ? `${doc.nombre} ${doc.apellido}` : 'Docente no asignado';

      return `
        <tr data-id="${escapar(g.id)}">
          <td><strong>${escapar(nombreAsignatura)}</strong></td>
          <td><span class="insignia insignia--secundario">${escapar(g.paralelo || '-')}</span></td>
          <td>${escapar(g.periodo || '-')}</td>
          <td>${escapar(nombreDocente)}</td>
          <td>
            <span class="insignia insignia--info">${cantEstudiantes} ${cantEstudiantes === 1 ? 'estudiante' : 'estudiantes'}</span>
          </td>
          <td>
            <div class="fila" style="gap: var(--espacio-xs);">
              <button type="button" class="btn btn--secundario btn--pequeno btn-editar" data-id="${escapar(g.id)}">
                Editar
              </button>
              <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar" data-id="${escapar(g.id)}">
                Eliminar
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Eventos Editar y Eliminar
    cuerpoTabla.querySelectorAll('.btn-editar').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const grupo = distributivo.find(x => x.id === id);
        if (grupo) abrirModalFormulario(grupo);
      });
    });

    cuerpoTabla.querySelectorAll('.btn-eliminar').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const grupo = distributivo.find(x => x.id === id);
        if (!grupo) return;

        const confirmado = await confirmar(`¿Estás seguro de eliminar el grupo del paralelo "${grupo.paralelo}" (${grupo.periodo})?`);
        if (!confirmado) return;

        try {
          await api.eliminar('distributivo', grupo.id);
          aviso('Grupo eliminado del distributivo', 'exito');
          await cargarDatos();
        } catch (err) {
          aviso(err.message || 'Error al eliminar el grupo', 'error');
        }
      });
    });
  }

  async function abrirModalFormulario(existente = null) {
    const esEdicion = !!existente;
    const docentes = usuarios.filter(u => u.rol === 'docente' && u.activo !== false);
    const estudiantes = usuarios.filter(u => u.rol === 'estudiante' && u.activo !== false);

    const seleccionados = new Set(Array.isArray(existente?.estudiantes) ? existente.estudiantes : []);

    const formWrapper = document.createElement('form');
    formWrapper.className = 'pila pila--media';
    formWrapper.setAttribute('novalidate', '');

    const opcionesAsignaturas = asignaturas.map(a => {
      const selected = existente?.asignaturaId === a.id ? 'selected' : '';
      return `<option value="${escapar(a.id)}" ${selected}>${escapar(a.nombre)} - ${escapar(a.nivel)}</option>`;
    }).join('');

    const opcionesDocentes = docentes.map(d => {
      const selected = existente?.docenteId === d.id ? 'selected' : '';
      return `<option value="${escapar(d.id)}" ${selected}>${escapar(d.nombre)} ${escapar(d.apellido)} (${escapar(d.correo)})</option>`;
    }).join('');

    formWrapper.innerHTML = `
      <div class="campo">
        <label for="modal-dist-asig">Asignatura</label>
        <select id="modal-dist-asig" required>
          <option value="">-- Seleccionar asignatura --</option>
          ${opcionesAsignaturas}
        </select>
      </div>

      <div class="fila" style="gap: var(--espacio-m);">
        <div class="campo" style="flex: 1;">
          <label for="modal-dist-paralelo">Paralelo</label>
          <input type="text" id="modal-dist-paralelo" value="${escapar(existente?.paralelo || 'A')}" placeholder="Ej. A" maxlength="10" required>
        </div>
        <div class="campo" style="flex: 1;">
          <label for="modal-dist-periodo">Período lectivo</label>
          <input type="text" id="modal-dist-periodo" value="${escapar(existente?.periodo || '2026-2027')}" placeholder="Ej. 2026-2027" required>
        </div>
      </div>

      <div class="campo">
        <label for="modal-dist-docente">Docente asignado</label>
        <select id="modal-dist-docente" required>
          <option value="">-- Seleccionar docente --</option>
          ${opcionesDocentes}
        </select>
      </div>

      <div class="campo">
        <label>Estudiantes del grupo</label>
        <div class="estudiantes-selector-contenedor">
          <div class="fila" style="justify-content: space-between; align-items: center; gap: var(--espacio-s);">
            <input type="search" id="modal-buscar-est" placeholder="Buscar estudiante por nombre o correo..." style="flex: 1;" aria-label="Buscar estudiantes">
            <span id="contador-estudiantes-sel" class="insignia insignia--info">0 seleccionados</span>
          </div>

          <div class="estudiantes-lista-scroll" id="lista-estudiantes-scroll">
            <!-- Se llena dinámicamente -->
          </div>
        </div>
      </div>
    `;

    const selectAsig = formWrapper.querySelector('#modal-dist-asig');
    const inputParalelo = formWrapper.querySelector('#modal-dist-paralelo');
    const inputPeriodo = formWrapper.querySelector('#modal-dist-periodo');
    const selectDocente = formWrapper.querySelector('#modal-dist-docente');
    const inputBuscarEst = formWrapper.querySelector('#modal-buscar-est');
    const contadorEst = formWrapper.querySelector('#contador-estudiantes-sel');
    const contenedorScroll = formWrapper.querySelector('#lista-estudiantes-scroll');

    function actualizarContador() {
      const cant = seleccionados.size;
      contadorEst.textContent = `${cant} ${cant === 1 ? 'seleccionado' : 'seleccionados'}`;
    }

    function renderizarListaEstudiantes() {
      const q = inputBuscarEst.value.trim().toLowerCase();
      const filtrados = estudiantes.filter(e => {
        if (!q) return true;
        return (
          (e.nombre && e.nombre.toLowerCase().includes(q)) ||
          (e.apellido && e.apellido.toLowerCase().includes(q)) ||
          (e.correo && e.correo.toLowerCase().includes(q))
        );
      });

      if (filtrados.length === 0) {
        contenedorScroll.innerHTML = `<p style="font-size: var(--texto-xs); color: var(--color-texto-suave); padding: var(--espacio-xs);">No se encontraron estudiantes.</p>`;
        return;
      }

      contenedorScroll.innerHTML = filtrados.map(e => {
        const checked = seleccionados.has(e.id) ? 'checked' : '';
        return `
          <label class="estudiante-fila-item">
            <input type="checkbox" data-est-id="${escapar(e.id)}" ${checked}>
            <div class="estudiante-fila-datos">
              <span class="estudiante-fila-nombre">${escapar(e.nombre)} ${escapar(e.apellido)}</span>
              <span class="estudiante-fila-correo">${escapar(e.correo)}</span>
            </div>
          </label>
        `;
      }).join('');

      contenedorScroll.querySelectorAll('input[type="checkbox"]').forEach(chk => {
        chk.addEventListener('change', e => {
          const estId = e.target.getAttribute('data-est-id');
          if (e.target.checked) {
            seleccionados.add(estId);
          } else {
            seleccionados.delete(estId);
          }
          actualizarContador();
        });
      });
    }

    inputBuscarEst.addEventListener('input', renderizarListaEstudiantes);

    renderizarListaEstudiantes();
    actualizarContador();

    const accionElegida = await modal({
      titulo: esEdicion ? 'Editar Grupo del Distributivo' : 'Nuevo Grupo en Distributivo',
      contenido: formWrapper,
      acciones: [
        { texto: 'Cancelar', clase: 'btn btn--texto', valor: null },
        { texto: esEdicion ? 'Guardar Cambios' : 'Crear Grupo', clase: 'btn btn--primario', valor: 'guardar' }
      ]
    });

    if (accionElegida === 'guardar') {
      const asignaturaId = selectAsig.value;
      const paralelo = inputParalelo.value.trim();
      const periodo = inputPeriodo.value.trim();
      const docenteId = selectDocente.value;
      const listaEstudiantes = Array.from(seleccionados);

      if (!asignaturaId || !paralelo || !periodo || !docenteId) {
        aviso('Todos los campos son obligatorios (asignatura, paralelo, período y docente).', 'error');
        return;
      }

      try {
        const payload = {
          asignaturaId,
          paralelo,
          periodo,
          docenteId,
          estudiantes: listaEstudiantes
        };

        if (esEdicion) {
          await api.actualizar('distributivo', existente.id, payload);
          aviso('Grupo del distributivo actualizado con éxito', 'exito');
        } else {
          await api.crear('distributivo', payload);
          aviso('Grupo creado en el distributivo con éxito', 'exito');
        }
        await cargarDatos();
      } catch (err) {
        aviso(err.message || 'Error al guardar el grupo', 'error');
      }
    }
  }

  btnNuevo.addEventListener('click', () => abrirModalFormulario());

  await cargarDatos();
}
