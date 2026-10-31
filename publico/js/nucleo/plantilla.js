// publico/js/nucleo/plantilla.js · Montaje de encabezado, menú y pie

import { MENU } from './menu.js';
import { usuarioActual, cerrar, exigirRol } from './sesion.js';
import { registrarEvento } from './bitacora.js';
import { aviso, escapar } from './ui.js';
import { logrosDe } from './gamificacion.js';
import api from './api.js';

export const NOMBRE = 'Ecosistema Educativo';

export async function montarPlantilla({ titulo = '', roles } = {}) {
  // 1. Exigir rol si se especifican roles
  if (roles !== undefined) {
    const permitido = exigirRol(roles);
    if (permitido === false) return;
  }

  // 2. Título del documento
  document.title = titulo ? `${titulo} · ${NOMBRE}` : NOMBRE;

  if (typeof document === 'undefined') return;

  // 3. Revisar si hay avisos pendientes tras redirecciones
  try {
    const avisoPendiente = sessionStorage.getItem('aviso_pendiente');
    if (avisoPendiente) {
      sessionStorage.removeItem('aviso_pendiente');
      const { texto, tipo } = JSON.parse(avisoPendiente);
      aviso(texto, tipo || 'info');
    }
  } catch {
    // Si no es un JSON válido se omite
  }

  // 4. Usuario actual y registro de navegación
  const usuario = usuarioActual();
  if (usuario) {
    registrarEvento('pagina', window.location.pathname);
  }

  const rutaActual = window.location.pathname;
  const contenedorPlantilla = document.getElementById('plantilla');

  // 5. Encabezado y menú lateral en #plantilla
  if (contenedorPlantilla) {
    // Filtrar menú por rol ("publico" = todos, "sesion" = cualquier autenticado)
    const menuFiltrado = MENU.filter(item => {
      const itemRoles = item.roles || ['publico'];
      if (itemRoles.includes('publico')) return true;
      if (!usuario) return false;
      if (itemRoles.includes('sesion')) return true;
      return itemRoles.includes(usuario.rol);
    });

    const enlacesHtml = menuFiltrado.map(item => {
      const esActual =
        rutaActual === item.href ||
        (item.href === '/index.html' && (rutaActual === '/' || rutaActual === '/index.html'));

      const esNoticias = item.href === '/paginas/noticias.html';
      const badgeNoticias = esNoticias
        ? ' <span id="badge-noticias-no-leidas" class="insignia insignia--advertencia oculto" style="font-size: var(--texto-xs); padding: 2px 6px; margin-left: var(--espacio-xs); border-radius: var(--radio-completo);"></span>'
        : '';

      return `<a href="${item.href}" class="menu__enlace${esActual ? ' menu__enlace--activo' : ''}" ${
        esActual ? 'aria-current="page"' : ''
      }>${item.texto}${badgeNoticias}</a>`;
    }).join('');

    let accionesHtml = '';
    if (usuario) {
      const puntosHtml = usuario.rol === 'estudiante'
        ? `<span id="puntos-usuario" class="puntos-usuario" title="Puntos acumulados">0 pts</span>`
        : '';

      accionesHtml = `
        <div class="encabezado__acciones">
          ${puntosHtml}
          <a href="/paginas/perfil.html" class="encabezado__usuario-enlace" title="Ver perfil">
            ${escapar(usuario.nombre)} (${escapar(usuario.rol)})
          </a>
          <button type="button" id="btn-salir" class="btn btn--texto btn--pequeno" style="color: var(--color-texto-inverso);">Salir</button>
        </div>
      `;
    } else {
      accionesHtml = `
        <div class="encabezado__acciones">
          <a href="/paginas/ingreso.html" class="btn btn--texto btn--pequeno" style="color: var(--color-texto-inverso);">Ingresar</a>
          <a href="/paginas/registro.html" class="btn btn--secundario btn--pequeno">Registrarse</a>
        </div>
      `;
    }

    contenedorPlantilla.innerHTML = `
      <header class="encabezado">
        <div class="contenedor encabezado__contenedor">
          <div class="fila">
            <button type="button" class="menu-toggle" id="btn-menu-movil" aria-label="Abrir menú" aria-expanded="false">☰</button>
            <span class="encabezado__marca">${NOMBRE}</span>
          </div>
          <span class="encabezado__titulo" style="font-size: var(--texto-m); font-weight: var(--peso-medio); color: var(--color-texto-inverso);">${titulo}</span>
          ${accionesHtml}
        </div>
      </header>
      <nav class="menu" id="menu-lateral" aria-label="Navegación principal">
        <div class="menu__lista pila pila--compacta">
          ${enlacesHtml}
        </div>
      </nav>
    `;

    // Interacción botón de salir
    const btnSalir = document.getElementById('btn-salir');
    if (btnSalir) {
      btnSalir.addEventListener('click', async () => {
        await cerrar();
      });
    }

    // Interacción del menú para celular
    const btnMenu = document.getElementById('btn-menu-movil');
    const menuLateral = document.getElementById('menu-lateral');

    if (btnMenu && menuLateral) {
      btnMenu.addEventListener('click', e => {
        e.stopPropagation();
        const abierto = menuLateral.classList.toggle('abierto');
        btnMenu.setAttribute('aria-expanded', String(abierto));
      });

      // Cerrar menú al hacer clic fuera o en un enlace
      document.addEventListener('click', e => {
        if (menuLateral.classList.contains('abierto') && !menuLateral.contains(e.target) && e.target !== btnMenu) {
          menuLateral.classList.remove('abierto');
          btnMenu.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // Cargar puntos de gamificación para estudiantes
    if (usuario && usuario.rol === 'estudiante') {
      try {
        const logros = await logrosDe('yo');
        const elPuntos = document.getElementById('puntos-usuario');
        if (elPuntos && logros && typeof logros.puntos === 'number') {
          elPuntos.textContent = `${logros.puntos} pts`;
        }
      } catch {
        // Si no se pueden obtener logros temporalmente, se omite
      }
    }

    // Actualizar contador de noticias no leídas si hay sesión
    if (usuario) {
      actualizarContadorNoticias();
    }
  }

  // 6. Pie con el año al final del body
  let pie = document.querySelector('footer.pie');
  if (!pie) {
    pie = document.createElement('footer');
    pie.className = 'pie';
    const anio = new Date().getFullYear();
    pie.innerHTML = `
      <div class="contenedor">
        <p>© ${anio} ${NOMBRE}</p>
      </div>
    `;
    document.body.appendChild(pie);
  }
}

async function actualizarContadorNoticias() {
  const badge = document.getElementById('badge-noticias-no-leidas');
  if (!badge) return;
  try {
    const [noticias, lecturas] = await Promise.all([
      api.listar('noticias'),
      api.listar('lecturas-noticias')
    ]);
    const publicadas = (noticias || []).filter(n => n && n.estado === 'publicado');
    const leidasIds = new Set((lecturas || []).map(l => l.noticiaId));
    const sinLeer = publicadas.filter(n => !leidasIds.has(n.id)).length;
    if (sinLeer > 0) {
      badge.textContent = sinLeer > 99 ? '99+' : String(sinLeer);
      badge.classList.remove('oculto');
    } else {
      badge.classList.add('oculto');
    }
  } catch {
    // Si no tiene permisos o falla conexión se omite
  }
}

export default {
  NOMBRE,
  montarPlantilla
};
