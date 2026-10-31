// publico/js/modulos/cancion.js · Reproductor con letra sincronizada (Karaoke) y metadatos
import { montarPlantilla } from '../nucleo/plantilla.js';
import api from '../nucleo/api.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { parametro, fechaLarga } from '../nucleo/util.js';
import { escapar } from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Canción Educativa', roles: ['sesion'] });

const usuario = usuarioActual();
const esDocenteOAdmin = usuario && (usuario.rol === 'docente' || usuario.rol === 'admin');

const contenido = document.getElementById('contenido');
const cancionId = parametro('id');

function parsearLRC(lrcTexto) {
  if (!lrcTexto || typeof lrcTexto !== 'string') return [];
  const lineas = lrcTexto.split(/\r?\n/);
  const resultado = [];
  const regex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)/;

  for (let i = 0; i < lineas.length; i++) {
    const coincidencia = lineas[i].match(regex);
    if (coincidencia) {
      const min = parseInt(coincidencia[1], 10);
      const seg = parseInt(coincidencia[2], 10);
      let ms = 0;
      if (coincidencia[3]) {
        const digitos = coincidencia[3];
        ms = digitos.length === 2 ? parseInt(digitos, 10) * 10 : parseInt(digitos.padEnd(3, '0').slice(0, 3), 10);
      }
      const tiempoSegundos = min * 60 + seg + (ms / 1000);
      const texto = coincidencia[4].trim();
      resultado.push({ id: i, tiempo: tiempoSegundos, texto });
    }
  }

  return resultado.sort((a, b) => a.tiempo - b.tiempo);
}

if (!cancionId) {
  if (contenido) {
    contenido.innerHTML = `
      <div class="tarjeta" style="color: var(--color-error); text-align: center; padding: var(--espacio-xl);">
        <p>No se especificó ninguna canción para reproducir.</p>
        <a href="/paginas/canciones.html" class="btn btn--primario">Ir al catálogo de canciones</a>
      </div>
    `;
  }
} else if (contenido) {
  try {
    const cancion = await api.obtener('canciones', cancionId);
    if (!cancion) {
      contenido.innerHTML = `
        <div class="tarjeta" style="color: var(--color-error); text-align: center; padding: var(--espacio-xl);">
          <p>La canción solicitada no existe o fue eliminada.</p>
          <a href="/paginas/canciones.html" class="btn btn--primario">Volver al catálogo</a>
        </div>
      `;
    } else {
      let tema = null;
      if (cancion.temaId) {
        try {
          tema = await api.obtener('temas', cancion.temaId);
        } catch {
          tema = null;
        }
      }

      const lineasLRC = parsearLRC(cancion.lrc);
      const tieneLRC = lineasLRC.length > 0;

      contenido.innerHTML = `
        <div class="pila pila--amplia">
          <!-- Migas de pan -->
          <nav class="migas" aria-label="Ruta de navegación">
            <a href="/paginas/canciones.html">Canciones</a>
            <span class="migas__separador">/</span>
            <span class="migas__actual">${escapar(cancion.titulo)}</span>
          </nav>

          <header style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--espacio-m);">
            <div>
              <h1 style="font-size: var(--texto-2xl); color: var(--color-primario); margin: 0;">${escapar(cancion.titulo)}</h1>
              <p style="color: var(--color-texto-suave); margin: var(--espacio-2xs) 0 0 0;">
                Composición pedagógica y acompañamiento lírico
              </p>
            </div>
            ${esDocenteOAdmin ? `
              <a href="/paginas/editor-cancion.html?id=${escapar(cancion.id)}" class="btn btn--secundario">
                ✏️ Editar canción
              </a>
            ` : ''}
          </header>

          <div class="cancion-layout">
            <!-- Columna Principal: Reproductor y Letra / Karaoke -->
            <section class="cancion-reproductor-card" aria-label="Reproductor de audio y letra">
              <div class="cancion-disco">
                <div class="cancion-disco__vinilo" id="vinilo-icono" aria-hidden="true">
                  🎵
                </div>
                <div class="cancion-disco__info">
                  <h2 class="cancion-disco__titulo">${escapar(cancion.titulo)}</h2>
                  <div class="cancion-disco__autoria">Por: ${escapar(cancion.autoria)}</div>
                </div>
              </div>

              <!-- Reproductor de audio -->
              <audio id="audio-cancion" controls class="cancion-audio-elemento" src="${escapar(cancion.audio)}">
                Tu navegador no soporta el reproductor de audio.
              </audio>

              <!-- Navegación de pestañas: Karaoke vs Texto plano -->
              <nav class="cancion-pestanas" role="tablist">
                <button type="button" role="tab" id="tab-karaoke" aria-selected="${tieneLRC ? 'true' : 'false'}" class="cancion-pestana ${tieneLRC ? 'cancion-pestana--activa' : ''}" style="${!tieneLRC ? 'display: none;' : ''}">
                  🎤 Letra sincronizada (Karaoke)
                </button>
                <button type="button" role="tab" id="tab-plana" aria-selected="${!tieneLRC ? 'true' : 'false'}" class="cancion-pestana ${!tieneLRC ? 'cancion-pestana--activa' : ''}">
                  📄 Letra completa
                </button>
              </nav>

              <!-- Vista Karaoke -->
              <div id="panel-karaoke" role="tabpanel" class="pila pila--s" style="${!tieneLRC ? 'display: none;' : ''}">
                <div class="cancion-karaoke-caja" id="caja-karaoke" tabindex="0" aria-label="Letra sincronizada interactiva">
                  ${tieneLRC ? lineasLRC.map((item, idx) => `
                    <div class="cancion-karaoke__linea" id="linea-lrc-${idx}" data-tiempo="${item.tiempo}">
                      ${escapar(item.texto || '...')}
                    </div>
                  `).join('') : '<p style="color: var(--color-texto-suave);">No hay sincronización disponible para esta canción.</p>'}
                </div>
                <p class="cancion-karaoke__pista">💡 Haz clic en cualquier verso para saltar la canción directamente a ese momento.</p>
              </div>

              <!-- Vista Letra Plana -->
              <div id="panel-plana" role="tabpanel" style="${tieneLRC ? 'display: none;' : ''}">
                <div class="cancion-letra-plana">${escapar(cancion.letra || 'Letra no registrada.')}</div>
              </div>
            </section>

            <!-- Columna Lateral: Tema y Metadatos -->
            <aside class="cancion-lateral">
              ${tema ? `
                <div class="cancion-tema-card">
                  <h3 class="cancion-tema-card__titulo">📚 Tema relacionado</h3>
                  <p style="margin: 0 0 var(--espacio-s) 0; font-size: var(--texto-s); color: var(--color-texto-suave);">
                    Esta canción refuerza los conceptos del siguiente tema curricular:
                  </p>
                  <p style="font-weight: var(--peso-negrita); margin-bottom: var(--espacio-m);">
                    ${escapar(tema.titulo)}
                  </p>
                  <a href="/paginas/tema.html?id=${escapar(tema.id)}" class="btn btn--primario btn--pequeno" style="width: 100%;">
                    Ir al tema de estudio ↗
                  </a>
                </div>
              ` : ''}

              <div class="cancion-tema-card">
                <h3 class="cancion-tema-card__titulo">ℹ️ Información y Licencia</h3>
                <ul class="cancion-metadatos-lista">
                  <li>
                    <strong>Autoría / Intérprete:</strong>
                    <span>${escapar(cancion.autoria)}</span>
                  </li>
                  <li>
                    <strong>Licencia de uso:</strong>
                    <span>${escapar(cancion.licencia)}</span>
                  </li>
                  <li>
                    <strong>Fecha de registro:</strong>
                    <span>${cancion.fecha ? fechaLarga(cancion.fecha) : 'No disponible'}</span>
                  </li>
                  <li>
                    <strong>Formato:</strong>
                    <span>Audio con ${tieneLRC ? 'sincronización LRC' : 'letra estándar'}</span>
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        </div>
      `;

      // Interactividad del reproductor
      const audio = document.getElementById('audio-cancion');
      const vinilo = document.getElementById('vinilo-icono');
      const cajaKaraoke = document.getElementById('caja-karaoke');
      const tabKaraoke = document.getElementById('tab-karaoke');
      const tabPlana = document.getElementById('tab-plana');
      const panelKaraoke = document.getElementById('panel-karaoke');
      const panelPlana = document.getElementById('panel-plana');

      if (audio && vinilo) {
        audio.addEventListener('play', () => vinilo.classList.add('girando'));
        audio.addEventListener('pause', () => vinilo.classList.remove('girando'));
        audio.addEventListener('ended', () => vinilo.classList.remove('girando'));
      }

      // Manejo de pestañas
      if (tabKaraoke && tabPlana && panelKaraoke && panelPlana) {
        tabKaraoke.addEventListener('click', () => {
          tabKaraoke.classList.add('cancion-pestana--activa');
          tabKaraoke.setAttribute('aria-selected', 'true');
          tabPlana.classList.remove('cancion-pestana--activa');
          tabPlana.setAttribute('aria-selected', 'false');
          panelKaraoke.style.display = 'block';
          panelPlana.style.display = 'none';
        });

        tabPlana.addEventListener('click', () => {
          tabPlana.classList.add('cancion-pestana--activa');
          tabPlana.setAttribute('aria-selected', 'true');
          tabKaraoke.classList.remove('cancion-pestana--activa');
          tabKaraoke.setAttribute('aria-selected', 'false');
          panelPlana.style.display = 'block';
          panelKaraoke.style.display = 'none';
        });
      }

      // Sincronización de Karaoke
      if (tieneLRC && audio && cajaKaraoke) {
        let indiceActivo = -1;

        audio.addEventListener('timeupdate', () => {
          const tActual = audio.currentTime;
          let nuevoIndice = -1;

          for (let i = 0; i < lineasLRC.length; i++) {
            if (lineasLRC[i].tiempo <= tActual) {
              nuevoIndice = i;
            } else {
              break;
            }
          }

          if (nuevoIndice !== indiceActivo) {
            if (indiceActivo >= 0) {
              const elPrevio = document.getElementById(`linea-lrc-${indiceActivo}`);
              if (elPrevio) elPrevio.classList.remove('cancion-karaoke__linea--activa');
            }

            indiceActivo = nuevoIndice;

            if (indiceActivo >= 0) {
              const elNuevo = document.getElementById(`linea-lrc-${indiceActivo}`);
              if (elNuevo) {
                elNuevo.classList.add('cancion-karaoke__linea--activa');
                // Desplazamiento suave dentro de la caja de karaoke
                const contenedorTop = cajaKaraoke.offsetTop;
                const elementoTop = elNuevo.offsetTop;
                cajaKaraoke.scrollTop = elementoTop - contenedorTop - (cajaKaraoke.clientHeight / 2) + (elNuevo.clientHeight / 2);
              }
            }
          }
        });

        // Clic en un verso para saltar en la reproducción
        cajaKaraoke.querySelectorAll('.cancion-karaoke__linea').forEach(lineaEl => {
          lineaEl.addEventListener('click', () => {
            const tiempo = parseFloat(lineaEl.dataset.tiempo);
            if (!isNaN(tiempo)) {
              audio.currentTime = tiempo;
              audio.play().catch(() => {});
            }
          });
        });
      }
    }
  } catch (err) {
    contenido.innerHTML = `
      <div class="tarjeta" style="color: var(--color-error); text-align: center; padding: var(--espacio-xl);">
        <p>Ocurrió un error al cargar la canción: ${escapar(err.message || 'Error de conexión')}</p>
        <a href="/paginas/canciones.html" class="btn btn--secundario">Regresar al catálogo</a>
      </div>
    `;
  }
}
