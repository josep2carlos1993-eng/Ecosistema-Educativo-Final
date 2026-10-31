// publico/js/nucleo/gamificacion.js · Gestión de gamificación en el cliente
import api from './api.js';
import { aviso, modal, escapar } from './ui.js';

export async function registrarIntento({ actividad, temaId, nivel = 1, puntaje, maximo, errores = 0, duracionSeg = 0, detalle = {} }) {
  try {
    const resultado = await api.llamar('POST', '/api/intentos', {
      actividad,
      temaId,
      nivel,
      puntaje,
      maximo,
      errores,
      duracionSeg,
      detalle
    });

    await mostrarLogros(resultado);
    return resultado;
  } catch (error) {
    aviso(error.message || 'Error al registrar el intento', 'error');
    throw error;
  }
}

export async function mostrarLogros(resultado) {
  if (!resultado) return;

  const { puntosGanados = 0, puntosTotales, insigniasNuevas = [] } = resultado;

  if (puntosGanados > 0) {
    aviso(`¡Ganaste +${puntosGanados} puntos!`, 'exito');
  }

  if (puntosTotales !== undefined) {
    const elPuntos = document.getElementById('puntos-usuario');
    if (elPuntos) {
      elPuntos.textContent = `${puntosTotales} pts`;
    }
  }

  if (Array.isArray(insigniasNuevas) && insigniasNuevas.length > 0) {
    for (const ins of insigniasNuevas) {
      const contenido = document.createElement('div');
      contenido.className = 'celebracion';
      contenido.innerHTML = `
        <div class="celebracion__icono" aria-hidden="true">${escapar(ins.icono || '🏆')}</div>
        <h3 class="celebracion__nombre">${escapar(ins.nombre || 'Nueva Insignia')}</h3>
        ${ins.descripcion ? `<p class="celebracion__descripcion">${escapar(ins.descripcion)}</p>` : ''}
      `;

      await modal({
        titulo: '¡Insignia Desbloqueada!',
        contenido,
        acciones: [{ texto: '¡Genial!', valor: true, clase: 'btn btn--primario' }]
      });
    }
  }
}

export async function logrosDe(usuarioId = 'yo') {
  return api.llamar('GET', `/api/logros/${encodeURIComponent(usuarioId)}`);
}

export default {
  registrarIntento,
  mostrarLogros,
  logrosDe
};

