// servidor/ganchos/distributivo.js · Ganchos para la colección distributivo
import { gruposDe } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const grupos = await gruposDe(usuario);
  const gruposIds = new Set(grupos.map(g => g.id));
  return lista.filter(g => g && gruposIds.has(g.id));
}

export default {
  filtrarLista
};
