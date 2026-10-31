// publico/js/modulos/admin-usuarios.js · Módulo de administración de usuarios
import { montarPlantilla } from '../nucleo/plantilla.js';
import api from '../nucleo/api.js';
import { confirmar, modal, aviso, escapar } from '../nucleo/ui.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Administración de Usuarios', roles: ['admin'] });

const contenido = document.getElementById('contenido');
if (contenido) {
  let usuarios = [];
  const adminSesion = usuarioActual();

  contenido.innerHTML = `
    <div class="pila pila--media">
      <div class="admin-herramientas">
        <div class="admin-filtros">
          <div class="campo admin-buscador">
            <input
              type="search"
              id="buscar-usuario"
              placeholder="Buscar por nombre, apellido o correo..."
              aria-label="Buscar usuarios"
            >
          </div>
          <div class="campo" style="max-width: 180px;">
            <select id="filtrar-rol" aria-label="Filtrar por rol">
              <option value="todos">Todos los roles</option>
              <option value="estudiante">Estudiante</option>
              <option value="docente">Docente</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>
        <div>
          <span class="insignia insignia--info" id="contador-usuarios">0 usuarios</span>
        </div>
      </div>

      <div class="admin-tabla-wrapper">
        <table class="admin-tabla" aria-label="Listado de usuarios registrados">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="cuerpo-tabla-usuarios">
            <tr>
              <td colspan="4" style="text-align: center; padding: var(--espacio-l);">Cargando usuarios...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  const inputBuscar = document.getElementById('buscar-usuario');
  const selectRol = document.getElementById('filtrar-rol');
  const cuerpoTabla = document.getElementById('cuerpo-tabla-usuarios');
  const contadorUsuarios = document.getElementById('contador-usuarios');

  async function cargarUsuarios() {
    try {
      usuarios = await api.listar('usuarios');
      renderizarTabla();
    } catch (err) {
      cuerpoTabla.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--color-error);">${escapar(err.message || 'Error al cargar usuarios')}</td></tr>`;
      aviso(err.message || 'No se pudieron cargar los usuarios', 'error');
    }
  }

  function obtenerUsuariosFiltrados() {
    const q = inputBuscar.value.trim().toLowerCase();
    const rol = selectRol.value;

    return usuarios.filter(u => {
      const coincideRol = rol === 'todos' || u.rol === rol;
      const coincideTexto =
        !q ||
        (u.nombre && u.nombre.toLowerCase().includes(q)) ||
        (u.apellido && u.apellido.toLowerCase().includes(q)) ||
        (u.correo && u.correo.toLowerCase().includes(q));

      return coincideRol && coincideTexto;
    });
  }

  function renderizarTabla() {
    const lista = obtenerUsuariosFiltrados();
    contadorUsuarios.textContent = `${lista.length} ${lista.length === 1 ? 'usuario' : 'usuarios'}`;

    if (lista.length === 0) {
      cuerpoTabla.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: var(--espacio-l); color: var(--color-texto-suave);">
            No se encontraron usuarios que coincidan con la búsqueda.
          </td>
        </tr>
      `;
      return;
    }

    cuerpoTabla.innerHTML = lista.map(u => {
      const esAdminActual = adminSesion && adminSesion.id === u.id;
      const estaActivo = u.activo !== false;

      return `
        <tr data-id="${escapar(u.id)}">
          <td>
            <div class="admin-usuario-info">
              <span class="admin-usuario-nombre">${escapar(u.nombre)} ${escapar(u.apellido)} ${esAdminActual ? '<span class="insignia insignia--secundario" style="margin-left: 4px;">Tú</span>' : ''}</span>
              <span class="admin-usuario-correo">${escapar(u.correo)}</span>
            </div>
          </td>
          <td>
            <select class="select-rol" data-id="${escapar(u.id)}" aria-label="Cambiar rol de ${escapar(u.nombre)}">
              <option value="estudiante" ${u.rol === 'estudiante' ? 'selected' : ''}>Estudiante</option>
              <option value="docente" ${u.rol === 'docente' ? 'selected' : ''}>Docente</option>
              <option value="admin" ${u.rol === 'admin' ? 'selected' : ''}>Administrador</option>
            </select>
          </td>
          <td>
            <label class="admin-casilla-activo">
              <input type="checkbox" class="check-activo" data-id="${escapar(u.id)}" ${estaActivo ? 'checked' : ''} aria-label="Usuario activo">
              <span>${estaActivo ? 'Activo' : 'Inactivo'}</span>
            </label>
          </td>
          <td>
            <button type="button" class="btn btn--secundario btn--pequeno btn-restablecer" data-id="${escapar(u.id)}" data-nombre="${escapar(u.nombre)} ${escapar(u.apellido)}">
              Restablecer clave
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Asignar eventos de interacción
    cuerpoTabla.querySelectorAll('.select-rol').forEach(sel => {
      sel.addEventListener('change', async e => {
        const id = e.target.getAttribute('data-id');
        const nuevoRol = e.target.value;
        const u = usuarios.find(x => x.id === id);
        const rolAnterior = u ? u.rol : nuevoRol;

        try {
          await api.actualizar('usuarios', id, { rol: nuevoRol });
          if (u) u.rol = nuevoRol;
          aviso(`Rol actualizado a ${nuevoRol}`, 'exito');
        } catch (err) {
          e.target.value = rolAnterior;
          aviso(err.message || 'No se pudo actualizar el rol', 'error');
        }
      });
    });

    cuerpoTabla.querySelectorAll('.check-activo').forEach(chk => {
      chk.addEventListener('change', async e => {
        const id = e.target.getAttribute('data-id');
        const nuevoEstado = e.target.checked;
        const u = usuarios.find(x => x.id === id);
        const estadoAnterior = u ? u.activo !== false : !nuevoEstado;

        try {
          await api.actualizar('usuarios', id, { activo: nuevoEstado });
          if (u) u.activo = nuevoEstado;
          const labelSpan = e.target.closest('label').querySelector('span');
          if (labelSpan) labelSpan.textContent = nuevoEstado ? 'Activo' : 'Inactivo';
          aviso(`Usuario ${nuevoEstado ? 'activado' : 'desactivado'}`, 'exito');
        } catch (err) {
          e.target.checked = estadoAnterior;
          aviso(err.message || 'No se pudo actualizar el estado', 'error');
        }
      });
    });

    cuerpoTabla.querySelectorAll('.btn-restablecer').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const nombre = btn.getAttribute('data-nombre');

        const confirmado = await confirmar(`¿Estás seguro de restablecer la contraseña de ${nombre}?`);
        if (!confirmado) return;

        try {
          const res = await api.llamar('POST', `/api/admin/usuarios/${encodeURIComponent(id)}/restablecer`);
          const clave = res.claveTemporal;

          const contenidoModal = document.createElement('div');
          contenidoModal.className = 'pila pila--media';
          contenidoModal.innerHTML = `
            <p>Se ha generado una nueva contraseña temporal para <strong>${escapar(nombre)}</strong>.</p>
            <div class="alerta alerta--advertencia">
              <p>Esta contraseña solo se muestra una sola vez. Cópiala y entrégala al usuario.</p>
            </div>
            <div class="campo">
              <label for="input-clave-temporal">Contraseña temporal:</label>
              <div class="fila" style="gap: var(--espacio-s);">
                <input
                  type="text"
                  id="input-clave-temporal"
                  value="${escapar(clave)}"
                  readonly
                  style="font-family: monospace; font-size: var(--texto-l); font-weight: var(--peso-negrita); letter-spacing: 1px;"
                >
                <button type="button" id="btn-copiar-clave" class="btn btn--secundario">Copiar</button>
              </div>
            </div>
          `;

          const btnCopiar = contenidoModal.querySelector('#btn-copiar-clave');
          const inputClave = contenidoModal.querySelector('#input-clave-temporal');

          btnCopiar.addEventListener('click', async () => {
            try {
              if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(clave);
              } else {
                inputClave.select();
                document.execCommand('copy');
              }
              btnCopiar.textContent = '¡Copiado!';
              aviso('Contraseña copiada al portapapeles', 'exito');
              setTimeout(() => { btnCopiar.textContent = 'Copiar'; }, 2000);
            } catch {
              inputClave.select();
              document.execCommand('copy');
              aviso('Contraseña copiada', 'exito');
            }
          });

          await modal({
            titulo: 'Contraseña Temporal Generada',
            contenido: contenidoModal,
            acciones: [
              { texto: 'Cerrar', clase: 'btn btn--primario', valor: 'cerrar' }
            ]
          });
        } catch (err) {
          aviso(err.message || 'Error al restablecer la contraseña', 'error');
        }
      });
    });
  }

  inputBuscar.addEventListener('input', renderizarTabla);
  selectRol.addEventListener('change', renderizarTabla);

  await cargarUsuarios();
}
