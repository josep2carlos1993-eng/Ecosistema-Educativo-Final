// publico/js/nucleo/retroalimentacion.js · Componentes de retroalimentación formativa y resumen pedagógico
import { modal, escapar } from './ui.js';

export function mostrarRetro({ correcto, explicacion = '', sugerencia = '', enlaceTema = '', contenedor = null }) {
  const panel = document.createElement('div');
  const variante = correcto ? 'retro--correcto' : 'retro--incorrecto';
  panel.className = `retro ${variante}`;
  panel.setAttribute('aria-live', 'polite');
  panel.setAttribute('role', 'status');

  const icono = correcto ? '✅' : '💡';
  const tituloTexto = correcto ? '¡Respuesta correcta!' : 'Oportunidad de aprendizaje';

  panel.innerHTML = `
    <div class="retro__cabecera">
      <span class="retro__icono" aria-hidden="true">${icono}</span>
      <strong class="retro__titulo">${escapar(tituloTexto)}</strong>
    </div>
    ${explicacion ? `<p class="retro__explicacion">${escapar(explicacion)}</p>` : ''}
    ${sugerencia ? `
      <div class="retro__sugerencia">
        <strong>Sugerencia didáctica:</strong> ${escapar(sugerencia)}
      </div>
    ` : ''}
    ${enlaceTema ? `
      <div class="retro__enlace">
        <a href="${escapar(enlaceTema)}" class="btn btn--texto btn--pequeno" target="_blank" rel="noopener noreferrer">
          📖 Repasar el tema
        </a>
      </div>
    ` : ''}
  `;

  if (contenedor && contenedor instanceof HTMLElement) {
    contenedor.innerHTML = '';
    contenedor.appendChild(panel);
    return Promise.resolve(panel);
  }

  return modal({
    titulo: tituloTexto,
    contenido: panel,
    acciones: [
      { texto: 'Continuar', valor: true, clase: correcto ? 'btn btn--primario' : 'btn btn--secundario' }
    ]
  });
}

export function mostrarResumen({ titulo = 'Resumen de la Actividad', aciertos = 0, errores = 0, recomendaciones = [], enlaceTema = '' }) {
  const total = aciertos + errores;
  const porcentaje = total > 0 ? Math.round((aciertos / total) * 100) : 0;
  const aprobado = porcentaje >= 70;

  const listaRecomendaciones = Array.isArray(recomendaciones)
    ? recomendaciones
    : (recomendaciones ? [recomendaciones] : []);

  const cuerpo = document.createElement('div');
  cuerpo.className = 'pila pila--media';

  cuerpo.innerHTML = `
    <div style="text-align: center; padding: var(--espacio-s);">
      <div style="font-size: var(--texto-3xl); margin-bottom: var(--espacio-xs);">
        ${aprobado ? '🌟' : '📚'}
      </div>
      <h3 style="color: var(--color-primario); margin: 0 0 var(--espacio-xs) 0;">
        ${aprobado ? '¡Excelente trabajo!' : '¡Buen esfuerzo! Sigue practicando'}
      </h3>
      <p style="color: var(--color-texto-suave); font-size: var(--texto-s); margin: 0 0 var(--espacio-m) 0;">
        ${aprobado ? 'Has demostrado dominio sobre los conceptos evaluados.' : 'Te sugerimos repasar los conceptos clave para reforzar tu aprendizaje.'}
      </p>

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--espacio-s); margin-bottom: var(--espacio-m);">
        <div class="tarjeta" style="padding: var(--espacio-s); text-align: center; background-color: var(--color-fondo);">
          <div style="font-size: var(--texto-xl); font-weight: var(--peso-negrita); color: var(--color-primario);">${total}</div>
          <div style="font-size: var(--texto-xs); color: var(--color-texto-suave);">Total</div>
        </div>
        <div class="tarjeta" style="padding: var(--espacio-s); text-align: center; background-color: var(--color-exito-fondo); border: 1px solid var(--color-exito);">
          <div style="font-size: var(--texto-xl); font-weight: var(--peso-negrita); color: var(--color-exito);">${aciertos}</div>
          <div style="font-size: var(--texto-xs); color: var(--color-exito);">Aciertos</div>
        </div>
        <div class="tarjeta" style="padding: var(--espacio-s); text-align: center; background-color: var(--color-error-fondo); border: 1px solid var(--color-error);">
          <div style="font-size: var(--texto-xl); font-weight: var(--peso-negrita); color: var(--color-error);">${errores}</div>
          <div style="font-size: var(--texto-xs); color: var(--color-error);">Errores</div>
        </div>
      </div>

      <div class="barra-progreso" style="height: 12px; margin-bottom: var(--espacio-s);">
        <div class="barra-progreso__relleno ${aprobado ? 'barra-progreso__relleno--completado' : ''}" style="width: ${porcentaje}%;"></div>
      </div>
      <div style="font-size: var(--texto-s); font-weight: var(--peso-seminegrita); color: var(--color-texto-suave);">
        Precisión formativa: ${porcentaje}%
      </div>
    </div>

    ${listaRecomendaciones.length > 0 ? `
      <div class="tarjeta" style="background-color: var(--color-info-fondo); border-left: 4px solid var(--color-info); padding: var(--espacio-m);">
        <h4 style="margin: 0 0 var(--espacio-xs) 0; color: var(--color-info); font-size: var(--texto-s);">Recomendaciones pedagógicas:</h4>
        <ul style="margin: 0; padding-left: var(--espacio-l); font-size: var(--texto-s); color: var(--color-texto);">
          ${listaRecomendaciones.map(rec => `<li>${escapar(rec)}</li>`).join('')}
        </ul>
      </div>
    ` : ''}

    ${enlaceTema ? `
      <div style="text-align: center; margin-top: var(--espacio-xs);">
        <a href="${escapar(enlaceTema)}" class="btn btn--texto btn--pequeno">
          📖 Repasar el tema
        </a>
      </div>
    ` : ''}
  `;

  return modal({
    titulo,
    contenido: cuerpo,
    acciones: [
      { texto: 'Jugar de nuevo', valor: 'repetir', clase: 'btn btn--secundario' },
      { texto: 'Repasar el tema', valor: 'salir', clase: 'btn btn--primario' }
    ]
  }).then(resultado => {
    return resultado === 'repetir' ? 'repetir' : 'salir';
  });
}

export default {
  mostrarRetro,
  mostrarResumen
};

