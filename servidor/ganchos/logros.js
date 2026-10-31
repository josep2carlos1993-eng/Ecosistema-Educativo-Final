// servidor/ganchos/logros.js · Ganchos para la colección logros
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
    return lista.filter(l => l && idsEstudiantes.has(l.usuarioId));
  }

  if (usuario.rol === 'estudiante') {
    return lista.filter(l => l && l.usuarioId === usuario.id);
  }

  return [];
}

export default {
  filtrarLista
};
