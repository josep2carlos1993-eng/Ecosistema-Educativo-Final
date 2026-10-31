// servidor/acceso.js · Reglas de acceso por grupos y asignaturas
import { leer } from './almacen.js';

export async function gruposDe(usuario) {
  if (!usuario) return [];
  const distributivo = await leer('distributivo');

  if (usuario.rol === 'admin') {
    return distributivo;
  }
  if (usuario.rol === 'docente') {
    return distributivo.filter(g => g && g.docenteId === usuario.id);
  }
  if (usuario.rol === 'estudiante') {
    return distributivo.filter(g => g && Array.isArray(g.estudiantes) && g.estudiantes.includes(usuario.id));
  }
  return [];
}

export async function asignaturasDe(usuario) {
  if (!usuario) return [];
  const asignaturas = await leer('asignaturas');

  if (usuario.rol === 'admin') {
    return asignaturas;
  }

  const grupos = await gruposDe(usuario);
  const idsAsignaturas = new Set(grupos.map(g => g.asignaturaId).filter(Boolean));
  return asignaturas.filter(a => a && idsAsignaturas.has(a.id));
}

export async function asignaturaDeTema(temaId) {
  if (!temaId) return null;
  const temas = await leer('temas');
  const tema = temas.find(t => t && t.id === temaId);
  if (!tema || !tema.unidadId) return null;

  const unidades = await leer('unidades');
  const unidad = unidades.find(u => u && u.id === tema.unidadId);
  if (!unidad || !unidad.asignaturaId) return null;

  const asignaturas = await leer('asignaturas');
  return asignaturas.find(a => a && a.id === unidad.asignaturaId) || null;
}

export async function puedeEditarAsignatura(usuario, asignaturaId) {
  if (!usuario || !asignaturaId) return false;
  if (usuario.rol === 'admin') return true;
  if (usuario.rol !== 'docente') return false;

  const grupos = await gruposDe(usuario);
  return grupos.some(g => g && g.asignaturaId === asignaturaId);
}

export async function estudiantesDe(docenteId) {
  if (!docenteId) return [];
  const distributivo = await leer('distributivo');
  const gruposDocente = distributivo.filter(g => g && g.docenteId === docenteId);
  const estudiantesIds = new Set(gruposDocente.flatMap(g => g.estudiantes || []));

  const usuarios = await leer('usuarios');
  return usuarios.filter(u => u && estudiantesIds.has(u.id));
}

export async function docentesDe(estudianteId) {
  if (!estudianteId) return [];
  const distributivo = await leer('distributivo');
  const gruposEstudiante = distributivo.filter(
    g => g && Array.isArray(g.estudiantes) && g.estudiantes.includes(estudianteId)
  );
  const docentesIds = new Set(gruposEstudiante.map(g => g.docenteId).filter(Boolean));

  const usuarios = await leer('usuarios');
  return usuarios.filter(u => u && docentesIds.has(u.id));
}

export default {
  gruposDe,
  asignaturasDe,
  asignaturaDeTema,
  puedeEditarAsignatura,
  estudiantesDe,
  docentesDe
};
