// servidor/ganchos/lecturas-noticias.js · Ganchos para la colección lecturas-noticias
import { leer } from '../almacen.js';

export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];
  if (usuario.rol === 'admin') return lista;
  // Solo sus propias lecturas
  return lista.filter(l => l && l.usuarioId === usuario.id);
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    const error = new Error('No autenticado');
    error.estado = 401;
    throw error;
  }

  datos.usuarioId = usuario.id;

  if (!datos.noticiaId) {
    const error = new Error('El campo noticiaId es obligatorio');
    error.estado = 400;
    throw error;
  }

  // Evitar duplicados
  const existentes = await leer('lecturas-noticias');
  const existe = existentes.some(
    l => l && l.usuarioId === usuario.id && l.noticiaId === datos.noticiaId && (!anterior || l.id !== anterior.id)
  );

  if (existe) {
    const error = new Error('Ya existe un registro de lectura para esta noticia');
    error.estado = 400;
    throw error;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
