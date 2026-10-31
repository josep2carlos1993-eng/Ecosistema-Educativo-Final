// publico/js/modulos/noticia.js · Visualización detallada de una noticia y registro de lectura
import { montarPlantilla } from '../nucleo/plantilla.js';
import api from '../nucleo/api.js';
import { parametro, fechaLarga, formatoBasico } from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { escapar, aviso } from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Detalle de Noticia', roles: ['sesion'] });

const noticiaId = parametro('id');
if (!noticiaId) {
  aviso('No se especificó ninguna noticia.', 'error');
  window.location.href = '/paginas/noticias.html';
}

const contenido = document.getElementById('contenido');
const usuario = usuarioActual();
const esDocenteOAdmin = usuario && (usuario.rol === 'docente' || usuario.rol === 'admin');

if (contenido && noticiaId) {
  contenido.innerHTML = `
    <div class="pila pila--amplia">
      <nav class="migas" aria-label="Ruta de navegación">
        <a href="/paginas/noticias.html">Noticias</a>
        <span class="migas__separador">/</span>
        <span class="migas__actual" id="miga-noticia">Cargando...</span>
      </nav>

      <div id="cuerpo-noticia">
        <p style="color: var(--color-texto-suave);">Cargando noticia...</p>
      </div>
    </div>
  `;

  async function cargarDetalle() {
    const cuerpo = document.getElementById('cuerpo-noticia');
    try {
      const [noticia, lecturas] = await Promise.all([
        api.obtener('noticias', noticiaId),
        api.listar('lecturas-noticias', { noticiaId })
      ]);

      if (!noticia) {
        cuerpo.innerHTML = `
          <div class="tarjeta" style="color: var(--color-error); text-align: center; padding: var(--espacio-xl);">
            No se encontró la noticia solicitada.
          </div>
        `;
        return;
      }

      document.getElementById('miga-noticia').textContent = noticia.titulo;

      // Registrar lectura si no existe
      const yaLeida = Array.isArray(lecturas) && lecturas.some(l => l && l.noticiaId === noticia.id);
      if (!yaLeida) {
        try {
          await api.crear('lecturas-noticias', { noticiaId: noticia.id });
          // Actualizar badge del menú si está en pantalla
          const badge = document.getElementById('badge-noticias-no-leidas');
          if (badge && !badge.classList.contains('oculto')) {
            const actual = parseInt(badge.textContent, 10) || 0;
            if (actual > 1) {
              badge.textContent = String(actual - 1);
            } else {
              badge.classList.add('oculto');
            }
          }
        } catch {
          // Si ya existe o error en registro se omite
        }
      }

      // Si tiene tema asociado, obtener el título del tema
      let temaAsociado = null;
      if (noticia.temaId) {
        try {
          temaAsociado = await api.obtener('temas', noticia.temaId);
        } catch {
          temaAsociado = null;
        }
      }

      const fechaPub = noticia.fechaPublicacion || noticia.fecha;
      const fechaTexto = fechaPub ? fechaLarga(fechaPub) : '';

      cuerpo.innerHTML = `
        <article class="articulo-noticia">
          <header class="articulo-noticia__cabecera">
            <div class="fila" style="justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espacio-s);">
              <div class="articulo-noticia__metas">
                <span class="insignia insignia--secundario">${escapar(noticia.categoria || 'General')}</span>
                ${noticia.destacada ? '<span class="insignia insignia--advertencia">⭐ Noticia Destacada</span>' : ''}
                ${(esDocenteOAdmin && noticia.estado === 'borrador') ? '<span class="insignia" style="background: var(--color-texto-suave); color: var(--color-texto-inverso);">Borrador</span>' : ''}
                ${temaAsociado ? `
                  <a href="/paginas/tema.html?id=${escapar(temaAsociado.id)}" class="insignia insignia--primario" style="text-decoration: none;" title="Ver tema relacionado">
                    📖 Tema: ${escapar(temaAsociado.titulo)}
                  </a>
                ` : ''}
              </div>

              ${esDocenteOAdmin ? `
                <a href="/paginas/editor-noticia.html?id=${escapar(noticia.id)}" class="btn btn--secundario btn--pequeno">
                  Editar noticia
                </a>
              ` : ''}
            </div>

            <h1 class="articulo-noticia__titulo">${escapar(noticia.titulo)}</h1>

            ${fechaTexto ? `
              <div class="articulo-noticia__fecha-autor">
                Publicado el ${escapar(fechaTexto)}
              </div>
            ` : ''}

            ${noticia.resumen ? `
              <p class="articulo-noticia__resumen">${escapar(noticia.resumen)}</p>
            ` : ''}
          </header>

          ${noticia.imagen ? `
            <img src="${escapar(noticia.imagen)}" alt="${escapar(noticia.titulo)}" class="articulo-noticia__imagen">
          ` : ''}

          <div class="articulo-noticia__cuerpo">
            ${formatoBasico(noticia.cuerpo || '')}
          </div>

          <footer style="margin-top: var(--espacio-xl); padding-top: var(--espacio-m); border-top: 1px solid var(--color-borde); display: flex; justify-content: space-between; align-items: center;">
            <a href="/paginas/noticias.html" class="btn btn--secundario">
              ← Volver al listado de noticias
            </a>
          </footer>
        </article>
      `;
    } catch (err) {
      cuerpo.innerHTML = `
        <div class="tarjeta" style="color: var(--color-error); text-align: center; padding: var(--espacio-xl);">
          ${escapar(err.message || 'Error al cargar la noticia.')}
        </div>
      `;
    }
  }

  await cargarDetalle();
}
