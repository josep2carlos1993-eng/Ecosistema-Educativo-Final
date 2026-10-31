// servidor/ganchos/noticias.js · Ganchos para la colección noticias
export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];
  if (usuario.rol === 'admin' || usuario.rol === 'docente') {
    return lista;
  }
  // Los estudiantes solo ven las noticias publicadas
  return lista.filter(n => n && n.estado === 'publicado');
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    const error = new Error('No autenticado');
    error.estado = 401;
    throw error;
  }

  // Fija autorId al crear
  if (!anterior) {
    datos.autorId = usuario.id;
  } else if (!datos.autorId) {
    datos.autorId = anterior.autorId;
  }

  // Fija fechaPublicacion cuando el estado pasa a "publicado"
  if (datos.estado === 'publicado') {
    if (!anterior || anterior.estado !== 'publicado') {
      datos.fechaPublicacion = new Date().toISOString();
    } else {
      datos.fechaPublicacion = datos.fechaPublicacion || anterior.fechaPublicacion || new Date().toISOString();
    }
  }

  if (datos.resumen && typeof datos.resumen === 'string' && datos.resumen.length > 200) {
    const error = new Error('El resumen no puede superar los 200 caracteres');
    error.estado = 400;
    throw error;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
