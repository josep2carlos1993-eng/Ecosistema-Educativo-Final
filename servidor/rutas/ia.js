// servidor/rutas/ia.js · Rutas de Inteligencia Artificial pedagógica y configuración
import { Router } from 'express';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import almacen from '../almacen.js';
import { ejecutarTarea, probarConexion, listarModelosGemini } from '../ia.js';

const router = Router();
const DIR_PREPARADORES = path.resolve('servidor', 'preparadores');

const MODELOS_ESTANDAR = [
  { id: 'gemini-1.5-flash', nombre: 'Gemini 1.5 Flash (Recomendado - Rápido, económico y siempre disponible)' },
  { id: 'gemini-1.5-flash-latest', nombre: 'Gemini 1.5 Flash Latest' },
  { id: 'gemini-1.5-pro', nombre: 'Gemini 1.5 Pro (Capacidad avanzada de razonamiento y análisis)' },
  { id: 'gemini-1.5-pro-latest', nombre: 'Gemini 1.5 Pro Latest' },
  { id: 'gemini-2.0-flash', nombre: 'Gemini 2.0 Flash (Nueva generación - Ultra veloz)' },
  { id: 'gemini-2.0-flash-lite', nombre: 'Gemini 2.0 Flash Lite (Alta eficiencia)' },
  { id: 'gemini-2.5-flash', nombre: 'Gemini 2.5 Flash' },
  { id: 'gemini-3.8-flash', nombre: 'Gemini 3.8 Flash' },
  { id: 'gemini-4-argon', nombre: 'Gemini 4 Argon' }
];

function enmascararClave(clave) {
  if (!clave || typeof clave !== 'string') return '';
  if (clave.length <= 8) return '********';
  return `${clave.slice(0, 6)}...${clave.slice(-4)}`;
}

// GET /api/ia/modelos (obtiene la lista de modelos de Google para la clave o estándar)
router.get('/ia/modelos', async (req, res) => {
  const ajustes = await almacen.leerConfig('ajustes');
  const clave = (req.query.clave || ajustes.iaClave || process.env.IA_CLAVE || '').trim();

  if (clave) {
    try {
      const remotos = await listarModelosGemini(clave);
      if (remotos && remotos.length > 0) {
        return res.json({ modelos: remotos, origen: 'google' });
      }
    } catch (err) {
      console.warn('Error al consultar modelos con Google:', err.message);
    }
  }

  return res.json({ modelos: MODELOS_ESTANDAR, origen: 'catalogo' });
});

// GET /api/ia/configuracion (solo admin)
router.get('/ia/configuracion', async (req, res) => {
  if (!req.usuario || req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }

  const ajustes = await almacen.leerConfig('ajustes');
  const clave = (ajustes.iaClave || process.env.IA_CLAVE || '').trim();

  let listaFinal = MODELOS_ESTANDAR;
  if (clave) {
    try {
      const remotos = await listarModelosGemini(clave);
      if (remotos && remotos.length > 0) {
        listaFinal = remotos;
      }
    } catch {}
  }

  res.json({
    iaProveedor: ajustes.iaProveedor || process.env.IA_PROVEEDOR || 'gemini',
    iaModelo: ajustes.iaModelo || process.env.IA_MODELO || 'gemini-1.5-flash',
    tieneClave: Boolean(clave),
    claveEnmascarada: enmascararClave(clave),
    limiteIADiario: ajustes.limiteIADiario ?? 30,
    modelosDisponibles: listaFinal
  });
});

// PUT /api/ia/configuracion (solo admin)
router.put('/ia/configuracion', async (req, res) => {
  if (!req.usuario || req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }

  const { iaProveedor, iaModelo, iaClave, limiteIADiario } = req.body || {};
  const ajustes = await almacen.leerConfig('ajustes');

  if (iaProveedor !== undefined) ajustes.iaProveedor = String(iaProveedor).trim();
  if (iaModelo !== undefined) ajustes.iaModelo = String(iaModelo).trim();
  if (limiteIADiario !== undefined && Number(limiteIADiario) > 0) {
    ajustes.limiteIADiario = Number(limiteIADiario);
  }

  if (typeof iaClave === 'string' && iaClave.trim().length > 0) {
    ajustes.iaClave = iaClave.trim();
  }

  await almacen.escribirConfig('ajustes', ajustes);

  res.json({
    ok: true,
    mensaje: 'Configuración de IA guardada correctamente',
    iaProveedor: ajustes.iaProveedor,
    iaModelo: ajustes.iaModelo,
    tieneClave: Boolean(ajustes.iaClave)
  });
});

// Función auxiliar para prueba de conexión
async function procesarPrueba(req, res) {
  const ajustes = await almacen.leerConfig('ajustes');
  const apiKey = (req.body?.iaClave || ajustes.iaClave || process.env.IA_CLAVE || '').trim();
  const modelo = (req.body?.iaModelo || ajustes.iaModelo || process.env.IA_MODELO || 'gemini-1.5-flash').trim();
  const proveedor = (req.body?.iaProveedor || ajustes.iaProveedor || process.env.IA_PROVEEDOR || 'gemini').trim();

  try {
    const test = await probarConexion({ apiKey, modelo, proveedor });
    return res.json({ ok: true, mensaje: `Conexión exitosa con el modelo "${test.modelo}" (${test.proveedor})` });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message || 'Error al conectar con la API de IA' });
  }
}

// POST /api/ia/probar (ruta directa)
router.post('/ia/probar', async (req, res) => {
  if (!req.usuario || req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }
  return procesarPrueba(req, res);
});

// POST /api/ia/:tarea
router.post('/ia/:tarea', async (req, res) => {
  if (!req.usuario) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const { tarea } = req.params;

  if (tarea === 'probar') {
    return procesarPrueba(req, res);
  }

  try {
    let datos = req.body || {};

    const rutaPrep = path.join(DIR_PREPARADORES, `${tarea}.js`);
    try {
      const mod = await import(pathToFileURL(rutaPrep).href);
      const preparador = mod.default || mod;
      if (typeof preparador === 'function') {
        datos = await preparador(req.body, req.usuario);
      }
    } catch (errPrep) {
      if (errPrep.code !== 'ERR_MODULE_NOT_FOUND' && errPrep.code !== 'ENOENT') {
        throw errPrep;
      }
    }

    const resultado = await ejecutarTarea(tarea, datos, req.usuario, { formato: 'json' });

    if (tarea === 'tutor') {
      try {
        await almacen.agregar('consultas-tutor', {
          usuarioId: req.usuario.id,
          asignaturaId: req.body?.asignaturaId || datos.asignaturaId || '',
          temaId: req.body?.temaId || datos.temaId || '',
          dia: new Date().toISOString().slice(0, 10),
          mensaje: req.body?.mensaje || '',
          respuesta: resultado?.respuesta || ''
        });
      } catch (errLog) {
        console.warn('Error al registrar en consultas-tutor:', errLog.message);
      }
    }

    return res.json(resultado);
  } catch (error) {
    const estado = error.estado || (error.message?.includes('permisos') ? 403 : 500);
    return res.status(estado).json({ error: error.message || 'Error al procesar la tarea de IA' });
  }
});

export default router;
