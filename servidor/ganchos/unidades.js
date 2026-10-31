// servidor/ganchos/unidades.js · Ganchos para la colección unidades
import { asignaturasDe, puedeEditarAsignatura } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const misAsignaturas = await asignaturasDe(usuario);
  const permitidasIds = new Set(misAsignaturas.map(a => a.id));

  return lista.filter(u => {
    if (!u || !permitidasIds.has(u.asignaturaId)) return false;
    if (usuario.rol === 'estudiante' && u.visible === false) return false;
    return true;
  });
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const asignaturaId = datos?.asignaturaId || anterior?.asignaturaId;
  const puede = await puedeEditarAsignatura(usuario, asignaturaId);
  if (!puede) {
    const error = new Error('No tienes permisos para gestionar unidades en esta asignatura');
    error.estado = 403;
    throw error;
  }
  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
