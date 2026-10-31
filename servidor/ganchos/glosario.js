// servidor/ganchos/glosario.js · Ganchos para la colección glosario
import { leer } from '../almacen.js';
import { asignaturasDe, asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const [temas, unidades, misAsignaturas] = await Promise.all([
    leer('temas'),
    leer('unidades'),
    asignaturasDe(usuario)
  ]);

  const permitidasIds = new Set(misAsignaturas.map(a => a.id));
  const mapaUnidad = new Map(unidades.map(u => [u.id, u]));
  const mapaTema = new Map(temas.map(t => [t.id, t]));

  return lista.filter(g => {
    if (!g || !g.temaId) return false;
    const tema = mapaTema.get(g.temaId);
    if (!tema || !tema.unidadId) return false;
    const unidad = mapaUnidad.get(tema.unidadId);
    if (!unidad || !permitidasIds.has(unidad.asignaturaId)) return false;

    if (usuario.rol === 'estudiante') {
      if (unidad.visible === false) return false;
      if (tema.estado !== 'publicado') return false;
      if (g.estado !== 'aprobado' && g.aprobado !== true) return false;
    }
    return true;
  });
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const temaId = datos?.temaId || anterior?.temaId;
  const asignatura = await asignaturaDeTema(temaId);
  const puede = await puedeEditarAsignatura(usuario, asignatura?.id);

  if (!puede) {
    const error = new Error('No tienes permisos para gestionar términos de glosario en esta asignatura');
    error.estado = 403;
    throw error;
  }
  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
