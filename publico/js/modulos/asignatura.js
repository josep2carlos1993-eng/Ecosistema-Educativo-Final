// publico/js/modulos/asignatura.js · Vista detallada de una asignatura con unidades, temas y tutor socrático
import { montarPlantilla } from '../nucleo/plantilla.js';
import api from '../nucleo/api.js';
import { parametro } from '../nucleo/util.js';
import { escapar, aviso } from '../nucleo/ui.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Contenidos de la Asignatura', roles: ['estudiante', 'docente', 'admin'] });

const asignaturaId = parametro('id');
if (!asignaturaId) {
  aviso('No se especificó ninguna asignatura.', 'error');
  window.location.href = '/paginas/asignaturas.html';
}

const contenido = document.getElementById('contenido');
if (contenido && asignaturaId) {
  contenido.innerHTML = `
    <div class="pila pila--amplia">
      <nav class="migas" aria-label="Ruta de navegación">
        <a href="/paginas/asignaturas.html">Mis asignaturas</a>
        <span class="migas__separador">/</span>
        <span class="migas__actual" id="miga-asignatura">Cargando...</span>
      </nav>

      <div id="cuerpo-asignatura">
        <p style="color: var(--color-texto-suave);">Cargando contenidos de la asignatura...</p>
      </div>
    </div>
  `;

  async function cargarDetalles() {
    const cuerpo = document.getElementById('cuerpo-asignatura');
    try {
      const [asignatura, unidades, temas, progreso] = await Promise.all([
        api.obtener('asignaturas', asignaturaId),
        api.listar('unidades', { asignaturaId }),
        api.listar('temas'),
        api.listar('progreso-temas')
      ]);

      if (!asignatura) {
        cuerpo.innerHTML = `
          <div class="tarjeta" style="color: var(--color-error); text-align: center; padding: var(--espacio-xl);">
            No se encontró la asignatura solicitada.
          </div>
        `;
        return;
      }

      document.getElementById('miga-asignatura').textContent = asignatura.nombre;

      // Filtrar unidades visibles y ordenar
      const unidadesVisibles = (unidades || [])
        .filter(u => u && u.visible !== false)
        .sort((a, b) => (a.orden || 0) - (b.orden || 0));

      const unidadesIds = new Set(unidadesVisibles.map(u => u.id));

      // Filtrar temas publicados de las unidades visibles
      const temasPublicados = (temas || [])
        .filter(t => t && unidadesIds.has(t.unidadId) && t.estado === 'publicado')
        .sort((a, b) => (a.orden || 0) - (b.orden || 0));

      const revisadosIds = new Set((progreso || []).map(p => p.temaId));
      const totalTemas = temasPublicados.length;
      const totalRevisados = temasPublicados.filter(t => revisadosIds.has(t.id)).length;
      const porcentaje = totalTemas > 0 ? Math.round((totalRevisados / totalTemas) * 100) : 0;

      // Agrupar temas por unidad
      const temasPorUnidad = new Map();
      unidadesVisibles.forEach(u => temasPorUnidad.set(u.id, []));
      temasPublicados.forEach(t => {
        if (temasPorUnidad.has(t.unidadId)) {
          temasPorUnidad.get(t.unidadId).push(t);
        }
      });

      const usuario = usuarioActual();
      const puedeEditar = usuario && (usuario.rol === 'docente' || usuario.rol === 'admin');

      // Generar preguntas sugeridas iniciales para el tutor según los temas
      const chipsSugeridos = [];
      if (temasPublicados.length > 0) {
        chipsSugeridos.push(`¿Por qué es importante estudiar "${temasPublicados[0].titulo}"?`);
      }
      if (temasPublicados.length > 1) {
        chipsSugeridos.push(`Explícame con una analogía "${temasPublicados[1].titulo}"`);
      }
      chipsSugeridos.push(`Hazme una pregunta guiada para comprobar lo que he aprendido`);

      let htmlUnidades = '';
      if (unidadesVisibles.length === 0) {
        htmlUnidades = `
          <div class="vacio">
            <span class="vacio__icono">📖</span>
            <h2 class="vacio__titulo">No hay unidades disponibles</h2>
            <p class="vacio__texto">Esta asignatura aún no tiene unidades formativas visibles publicadas.</p>
          </div>
        `;
      } else {
        htmlUnidades = unidadesVisibles.map((u, uIdx) => {
          const listaTemas = temasPorUnidad.get(u.id) || [];
          return `
            <section class="unidad-bloque">
              <header class="unidad-bloque__encabezado">
                <div>
                  <span style="font-size: var(--texto-xs); color: var(--color-texto-suave); text-transform: uppercase; font-weight: var(--peso-seminegrita);">
                    Unidad ${uIdx + 1}
                  </span>
                  <h2 style="font-size: var(--texto-l); color: var(--color-primario); margin: var(--espacio-xs) 0 0 0;">
                    ${escapar(u.titulo)}
                  </h2>
                </div>
                <span class="insignia insignia--secundario">
                  ${listaTemas.length} ${listaTemas.length === 1 ? 'tema' : 'temas'}
                </span>
              </header>

              <div class="lista-temas-unidad">
                ${listaTemas.length === 0 ? `
                  <p style="font-size: var(--texto-s); color: var(--color-texto-suave); margin: 0; padding: var(--espacio-m) 0;">
                    No hay temas publicados en esta unidad.
                  </p>
                ` : listaTemas.map((tema, tIdx) => {
            const revisado = revisadosIds.has(tema.id);
            return `
                    <div class="item-tema" style="display: flex; justify-content: space-between; align-items: center;">
                      <a href="/paginas/tema.html?id=${escapar(tema.id)}" class="item-tema__izq" style="text-decoration: none; display: flex; align-items: center; gap: var(--espacio-s); flex: 1;" title="Abrir tema: ${escapar(tema.titulo)}">
                        <span class="item-tema__numero">${tIdx + 1}</span>
                        <h3 class="item-tema__titulo">${escapar(tema.titulo)}</h3>
                      </a>
                      <div class="item-tema__der" style="display: flex; align-items: center; gap: var(--espacio-s);">
                        ${revisado ? `
                          <span class="insignia insignia--exito">Revisado ✓</span>
                        ` : `
                          <span class="insignia insignia--advertencia">Pendiente</span>
                        `}
                        ${puedeEditar ? `
                          <a href="/paginas/editor-tema.html?id=${escapar(tema.id)}" class="btn btn--secundario btn--pequeno" title="Editar ficha pedagógica del tema">
                            ✏️ Editar ficha
                          </a>
                        ` : ''}
                        <a href="/paginas/tema.html?id=${escapar(tema.id)}" style="color: var(--color-primario); font-weight: var(--peso-negrita); font-size: var(--texto-m); text-decoration: none;">→</a>
                      </div>
                    </div>
                  `;
          }).join('')}
              </div>
            </section>
          `;
        }).join('');
      }

      cuerpo.innerHTML = `
        <div class="pila pila--amplia">
          <!-- Cabecera de la asignatura -->
          <header class="cabecera-asignatura-detalle pila pila--media">
            <div class="fila" style="justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--espacio-s);">
              <div>
                ${asignatura.nivel ? `<span class="tarjeta-asignatura__nivel">${escapar(asignatura.nivel)}</span>` : ''}
                <h1 style="font-size: var(--texto-2xl); color: var(--color-primario); margin: var(--espacio-xs) 0 0 0;">
                  ${escapar(asignatura.nombre)}
                </h1>
              </div>
              <div class="fila" style="gap: var(--espacio-s); align-items: center;">
                <span class="insignia insignia--primario" style="font-size: var(--texto-s);">
                  ${unidadesVisibles.length} ${unidadesVisibles.length === 1 ? 'unidad' : 'unidades'}
                </span>
                ${puedeEditar ? `
                  <a href="/paginas/editor-contenidos.html" class="btn btn--primario btn--pequeno">
                    ✏️ Gestionar Unidades y Temas
                  </a>
                ` : ''}
              </div>
            </div>

            <p style="font-size: var(--texto-m); color: var(--color-texto); line-height: var(--interlineado-base); margin: 0;">
              ${escapar(asignatura.descripcion || 'Sin descripción disponible.')}
            </p>

            <div class="tarjeta-asignatura__progreso-caja" style="margin-top: var(--espacio-s);">
              <div class="tarjeta-asignatura__progreso-texto">
                <span>Tu avance en la asignatura</span>
                <span class="tarjeta-asignatura__progreso-porcentaje">${porcentaje}%</span>
              </div>
              <div class="barra-progreso" role="progressbar" aria-valuenow="${porcentaje}" aria-valuemin="0" aria-valuemax="100" aria-label="Avance en ${escapar(asignatura.nombre)}">
                <div class="barra-progreso__relleno ${porcentaje === 100 ? 'barra-progreso__relleno--completado' : ''}" style="width: ${porcentaje}%;"></div>
              </div>
              <span style="font-size: var(--texto-xs); color: var(--color-texto-suave); text-align: right;">
                ${totalRevisados} de ${totalTemas} ${totalTemas === 1 ? 'tema revisado' : 'temas revisados'}
              </span>
            </div>
          </header>

          <!-- Tutor Virtual Socrático de la Asignatura -->
          <section class="tutor-panel" id="panel-tutor" aria-label="Tutor Socrático de ${escapar(asignatura.nombre)}">
            <div class="tutor-cabecera">
              <div class="tutor-info-perfil">
                <div class="tutor-avatar" aria-hidden="true">🤖</div>
                <div class="tutor-titulos">
                  <h2 class="tutor-nombre">Tutor Socrático de ${escapar(asignatura.nombre)}</h2>
                  <span class="tutor-subtitulo">
                    🟢 En línea · Preguntas y orientación reflexiva sobre los temas de la asignatura
                  </span>
                </div>
              </div>
              <div>
                <button type="button" class="btn btn--texto btn--pequeno" id="btn-toggle-tutor" title="Ocultar o desplegar chat">
                  🔽 Minimizar chat
                </button>
              </div>
            </div>

            <div class="tutor-cuerpo" id="tutor-cuerpo-chat">
              <div class="tutor-chat-area" id="tutor-chat-mensajes" role="log" aria-live="polite">
                <!-- Mensaje de bienvenida inicial -->
                <div class="tutor-burbuja tutor-burbuja--tutor">
                  <p style="margin: 0 0 var(--espacio-xs) 0;">
                    ¡Hola! Soy tu <strong>tutor socrático</strong> de <em>${escapar(asignatura.nombre)}</em>.
                  </p>
                  <p style="margin: 0;">
                    No te daré respuestas directas para memorizar, sino que te ayudaré a reflexionar, deducir y comprender a fondo los temas de esta asignatura mediante preguntas guía. ¿Qué concepto o duda te gustaría analizar hoy?
                  </p>
                </div>
              </div>

              <!-- Chips de sugerencias rápidas -->
              <div class="tutor-chips-rapidos" id="tutor-chips-contenedor">
                ${chipsSugeridos.map(sug => `
                  <button type="button" class="tutor-chip" data-pregunta="${escapar(sug)}">
                    💬 ${escapar(sug)}
                  </button>
                `).join('')}
              </div>

              <!-- Formulario de interacción con el tutor -->
              <form class="tutor-form" id="form-tutor-chat">
                <input
                  type="text"
                  id="input-tutor-mensaje"
                  class="tutor-input"
                  placeholder="Escribe tu pregunta o razonamiento sobre esta asignatura..."
                  aria-label="Pregunta para el tutor socrático"
                  maxlength="500"
                  required
                >
                <button type="submit" class="btn btn--primario" id="btn-enviar-tutor">
                  Preguntar 🚀
                </button>
              </form>
            </div>
          </section>

          <!-- Listado de unidades y temas -->
          <div class="pila pila--amplia">
            ${htmlUnidades}
          </div>
        </div>
      `;

      // Inicializar eventos y lógica del tutor socrático
      inicializarTutorChat(asignatura);

    } catch (err) {
      cuerpo.innerHTML = `
        <div class="tarjeta" style="color: var(--color-error); text-align: center; padding: var(--espacio-xl);">
          ${escapar(err.message || 'Error al cargar los contenidos de la asignatura.')}
        </div>
      `;
    }
  }

  function inicializarTutorChat(asignatura) {
    const btnToggle = document.getElementById('btn-toggle-tutor');
    const cuerpoChat = document.getElementById('tutor-cuerpo-chat');
    const formChat = document.getElementById('form-tutor-chat');
    const inputMensaje = document.getElementById('input-tutor-mensaje');
    const btnEnviar = document.getElementById('btn-enviar-tutor');
    const chatMensajes = document.getElementById('tutor-chat-mensajes');
    const chipsContenedor = document.getElementById('tutor-chips-contenedor');

    const historial = [];
    let enviando = false;

    // Toggle colapsar/expandir
    const claveStorage = `tutor-colapsado-${asignatura.id}`;
    if (localStorage.getItem(claveStorage) === 'true') {
      cuerpoChat.classList.add('tutor-cuerpo--colapsado');
      btnToggle.textContent = '🔼 Abrir chat del tutor';
    }

    btnToggle?.addEventListener('click', () => {
      const estaColapsado = cuerpoChat.classList.toggle('tutor-cuerpo--colapsado');
      btnToggle.textContent = estaColapsado ? '🔼 Abrir chat del tutor' : '🔽 Minimizar chat';
      localStorage.setItem(claveStorage, String(estaColapsado));
    });

    // Enviar pregunta desde un chip
    chipsContenedor?.addEventListener('click', (e) => {
      const chip = e.target.closest('.tutor-chip');
      if (chip && !enviando) {
        const texto = chip.getAttribute('data-pregunta') || chip.textContent.replace('💬', '').trim();
        enviarMensajeTutor(texto);
      }
    });

    // Enviar formulario
    formChat?.addEventListener('submit', (e) => {
      e.preventDefault();
      const texto = inputMensaje.value.trim();
      if (texto && !enviando) {
        enviarMensajeTutor(texto);
      }
    });

    async function enviarMensajeTutor(texto) {
      if (!texto || enviando) return;
      enviando = true;
      inputMensaje.disabled = true;
      btnEnviar.disabled = true;

      // 1. Agregar burbuja del estudiante
      const burbujaUsuario = document.createElement('div');
      burbujaUsuario.className = 'tutor-burbuja tutor-burbuja--usuario';
      burbujaUsuario.textContent = texto;
      chatMensajes.appendChild(burbujaUsuario);

      // Guardar en historial local
      historial.push({ rol: 'estudiante', texto });

      // Limpiar input
      inputMensaje.value = '';

      // 2. Indicador pensando
      const pensando = document.createElement('div');
      pensando.className = 'tutor-pensando';
      pensando.innerHTML = '🤖 <span>El tutor está analizando tu consulta...</span>';
      chatMensajes.appendChild(pensando);
      chatMensajes.scrollTop = chatMensajes.scrollHeight;

      try {
        const respuestaIA = await api.llamar('POST', '/api/ia/tutor', {
          asignaturaId: asignatura.id,
          mensaje: texto,
          historial
        });

        // Eliminar indicador pensando
        pensando.remove();

        const textoResp = respuestaIA?.respuesta || 'He recibido tu consulta. Reflexionemos juntos.';
        const sugerencia = respuestaIA?.sugerencia || '';

        // 3. Agregar burbuja del tutor
        const burbujaTutor = document.createElement('div');
        burbujaTutor.className = 'tutor-burbuja tutor-burbuja--tutor';
        burbujaTutor.innerHTML = `
          <p style="margin: 0;">${escapar(textoResp)}</p>
          ${sugerencia ? `
            <div class="tutor-burbuja__sugerencia">
              💡 <span>${escapar(sugerencia)}</span>
            </div>
          ` : ''}
        `;
        chatMensajes.appendChild(burbujaTutor);

        // Guardar respuesta en historial
        historial.push({
          rol: 'tutor',
          texto: sugerencia ? `${textoResp} Pregunta guía: ${sugerencia}` : textoResp
        });

      } catch (err) {
        pensando.remove();
        const burbujaError = document.createElement('div');
        burbujaError.className = 'tutor-burbuja tutor-burbuja--tutor';
        burbujaError.style.borderColor = 'var(--color-error)';
        burbujaError.innerHTML = `
          <p style="margin: 0; color: var(--color-error);">
            ⚠️ ${escapar(err.message || 'No pude procesar tu mensaje en este momento. Inténtalo nuevamente.')}
          </p>
        `;
        chatMensajes.appendChild(burbujaError);
      } finally {
        enviando = false;
        inputMensaje.disabled = false;
        btnEnviar.disabled = false;
        inputMensaje.focus();
        chatMensajes.scrollTop = chatMensajes.scrollHeight;
      }
    }
  }

  await cargarDetalles();
}
