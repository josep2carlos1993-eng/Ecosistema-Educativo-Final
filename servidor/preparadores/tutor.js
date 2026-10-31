// servidor/preparadores/tutor.js · Preparador de contexto para el tutor socrático virtual
import almacen from '../almacen.js';
import { asignaturasDe } from '../acceso.js';

export default async function prepararTutor(cuerpo, usuario) {
  if (!usuario) {
    const err = new Error('No autenticado');
    err.estado = 401;
    throw err;
  }

  const { asignaturaId, temaId, mensaje, historial } = cuerpo || {};

  if (!asignaturaId) {
    const err = new Error('Se requiere el identificador de la asignatura (asignaturaId)');
    err.estado = 400;
    throw err;
  }

  // Verificar que el estudiante tenga acceso a la asignatura
  const asignaturasPermitidas = await asignaturasDe(usuario);
  const asignatura = asignaturasPermitidas.find(a => a && a.id === asignaturaId);

  if (!asignatura && usuario.rol !== 'admin') {
    const err = new Error('No tienes acceso a los contenidos de esta asignatura');
    err.estado = 403;
    throw err;
  }

  // Verificar límite diario de consultas con el tutor
  const ajustes = await almacen.leerConfig('ajustes');
  const limiteTutor = Number(ajustes?.limiteTutorDiario) || 40;
  const hoy = new Date().toISOString().slice(0, 10);

  const consultas = await almacen.leer('consultas-tutor');
  const consultasHoy = consultas.filter(c => c && c.usuarioId === usuario.id && c.dia === hoy);

  if (consultasHoy.length >= limiteTutor) {
    const err = new Error(`Has alcanzado el límite diario de consultas con el tutor (${limiteTutor} al día). Continúa mañana o repasa tus notas.`);
    err.estado = 429;
    throw err;
  }

  // Cargar unidades y temas publicados de la asignatura para limitar el contexto
  const [todasUnidades, todosTemas, todoGlosario] = await Promise.all([
    almacen.leer('unidades'),
    almacen.leer('temas'),
    almacen.leer('glosario')
  ]);

  const unidadesAsignatura = todasUnidades
    .filter(u => u && u.asignaturaId === asignaturaId && u.visible !== false)
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));

  const unidadesIds = new Set(unidadesAsignatura.map(u => u.id));

  const temasAsignatura = todosTemas
    .filter(t => t && unidadesIds.has(t.unidadId) && t.estado === 'publicado')
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));

  const temasIds = new Set(temasAsignatura.map(t => t.id));
  const glosarioAsignatura = todoGlosario.filter(g => g && temasIds.has(g.temaId));

  // Compilar textos de contexto
  const contextoAsignatura = `${asignatura.nombre} (${asignatura.nivel || 'Educación General'}). ${asignatura.descripcion || 'Enfoque formativo integral.'}`;

  const temasTexto = unidadesAsignatura.map(u => {
    const temasDeU = temasAsignatura.filter(t => t.unidadId === u.id);
    const lista = temasDeU.map(t => `  * ${t.titulo}${t.resumen ? ': ' + t.resumen : ''}`).join('\n');
    return `Unidad: ${u.titulo}\n${lista || '  (Sin temas publicados)'}`;
  }).join('\n\n') || 'Temas de la asignatura en desarrollo.';

  const glosarioTexto = glosarioAsignatura.slice(0, 25)
    .map(g => `${g.termino}: ${g.definicion}`)
    .join(' | ') || 'Conceptos fundamentales de la asignatura.';

  let textoHistorial = 'Inicio del diálogo formativo.';
  if (Array.isArray(historial) && historial.length > 0) {
    textoHistorial = historial.slice(-6).map(h => {
      const remitente = h.rol === 'usuario' || h.rol === 'estudiante' ? 'Estudiante' : 'Tutor';
      return `${remitente}: ${h.texto || h.mensaje || ''}`;
    }).join('\n');
  }

  return {
    asignatura: asignatura.nombre,
    nivel: asignatura.nivel || 'Nivel escolar',
    contextoAsignatura,
    temasDisponibles: temasTexto,
    glosario: glosarioTexto,
    historial: textoHistorial,
    mensaje: String(mensaje || '').trim(),
    asignaturaId,
    temaId: temaId || ''
  };
}

