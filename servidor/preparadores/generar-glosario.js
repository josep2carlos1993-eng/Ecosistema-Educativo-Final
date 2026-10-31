// servidor/preparadores/generar-glosario.js · Preparador para generar palabras de glosario con IA
import { leer } from '../almacen.js';
import { asignaturaDeTema, asignaturasDe } from '../acceso.js';

export default async function prepararGenerarGlosario(cuerpo, usuario) {
  if (!usuario) {
    const error = new Error('No autenticado');
    error.estado = 401;
    throw error;
  }

  const { temaId } = cuerpo || {};
  if (!temaId) {
    const error = new Error('El campo temaId es obligatorio');
    error.estado = 400;
    throw error;
  }

  const [temas, glosario] = await Promise.all([
    leer('temas'),
    leer('glosario')
  ]);

  const tema = temas.find(t => t && t.id === temaId);
  if (!tema) {
    const error = new Error('Tema pedagógico no encontrado');
    error.estado = 404;
    throw error;
  }

  const asignatura = await asignaturaDeTema(temaId);
  if (!asignatura) {
    const error = new Error('Asignatura no encontrada para el tema');
    error.estado = 404;
    throw error;
  }

  // Verificar acceso a la asignatura según rol
  if (usuario.rol === 'docente') {
    const permitidas = await asignaturasDe(usuario);
    const tieneAcceso = (permitidas || []).some(a => a && a.id === asignatura.id);
    if (!tieneAcceso) {
      const error = new Error('No tienes acceso a los contenidos de esta asignatura');
      error.estado = 403;
      throw error;
    }
  } else if (usuario.rol === 'estudiante') {
    const permitidas = await asignaturasDe(usuario);
    const tieneAcceso = (permitidas || []).some(a => a && a.id === asignatura.id);
    if (!tieneAcceso && tema.estado !== 'publicado') {
      const error = new Error('No tienes acceso a los contenidos de esta asignatura');
      error.estado = 403;
      throw error;
    }
  }

  let cantidad = Number(cuerpo.cantidad) || 8;
  if (cantidad < 5) cantidad = 5;
  if (cantidad > 15) cantidad = 15;

  const objetivosTexto = Array.isArray(tema.objetivos) ? tema.objetivos.join('; ') : (tema.objetivos || '');
  const ejemplosTexto = Array.isArray(tema.ejemplos) ? tema.ejemplos.join('; ') : (tema.ejemplos || '');
  const clavesTexto = Array.isArray(tema.palabrasClave) ? tema.palabrasClave.join(', ') : (tema.palabrasClave || '');

  const partesContenido = [
    tema.resumen ? `Resumen temático: ${tema.resumen}` : '',
    objetivosTexto ? `Objetivos de aprendizaje: ${objetivosTexto}` : '',
    ejemplosTexto ? `Ejemplos y contextos: ${ejemplosTexto}` : '',
    clavesTexto ? `Tópicos clave: ${clavesTexto}` : ''
  ].filter(Boolean).join('\n\n') || `Estudio formativo de la unidad sobre ${tema.titulo}.`;

  const existentes = glosario
    .filter(g => g && g.temaId === temaId && g.termino)
    .map(g => g.termino)
    .join(', ');

  return {
    temaId: tema.id,
    asignatura: asignatura.nombre,
    nivel: asignatura.nivel || 'Educación Básica General',
    tema: tema.titulo,
    contenido: partesContenido,
    existentes: existentes || 'Ninguno aún',
    cantidad,
    minimoSeisLetras: 3
  };
}
