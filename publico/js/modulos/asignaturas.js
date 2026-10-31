// publico/js/modulos/asignaturas.js · Vista de mis asignaturas con barra de avance
import { montarPlantilla } from '../nucleo/plantilla.js';
import api from '../nucleo/api.js';
import { escapar } from '../nucleo/ui.js';
import { usuarioActual } from '../nucleo/sesion.js';

/**
 * Calcula el avance en una asignatura (% de temas publicados revisados).
 * @param {string} asignaturaId - ID de la asignatura.
 * @returns {Promise<{ porcentaje: number, revisados: number, total: number }>}
 */
export async function calcularAvance(asignaturaId) {
  try {
    const [unidades, temas, progreso] = await Promise.all([
      api.listar('unidades', { asignaturaId }),
      api.listar('temas'),
      api.listar('progreso-temas')
    ]);

    const unidadesVisibles = new Set(
      (unidades || []).filter(u => u && u.visible !== false).map(u => u.id)
    );

    const temasPublicados = (temas || []).filter(
      t => t && unidadesVisibles.has(t.unidadId) && t.estado === 'publicado'
    );

    const revisadosIds = new Set((progreso || []).map(p => p.temaId));
    const revisados = temasPublicados.filter(t => revisadosIds.has(t.id)).length;
    const total = temasPublicados.length;
    const porcentaje = total > 0 ? Math.round((revisados / total) * 100) : 0;

    return {
      porcentaje,
      revisados,
      total,
      valueOf() {
        return this.porcentaje;
      },
      toString() {
        return String(this.porcentaje);
      }
    };
  } catch (err) {
    console.error('Error calculando avance:', err);
    return {
      porcentaje: 0,
      revisados: 0,
      total: 0,
      valueOf() {
        return 0;
      },
      toString() {
        return '0';
      }
    };
  }
}

if (typeof window !== 'undefined' && window.location.pathname.endsWith('asignaturas.html')) {
  await montarPlantilla({ titulo: 'Mis Asignaturas', roles: ['estudiante', 'docente', 'admin'] });

  const usuario = usuarioActual();
  const puedeEditar = usuario && (usuario.rol === 'docente' || usuario.rol === 'admin');

  const contenido = document.getElementById('contenido');
  if (contenido) {
    contenido.innerHTML = `
      <section class="pila pila--amplia">
        <header class="cabecera-asignaturas fila" style="justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--espacio-s);">
          <div>
            <h1 style="font-size: var(--texto-2xl); color: var(--color-primario);">Mis Asignaturas</h1>
            <p style="color: var(--color-texto-suave);">Explora los contenidos formativos y continúa con tu aprendizaje.</p>
          </div>
          ${puedeEditar ? `
            <a href="/paginas/editor-contenidos.html" class="btn btn--primario btn--pequeno">
              ✏️ Editor de Contenidos
            </a>
          ` : ''}
        </header>
        <div id="contenedor-asignaturas">
          <p style="color: var(--color-texto-suave);">Cargando asignaturas...</p>
        </div>
      </section>
    `;

    async function cargarAsignaturas() {
      const contenedor = document.getElementById('contenedor-asignaturas');
      try {
        const lista = await api.listar('asignaturas');

        if (!lista || lista.length === 0) {
          contenedor.innerHTML = `
            <div class="vacio">
              <span class="vacio__icono">📚</span>
              <h2 class="vacio__titulo">No tienes asignaturas registradas</h2>
              <p class="vacio__texto">Actualmente no estás matriculado en ninguna asignatura o grupo activo.</p>
            </div>
          `;
          return;
        }

        const tarjetas = await Promise.all(
          lista.map(async asig => {
            const avance = await calcularAvance(asig.id);
            const pct = avance.porcentaje;
            return `
              <article class="tarjeta tarjeta--interactiva tarjeta-asignatura">
                <div class="tarjeta-asignatura__cuerpo">
                  ${asig.nivel ? `<span class="tarjeta-asignatura__nivel">${escapar(asig.nivel)}</span>` : ''}
                  <h2 class="tarjeta-asignatura__titulo">${escapar(asig.nombre)}</h2>
                  <p class="tarjeta-asignatura__descripcion">${escapar(asig.descripcion || 'Sin descripción disponible.')}</p>
                </div>

                <div class="pila pila--media">
                  <div class="tarjeta-asignatura__progreso-caja">
                    <div class="tarjeta-asignatura__progreso-texto">
                      <span>Avance curricular</span>
                      <span class="tarjeta-asignatura__progreso-porcentaje">${pct}%</span>
                    </div>
                    <div class="barra-progreso" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Avance en ${escapar(asig.nombre)}">
                      <div class="barra-progreso__relleno ${pct === 100 ? 'barra-progreso__relleno--completado' : ''}" style="width: ${pct}%;"></div>
                    </div>
                    <span style="font-size: var(--texto-xs); color: var(--color-texto-suave); text-align: right;">
                      ${avance.revisados} de ${avance.total} ${avance.total === 1 ? 'tema revisado' : 'temas revisados'}
                    </span>
                  </div>

                  <a href="/paginas/asignatura.html?id=${escapar(asig.id)}" class="btn btn--primario" style="width: 100%;">
                    Ver Temas
                  </a>
                </div>
              </article>
            `;
          })
        );

        contenedor.innerHTML = `
          <div class="grid-asignaturas">
            ${tarjetas.join('')}
          </div>
        `;
      } catch (err) {
        contenedor.innerHTML = `
          <div class="tarjeta" style="color: var(--color-error); text-align: center; padding: var(--espacio-xl);">
            ${escapar(err.message || 'Error al cargar las asignaturas.')}
          </div>
        `;
      }
    }

    await cargarAsignaturas();
  }
}

export default { calcularAvance };
