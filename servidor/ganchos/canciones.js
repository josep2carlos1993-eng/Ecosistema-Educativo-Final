// servidor/ganchos/canciones.js · Ganchos para la colección canciones
export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];
  return lista;
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    const error = new Error('No autenticado');
    error.estado = 401;
    throw error;
  }

  if (!datos.titulo || typeof datos.titulo !== 'string' || !datos.titulo.trim()) {
    const error = new Error('El título de la canción es obligatorio');
    error.estado = 400;
    throw error;
  }

  if (!datos.audio || typeof datos.audio !== 'string' || !datos.audio.trim()) {
    const error = new Error('El archivo de audio es obligatorio');
    error.estado = 400;
    throw error;
  }

  if (!datos.autoria || typeof datos.autoria !== 'string' || !datos.autoria.trim()) {
    const error = new Error('La autoría es obligatoria');
    error.estado = 400;
    throw error;
  }

  if (!datos.licencia || typeof datos.licencia !== 'string' || !datos.licencia.trim()) {
    const error = new Error('La licencia es obligatoria');
    error.estado = 400;
    throw error;
  }

  // Normalizar campos de texto
  datos.titulo = datos.titulo.trim();
  datos.audio = datos.audio.trim();
  datos.autoria = datos.autoria.trim();
  datos.licencia = datos.licencia.trim();
  datos.letra = typeof datos.letra === 'string' ? datos.letra.trim() : '';
  datos.lrc = typeof datos.lrc === 'string' ? datos.lrc.trim() : '';
  datos.temaId = datos.temaId ? String(datos.temaId).trim() : null;

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
