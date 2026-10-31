// servidor/preparadores/generar-preguntas.js · Preparador para generar preguntas con IA
import { leer } from '../almacen.js';
import { asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

const NIVELES_BLOOM = {
  1: '1 Recordar',
  2: '2 Comprender',
  3: '3 Aplicar',
  4: '4 Analizar',
  5: '5 Evaluar'
};

export default async function prepararGenerarPreguntas(cuerpo, usuario) {
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

  const nivelNum = Number(cuerpo.nivel);
  if (isNaN(nivelNum) || nivelNum < 1 || nivelNum > 5) {
    const error = new Error('El nivel debe ser un número entero entre 1 y 5');
    error.estado = 400;
    throw error;
  }

  let cantidad = Number(cuerpo.cantidad);
  if (isNaN(cantidad) || cantidad < 5) {
    cantidad = 5;
  } else if (cantidad > 15) {
    cantidad = 15;
  }

  const asignatura = await asignaturaDeTema(temaId);
  if (!asignatura) {
    const error = new Error('Asignatura no encontrada para el tema');
    error.estado = 404;
    throw error;
  }

  const puede = await puedeEditarAsignatura(usuario, asignatura.id);
  if (!puede) {
    const error = new Error('No tienes permisos para editar preguntas de este tema');
    error.estado = 403;
    throw error;
  }

  const [temas, glosario, preguntas] = await Promise.all([
    leer('temas'),
    leer('glosario'),
    leer('preguntas')
  ]);

  const temaObj = temas.find(t => t && t.id === temaId);
  if (!temaObj) {
    const error = new Error('Tema no encontrado');
    error.estado = 404;
    throw error;
  }

  // Contenido pedagógico del tema
  const partesContenido = [
    temaObj.resumen,
    Array.isArray(temaObj.ejemplos) && temaObj.ejemplos.length > 0
      ? `Ejemplos:\n${temaObj.ejemplos.join('\n')}`
      : '',
    Array.isArray(temaObj.objetivos) && temaObj.objetivos.length > 0
      ? `Objetivos:\n${temaObj.objetivos.join('\n')}`
      : ''
  ].filter(Boolean);
  const contenido = partesContenido.join('\n\n') || temaObj.titulo;

  // Glosario: ("término: definición")
  const glosarioFiltrado = glosario.filter(g => g && g.temaId === temaId && g.termino && g.definicion);
  const glosarioTexto = glosarioFiltrado.length > 0
    ? glosarioFiltrado.map(g => `${g.termino}: ${g.definicion}`).join('\n')
    : 'Sin términos adicionales en el glosario.';

  // Nivel cognitivo según taxonomía de Bloom
  const nivelBloom = NIVELES_BLOOM[nivelNum] || `${nivelNum} Recordar`;

  // Preguntas que ya existen de ese nivel
  const existentesArr = preguntas
    .filter(p => p && p.temaId === temaId && Number(p.nivel) === nivelNum && p.enunciado)
    .map(p => `- ${p.enunciado}`);
  const existentes = existentesArr.length > 0
    ? existentesArr.join('\n')
    : 'Ninguna pregunta registrada previamente.';

  return {
    asignatura: asignatura.nombre,
    nivel: asignatura.nivel || 'Nivel General',
    tema: temaObj.titulo,
    contenido,
    glosario: glosarioTexto,
    nivelBloom,
    cantidad,
    existentes
  };
}

