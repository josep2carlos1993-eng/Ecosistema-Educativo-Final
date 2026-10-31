// servidor/ganchos/asignaturas.js · Ganchos para la colección asignaturas
import { asignaturasDe } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const permitidas = await asignaturasDe(usuario);
  const permitidasIds = new Set(permitidas.map(a => a.id));
  return lista.filter(a => a && permitidasIds.has(a.id));
}

export default {
  filtrarLista
};
