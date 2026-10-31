// publico/js/modulos/editor-noticia.js · Editor de noticias para docentes y admin
import { montarPlantilla } from '../nucleo/plantilla.js';
import api from '../nucleo/api.js';
import { parametro, formatoBasico } from '../nucleo/util.js';
import { escapar, aviso } from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Editor de Noticia', roles: ['docente', 'admin'] });

const noticiaId = parametro('id');
const contenido = document.getElementById('contenido');

if (contenido) {
  let noticia = null;
  let temas = [];

  contenido.innerHTML = `
    <div class="pila pila--amplia">
      <header class="editor-cabecera">
        <div class="editor-cabecera__izq">
          <a href="/paginas/noticias.html" class="btn btn--texto btn--pequeno">
            ← Volver a Noticias
          </a>
          <h1 style="font-size: var(--texto-xl); color: var(--color-primario); margin: 0;" id="titulo-pagina">
            ${noticiaId ? 'Editar Noticia' : 'Nueva Noticia'}
          </h1>
        </div>
        <div class="editor-cabecera__acciones">
          <button type="button" id="btn-toggle-previa" class="btn btn--secundario">
            Ver Vista Previa
          </button>
          <button type="button" id="btn-guardar" class="btn btn--primario">
            Guardar Noticia
          </button>
        </div>
      </header>

      <div id="cuerpo-formulario" class="pila pila--media">
        <p style="color: var(--color-texto-suave);">Cargando formulario...</p>
      </div>
    </div>
  `;

  async function inicializar() {
    try {
      const [temasResp, noticiaResp] = await Promise.all([
        api.listar('temas'),
        noticiaId ? api.obtener('noticias', noticiaId) : null
      ]);

      temas = temasResp || [];
      noticia = noticiaResp || {
        titulo: '',
        resumen: '',
        cuerpo: '',
        imagen: '',
        categoria: 'Académica',
        temaId: '',
        destacada: false,
        estado: 'borrador'
      };

      renderizarFormulario();
    } catch (err) {
      document.getElementById('cuerpo-formulario').innerHTML = `
        <div class="tarjeta" style="color: var(--color-error); text-align: center; padding: var(--espacio-xl);">
          ${escapar(err.message || 'Error al cargar los datos de la noticia.')}
        </div>
      `;
    }
  }

  function renderizarFormulario() {
    const cuerpo = document.getElementById('cuerpo-formulario');
    cuerpo.innerHTML = `
      <form id="form-noticia" class="pila pila--media" novalidate>
        <!-- 1. Datos Principales -->
        <section class="tarjeta pila pila--media">
          <div class="campo">
            <label for="campo-titulo">Título de la noticia *</label>
            <input type="text" id="campo-titulo" value="${escapar(noticia.titulo || '')}" placeholder="Ej. Inicio del nuevo período de proyectos formativos" required>
          </div>

          <div class="grid-auto">
            <div class="campo">
              <label for="campo-categoria">Categoría</label>
              <select id="campo-categoria">
                <option value="Institucional" ${noticia.categoria === 'Institucional' ? 'selected' : ''}>Institucional</option>
                <option value="Académica" ${(!noticia.categoria || noticia.categoria === 'Académica') ? 'selected' : ''}>Académica</option>
                <option value="Eventos" ${noticia.categoria === 'Eventos' ? 'selected' : ''}>Eventos</option>
                <option value="Logros" ${noticia.categoria === 'Logros' ? 'selected' : ''}>Logros</option>
              </select>
            </div>

            <div class="campo">
              <label for="campo-tema">Tema relacionado (opcional)</label>
              <select id="campo-tema">
                <option value="">-- Sin tema relacionado (General) --</option>
                ${temas.map(t => `
                  <option value="${escapar(t.id)}" ${noticia.temaId === t.id ? 'selected' : ''}>
                    ${escapar(t.titulo)}
                  </option>
                `).join('')}
              </select>
            </div>
          </div>

          <div class="grid-auto">
            <div class="campo">
              <label for="campo-estado">Estado de publicación</label>
              <select id="campo-estado">
                <option value="borrador" ${noticia.estado === 'borrador' ? 'selected' : ''}>Borrador</option>
                <option value="publicado" ${noticia.estado === 'publicado' ? 'selected' : ''}>Publicado</option>
              </select>
            </div>

            <div class="campo" style="justify-content: flex-end; padding-bottom: var(--espacio-s);">
              <label class="fila" style="gap: var(--espacio-s); cursor: pointer; align-items: center;">
                <input type="checkbox" id="campo-destacada" ${noticia.destacada ? 'checked' : ''}>
                <span style="font-weight: var(--peso-seminegrita);">Marcar como noticia destacada ⭐</span>
              </label>
            </div>
          </div>
        </section>

        <!-- 2. Imagen de portada -->
        <section class="tarjeta pila pila--media">
          <header class="tarjeta__encabezado">
            <h2>Imagen de Portada</h2>
            <p>Sube una imagen ilustrativa o ingresa una URL directa.</p>
          </header>

          <div class="campo">
            <label for="campo-imagen">URL de la imagen</label>
            <div class="fila" style="gap: var(--espacio-s);">
              <input type="text" id="campo-imagen" value="${escapar(noticia.imagen || '')}" placeholder="https://... o sube una imagen" style="flex: 1;">
              <label class="btn btn--secundario" style="cursor: pointer; white-space: nowrap;">
                Subir Imagen
                <input type="file" id="input-subir-imagen" class="sr-only" accept="image/jpeg,image/png,image/webp">
              </label>
            </div>
          </div>

          <div id="contenedor-preview-imagen" class="${noticia.imagen ? '' : 'oculto'}">
            <img id="img-preview" src="${escapar(noticia.imagen || '')}" alt="Vista previa de imagen" style="max-height: 200px; border-radius: var(--radio-s); border: 1px solid var(--color-borde);">
          </div>
        </section>

        <!-- 3. Resumen y Cuerpo -->
        <section class="tarjeta pila pila--media">
          <header class="tarjeta__encabezado">
            <h2>Contenido de la Noticia</h2>
          </header>

          <div class="campo">
            <div class="fila" style="justify-content: space-between; align-items: baseline;">
              <label for="campo-resumen">Resumen breve (hasta 200 caracteres) *</label>
              <span id="contador-resumen" class="contador-caracteres">0 / 200 caracteres</span>
            </div>
            <textarea id="campo-resumen" rows="3" maxlength="200" placeholder="Escribe una breve síntesis de la noticia..." required>${escapar(noticia.resumen || '')}</textarea>
          </div>

          <div class="campo">
            <label for="campo-cuerpo">Cuerpo de la noticia (admite negrita **texto** y listas con - item) *</label>
            <textarea id="campo-cuerpo" rows="10" placeholder="Escribe el desarrollo completo de la noticia..." required>${escapar(noticia.cuerpo || '')}</textarea>
          </div>
        </section>
      </form>

      <!-- Panel de Vista Previa -->
      <section id="panel-vista-previa" class="tarjeta pila pila--media oculto">
        <header class="tarjeta__encabezado">
          <h2>Vista Previa de la Noticia</h2>
        </header>
        <div id="contenedor-render-previa" class="vista-previa-caja pila pila--media"></div>
      </section>
    `;

    // Contador de caracteres para resumen
    const txtResumen = document.getElementById('campo-resumen');
    const contadorResumen = document.getElementById('contador-resumen');

    function actualizarContador() {
      const long = txtResumen.value.length;
      contadorResumen.textContent = `${long} / 200 caracteres`;
      if (long >= 200) {
        contadorResumen.classList.add('limite-alcanzado');
      } else {
        contadorResumen.classList.remove('limite-alcanzado');
      }
    }
    txtResumen.addEventListener('input', actualizarContador);
    actualizarContador();

    // Vista previa de imagen al cambiar URL o al subir
    const inputImagen = document.getElementById('campo-imagen');
    const inputSubir = document.getElementById('input-subir-imagen');
    const contImg = document.getElementById('contenedor-preview-imagen');
    const imgPreview = document.getElementById('img-preview');

    inputImagen.addEventListener('input', () => {
      const url = inputImagen.value.trim();
      if (url) {
        imgPreview.src = url;
        contImg.classList.remove('oculto');
      } else {
        contImg.classList.add('oculto');
      }
    });

    inputSubir.addEventListener('change', async e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        aviso('Subiendo imagen...', 'info');
        const resp = await api.subir(file);
        if (resp && resp.url) {
          inputImagen.value = resp.url;
          imgPreview.src = resp.url;
          contImg.classList.remove('oculto');
          aviso('Imagen subida con éxito.', 'exito');
        }
      } catch (err) {
        aviso(err.message || 'Error al subir la imagen.', 'error');
      }
    });

    // Toggle Vista Previa
    const btnTogglePrevia = document.getElementById('btn-toggle-previa');
    const panelPrevia = document.getElementById('panel-vista-previa');
    const renderPrevia = document.getElementById('contenedor-render-previa');

    btnTogglePrevia.addEventListener('click', () => {
      const oculto = panelPrevia.classList.toggle('oculto');
      if (!oculto) {
        btnTogglePrevia.textContent = 'Ocultar Vista Previa';
        const tit = document.getElementById('campo-titulo').value.trim() || 'Sin título';
        const cat = document.getElementById('campo-categoria').value;
        const dest = document.getElementById('campo-destacada').checked;
        const imgUrl = inputImagen.value.trim();
        const res = txtResumen.value.trim();
        const cue = document.getElementById('campo-cuerpo').value.trim();

        renderPrevia.innerHTML = `
          <div class="fila" style="gap: var(--espacio-s); align-items: center;">
            <span class="insignia insignia--primario">${escapar(cat)}</span>
            ${dest ? '<span class="insignia insignia--advertencia">⭐ Destacada</span>' : ''}
          </div>
          <h2 style="font-size: var(--texto-2xl); color: var(--color-primario); margin: 0;">${escapar(tit)}</h2>
          ${res ? `<p style="font-size: var(--texto-l); color: var(--color-texto-suave); font-style: italic; margin: 0;">${escapar(res)}</p>` : ''}
          ${imgUrl ? `<img src="${escapar(imgUrl)}" alt="${escapar(tit)}" class="vista-previa-imagen">` : ''}
          <div class="vista-previa-cuerpo">
            ${formatoBasico(cue || '<em>Sin contenido</em>')}
          </div>
        `;
        panelPrevia.scrollIntoView({ behavior: 'smooth' });
      } else {
        btnTogglePrevia.textContent = 'Ver Vista Previa';
      }
    });

    // Guardar Noticia
    const btnGuardar = document.getElementById('btn-guardar');
    btnGuardar.addEventListener('click', async () => {
      const titulo = document.getElementById('campo-titulo').value.trim();
      const resumen = txtResumen.value.trim();
      const cuerpoTxt = document.getElementById('campo-cuerpo').value.trim();
      const categoria = document.getElementById('campo-categoria').value;
      const temaSel = document.getElementById('campo-tema').value;
      const destacada = document.getElementById('campo-destacada').checked;
      const estado = document.getElementById('campo-estado').value;
      const imagen = inputImagen.value.trim();

      if (!titulo) {
        aviso('El título de la noticia es obligatorio.', 'error');
        document.getElementById('campo-titulo').focus();
        return;
      }

      if (!resumen) {
        aviso('El resumen es obligatorio.', 'error');
        txtResumen.focus();
        return;
      }

      if (resumen.length > 200) {
        aviso('El resumen no puede superar los 200 caracteres.', 'error');
        txtResumen.focus();
        return;
      }

      if (!cuerpoTxt) {
        aviso('El cuerpo de la noticia es obligatorio.', 'error');
        document.getElementById('campo-cuerpo').focus();
        return;
      }

      const payload = {
        titulo,
        resumen,
        cuerpo: cuerpoTxt,
        imagen: imagen || null,
        categoria,
        temaId: temaSel || null,
        destacada,
        estado
      };

      btnGuardar.disabled = true;
      const txtAnt = btnGuardar.textContent;
      btnGuardar.textContent = 'Guardando...';

      try {
        if (noticiaId) {
          await api.actualizar('noticias', noticiaId, payload);
          aviso('Noticia actualizada con éxito.', 'exito');
        } else {
          await api.crear('noticias', payload);
          aviso('Noticia creada con éxito.', 'exito');
        }
        setTimeout(() => {
          window.location.href = '/paginas/noticias.html';
        }, 600);
      } catch (err) {
        aviso(err.message || 'Error al guardar la noticia', 'error');
        btnGuardar.disabled = false;
        btnGuardar.textContent = txtAnt;
      }
    });
  }

  await inicializar();
}
