// servidor/rutas/quiz.js · Motor del quiz formativo y adaptativo
import { Router } from 'express';
import almacen from '../almacen.js';
import { asignaturaDeTema, asignaturasDe } from '../acceso.js';
import { procesarIntento } from '../gamificacion.js';
import { notificar } from '../notificar.js';

const router = Router();

const NOMBRES_NIVELES = {
  1: 'Recordar',
  2: 'Comprender',
  3: 'Aplicar',
  4: 'Analizar',
  5: 'Evaluar'
};

function normalizar(texto) {
  if (texto === null || texto === undefined) return '';
  let s = String(texto).trim().toUpperCase();
  s = s.replace(/Ñ/g, '\uE000');
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC');
  s = s.replace(/\uE000/g, 'Ñ');
  return s;
}

function barajar(lista) {
  if (!Array.isArray(lista)) return [];
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

async function verificarAccesoEstudianteTema(usuario, temaId) {
  if (!usuario) {
    const err = new Error('No autenticado');
    err.estado = 401;
    throw err;
  }
  if (usuario.rol !== 'estudiante') {
    const err = new Error('Solo los estudiantes pueden acceder al quiz');
    err.estado = 403;
    throw err;
  }
  if (!temaId) {
    const err = new Error('Parámetro temaId requerido');
    err.estado = 400;
    throw err;
  }

  const asignatura = await asignaturaDeTema(temaId);
  if (!asignatura) {
    const err = new Error('Tema no encontrado');
    err.estado = 404;
    throw err;
  }

  const asignaturasPermitidas = await asignaturasDe(usuario);
  const tieneAcceso = asignaturasPermitidas.some(a => a && a.id === asignatura.id);
  if (!tieneAcceso) {
    const err = new Error('No tienes acceso a los contenidos de este tema');
    err.estado = 403;
    throw err;
  }

  return asignatura;
}

async function notificarDocentePocasPreguntas(estudianteId, temaId, nivel) {
  try {
    const asignatura = await asignaturaDeTema(temaId);
    if (!asignatura) return;

    const distributivo = await almacen.leer('distributivo');
    const grupo = distributivo.find(g =>
      g &&
      g.asignaturaId === asignatura.id &&
      Array.isArray(g.estudiantes) &&
      g.estudiantes.includes(estudianteId)
    );
    if (!grupo || !grupo.docenteId) return;

    const hoy = new Date().toISOString().slice(0, 10);
    const notificaciones = await almacen.leer('notificaciones');

    const yaNotificado = notificaciones.some(n =>
      n &&
      n.usuarioId === grupo.docenteId &&
      n.tipo === 'banco-preguntas' &&
      n.temaId === temaId &&
      Number(n.nivel) === Number(nivel) &&
      n.fecha &&
      n.fecha.startsWith(hoy)
    );

    if (yaNotificado) return;

    const temas = await almacen.leer('temas');
    const tema = temas.find(t => t && t.id === temaId);
    const tituloTema = tema?.titulo || 'el tema';

    await notificar(grupo.docenteId, {
      tipo: 'banco-preguntas',
      temaId,
      nivel: Number(nivel),
      mensaje: `El banco de preguntas para "${tituloTema}" (Nivel ${nivel}) tiene pocas preguntas disponibles y los estudiantes están repitiendo preguntas.`,
      enlace: `/paginas/banco-preguntas.html?temaId=${encodeURIComponent(temaId)}&nivel=${nivel}`
    });
  } catch (err) {
    console.warn('Error al notificar al docente sobre banco de preguntas:', err.message);
  }
}

// 1. GET /api/quiz/estado?temaId=
router.get('/quiz/estado', async (req, res) => {
  try {
    const { temaId } = req.query;
    await verificarAccesoEstudianteTema(req.usuario, temaId);

    const todosLogros = await almacen.leer('logros');
    const logro = todosLogros.find(l => l && l.usuarioId === req.usuario.id);
    const nivelAprobado = Number(logro?.nivelQuiz?.[temaId]) || 0;

    const todosIntentos = await almacen.leer('intentos');
    const intentosQuiz = todosIntentos.filter(
      i => i && i.usuarioId === req.usuario.id && i.actividad === 'quiz' && i.temaId === temaId
    );

    const reglas = await almacen.leerConfig('reglas-gamificacion');
    const nivelMaximo = Number(reglas?.quiz?.nivelMaximo) || 5;

    const niveles = [];
    for (let i = 1; i <= nivelMaximo; i++) {
      let estado = 'bloqueado';
      if (i <= nivelAprobado) {
        estado = 'aprobado';
      } else if (i === 1 || (i - 1) <= nivelAprobado) {
        estado = 'disponible';
      } else {
        estado = 'bloqueado';
      }

      const intentosNivel = intentosQuiz.filter(it => Number(it.nivel) === i);
      let mejorPorcentaje = 0;
      if (intentosNivel.length > 0) {
        mejorPorcentaje = Math.max(
          ...intentosNivel.map(it => Math.round(((Number(it.puntaje) || 0) / (Number(it.maximo) || 1)) * 100))
        );
      }

      niveles.push({
        nivel: i,
        nombre: NOMBRES_NIVELES[i] || `Nivel ${i}`,
        estado,
        mejorPorcentaje
      });
    }

    res.json({ niveles });
  } catch (error) {
    const estado = error.estado || 500;
    res.status(estado).json({ error: error.message || 'Error al obtener estado del quiz' });
  }
});

// 2. POST /api/quiz/iniciar { temaId, nivel }
router.post('/quiz/iniciar', async (req, res) => {
  try {
    const { temaId, nivel } = req.body || {};
    const nivelNum = Number(nivel);
    if (!nivelNum || nivelNum < 1 || nivelNum > 5) {
      return res.status(400).json({ error: 'Nivel inválido (debe ser del 1 al 5)' });
    }

    await verificarAccesoEstudianteTema(req.usuario, temaId);

    // Verificar que el nivel esté disponible
    const todosLogros = await almacen.leer('logros');
    const logro = todosLogros.find(l => l && l.usuarioId === req.usuario.id);
    const nivelAprobado = Number(logro?.nivelQuiz?.[temaId]) || 0;

    const estaDisponible = nivelNum === 1 || (nivelNum - 1) <= nivelAprobado;
    if (!estaDisponible) {
      return res.status(403).json({ error: 'El nivel solicitado se encuentra bloqueado' });
    }

    const reglas = await almacen.leerConfig('reglas-gamificacion');
    const cantRequerida = Number(reglas?.quiz?.preguntasPorNivel) || 5;

    // Obtener todas las preguntas aprobadas de ese tema y nivel
    const todasPreguntas = await almacen.leer('preguntas');
    const aprobadas = todasPreguntas.filter(
      p => p && p.temaId === temaId && Number(p.nivel) === nivelNum && p.estado === 'aprobado'
    );

    if (aprobadas.length === 0) {
      return res.status(400).json({ error: 'No hay preguntas aprobadas disponibles para este nivel y tema' });
    }

    // Identificar preguntas vistas previamente por el estudiante en quiz-sesiones
    const todasSesiones = await almacen.leer('quiz-sesiones');
    const sesionesUsuario = todasSesiones.filter(s => s && s.usuarioId === req.usuario.id);

    const vistoTimestamp = new Map();
    for (const s of sesionesUsuario) {
      const fechaMs = new Date(s.inicio || s.fecha || 0).getTime();
      if (Array.isArray(s.preguntasIds)) {
        for (const pid of s.preguntasIds) {
          const previo = vistoTimestamp.get(pid) || 0;
          if (fechaMs > previo) {
            vistoTimestamp.set(pid, fechaMs);
          }
        }
      }
    }

    const noVistas = [];
    const vistas = [];

    for (const p of aprobadas) {
      if (!vistoTimestamp.has(p.id)) {
        noVistas.push(p);
      } else {
        vistas.push(p);
      }
    }

    const noVistasBarajadas = barajar(noVistas);
    let seleccionadas = [];

    if (noVistasBarajadas.length >= cantRequerida) {
      seleccionadas = noVistasBarajadas.slice(0, cantRequerida);
    } else {
      // Ordenar las vistas por timestamp ascendente (las vistas hace más tiempo primero)
      const vistasOrdenadas = vistas.sort((a, b) => {
        const tA = vistoTimestamp.get(a.id) || 0;
        const tB = vistoTimestamp.get(b.id) || 0;
        return tA - tB;
      });

      const faltan = cantRequerida - noVistasBarajadas.length;
      seleccionadas = [
        ...noVistasBarajadas,
        ...vistasOrdenadas.slice(0, faltan)
      ];

      // Notificar al docente del grupo si se están reutilizando preguntas
      await notificarDocentePocasPreguntas(req.usuario.id, temaId, nivelNum);
    }

    // Barajar el conjunto final
    seleccionadas = barajar(seleccionadas);

    // Crear la quiz-sesión
    const nuevaSesion = await almacen.agregar('quiz-sesiones', {
      usuarioId: req.usuario.id,
      temaId,
      nivel: nivelNum,
      preguntasIds: seleccionadas.map(p => p.id),
      respuestas: {},
      inicio: new Date().toISOString(),
      finalizada: false
    });

    // Devolver SIN respuestas ni retroalimentación
    const preguntasPublicas = seleccionadas.map(p => ({
      id: p.id,
      tipo: p.tipo,
      enunciado: p.enunciado,
      opciones: Array.isArray(p.opciones) ? p.opciones : []
    }));

    res.status(201).json({
      sesionId: nuevaSesion.id,
      preguntas: preguntasPublicas
    });
  } catch (error) {
    const estado = error.estado || 500;
    res.status(estado).json({ error: error.message || 'Error al iniciar la sesión de quiz' });
  }
});

// 3. POST /api/quiz/responder { sesionId, preguntaId, respuesta }
router.post('/quiz/responder', async (req, res) => {
  try {
    if (!req.usuario || req.usuario.rol !== 'estudiante') {
      return res.status(403).json({ error: 'Solo los estudiantes pueden responder el quiz' });
    }

    const { sesionId, preguntaId, respuesta } = req.body || {};
    if (!sesionId || !preguntaId || respuesta === undefined) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (sesionId, preguntaId, respuesta)' });
    }

    const todasSesiones = await almacen.leer('quiz-sesiones');
    const sesion = todasSesiones.find(s => s && s.id === sesionId);

    if (!sesion) {
      return res.status(404).json({ error: 'Sesión de quiz no encontrada' });
    }

    if (sesion.usuarioId !== req.usuario.id) {
      return res.status(403).json({ error: 'No tienes acceso a esta sesión de quiz' });
    }

    if (sesion.finalizada) {
      return res.status(400).json({ error: 'Esta sesión de quiz ya fue finalizada' });
    }

    if (!Array.isArray(sesion.preguntasIds) || !sesion.preguntasIds.includes(preguntaId)) {
      return res.status(400).json({ error: 'La pregunta no pertenece a esta sesión de quiz' });
    }

    const respuestasSesion = sesion.respuestas || {};

    // Guarda una sola vez por pregunta
    if (respuestasSesion[preguntaId] !== undefined) {
      return res.status(400).json({ error: 'Esta pregunta ya fue respondida en esta sesión' });
    }

    // Buscar datos de la pregunta
    const todasPreguntas = await almacen.leer('preguntas');
    const pregunta = todasPreguntas.find(p => p && p.id === preguntaId);

    if (!pregunta) {
      return res.status(404).json({ error: 'Pregunta no encontrada en el banco' });
    }

    let correcto = false;
    let textoCorrecta = '';

    if (pregunta.tipo === 'opcion') {
      const idxCorrecto = Number(pregunta.correcta);
      const idxRespuesta = Number(respuesta);
      correcto = !isNaN(idxCorrecto) && !isNaN(idxRespuesta) && idxCorrecto === idxRespuesta;
      textoCorrecta = Array.isArray(pregunta.opciones) && pregunta.opciones[idxCorrecto] !== undefined
        ? String(pregunta.opciones[idxCorrecto])
        : String(pregunta.correcta);
    } else if (pregunta.tipo === 'vf') {
      const respBool = respuesta === true || respuesta === 'true' || respuesta === 'Verdadero' || respuesta === 'verdadero';
      const corrBool = pregunta.correcta === true || pregunta.correcta === 'true' || pregunta.correcta === 'Verdadero' || pregunta.correcta === 'verdadero';
      correcto = respBool === corrBool;
      textoCorrecta = corrBool ? 'Verdadero' : 'Falso';
    } else if (pregunta.tipo === 'completar') {
      correcto = normalizar(respuesta) === normalizar(pregunta.correcta);
      textoCorrecta = String(pregunta.correcta);
    } else {
      correcto = String(respuesta).trim().toLowerCase() === String(pregunta.correcta).trim().toLowerCase();
      textoCorrecta = String(pregunta.correcta);
    }

    // Registrar respuesta en la sesión
    respuestasSesion[preguntaId] = {
      respuesta,
      correcto,
      fecha: new Date().toISOString()
    };

    await almacen.actualizar('quiz-sesiones', sesion.id, { respuestas: respuestasSesion });

    res.json({
      correcto,
      retroalimentacion: pregunta.retroalimentacion || '',
      correcta: textoCorrecta
    });
  } catch (error) {
    const estado = error.estado || 500;
    res.status(estado).json({ error: error.message || 'Error al procesar la respuesta' });
  }
});

// 4. POST /api/quiz/finalizar { sesionId }
router.post('/quiz/finalizar', async (req, res) => {
  try {
    if (!req.usuario || req.usuario.rol !== 'estudiante') {
      return res.status(403).json({ error: 'Solo los estudiantes pueden finalizar el quiz' });
    }

    const { sesionId } = req.body || {};
    if (!sesionId) {
      return res.status(400).json({ error: 'Parámetro sesionId requerido' });
    }

    const todasSesiones = await almacen.leer('quiz-sesiones');
    const sesion = todasSesiones.find(s => s && s.id === sesionId);

    if (!sesion) {
      return res.status(404).json({ error: 'Sesión de quiz no encontrada' });
    }

    if (sesion.usuarioId !== req.usuario.id) {
      return res.status(403).json({ error: 'No tienes acceso a esta sesión de quiz' });
    }

    if (sesion.finalizada) {
      return res.status(400).json({ error: 'Esta sesión de quiz ya fue finalizada anteriormente' });
    }

    const preguntasIds = Array.isArray(sesion.preguntasIds) ? sesion.preguntasIds : [];
    const total = preguntasIds.length;
    if (total === 0) {
      return res.status(400).json({ error: 'La sesión no contiene preguntas' });
    }

    const respuestas = sesion.respuestas || {};
    let aciertos = 0;
    const falladasIds = [];

    for (const pid of preguntasIds) {
      const resp = respuestas[pid];
      if (resp && resp.correcto === true) {
        aciertos++;
      } else {
        falladasIds.push(pid);
      }
    }

    const errores = total - aciertos;
    const porcentaje = Math.round((aciertos / total) * 100);

    const reglas = await almacen.leerConfig('reglas-gamificacion');
    const pctMinimo = Number(reglas?.quiz?.porcentajeAprobacion ?? reglas?.quiz?.aprobadoMinimo ?? 70);
    const aprobado = porcentaje >= pctMinimo;

    // Si aprueba, primero actualiza logros.nivelQuiz[temaId] al máximo
    if (aprobado) {
      const todosLogros = await almacen.leer('logros');
      let logro = todosLogros.find(l => l && l.usuarioId === req.usuario.id);
      const nivelActual = Number(sesion.nivel);

      if (!logro) {
        logro = await almacen.agregar('logros', {
          usuarioId: req.usuario.id,
          puntos: 0,
          insignias: [],
          nivelQuiz: { [sesion.temaId]: nivelActual }
        });
      } else {
        const nivelPrevio = Number(logro.nivelQuiz?.[sesion.temaId]) || 0;
        const nuevoMax = Math.max(nivelActual, nivelPrevio);
        const nivelQuizActualizado = {
          ...(logro.nivelQuiz || {}),
          [sesion.temaId]: nuevoMax
        };
        await almacen.actualizar('logros', logro.id, { nivelQuiz: nivelQuizActualizado });
      }
    }

    // Calcular duración en segundos
    const inicioMs = new Date(sesion.inicio || sesion.fecha || Date.now()).getTime();
    const duracionSeg = Math.max(1, Math.round((Date.now() - inicioMs) / 1000));

    // Actualizar sesión como finalizada
    await almacen.actualizar('quiz-sesiones', sesion.id, {
      finalizada: true,
      fin: new Date().toISOString(),
      porcentaje,
      aprobado,
      aciertos,
      total,
      errores,
      duracionSeg
    });

    // En todos los casos llamar a procesarIntento
    const intentoResultado = await procesarIntento(req.usuario, {
      actividad: 'quiz',
      temaId: sesion.temaId,
      nivel: Number(sesion.nivel),
      puntaje: aciertos,
      maximo: total,
      errores,
      duracionSeg,
      detalle: { aprobado }
    });

    // Obtener retroalimentaciones de las preguntas falladas
    const todasPreguntas = await almacen.leer('preguntas');
    const mapaPreguntas = new Map(todasPreguntas.map(p => [p.id, p]));

    const repasar = falladasIds
      .map(pid => {
        const preg = mapaPreguntas.get(pid);
        return preg?.retroalimentacion || preg?.enunciado || '';
      })
      .filter(Boolean);

    res.json({
      porcentaje,
      aprobado,
      aciertos,
      total,
      repasar,
      puntosGanados: intentoResultado?.puntosGanados ?? 0,
      insigniasNuevas: intentoResultado?.insigniasNuevas ?? []
    });
  } catch (error) {
    const estado = error.estado || 500;
    res.status(estado).json({ error: error.message || 'Error al finalizar la sesión de quiz' });
  }
});

export default router;

