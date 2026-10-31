// publico/js/modulos/tema.js · Vista del tema pedagógico y actividades de práctica
import { montarPlantilla } from '../nucleo/plantilla.js';
import api from '../nucleo/api.js';
import { parametro, formatoBasico } from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { escapar, aviso } from '../nucleo/ui.js';
import { ACTIVIDADES } from '../nucleo/catalogo-actividades.js';
import { registrarIntento } from '../nucleo/gamificacion.js';

await montarPlantilla({ titulo: 'Tema de Aprendizaje', roles: ['estudiante', 'docente', 'admin'] });

const temaId = parametro('id');
if (!temaId) {
  aviso('No se especificó ningún tema.', 'error');
  window.location.href = '/paginas/asignaturas.html';
}

const contenido = document.getElementById('contenido');
if (contenido && temaId) {
  contenido.innerHTML = `
    <div class="pila pila--amplia">
      <nav class="migas" aria-label="Ruta de navegación" id="contenedor-migas">
        <a href="/paginas/asignaturas.html">Mis asignaturas</a>
        <span class="migas__separador">/</span>
        <span class="migas__actual">Cargando tema...</span>
      </nav>

      <div id="cuerpo-tema">
        <p style="color: var(--color-texto-suave);">Cargando tema pedagógico...</p>
      </div>
    </div>
  `;

  function generarEmbedVideo(url, titulo) {
    if (!url) return '';
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
      const videoId = ytMatch[1];
      return `
        <div class="recurso-video-marco">
          <iframe 
            src="https://www.youtube-nocookie.com/embed/${escapar(videoId)}" 
            title="${escapar(titulo || 'Vídeo educativo en YouTube')}" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen>
          </iframe>
        </div>
      `;
    }

    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
    if (vimeoMatch) {
      const videoId = vimeoMatch[1];
      return `
        <div class="recurso-video-marco">
          <iframe 
            src="https://player.vimeo.com/video/${escapar(videoId)}" 
            title="${escapar(titulo || 'Vídeo educativo en Vimeo')}" 
            allow="autoplay; fullscreen; picture-in-picture" 
            allowfullscreen>
          </iframe>
        </div>
      `;
    }

    return `
      <a href="${escapar(url)}" target="_blank" rel="noopener noreferrer" class="btn btn--secundario btn--pequeno">
        Ver vídeo externo: ${escapar(titulo || url)} ↗
      </a>
    `;
  }

  async function cargarTema() {
    const cuerpo = document.getElementById('cuerpo-tema');
    const contenedorMigas = document.getElementById('contenedor-migas');

    try {
      const tema = await api.obtener('temas', temaId);
      if (!tema) {
        cuerpo.innerHTML = `
          <div class="tarjeta" style="color: var(--color-error); text-align: center; padding: var(--espacio-xl);">
            No se encontró el tema solicitado.
          </div>
        `;
        return;
      }

      // Guardar en localStorage el último tema consultado
      localStorage.setItem('ultimoTema', JSON.stringify({ id: tema.id, titulo: tema.titulo }));

      // Cargar unidad y asignatura para las migas de pan y progreso
      const [unidad, progreso] = await Promise.all([
        tema.unidadId ? api.obtener('unidades', tema.unidadId) : null,
        api.listar('progreso-temas', { temaId })
      ]);

      const asignatura = (unidad && unidad.asignaturaId)
        ? await api.obtener('asignaturas', unidad.asignaturaId)
        : null;

      // Actualizar migas de pan
      if (asignatura && unidad) {
        contenedorMigas.innerHTML = `
          <a href="/paginas/asignaturas.html">Mis asignaturas</a>
          <span class="migas__separador">/</span>
          <a href="/paginas/asignatura.html?id=${escapar(asignatura.id)}">${escapar(asignatura.nombre)}</a>
          <span class="migas__separador">/</span>
          <span>${escapar(unidad.titulo)}</span>
          <span class="migas__separador">/</span>
          <span class="migas__actual">${escapar(tema.titulo)}</span>
        `;
      } else {
        contenedorMigas.innerHTML = `
          <a href="/paginas/asignaturas.html">Mis asignaturas</a>
          <span class="migas__separador">/</span>
          <span class="migas__actual">${escapar(tema.titulo)}</span>
        `;
      }

      const usuario = usuarioActual();
      let yaRevisado = Array.isArray(progreso) && progreso.some(p => p && p.temaId === tema.id);

      // Renderizar cuerpo del tema
      cuerpo.innerHTML = `
        <article class="pila pila--amplia">
          <!-- Cabecera del tema -->
          <header class="tema-cabecera">
            <div class="tema-cabecera__izq">
              <h1 style="font-size: var(--texto-2xl); color: var(--color-primario); margin: 0;">
                ${escapar(tema.titulo)}
              </h1>
              <div class="tema-cabecera__metas">
                ${tema.dificultad ? `
                  <span class="insignia insignia--secundario">
                    Dificultad ${escapar(tema.dificultad)}
                  </span>
                ` : ''}
                ${(tema.palabrasClave && tema.palabrasClave.length > 0) ? `
                  <span style="font-size: var(--texto-xs); color: var(--color-texto-suave);">
                    🏷️ ${escapar(Array.isArray(tema.palabrasClave) ? tema.palabrasClave.join(', ') : tema.palabrasClave)}
                  </span>
                ` : ''}
              </div>
            </div>

            <div class="tema-cabecera__acciones" id="contenedor-accion-revisado">
              ${yaRevisado ? `
                <span class="insignia insignia--exito" style="font-size: var(--texto-s); padding: var(--espacio-xs) var(--espacio-m);">
                  Revisado ✓
                </span>
              ` : (usuario && usuario.rol === 'estudiante') ? `
                <button type="button" id="btn-marcar-revisado" class="btn btn--primario">
                  Marcar como revisado
                </button>
              ` : (usuario && (usuario.rol === 'docente' || usuario.rol === 'admin')) ? `
                <div class="fila" style="gap: var(--espacio-s);">
                  <a href="/paginas/editor-tema.html?id=${encodeURIComponent(tema.id)}" class="btn btn--primario btn--pequeno">
                    ✏️ Editar este tema
                  </a>
                  <a href="/paginas/editor-contenidos.html" class="btn btn--secundario btn--pequeno">
                    Gestionar contenidos
                  </a>
                </div>
              ` : `
                <span class="insignia insignia--secundario" title="Solo los estudiantes registran avance curricular">
                  Vista docente / admin
                </span>
              `}
            </div>
          </header>

          <!-- Objetivos de aprendizaje -->
          ${(tema.objetivos && tema.objetivos.length > 0) ? `
            <section class="tarjeta pila pila--media">
              <h2 style="font-size: var(--texto-l); color: var(--color-primario); margin: 0;">
                🎯 Objetivos de aprendizaje
              </h2>
              <ul class="lista-objetivos-vista">
                ${tema.objetivos.map(obj => `<li>${escapar(obj)}</li>`).join('')}
              </ul>
            </section>
          ` : ''}

          <!-- Resumen pedagógico -->
          <section class="tarjeta pila pila--media">
            <h2 style="font-size: var(--texto-l); color: var(--color-primario); margin: 0;">
              📖 Resumen del tema
            </h2>
            <div class="tema-resumen-cuerpo">
              ${formatoBasico(tema.resumen || 'Sin resumen registrado.')}
            </div>
            ${tema.fuentes ? `
              <footer style="margin-top: var(--espacio-m); padding-top: var(--espacio-s); border-top: 1px solid var(--color-borde); font-size: var(--texto-xs); color: var(--color-texto-suave);">
                <strong>Fuentes bibliográficas:</strong> ${escapar(tema.fuentes)}
              </footer>
            ` : ''}
          </section>

          <!-- Ejemplos prácticos y Errores comunes -->
          ${((tema.ejemplos && tema.ejemplos.length > 0) || (tema.erroresFrecuentes && tema.erroresFrecuentes.length > 0)) ? `
            <div class="grid-auto">
              ${(tema.ejemplos && tema.ejemplos.length > 0) ? `
                <section class="tarjeta pila pila--media">
                  <h2 style="font-size: var(--texto-m); color: var(--color-primario); margin: 0;">
                    💡 Ejemplos de aplicación
                  </h2>
                  <div class="pila pila--s">
                    ${tema.ejemplos.map(ej => `<div class="ejemplo-item">${escapar(ej)}</div>`).join('')}
                  </div>
                </section>
              ` : ''}

              ${(tema.erroresFrecuentes && tema.erroresFrecuentes.length > 0) ? `
                <section class="tarjeta pila pila--media">
                  <h2 style="font-size: var(--texto-m); color: var(--color-advertencia); margin: 0;">
                    ⚠️ Errores comunes a evitar
                  </h2>
                  <div class="pila pila--s">
                    ${tema.erroresFrecuentes.map(err => `<div class="error-frecuente-item">${escapar(err)}</div>`).join('')}
                  </div>
                </section>
              ` : ''}
            </div>
          ` : ''}

          <!-- Recursos didácticos -->
          ${(tema.recursos && tema.recursos.length > 0) ? `
            <section class="tarjeta pila pila--media">
              <h2 style="font-size: var(--texto-l); color: var(--color-primario); margin: 0;">
                📁 Recursos didácticos complementarios
              </h2>
              <div class="grid-recursos">
                ${tema.recursos.map(rec => {
                  let htmlContenido = '';
                  if (rec.tipo === 'video') {
                    htmlContenido = generarEmbedVideo(rec.url, rec.titulo);
                  } else if (rec.tipo === 'pdf') {
                    htmlContenido = `
                      <a href="${escapar(rec.url)}" target="_blank" rel="noopener noreferrer" class="recurso-enlace-pdf">
                        <span>📄 Abrir documento PDF</span>
                        <span>↗</span>
                      </a>
                    `;
                  } else if (rec.tipo === 'imagen') {
                    htmlContenido = `
                      <img src="${escapar(rec.url)}" alt="${escapar(rec.titulo || 'Imagen didáctica')}" class="recurso-imagen">
                    `;
                  } else {
                    htmlContenido = `
                      <a href="${escapar(rec.url)}" target="_blank" rel="noopener noreferrer" class="btn btn--secundario btn--pequeno">
                        🔗 Visitar enlace externo ↗
                      </a>
                    `;
                  }

                  return `
                    <div class="recurso-item-card">
                      <h3 class="recurso-item-card__titulo">${escapar(rec.titulo || 'Recurso')}</h3>
                      ${htmlContenido}
                    </div>
                  `;
                }).join('')}
              </div>
            </section>
          ` : ''}

          <!-- Practica este tema -->
          <section class="tarjeta pila pila--media">
            <h2 style="font-size: var(--texto-l); color: var(--color-primario); margin: 0;">
              🎮 Practica este tema
            </h2>
            ${(!ACTIVIDADES || ACTIVIDADES.length === 0) ? `
              <div class="vacio" style="padding: var(--espacio-l); margin: 0;">
                <span class="vacio__icono">🧩</span>
                <p class="vacio__texto" style="font-size: var(--texto-m);">
                  Actualmente no hay actividades lúdicas disponibles para este tema. ¡Pronto estarán habilitadas!
                </p>
              </div>
            ` : `
              <div class="grid-actividades">
                ${ACTIVIDADES.map(act => `
                  <a href="${escapar(act.href)}?temaId=${escapar(tema.id)}" class="tarjeta tarjeta--interactiva tarjeta-actividad">
                    <h4>${escapar(act.texto)}</h4>
                    <p>${escapar(act.descripcion || '')}</p>
                    <span class="btn btn--secundario btn--pequeno" style="align-self: flex-start; margin-top: var(--espacio-s);">
                      Jugar ahora →
                    </span>
                  </a>
                `).join('')}
              </div>
            `}
          </section>
        </article>
      `;

      // Evento para marcar como revisado
      const btnMarcar = document.getElementById('btn-marcar-revisado');
      if (btnMarcar) {
        btnMarcar.addEventListener('click', async () => {
          btnMarcar.disabled = true;
          btnMarcar.textContent = 'Guardando...';

          try {
            await api.crear('progreso-temas', { temaId: tema.id });
            await registrarIntento({ actividad: 'tema-revisado', temaId, puntaje: 1, maximo: 1 });
            aviso('¡Tema marcado como revisado!', 'exito');
            const contAccion = document.getElementById('contenedor-accion-revisado');
            if (contAccion) {
              contAccion.innerHTML = `
                <span class="insignia insignia--exito" style="font-size: var(--texto-s); padding: var(--espacio-xs) var(--espacio-m);">
                  Revisado ✓
                </span>
              `;
            }
          } catch (err) {
            aviso(err.message || 'Error al registrar el progreso', 'error');
            btnMarcar.disabled = false;
            btnMarcar.textContent = 'Marcar como revisado';
          }
        });
      }

    } catch (err) {
      cuerpo.innerHTML = `
        <div class="tarjeta" style="color: var(--color-error); text-align: center; padding: var(--espacio-xl);">
          ${escapar(err.message || 'Error al cargar los datos del tema.')}
        </div>
      `;
    }
  }

  await cargarTema();
}
