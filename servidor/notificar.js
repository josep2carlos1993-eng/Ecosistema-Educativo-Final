// servidor/notificar.js · Envío de notificaciones a usuarios
import almacen from './almacen.js';

export async function notificar(usuarioId, { tipo = 'sistema', mensaje = '', enlace = '' } = {}) {
  if (!usuarioId) return null;

  return almacen.agregar('notificaciones', {
    usuarioId,
    tipo,
    mensaje,
    enlace,
    leida: false
  });
}

export default {
  notificar
};

