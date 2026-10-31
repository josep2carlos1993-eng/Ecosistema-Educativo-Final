// publico/js/modulos/actividades.js · Catálogo de actividades interactivas
import { montarPlantilla } from '../nucleo/plantilla.js';
import { ACTIVIDADES } from '../nucleo/catalogo-actividades.js';
import { escapar } from '../nucleo/ui.js';
import { parametro } from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Catálogo de Actividades', roles: ['estudiante', 'docente'] });

const contenido = document.getElementById('contenido');
const temaId = parametro('temaId');

if (contenido) {
  const querySuffix = temaId ? `?temaId=${encodeURIComponent(temaId)}` : '';

  contenido.innerHTML = `
    <div class="pila pila--amplia">
      <header class="actividades-encabezado">
        <h1 class="actividades-encabezado__titulo">Actividades Lúdicas</h1>
        <p class="actividades-encabezado__descripcion">
          Selecciona una actividad pedagógica para practicar y reforzar tus conocimientos de manera interactiva.
        </p>
      </header>

      <section class="grid-catalogo-actividades" aria-label="Lista de actividades interactivas">
        ${ACTIVIDADES.map(act => `
          <article class="tarjeta-actividad-item">
            <div class="tarjeta-actividad-item__cuerpo">
              <h2 class="tarjeta-actividad-item__titulo">${escapar(act.texto)}</h2>
              <p class="tarjeta-actividad-item__descripcion">${escapar(act.descripcion || '')}</p>
            </div>
            <div class="tarjeta-actividad-item__pie">
              <a href="${escapar(act.href)}${querySuffix}" class="btn btn--primario">
                Jugar
              </a>
            </div>
          </article>
        `).join('')}
      </section>
    </div>
  `;
}
