// servidor/ganchos/progreso-temas.js · Ganchos para la colección progreso-temas
import { leer } from '../almacen.js';
import { estudiantesDe } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];
  if (usuario.rol === 'admin') return lista;

  if (usuario.rol === 'docente') {
    const misEstudiantes = await estudiantesDe(usuario.id);
    const estIds = new Set(misEstudiantes.map(e => e.id));
    return lista.filter(p => p && estIds.has(p.usuarioId));
  }

  if (usuario.rol === 'estudiante') {
    return lista.filter(p => p && p.usuarioId === usuario.id);
  }

  return [];
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    const error = new Error('No autenticado');
    error.estado = 401;
    throw error;
  }

  datos.usuarioId = usuario.id;

  if (!datos.temaId) {
    const error = new Error('El campo temaId es obligatorio');
    error.estado = 400;
    throw error;
  }

  const existentes = await leer('progreso-temas');
  const existe = existentes.some(
    p => p && p.usuarioId === usuario.id && p.temaId === datos.temaId && (!anterior || p.id !== anterior.id)
  );

  if (existe) {
    const error = new Error('Ya existe un registro de progreso para este tema');
    error.estado = 400;
    throw error;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
