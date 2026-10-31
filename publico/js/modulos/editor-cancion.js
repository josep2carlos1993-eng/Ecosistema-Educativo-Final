// publico/js/modulos/editor-cancion.js · Editor y gestor de canciones educativas
import { montarPlantilla } from '../nucleo/plantilla.js';
import api from '../nucleo/api.js';
import { parametro } from '../nucleo/util.js';
import { escapar, aviso, confirmar, cargando } from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Editor de Canción', roles: ['docente', 'admin'] });

const cancionId = parametro('id');
const contenido = document.getElementById('contenido');

function parsearLRC(lrcTexto) {
  if (!lrcTexto || typeof lrcTexto !== 'string') return [];
  const lineas = lrcTexto.split(/\r?\n/);
  const resultado = [];
  const regex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)/;

  for (let i = 0; i < lineas.length; i++) {
    const match = lineas[i].match(regex);
    if (match) {
      const min = match[1];
      const seg = match[2];
      const ms = match[3] || '00';
      const texto = match[4].trim();
      resultado.push({ tiempo: `${min}:${seg}.${ms}`, texto });
    }
  }
  return resultado;
}

if (contenido) {
  let cancion = {
    titulo: '',
    temaId: '',
    audio: '',
    letra: '',
    lrc: '',
    autoria: '',
    licencia: 'Creative Commons Atribución-CompartirIgual 4.0 (CC BY-SA 4.0)'
  };
  let temas = [];

  contenido.innerHTML = `
    <div class="pila pila--amplia">
      <header class="editor-cancion-cabecera">
        <div class="editor-cancion-cabecera__izq">
          <nav class="migas" style="margin-bottom: var(--espacio-2xs);">
            <a href="/paginas/canciones.html">Canciones</a>
            <span class="migas__separador">/</span>
            <span class="migas__actual">${cancionId ? 'Editar Canción' : 'Nueva Canción'}</span>
          </nav>
          <h1 style="font-size: var(--texto-2xl); color: var(--color-primario); margin: 0;">
            ${cancionId ? 'Editar Canción Educativa' : 'Nueva Canción Educativa'}
          </h1>
        </div>
        <div class="editor-cancion-cabecera__acciones">
          <a href="/paginas/canciones.html" class="btn btn--secundario">
            Cancelar
          </a>
          ${cancionId ? `
            <button type="button" id="btn-eliminar" class="btn btn--peligro">
              🗑️ Eliminar
            </button>
          ` : ''}
          <button type="button" id="btn-guardar" class="btn btn--primario">
            💾 Guardar Canción
          </button>
        </div>
      </header>

      <form id="formulario-cancion" class="pila pila--media" novalidate>
        <!-- 1. Información General -->
        <section class="tarjeta pila pila--media">
          <h2 style="font-size: var(--texto-l); color: var(--color-primario); margin: 0;">1. Información Básica</h2>

          <div class="campo">
            <label for="campo-titulo">Título de la canción *</label>
            <input type="text" id="campo-titulo" required placeholder="Ej. El Tren de Alfaro y la Educación Laica">
          </div>

          <div class="editor-grid-dos-cols">
            <div class="campo">
              <label for="campo-tema">Tema de estudio curricular relacionado</label>
              <select id="campo-tema">
                <option value="">-- Sin tema específico / General --</option>
              </select>
            </div>

            <div class="campo">
              <label for="campo-autoria">Autoría / Intérprete pedagógico *</label>
              <input type="text" id="campo-autoria" required placeholder="Ej. Prof. Juan Pérez / Coro Estudiantil">
            </div>
          </div>

          <div class="campo">
            <label for="campo-licencia">Licencia de propiedad o uso *</label>
            <input type="text" id="campo-licencia" required placeholder="Ej. Creative Commons CC BY-SA 4.0 o Dominio Público">
          </div>
        </section>

        <!-- 2. Archivo de Audio -->
        <section class="tarjeta pila pila--media">
          <h2 style="font-size: var(--texto-l); color: var(--color-primario); margin: 0;">2. Archivo de Audio</h2>
          <p style="color: var(--color-texto-suave); font-size: var(--texto-s); margin: 0;">
            Puedes subir un archivo de audio (formato MP3 o WAV) o especificar una URL directa.
          </p>

          <div class="campo">
            <label for="campo-audio">Ruta o URL del archivo de audio *</label>
            <div style="display: flex; gap: var(--espacio-s); flex-wrap: wrap;">
              <input type="text" id="campo-audio" required placeholder="/recursos/audios/... o https://..." style="flex: 1 1 260px;">
              <label class="btn btn--secundario" style="cursor: pointer; white-space: nowrap;">
                📤 Subir archivo MP3
                <input type="file" id="input-archivo-audio" class="sr-only" accept="audio/*,.mp3,.wav">
              </label>
            </div>
          </div>

          <div id="caja-preview-audio" class="editor-audio-preview" style="display: none;">
            <strong>Vista previa del reproductor:</strong>
            <audio id="audio-previa" controls preload="none">
              Tu navegador no soporta el audio.
            </audio>
          </div>
        </section>

        <!-- 3. Letra y Sincronización LRC -->
        <section class="tarjeta pila pila--media">
          <h2 style="font-size: var(--texto-l); color: var(--color-primario); margin: 0;">3. Letras y Sincronización</h2>

          <div class="editor-grid-dos-cols">
            <!-- Letra en texto plano -->
            <div class="campo">
              <label for="campo-letra">Letra en texto plano</label>
              <textarea id="campo-letra" rows="12" placeholder="Escribe aquí los versos completos para lectura tradicional..."></textarea>
            </div>

            <!-- Formato LRC sincronizado -->
            <div class="campo">
              <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: var(--espacio-xs);">
                <label for="campo-lrc">Letra sincronizada (Formato LRC para Karaoke)</label>
                <button type="button" id="btn-probar-lrc" class="btn btn--texto btn--pequeno">
                  🔍 Verificar formato LRC
                </button>
              </div>
              <textarea id="campo-lrc" rows="12" placeholder="[00:02.00] Primer verso&#10;[00:05.50] Segundo verso con ritmo&#10;[00:09.00] Coro principal..."></textarea>
            </div>
          </div>

          <!-- Guía de formato LRC -->
          <div class="editor-formato-guia">
            <strong>💡 Guía rápida de formato LRC:</strong>
            Cada línea debe comenzar con la marca de tiempo entre corchetes <code>[minutos:segundos.centésimas]</code> seguida del texto del verso. Ejemplo: <code>[00:04.50] Vuela el tren de la libertad</code>.
          </div>

          <!-- Contenedor para mostrar resultado de prueba LRC -->
          <div id="caja-preview-lrc" class="editor-lrc-preview" style="display: none;"></div>
        </section>
      </form>
    </div>
  `;

  // Carga de datos
  async function inicializar() {
    cargando(true);
    try {
      const [listaTemas, datosCancion] = await Promise.all([
        api.listar('temas').catch(() => []),
        cancionId ? api.obtener('canciones', cancionId) : null
      ]);

      temas = listaTemas || [];
      if (datosCancion) {
        cancion = { ...cancion, ...datosCancion };
      }

      // Llenar selector de temas
      const selectTema = document.getElementById('campo-tema');
      temas.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.titulo;
        if (cancion.temaId === t.id) opt.selected = true;
        selectTema.appendChild(opt);
      });

      // Llenar formulario
      document.getElementById('campo-titulo').value = cancion.titulo || '';
      document.getElementById('campo-autoria').value = cancion.autoria || '';
      document.getElementById('campo-licencia').value = cancion.licencia || '';
      document.getElementById('campo-audio').value = cancion.audio || '';
      document.getElementById('campo-letra').value = cancion.letra || '';
      document.getElementById('campo-lrc').value = cancion.lrc || '';

      actualizarPreviaAudio(cancion.audio);
    } catch (err) {
      aviso(err.message || 'Error al cargar información', 'error');
    } finally {
      cargando(false);
    }
  }

  // Previa de audio
  const inputAudio = document.getElementById('campo-audio');
  const fileAudio = document.getElementById('input-archivo-audio');
  const cajaAudio = document.getElementById('caja-preview-audio');
  const audioPrevia = document.getElementById('audio-previa');

  function actualizarPreviaAudio(url) {
    if (url && url.trim()) {
      audioPrevia.src = url.trim();
      cajaAudio.style.display = 'block';
    } else {
      audioPrevia.removeAttribute('src');
      cajaAudio.style.display = 'none';
    }
  }

  inputAudio.addEventListener('input', () => {
    actualizarPreviaAudio(inputAudio.value);
  });

  // Subida de archivo de audio
  fileAudio.addEventListener('change', async (e) => {
    const archivo = e.target.files && e.target.files[0];
    if (!archivo) return;

    try {
      aviso('Subiendo archivo de audio...', 'info');
      cargando(true);
      const resp = await api.subir(archivo);
      if (resp && resp.url) {
        inputAudio.value = resp.url;
        actualizarPreviaAudio(resp.url);
        aviso('Audio subido exitosamente', 'exito');
      }
    } catch (err) {
      aviso(err.message || 'Error al subir el archivo de audio', 'error');
    } finally {
      cargando(false);
    }
  });

  // Verificación de LRC
  const btnProbarLRC = document.getElementById('btn-probar-lrc');
  const txtLRC = document.getElementById('campo-lrc');
  const cajaPreviewLRC = document.getElementById('caja-preview-lrc');

  btnProbarLRC.addEventListener('click', () => {
    const parsed = parsearLRC(txtLRC.value);
    if (parsed.length === 0) {
      cajaPreviewLRC.innerHTML = `<p style="color: var(--color-advertencia); margin: 0;">No se detectaron líneas válidas con marcas de tiempo en formato [mm:ss.xx].</p>`;
    } else {
      cajaPreviewLRC.innerHTML = `
        <div style="font-weight: var(--peso-negrita); margin-bottom: var(--espacio-xs); color: var(--color-exito);">
          ✓ Se detectaron ${parsed.length} versos sincronizados:
        </div>
        ${parsed.map(p => `
          <div class="editor-lrc-item">
            <span class="editor-lrc-item__tiempo">[${escapar(p.tiempo)}]</span>
            <span>${escapar(p.texto || '(pausa / instrumental)')}</span>
          </div>
        `).join('')}
      `;
    }
    cajaPreviewLRC.style.display = 'block';
  });

  // Guardar canción
  const btnGuardar = document.getElementById('btn-guardar');
  btnGuardar.addEventListener('click', async () => {
    const titulo = document.getElementById('campo-titulo').value.trim();
    const temaId = document.getElementById('campo-tema').value.trim() || null;
    const autoria = document.getElementById('campo-autoria').value.trim();
    const licencia = document.getElementById('campo-licencia').value.trim();
    const audioUrl = document.getElementById('campo-audio').value.trim();
    const letra = document.getElementById('campo-letra').value.trim();
    const lrc = document.getElementById('campo-lrc').value.trim();

    if (!titulo) {
      aviso('Por favor ingresa el título de la canción', 'error');
      document.getElementById('campo-titulo').focus();
      return;
    }

    if (!autoria) {
      aviso('Por favor ingresa la autoría o intérprete', 'error');
      document.getElementById('campo-autoria').focus();
      return;
    }

    if (!licencia) {
      aviso('Por favor especifica la licencia de uso', 'error');
      document.getElementById('campo-licencia').focus();
      return;
    }

    if (!audioUrl) {
      aviso('Por favor sube o proporciona la URL del audio', 'error');
      document.getElementById('campo-audio').focus();
      return;
    }

    const payload = {
      titulo,
      temaId,
      autoria,
      licencia,
      audio: audioUrl,
      letra,
      lrc
    };

    try {
      cargando(true);
      let guardado;
      if (cancionId) {
        guardado = await api.actualizar('canciones', cancionId, payload);
        aviso('Canción actualizada con éxito', 'exito');
      } else {
        guardado = await api.crear('canciones', payload);
        aviso('Canción creada con éxito', 'exito');
      }

      setTimeout(() => {
        const idFinal = (guardado && guardado.id) || cancionId;
        if (idFinal) {
          window.location.href = `/paginas/cancion.html?id=${idFinal}`;
        } else {
          window.location.href = '/paginas/canciones.html';
        }
      }, 700);
    } catch (err) {
      aviso(err.message || 'Error al guardar la canción', 'error');
    } finally {
      cargando(false);
    }
  });

  // Eliminar canción si es edición
  const btnEliminar = document.getElementById('btn-eliminar');
  if (btnEliminar) {
    btnEliminar.addEventListener('click', async () => {
      const titulo = document.getElementById('campo-titulo').value;
      const seguro = await confirmar(`¿Estás seguro de que deseas eliminar permanentemente la canción "${titulo}"?`);
      if (!seguro) return;

      try {
        cargando(true);
        await api.eliminar('canciones', cancionId);
        aviso('Canción eliminada correctamente', 'exito');
        setTimeout(() => {
          window.location.href = '/paginas/canciones.html';
        }, 700);
      } catch (err) {
        aviso(err.message || 'Error al eliminar la canción', 'error');
      } finally {
        cargando(false);
      }
    });
  }

  inicializar();
}
