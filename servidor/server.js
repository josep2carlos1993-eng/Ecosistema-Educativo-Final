import express from 'express';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import almacen from './almacen.js';
import { puede } from './permisos.js';
import ganchos from './ganchos.js';
import { cargarUsuario } from './auth.js';

dotenv.config();

const app = express();
const PUERTO = process.env.PUERTO || process.env.PORT || 3000;

app.use(express.static('publico'));
app.use(express.json({ limit: '1mb' }));
app.use(cargarUsuario);

// Carga automática de rutas específicas en /api (orden alfabético)
const DIR_RUTAS = path.resolve('servidor', 'rutas');
try {
  const archivos = await fs.readdir(DIR_RUTAS);
  const jsRutas = archivos
    .filter(a => a.endsWith('.js') && !a.startsWith('.'))
    .sort();

  for (const archivo of jsRutas) {
    const rutaArchivo = path.join(DIR_RUTAS, archivo);
    const modulo = await import(pathToFileURL(rutaArchivo).href);
    const router = modulo.default || modulo;
    if (router) {
      app.use('/api', router);
    }
  }
} catch (error) {
  if (error.code !== 'ENOENT') {
    console.error('Error al cargar rutas personalizadas:', error);
  }
}

// API genérica: /api/:col y /api/:col/:id
app.get('/api/:col', async (req, res, next) => {
  try {
    const { col } = req.params;
    const permitido = await puede(req.usuario, 'leer', col, null);
    if (!permitido) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    let items = await almacen.buscar(col, req.query);
    items = await ganchos.aplicar(col, 'filtrarLista', items, req.usuario);
    res.json(items);
  } catch (error) {
    next(error);
  }
});

app.get('/api/:col/:id', async (req, res, next) => {
  try {
    const { col, id } = req.params;
    const items = await almacen.leer(col);
    const registro = items.find(r => r && r.id === id);
    if (!registro) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const permitido = await puede(req.usuario, 'leer', col, registro);
    if (!permitido) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    res.json(registro);
  } catch (error) {
    next(error);
  }
});

app.post('/api/:col', async (req, res, next) => {
  try {
    const { col } = req.params;
    const datosEntrada = req.body || {};
    const permitido = await puede(req.usuario, 'escribir', col, datosEntrada);
    if (!permitido) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    const datosProcesados = await ganchos.aplicar(col, 'antesDeGuardar', datosEntrada, req.usuario, null);
    const nuevo = await almacen.agregar(col, datosProcesados);
    await ganchos.aplicar(col, 'despuesDeGuardar', nuevo, req.usuario, null);

    res.status(201).json(nuevo);
  } catch (error) {
    next(error);
  }
});

app.put('/api/:col/:id', async (req, res, next) => {
  try {
    const { col, id } = req.params;
    const items = await almacen.leer(col);
    const anterior = items.find(r => r && r.id === id);
    if (!anterior) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const cambiosEntrada = req.body || {};
    const permitido = await puede(req.usuario, 'escribir', col, anterior);
    if (!permitido) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    const cambiosProcesados = await ganchos.aplicar(col, 'antesDeGuardar', cambiosEntrada, req.usuario, anterior);
    const actualizado = await almacen.actualizar(col, id, cambiosProcesados);
    await ganchos.aplicar(col, 'despuesDeGuardar', actualizado, req.usuario, anterior);

    res.json(actualizado);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/:col/:id', async (req, res, next) => {
  try {
    const { col, id } = req.params;
    const items = await almacen.leer(col);
    const anterior = items.find(r => r && r.id === id);
    if (!anterior) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const permitido = await puede(req.usuario, 'escribir', col, anterior);
    if (!permitido) {
      return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    await almacen.eliminar(col, id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// Manejo centralizado de errores
app.use((err, req, res, next) => {
  const codigo = typeof err.estado === 'number' ? err.estado : (err.status || 500);
  res.status(codigo).json({ error: err.message || 'Error interno del servidor' });
});

const esPrincipal = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (esPrincipal) {
  app.listen(PUERTO, () => {
    console.log(`Servidor iniciado en http://localhost:${PUERTO}`);
  });
}

export default app;
