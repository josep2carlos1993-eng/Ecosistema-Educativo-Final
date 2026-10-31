// servidor/ganchos/intentos.js · Ganchos para la colección intentos
import { estudiantesDe } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];
  if (!Array.isArray(lista)) return [];

  if (usuario.rol === 'admin') {
    return lista;
  }

  if (usuario.rol === 'docente') {
    const estudiantes = await estudiantesDe(usuario.id);
    const idsEstudiantes = new Set(estudiantes.map(e => e.id));
    return lista.filter(i => i && idsEstudiantes.has(i.usuarioId));
  }

  if (usuario.rol === 'estudiante') {
    return lista.filter(i => i && i.usuarioId === usuario.id);
  }

  return [];
}

export default {
  filtrarLista
};
