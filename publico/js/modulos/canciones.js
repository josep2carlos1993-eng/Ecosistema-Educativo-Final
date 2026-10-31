// publico/js/modulos/canciones.js · Catálogo de canciones educativas con filtros y reproducción
import { montarPlantilla } from '../nucleo/plantilla.js';
import api from '../nucleo/api.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { escapar, aviso, confirmar } from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Canciones Educativas', roles: ['sesion'] });

const usuario = usuarioActual();
const esDocenteOAdmin = usuario && (usuario.rol === 'docente' || usuario.rol === 'admin');

const contenido = document.getElementById('contenido');
if (contenido) {
  let canciones = [];
  let temas = [];
  let filtroBusqueda = '';
  let filtroTema = '';

  contenido.innerHTML = `
    <section class="pila pila--amplia">
      <header class="canciones-cabecera">
        <div class="canciones-cabecera__textos">
          <h1 class="canciones-cabecera__titulo">🎵 Canciones Educativas</h1>
          <p class="canciones-cabecera__bajada">Aprende al ritmo de la música con canciones temáticas y letras sincronizadas.</p>
        </div>
        ${esDocenteOAdmin ? `
          <a href="/paginas/editor-cancion.html" class="btn btn--primario" id="btn-nueva-cancion">
            + Nueva Canción
          </a>
        ` : ''}
      </header>

      <!-- Barra de Filtros -->
      <section class="canciones-filtros" aria-label="Filtros de canciones">
        <div class="campo">
          <label for="buscar-texto" style="font-size: var(--texto-xs);">Buscar canción o autor</label>
          <input type="search" id="buscar-texto" placeholder="Ej. Ferrocarril, Alfaro, Cacao...">
        </div>

        <div class="campo">
          <label for="filtro-tema" style="font-size: var(--texto-xs);">Filtrar por tema de estudio</label>
          <select id="filtro-tema">
            <option value="">Todos los temas</option>
          </select>
        </div>
      </section>

      <!-- Listado de canciones -->
      <div id="contenedor-canciones" aria-live="polite">
        <div class="cargando">Cargando canciones...</div>
      </div>
    </section>
  `;

  const inputBuscar = document.getElementById('buscar-texto');
  const selectTema = document.getElementById('filtro-tema');
  const contenedorCanciones = document.getElementById('contenedor-canciones');

  function renderizar() {
    let filtradas = canciones.filter(c => {
      const matchTexto = !filtroBusqueda ||
        (c.titulo && c.titulo.toLowerCase().includes(filtroBusqueda)) ||
        (c.autoria && c.autoria.toLowerCase().includes(filtroBusqueda)) ||
        (c.letra && c.letra.toLowerCase().includes(filtroBusqueda));

      const matchTema = !filtroTema || c.temaId === filtroTema;
      return matchTexto && matchTema;
    });

    if (filtradas.length === 0) {
      contenedorCanciones.innerHTML = `
        <div class="canciones-vacio">
          <p style="font-size: var(--texto-lg); margin-bottom: var(--espacio-s);">No se encontraron canciones</p>
          <p style="margin: 0; font-size: var(--texto-s);">Intenta ajustar tus filtros de búsqueda o seleccionar otro tema.</p>
        </div>
      `;
      return;
    }

    const mapaTemas = new Map(temas.map(t => [t.id, t.titulo]));

    contenedorCanciones.innerHTML = `
      <div class="canciones-grid">
        ${filtradas.map(cancion => {
          const nombreTema = cancion.temaId ? mapaTemas.get(cancion.temaId) : null;
          const tieneKaraoke = Boolean(cancion.lrc && cancion.lrc.trim());

          return `
            <article class="tarjeta-cancion" data-id="${escapar(cancion.id)}">
              <div class="tarjeta-cancion__arriba">
                <div class="tarjeta-cancion__icono" aria-hidden="true">🎼</div>
                <div class="tarjeta-cancion__meta">
                  <h2 class="tarjeta-cancion__titulo">
                    <a href="/paginas/cancion.html?id=${escapar(cancion.id)}">${escapar(cancion.titulo)}</a>
                  </h2>
                  <div class="tarjeta-cancion__autoria">Por: ${escapar(cancion.autoria || 'Autor desconocido')}</div>
                </div>
              </div>

              ${nombreTema ? `
                <div>
                  <span class="tarjeta-cancion__tema">
                    <span>📖</span>
                    <span>${escapar(nombreTema)}</span>
                  </span>
                </div>
              ` : ''}

              <!-- Reproductor simple en tarjeta -->
              <audio controls preload="none" class="tarjeta-cancion__audio" src="${escapar(cancion.audio)}">
                Tu navegador no soporta el elemento de audio.
              </audio>

              <div class="tarjeta-cancion__acciones">
                <a href="/paginas/cancion.html?id=${escapar(cancion.id)}" class="btn btn--primario btn--pequeno" style="flex: 1;">
                  ${tieneKaraoke ? '🎤 Cantar (Karaoke)' : '▶ Ver detalles y letra'}
                </a>

                ${esDocenteOAdmin ? `
                  <a href="/paginas/editor-cancion.html?id=${escapar(cancion.id)}" class="btn btn--secundario btn--pequeno" title="Editar canción" aria-label="Editar ${escapar(cancion.titulo)}">
                    ✏️
                  </a>
                  <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar-cancion" data-id="${escapar(cancion.id)}" data-titulo="${escapar(cancion.titulo)}" title="Eliminar canción" aria-label="Eliminar ${escapar(cancion.titulo)}">
                    🗑️
                  </button>
                ` : ''}
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;

    if (esDocenteOAdmin) {
      contenedorCanciones.querySelectorAll('.btn-eliminar-cancion').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.dataset.id;
          const titulo = e.currentTarget.dataset.titulo;
          const seguro = await confirmar(`¿Estás seguro de que deseas eliminar la canción "${titulo}"?`);
          if (!seguro) return;

          try {
            await api.eliminar('canciones', id);
            canciones = canciones.filter(c => c.id !== id);
            aviso('Canción eliminada correctamente', 'exito');
            renderizar();
          } catch (err) {
            aviso(err.message || 'Error al eliminar la canción', 'error');
          }
        });
      });
    }
  }

  // Carga de datos iniciales
  try {
    const [listaCanciones, listaTemas] = await Promise.all([
      api.listar('canciones'),
      api.listar('temas').catch(() => [])
    ]);

    canciones = listaCanciones || [];
    temas = listaTemas || [];

    // Poblar selector de temas
    temas.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.titulo;
      selectTema.appendChild(opt);
    });

    renderizar();
  } catch (error) {
    contenedorCanciones.innerHTML = `
      <div class="canciones-vacio" style="color: var(--color-error);">
        <p>Ocurrió un error al cargar las canciones: ${escapar(error.message || 'Error de conexión')}</p>
      </div>
    `;
  }

  // Eventos de filtrado
  inputBuscar.addEventListener('input', (e) => {
    filtroBusqueda = e.target.value.trim().toLowerCase();
    renderizar();
  });

  selectTema.addEventListener('change', (e) => {
    filtroTema = e.target.value;
    renderizar();
  });
}
