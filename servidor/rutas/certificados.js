// servidor/rutas/certificados.js · Rutas de certificados y diplomas académicos
import { Router } from 'express';
import almacen from '../almacen.js';
import { asignaturasDe } from '../acceso.js';

const router = Router();

export async function evaluarCondicionesCumplimiento(usuario) {
  const reglas = await almacen.leerConfig('reglas-gamificacion');
  const certConfig = reglas?.certificado || {};

  const nivelQuizReq = certConfig.nivelQuizRequerido ?? 3;
  const temasConNivelReq = certConfig.temasConNivelRequerido ?? 1;
  const puntosMin = certConfig.puntosMinimos ?? 100;
  const pctRequerido = certConfig.temasRevisadosPct ?? 80;

  // 1. Logros acumulados del usuario
  const todosLogros = await almacen.leer('logros');
  const logro = todosLogros.find(l => l && l.usuarioId === usuario.id);
  const puntosActual = logro?.puntos || 0;
  const nivelQuiz = logro?.nivelQuiz || {};

  const temasConNivelActual = Object.values(nivelQuiz).filter(n => Number(n) >= nivelQuizReq).length;
  const cumpleNivelQuiz = temasConNivelActual >= temasConNivelReq;
  const cumplePuntos = puntosActual >= puntosMin;

  // 2. Porcentaje de temas revisados sobre los publicados de sus asignaturas
  const asignaturas = await asignaturasDe(usuario);
  const idsAsignaturas = new Set(asignaturas.map(a => a.id));
  const unidades = await almacen.leer('unidades');
  const idsUnidades = new Set(unidades.filter(u => idsAsignaturas.has(u.asignaturaId)).map(u => u.id));
  const temas = await almacen.leer('temas');
  let temasPublicados = temas.filter(t => idsUnidades.has(t.unidadId) && t.estado === 'publicado');

  if (temasPublicados.length === 0 && (usuario.rol === 'admin' || asignaturas.length === 0)) {
    temasPublicados = temas.filter(t => t.estado === 'publicado');
  }

  const progreso = await almacen.leer('progreso-temas');
  const temasRevisadosUsuario = new Set(progreso.filter(p => p && p.usuarioId === usuario.id).map(p => p.temaId));

  const revisadosCount = temasPublicados.filter(t => temasRevisadosUsuario.has(t.id)).length;
  const totalPublicados = temasPublicados.length;
  const pctActual = totalPublicados > 0 ? Math.round((revisadosCount / totalPublicados) * 100) : 0;
  const cumplePct = pctActual >= pctRequerido;

  const condiciones = [
    {
      nombre: `Temas con nivel de quiz ≥ ${nivelQuizReq}`,
      actual: temasConNivelActual,
      requerido: temasConNivelReq,
      cumple: cumpleNivelQuiz
    },
    {
      nombre: 'Puntos mínimos',
      actual: puntosActual,
      requerido: puntosMin,
      cumple: cumplePuntos
    },
    {
      nombre: 'Porcentaje de temas revisados',
      actual: pctActual,
      requerido: pctRequerido,
      cumple: cumplePct
    }
  ];

  const cumple = cumpleNivelQuiz && cumplePuntos && cumplePct;
  return { condiciones, cumple };
}

function generarCodigoCertificado(existentes) {
  const año = new Date().getFullYear();
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codigosExistentes = new Set(existentes.map(c => c && c.codigo));

  for (let intento = 0; intento < 1000; intento++) {
    let rand = '';
    for (let i = 0; i < 6; i++) {
      rand += caracteres[Math.floor(Math.random() * caracteres.length)];
    }
    const codigo = `EE-${año}-${rand}`;
    if (!codigosExistentes.has(codigo)) {
      return codigo;
    }
  }
  return `EE-${año}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

// GET /api/certificados/verificar/:codigo (público, sin sesión)
router.get('/certificados/verificar/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    if (!codigo) {
      return res.json({ valido: false });
    }

    const certificados = await almacen.leer('certificados');
    const cert = certificados.find(c => c && typeof c.codigo === 'string' && c.codigo.toUpperCase() === codigo.trim().toUpperCase());

    if (!cert) {
      return res.json({ valido: false });
    }

    return res.json({
      valido: true,
      nombreCompleto: cert.nombreCompleto,
      detalle: cert.detalle,
      fecha: cert.fecha
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Error al verificar el certificado' });
  }
});

// GET /api/certificados/estado (con sesión)
router.get('/certificados/estado', async (req, res) => {
  if (!req.usuario) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    const resultado = await evaluarCondicionesCumplimiento(req.usuario);
    return res.json(resultado);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Error al obtener el estado de certificación' });
  }
});

// POST /api/certificados (con sesión)
router.post('/certificados', async (req, res) => {
  if (!req.usuario) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const { tipo, temaId, nivel } = req.body || {};

  if (tipo !== 'cumplimiento' && tipo !== 'nivel-quiz') {
    return res.status(400).json({ error: 'Tipo de certificado inválido (debe ser "cumplimiento" o "nivel-quiz")' });
  }

  try {
    const certificados = await almacen.leer('certificados');
    let detalle = '';

    if (tipo === 'nivel-quiz') {
      if (!temaId || !nivel) {
        return res.status(400).json({ error: 'Los campos temaId y nivel son obligatorios para certificados nivel-quiz' });
      }

      // Verificar que cumple logros.nivelQuiz[temaId] >= nivel
      const todosLogros = await almacen.leer('logros');
      const logro = todosLogros.find(l => l && l.usuarioId === req.usuario.id);
      const nivelAlcanzado = Number(logro?.nivelQuiz?.[temaId] || 0);

      if (nivelAlcanzado < Number(nivel)) {
        return res.status(400).json({ error: `No cumples con el nivel de quiz requerido (${nivelAlcanzado} < ${nivel})` });
      }

      // Si ya existe uno igual, devolverlo
      const existente = certificados.find(c => 
        c && c.usuarioId === req.usuario.id &&
        c.tipo === 'nivel-quiz' &&
        c.temaId === temaId &&
        Number(c.nivel) === Number(nivel)
      );

      if (existente) {
        return res.status(200).json(existente);
      }

      const temas = await almacen.leer('temas');
      const tema = temas.find(t => t && t.id === temaId);
      const tituloTema = tema?.titulo || 'Tema formativo';
      detalle = `Aprobación y dominio del Nivel ${nivel} de Quiz en el tema "${tituloTema}"`;

    } else if (tipo === 'cumplimiento') {
      const { cumple } = await evaluarCondicionesCumplimiento(req.usuario);
      if (!cumple) {
        return res.status(400).json({ error: 'No cumples con los requisitos para obtener el certificado de cumplimiento' });
      }

      // Si ya existe uno igual, devolverlo
      const existente = certificados.find(c => c && c.usuarioId === req.usuario.id && c.tipo === 'cumplimiento');
      if (existente) {
        return res.status(200).json(existente);
      }

      detalle = 'Certificado de Cumplimiento Global y Excelencia Formativa en el Ecosistema Educativo';
    }

    const codigo = generarCodigoCertificado(certificados);
    const nombreCompleto = `${req.usuario.nombre || ''} ${req.usuario.apellido || ''}`.trim() || 'Estudiante';

    const nuevoCertificado = {
      codigo,
      usuarioId: req.usuario.id,
      tipo,
      temaId: temaId || null,
      nivel: nivel ? Number(nivel) : null,
      detalle,
      nombreCompleto
    };

    const creado = await almacen.agregar('certificados', nuevoCertificado);
    return res.status(201).json(creado);

  } catch (error) {
    return res.status(500).json({ error: error.message || 'Error al emitir el certificado' });
  }
});

export default router;

