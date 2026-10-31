// servidor/ganchos/temas.js · Ganchos para la colección temas
import { leer } from '../almacen.js';
import { asignaturasDe, puedeEditarAsignatura } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const [unidades, misAsignaturas] = await Promise.all([
    leer('unidades'),
    asignaturasDe(usuario)
  ]);

  const permitidasIds = new Set(misAsignaturas.map(a => a.id));
  const mapaUnidad = new Map(unidades.map(u => [u.id, u]));

  return lista.filter(t => {
    if (!t || !t.unidadId) return false;
    const unidad = mapaUnidad.get(t.unidadId);
    if (!unidad || !permitidasIds.has(unidad.asignaturaId)) return false;

    if (usuario.rol === 'estudiante') {
      if (unidad.visible === false) return false;
      if (t.estado !== 'publicado') return false;
    }
    return true;
  });
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const unidadId = datos?.unidadId || anterior?.unidadId;
  const unidades = await leer('unidades');
  const unidad = unidades.find(u => u && u.id === unidadId);
  const asignaturaId = unidad?.asignaturaId;

  const puede = await puedeEditarAsignatura(usuario, asignaturaId);
  if (!puede) {
    const error = new Error('No tienes permisos para gestionar temas en esta asignatura');
    error.estado = 403;
    throw error;
  }
  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
