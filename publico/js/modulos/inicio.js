// publico/js/modulos/inicio.js · Módulo de la página de inicio del Ecosistema Educativo
import { montarPlantilla } from '../nucleo/plantilla.js';
import { usuarioActual } from '../nucleo/sesion.js';
import api from '../nucleo/api.js';
import { escapar } from '../nucleo/ui.js';
import { fechaRelativa } from '../nucleo/util.js';
import { calcularAvance } from './asignaturas.js';

await montarPlantilla({ titulo: 'Inicio', roles: ['publico'] });

const contenido = document.getElementById('contenido');
if (!contenido) {
  throw new Error('Contenedor #contenido no encontrado');
}

const usuario = usuarioActual();

if (!usuario) {
  renderizarPublico();
} else {
  await renderizarAutenticado();
}

/**
 * 1. Vista para usuarios sin sesión (público general).
 * Presentación breve y botones de acceso directo: Ingresar y Registrarse.
 */
function renderizarPublico() {
  contenido.innerHTML = `
    <div class="pila pila--amplia">
      <section class="inicio-hero">
        <span class="insignia insignia--acento" style="font-size: var(--texto-s);">Ecosistema Educativo Digital</span>
        <h1 class="inicio-hero__titulo">Aprende, Practica y Supera tus Metas</h1>
        <p class="inicio-hero__descripcion">
          Una plataforma integral pensada para tu desarrollo académico: explora contenidos curriculares, 
          pon a prueba tus conocimientos con actividades interactivas y recibe acompañamiento formativo continuo.
        </p>
        <div class="inicio-hero__acciones">
          <a href="/paginas/ingreso.html" class="btn btn--primario">
            Ingresar
          </a>
          <a href="/paginas/registro.html" class="btn btn--secundario">
            Registrarse
          </a>
        </div>
      </section>

      <section class="inicio-caracteristicas" aria-label="Características de la plataforma">
        <article class="inicio-caracteristica">
          <span class="inicio-caracteristica__icono" aria-hidden="true">📚</span>
          <h2 style="font-size: var(--texto-l); color: var(--color-primario); margin: 0;">Contenidos Curriculares</h2>
          <p style="font-size: var(--texto-s); color: var(--color-texto-suave); margin: 0; line-height: var(--interlineado-base);">
            Asignaturas organizadas por unidades pedagógicas con fichas teóricas, recursos didácticos, glosarios y ejemplos aplicados.
          </p>
        </article>

        <article class="inicio-caracteristica">
          <span class="inicio-caracteristica__icono" aria-hidden="true">🎮</span>
          <h2 style="font-size: var(--texto-l); color: var(--color-primario); margin: 0;">Aprendizaje Gamificado</h2>
          <p style="font-size: var(--texto-s); color: var(--color-texto-suave); margin: 0; line-height: var(--interlineado-base);">
            Refuerza tu memoria con flashcards, completa conceptos clave, encuentra parejas y resuelve sopas de letras para sumar puntos.
          </p>
        </article>

        <article class="inicio-caracteristica">
          <span class="inicio-caracteristica__icono" aria-hidden="true">🎵</span>
          <h2 style="font-size: var(--texto-l); color: var(--color-primario); margin: 0;">Canciones y Noticias</h2>
          <p style="font-size: var(--texto-s); color: var(--color-texto-suave); margin: 0; line-height: var(--interlineado-base);">
            Aprende a través de la música con reproductor sincronizado tipo karaoke y mantente informado con comunicados académicos.
          </p>
        </article>
      </section>
    </div>
  `;
}

/**
 * 2. Vista para usuarios con sesión activa (estudiantes, docentes, admin).
 */
async function renderizarAutenticado() {
  const nombreCompleto = [usuario.nombre, usuario.apellido].filter(Boolean).join(' ') || usuario.nombre || 'estudiante';

  contenido.innerHTML = `
    <div class="pila pila--amplia">
      <!-- Saludo personalizado -->
      <section class="inicio-saludo">
        <div class="inicio-saludo__texto">
          <h1>¡Hola, ${escapar(nombreCompleto)}! 👋</h1>
          <p>Bienvenido de nuevo a tu espacio de estudio y progreso curricular.</p>
        </div>
        <div style="display: flex; gap: var(--espacio-s); align-items: center;">
          <span class="insignia insignia--primario" style="text-transform: capitalize;">
            Rol: ${escapar(usuario.rol || 'estudiante')}
          </span>
        </div>
      </section>

      <!-- Accesos rápidos para docentes y admin -->
      <div id="contenedor-accesos-rapidos"></div>

      <!-- Continuar donde te quedaste -->
      <div id="contenedor-continuar"></div>

      <!-- Mis Asignaturas con avance -->
      <section class="pila pila--media">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espacio-s);">
          <h2 style="font-size: var(--texto-xl); color: var(--color-primario); margin: 0;">
            📖 Mis Asignaturas
          </h2>
          <a href="/paginas/asignaturas.html" class="btn btn--texto btn--pequeno">
            Ver todas las asignaturas →
          </a>
        </div>
        <div id="contenedor-asignaturas-inicio">
          <p style="color: var(--color-texto-suave);">Cargando asignaturas y avance...</p>
        </div>
      </section>

      <!-- Últimas Noticias -->
      <section class="pila pila--media">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espacio-s);">
          <h2 style="font-size: var(--texto-xl); color: var(--color-primario); margin: 0;">
            📰 Noticias Académicas
          </h2>
          <a href="/paginas/noticias.html" class="btn btn--texto btn--pequeno">
            Ver todas las noticias →
          </a>
        </div>
        <div id="contenedor-noticias-inicio">
          <p style="color: var(--color-texto-suave);">Cargando noticias recientes...</p>
        </div>
      </section>
    </div>
  `;

  // Cargar componentes en paralelo
  await Promise.all([
    renderizarAccesosRapidos(),
    renderizarContinuarTema(),
    renderizarAsignaturas(),
    renderizarNoticias()
  ]);
}

/**
 * Accesos rápidos a Contenidos y Noticias exclusivos para roles docente y admin
 */
async function renderizarAccesosRapidos() {
  if (usuario.rol !== 'docente' && usuario.rol !== 'admin') return;

  const contenedor = document.getElementById('contenedor-accesos-rapidos');
  if (!contenedor) return;

  contenedor.innerHTML = `
    <section class="pila pila--s">
      <h2 style="font-size: var(--texto-m); color: var(--color-texto-suave); text-transform: uppercase; letter-spacing: 0.05em; margin: 0;">
        ⚙️ Accesos Rápidos
      </h2>
      <div class="grid-accesos-rapidos">
        <a href="/paginas/editor-contenidos.html" class="tarjeta-acceso-rapido">
          <span class="tarjeta-acceso-rapido__icono" aria-hidden="true">📝</span>
          <div class="tarjeta-acceso-rapido__info">
            <h3>Contenidos</h3>
            <p>Crear, organizar y editar asignaturas, unidades, temas y glosarios.</p>
          </div>
        </a>

        <a href="/paginas/noticias.html" class="tarjeta-acceso-rapido">
          <span class="tarjeta-acceso-rapido__icono" aria-hidden="true">📢</span>
          <div class="tarjeta-acceso-rapido__info">
            <h3>Noticias</h3>
            <p>Consultar, redactar y publicar comunicados y noticias del ecosistema.</p>
          </div>
        </a>
      </div>
    </section>
  `;
}

/**
 * Recupera el último tema revisado desde localStorage ('ultimoTema')
 */
async function renderizarContinuarTema() {
  const contenedor = document.getElementById('contenedor-continuar');
  if (!contenedor) return;

  const rawTema = localStorage.getItem('ultimoTema');
  if (!rawTema) return;

  let temaInfo = null;
  try {
    if (typeof rawTema === 'string' && rawTema.trim().startsWith('{')) {
      temaInfo = JSON.parse(rawTema);
    } else {
      temaInfo = { id: rawTema.trim() };
    }
  } catch {
    temaInfo = { id: rawTema };
  }

  if (!temaInfo || !temaInfo.id) return;

  try {
    // Si no tenemos el título completo en localStorage, consultarlo en el servidor
    let tituloTema = temaInfo.titulo;
    if (!tituloTema) {
      const temaCompleto = await api.obtener('temas', temaInfo.id);
      if (temaCompleto && temaCompleto.titulo) {
        tituloTema = temaCompleto.titulo;
      }
    }

    if (tituloTema) {
      contenedor.innerHTML = `
        <div class="continuar-banner">
          <div class="continuar-banner__info">
            <span class="continuar-banner__icono" aria-hidden="true">📌</span>
            <div>
              <div class="continuar-banner__etiqueta">Continuar donde te quedaste</div>
              <h2 class="continuar-banner__titulo">${escapar(tituloTema)}</h2>
            </div>
          </div>
          <a href="/paginas/tema.html?id=${escapar(temaInfo.id)}" class="btn btn--secundario" style="color: var(--color-primario); background-color: var(--color-superficie); border-color: transparent;">
            Continuar estudiando →
          </a>
        </div>
      `;
    }
  } catch {
    // Si el tema fue eliminado o no está disponible, no mostramos el banner
  }
}

/**
 * Carga las asignaturas del usuario y calcula su avance curricular usando calcularAvance
 */
async function renderizarAsignaturas() {
  const contenedor = document.getElementById('contenedor-asignaturas-inicio');
  if (!contenedor) return;

  try {
    const lista = await api.listar('asignaturas');

    if (!lista || lista.length === 0) {
      contenedor.innerHTML = `
        <div class="tarjeta" style="padding: var(--espacio-l); text-align: center; color: var(--color-texto-suave);">
          No tienes asignaturas activas asignadas en este momento.
        </div>
      `;
      return;
    }

    const tarjetas = await Promise.all(
      lista.map(async asig => {
        const avance = await calcularAvance(asig.id);
        const pct = typeof avance === 'object' && avance !== null ? avance.porcentaje : Number(avance) || 0;
        const revisados = avance?.revisados ?? 0;
        const total = avance?.total ?? 0;

        return `
          <article class="tarjeta tarjeta--interactiva tarjeta-asignatura">
            <div class="tarjeta-asignatura__cuerpo">
              ${asig.nivel ? `<span class="tarjeta-asignatura__nivel">${escapar(asig.nivel)}</span>` : ''}
              <h3 class="tarjeta-asignatura__titulo">${escapar(asig.nombre)}</h3>
              <p class="tarjeta-asignatura__descripcion">${escapar(asig.descripcion || '')}</p>
            </div>

            <div class="pila pila--s" style="margin-top: var(--espacio-m);">
              <div class="tarjeta-asignatura__progreso-caja">
                <div class="tarjeta-asignatura__progreso-texto">
                  <span>Progreso</span>
                  <span class="tarjeta-asignatura__progreso-porcentaje">${pct}%</span>
                </div>
                <div class="barra-progreso" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
                  <div class="barra-progreso__relleno ${pct === 100 ? 'barra-progreso__relleno--completado' : ''}" style="width: ${pct}%;"></div>
                </div>
                <span style="font-size: var(--texto-xs); color: var(--color-texto-suave); text-align: right;">
                  ${revisados} de ${total} ${total === 1 ? 'tema completado' : 'temas completados'}
                </span>
              </div>

              <a href="/paginas/asignatura.html?id=${escapar(asig.id)}" class="btn btn--primario btn--pequeno" style="width: 100%;">
                Acceder a la asignatura →
              </a>
            </div>
          </article>
        `;
      })
    );

    contenedor.innerHTML = `
      <div class="grid-asignaturas-inicio">
        ${tarjetas.join('')}
      </div>
    `;
  } catch (err) {
    contenedor.innerHTML = `
      <div class="tarjeta" style="color: var(--color-error); padding: var(--espacio-l); text-align: center;">
        ${escapar(err.message || 'Error al cargar las asignaturas.')}
      </div>
    `;
  }
}

/**
 * Carga las 3 noticias publicadas más recientes, priorizando las destacadas
 */
async function renderizarNoticias() {
  const contenedor = document.getElementById('contenedor-noticias-inicio');
  if (!contenedor) return;

  try {
    const todas = await api.listar('noticias');

    // Filtrar solo noticias publicadas
    const publicadas = (todas || []).filter(n => n && n.estado === 'publicado');

    if (publicadas.length === 0) {
      contenedor.innerHTML = `
        <div class="tarjeta" style="padding: var(--espacio-l); text-align: center; color: var(--color-texto-suave);">
          No hay comunicados ni noticias publicadas recientemente.
        </div>
      `;
      return;
    }

    // Ordenar: destacadas primero; luego por fecha más reciente
    publicadas.sort((a, b) => {
      const destA = Boolean(a.destacada);
      const destB = Boolean(b.destacada);
      if (destA !== destB) {
        return destA ? -1 : 1;
      }
      const fechaA = new Date(a.fechaPublicacion || a.fecha || 0).getTime();
      const fechaB = new Date(b.fechaPublicacion || b.fecha || 0).getTime();
      return fechaB - fechaA;
    });

    const tresNoticias = publicadas.slice(0, 3);

    contenedor.innerHTML = `
      <div class="grid-noticias-inicio">
        ${tresNoticias.map(noticia => {
          const fechaStr = fechaRelativa(noticia.fechaPublicacion || noticia.fecha);
          return `
            <a href="/paginas/noticia.html?id=${escapar(noticia.id)}" class="tarjeta-noticia-inicio">
              ${noticia.imagen ? `
                <img src="${escapar(noticia.imagen)}" alt="${escapar(noticia.titulo)}" class="tarjeta-noticia-inicio__imagen" loading="lazy">
              ` : `
                <div class="tarjeta-noticia-inicio__imagen" style="display: flex; align-items: center; justify-content: center; font-size: var(--texto-2xl); color: var(--color-texto-suave);">
                  📰
                </div>
              `}
              <div class="tarjeta-noticia-inicio__cuerpo">
                <div class="tarjeta-noticia-inicio__meta">
                  <span class="insignia insignia--pequena ${noticia.destacada ? 'insignia--acento' : ''}">
                    ${noticia.destacada ? '⭐ Destacada' : escapar(noticia.categoria || 'General')}
                  </span>
                  <span>${escapar(fechaStr)}</span>
                </div>
                <h3 class="tarjeta-noticia-inicio__titulo">${escapar(noticia.titulo)}</h3>
                <p class="tarjeta-noticia-inicio__resumen">${escapar(noticia.resumen || '')}</p>
              </div>
            </a>
          `;
        }).join('')}
      </div>
    `;
  } catch (err) {
    contenedor.innerHTML = `
      <div class="tarjeta" style="color: var(--color-error); padding: var(--espacio-l); text-align: center;">
        ${escapar(err.message || 'Error al cargar las noticias.')}
      </div>
    `;
  }
}
