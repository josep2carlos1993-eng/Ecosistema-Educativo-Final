// publico/js/nucleo/bitacora.js · Registro de eventos en la bitácora
import { llamar } from './api.js';

export async function registrarEvento(tipo, recurso) {
  try {
    return await llamar('POST', '/api/eventos', { tipo, recurso });
  } catch (err) {
    console.warn('Error al registrar evento en bitácora:', err);
  }
}

export default {
  registrarEvento
};
