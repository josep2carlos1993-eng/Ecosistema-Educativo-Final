// publico/js/modulos/noticias.js · Portal de noticias con filtros y paginación
import { montarPlantilla } from '../nucleo/plantilla.js';
import api from '../nucleo/api.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { fechaRelativa } from '../nucleo/util.js';
import { escapar } from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Noticias y Novedades', roles: ['sesion'] });

const usuario = usuarioActual();
const esDocenteOAdmin = usuario && (usuario.rol === 'docente' || usuario.rol === 'admin');

const contenido = document.getElementById('contenido');
if (contenido) {
  let noticias = [];
  let lecturas = [];
  let temas = [];
  let paginaActual = 1;
  const POR_PAGINA = 9;

  let filtroCategoria = '';
  let filtroTema = '';

  contenido.innerHTML = `
    <section class="pila pila--amplia">
      <header class="noticias-cabecera">
        <div>
          <h1 style="font-size: var(--texto-2xl); color: var(--color-primario); margin: 0;">Noticias y Novedades</h1>
          <p style="color: var(--color-texto-suave); margin: var(--espacio-xs) 0 0 0;">Mantente al día con los comunicados y eventos del ecosistema educativo.</p>
        </div>
        ${esDocenteOAdmin ? `
          <a href="/paginas/editor-noticia.html" class="btn btn--primario">
            + Nueva Noticia
          </a>
        ` : ''}
      </header>

      <!-- Barra de Filtros -->
      <div class="noticias-filtros">
        <div class="campo" style="max-width: 250px;">
          <label for="filtro-categoria" style="font-size: var(--texto-xs);">Filtrar por categoría</label>
          <select id="filtro-categoria">
            <option value="">Todas las categorías</option>
            <option value="Institucional">Institucional</option>
            <option value="Académica">Académica</option>
            <option value="Eventos">Eventos</option>
            <option value="Logros">Logros</option>
          </select>
        </div>

        <div class="campo" style="max-width: 250px;">
          <label for="filtro-tema" style="font-size: var(--texto-xs);">Filtrar por tema relacionado</label>
          <select id="filtro-tema">
            <option value="">Todos los temas</option>
          </select>
        </div>
      </div>

      <!-- Contenedor de noticias -->
      <div id="contenedor-noticias">
        <p style="color: var(--color-texto-suave);">Cargando noticias...</p>
      </div>

      <!-- Paginación -->
      <nav id="contenedor-paginacion" class="paginacion oculto" aria-label="Paginación de noticias"></nav>
    </section>
  `;

  async function cargarDatos() {
    try {
      const [notResp, lecResp, temResp] = await Promise.all([
        api.listar('noticias'),
        api.listar('lecturas-noticias'),
        api.listar('temas')
      ]);

      noticias = notResp || [];
      lecturas = lecResp || [];
      temas = temResp || [];

      // Poblar selector de temas
      const selTema = document.getElementById('filtro-tema');
      if (selTema) {
        temas.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.id;
          opt.textContent = t.titulo;
          selTema.appendChild(opt);
        });
      }

      // Escuchar filtros
      document.getElementById('filtro-categoria').addEventListener('change', e => {
        filtroCategoria = e.target.value;
        paginaActual = 1;
        renderizarNoticias();
      });

      document.getElementById('filtro-tema').addEventListener('change', e => {
        filtroTema = e.target.value;
        paginaActual = 1;
        renderizarNoticias();
      });

      renderizarNoticias();
    } catch (err) {
      document.getElementById('contenedor-noticias').innerHTML = `
        <div class="tarjeta" style="color: var(--color-error); text-align: center; padding: var(--espacio-xl);">
          ${escapar(err.message || 'Error al cargar las noticias.')}
        </div>
      `;
    }
  }

  function renderizarNoticias() {
    const contenedor = document.getElementById('contenedor-noticias');
    const contenedorPaginacion = document.getElementById('contenedor-paginacion');

    const leidasIds = new Set(lecturas.map(l => l.noticiaId));

    // Filtrar
    let filtradas = noticias.filter(n => {
      if (filtroCategoria && n.categoria !== filtroCategoria) return false;
      if (filtroTema && n.temaId !== filtroTema) return false;
      return true;
    });

    // Ordenar: destacadas primero, luego por fecha más reciente
    filtradas.sort((a, b) => {
      const destA = a.destacada ? 1 : 0;
      const destB = b.destacada ? 1 : 0;
      if (destA !== destB) return destB - destA;

      const fA = new Date(a.fechaPublicacion || a.fecha || 0).getTime();
      const fB = new Date(b.fechaPublicacion || b.fecha || 0).getTime();
      return fB - fA;
    });

    if (filtradas.length === 0) {
      contenedor.innerHTML = `
        <div class="vacio">
          <span class="vacio__icono">📰</span>
          <h2 class="vacio__titulo">No hay noticias disponibles</h2>
          <p class="vacio__texto">No se encontraron noticias que coincidan con los filtros seleccionados.</p>
        </div>
      `;
      contenedorPaginacion.classList.add('oculto');
      return;
    }

    // Calcular páginas
    const totalPaginas = Math.ceil(filtradas.length / POR_PAGINA);
    if (paginaActual > totalPaginas) paginaActual = totalPaginas;

    const inicio = (paginaActual - 1) * POR_PAGINA;
    const itemsPagina = filtradas.slice(inicio, inicio + POR_PAGINA);

    const tarjetasHtml = itemsPagina.map(n => {
      const esLeida = leidasIds.has(n.id);
      const fechaTexto = (n.fechaPublicacion || n.fecha) ? fechaRelativa(n.fechaPublicacion || n.fecha) : '';

      return `
        <article class="tarjeta tarjeta--interactiva tarjeta-noticia">
          ${n.imagen ? `
            <img src="${escapar(n.imagen)}" alt="${escapar(n.titulo)}" class="tarjeta-noticia__imagen" loading="lazy">
          ` : `
            <div class="tarjeta-noticia__imagen-vacia">📰</div>
          `}

          <div class="tarjeta-noticia__cuerpo">
            <div class="tarjeta-noticia__etiquetas">
              ${!esLeida ? '<span class="insignia insignia--primario">Nuevo</span>' : ''}
              ${n.destacada ? '<span class="insignia insignia--advertencia">⭐ Destacada</span>' : ''}
              <span class="insignia insignia--secundario">${escapar(n.categoria || 'General')}</span>
              ${(esDocenteOAdmin && n.estado === 'borrador') ? '<span class="insignia" style="background: var(--color-texto-suave); color: var(--color-texto-inverso);">Borrador</span>' : ''}
            </div>

            ${fechaTexto ? `<span class="tarjeta-noticia__fecha">${escapar(fechaTexto)}</span>` : ''}

            <h2 class="tarjeta-noticia__titulo">
              <a href="/paginas/noticia.html?id=${escapar(n.id)}" style="color: inherit; text-decoration: none;">
                ${escapar(n.titulo)}
              </a>
            </h2>

            <p class="tarjeta-noticia__resumen">${escapar(n.resumen || '')}</p>
          </div>

          <footer class="tarjeta-noticia__pie">
            <a href="/paginas/noticia.html?id=${escapar(n.id)}" class="btn btn--texto btn--pequeno">
              Leer completa →
            </a>
            ${esDocenteOAdmin ? `
              <a href="/paginas/editor-noticia.html?id=${escapar(n.id)}" class="btn btn--secundario btn--pequeno" title="Editar noticia">
                Editar
              </a>
            ` : ''}
          </footer>
        </article>
      `;
    }).join('');

    contenedor.innerHTML = `
      <div class="grid-noticias">
        ${tarjetasHtml}
      </div>
    `;

    // Renderizar paginador si hay más de 1 página
    if (totalPaginas > 1) {
      contenedorPaginacion.classList.remove('oculto');
      contenedorPaginacion.innerHTML = `
        <button type="button" id="btn-pag-ant" class="btn btn--secundario btn--pequeno" ${paginaActual === 1 ? 'disabled' : ''}>
          ← Anterior
        </button>
        <span style="font-size: var(--texto-s); color: var(--color-texto);">
          Página ${paginaActual} de ${totalPaginas}
        </span>
        <button type="button" id="btn-pag-sig" class="btn btn--secundario btn--pequeno" ${paginaActual === totalPaginas ? 'disabled' : ''}>
          Siguiente →
        </button>
      `;

      document.getElementById('btn-pag-ant').addEventListener('click', () => {
        if (paginaActual > 1) {
          paginaActual--;
          renderizarNoticias();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });

      document.getElementById('btn-pag-sig').addEventListener('click', () => {
        if (paginaActual < totalPaginas) {
          paginaActual++;
          renderizarNoticias();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    } else {
      contenedorPaginacion.classList.add('oculto');
    }
  }

  await cargarDatos();
}
