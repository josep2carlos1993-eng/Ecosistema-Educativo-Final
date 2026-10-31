// servidor/rutas/gamificacion.js · Rutas de gamificación (intentos y logros)
import { Router } from 'express';
import { procesarIntento } from '../gamificacion.js';
import almacen from '../almacen.js';
import { estudiantesDe } from '../acceso.js';

const router = Router();

// POST /intentos (montado en /api/intentos)
router.post('/intentos', async (req, res) => {
  if (!req.usuario) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    const resultado = await procesarIntento(req.usuario, req.body);
    res.status(200).json(resultado);
  } catch (error) {
    const estado = error.estado || 500;
    res.status(estado).json({ error: error.message || 'Error al procesar el intento' });
  }
});

// GET /logros/:usuarioId (montado en /api/logros/:usuarioId)
router.get('/logros/:usuarioId', async (req, res) => {
  if (!req.usuario) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const { usuarioId } = req.params;
  const targetId = (usuarioId === 'yo') ? req.usuario.id : usuarioId;

  // Verificación de permisos: propio estudiante, docente de sus grupos o admin
  let autorizado = false;

  if (req.usuario.rol === 'admin' || req.usuario.id === targetId) {
    autorizado = true;
  } else if (req.usuario.rol === 'docente') {
    const estudiantes = await estudiantesDe(req.usuario.id);
    autorizado = estudiantes.some(e => e && e.id === targetId);
  }

  if (!autorizado) {
    return res.status(403).json({ error: 'No tienes permisos para consultar los logros de este usuario' });
  }

  try {
    const todosLogros = await almacen.leer('logros');
    const logro = todosLogros.find(l => l && l.usuarioId === targetId);

    if (logro) {
      res.json(logro);
    } else {
      res.json({
        usuarioId: targetId,
        puntos: 0,
        insignias: [],
        nivelQuiz: {}
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error al obtener logros' });
  }
});

export default router;
