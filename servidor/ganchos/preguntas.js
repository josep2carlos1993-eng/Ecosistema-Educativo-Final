// servidor/ganchos/preguntas.js · Ganchos para la colección preguntas
import { leer } from '../almacen.js';
import { asignaturasDe, asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!usuario || usuario.rol === 'estudiante') {
    return [];
  }
  if (usuario.rol === 'admin') {
    return lista;
  }

  const [temas, unidades, misAsignaturas] = await Promise.all([
    leer('temas'),
    leer('unidades'),
    asignaturasDe(usuario)
  ]);

  const permitidasIds = new Set(misAsignaturas.map(a => a.id));
  const mapaUnidad = new Map(unidades.map(u => [u.id, u]));
  const mapaTema = new Map(temas.map(t => [t.id, t]));

  return lista.filter(p => {
    if (!p || !p.temaId) return false;
    const tema = mapaTema.get(p.temaId);
    if (!tema || !tema.unidadId) return false;
    const unidad = mapaUnidad.get(tema.unidadId);
    if (!unidad || !permitidasIds.has(unidad.asignaturaId)) return false;
    return true;
  });
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const temaId = datos?.temaId || anterior?.temaId;
  const asignatura = await asignaturaDeTema(temaId);
  const puede = await puedeEditarAsignatura(usuario, asignatura?.id);

  if (!puede) {
    const error = new Error('No tienes permisos para gestionar preguntas en esta asignatura');
    error.estado = 403;
    throw error;
  }

  if (datos.nivel !== undefined) {
    const n = Number(datos.nivel);
    if (isNaN(n) || n < 1 || n > 5) {
      const error = new Error('El nivel de la pregunta debe ser un número entre 1 y 5');
      error.estado = 400;
      throw error;
    }
    datos.nivel = n;
  }

  if (datos.tipo && !['opcion', 'vf', 'completar'].includes(datos.tipo)) {
    const error = new Error('El tipo de pregunta debe ser "opcion", "vf" o "completar"');
    error.estado = 400;
    throw error;
  }

  if (!datos.estado) {
    datos.estado = 'aprobado';
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};

