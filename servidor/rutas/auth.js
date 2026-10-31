// servidor/rutas/auth.js · Rutas de autenticación, perfil, administración y bitácora

import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import almacen from '../almacen.js';
import { exigirRol } from '../auth.js';

const router = Router();
const fallosLogin = new Map(); // en memoria: correoKey -> [timestamps]

function generarClaveTemporal(longitud = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let res = '';
  const bytes = crypto.randomBytes(longitud);
  for (let i = 0; i < longitud; i++) {
    res += chars[bytes[i] % chars.length];
  }
  return res;
}

// 1. Registro de estudiantes
router.post('/auth/registro', async (req, res) => {
  try {
    const { nombre, apellido, correo, clave, consentimiento } = req.body || {};

    if (!nombre || !nombre.trim() || !apellido || !apellido.trim()) {
      return res.status(400).json({ error: 'Nombre y apellido son obligatorios' });
    }

    const reCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!correo || !reCorreo.test(correo.trim())) {
      return res.status(400).json({ error: 'Correo electrónico inválido' });
    }

    const correoKey = correo.trim().toLowerCase();
    const usuarios = await almacen.leer('usuarios');
    const yaExiste = usuarios.some(u => u && u.correo && u.correo.toLowerCase() === correoKey);
    if (yaExiste) {
      return res.status(400).json({ error: 'El correo electrónico ya se encuentra registrado' });
    }

    if (!clave || clave.length < 8 || !/[a-zA-Z]/.test(clave) || !/[0-9]/.test(clave)) {
      return res.status(400).json({
        error: 'La contraseña debe tener al menos 8 caracteres e incluir letras y números'
      });
    }

    if (consentimiento !== true) {
      return res.status(400).json({ error: 'Debe aceptar el consentimiento' });
    }

    const claveHash = await bcrypt.hash(clave, 10);
    const nuevo = await almacen.agregar('usuarios', {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      correo: correoKey,
      claveHash,
      rol: 'estudiante',
      activo: true,
      foto: null,
      consentimiento: {
        aceptado: true,
        fecha: new Date().toISOString()
      }
    });

    res.status(201).json({
      id: nuevo.id,
      nombre: nuevo.nombre,
      apellido: nuevo.apellido,
      correo: nuevo.correo,
      rol: nuevo.rol
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error en el registro' });
  }
});

// 2. Inicio de sesión
router.post('/auth/login', async (req, res) => {
  try {
    const { correo, clave } = req.body || {};
    const correoKey = (correo || '').trim().toLowerCase();

    // Verificación de límite de intentos (5 fallos en 15 minutos)
    const ahora = Date.now();
    const intentos = fallosLogin.get(correoKey) || [];
    const recientes = intentos.filter(t => ahora - t < 15 * 60 * 1000);

    if (recientes.length >= 5) {
      return res.status(429).json({
        error: 'Demasiados intentos fallidos. Intente de nuevo en 15 minutos.'
      });
    }

    const usuarios = await almacen.leer('usuarios');
    const user = usuarios.find(u => u && u.correo && u.correo.toLowerCase() === correoKey);

    if (!user || !user.activo || !(await bcrypt.compare(clave || '', user.claveHash || ''))) {
      recientes.push(ahora);
      fallosLogin.set(correoKey, recientes);
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    // Login exitoso: limpiar fallos y crear sesión de 8 horas
    fallosLogin.delete(correoKey);
    const token = crypto.randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + 8 * 3600 * 1000).toISOString();

    await almacen.agregar('sesiones', {
      token,
      usuarioId: user.id,
      expira
    });

    // Registro automático en bitácora
    await almacen.anexarLinea('bitacora.jsonl', {
      usuarioId: user.id,
      tipo: 'login',
      recurso: 'auth',
      fecha: new Date().toISOString()
    });

    res.json({
      token,
      usuario: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        correo: user.correo,
        rol: user.rol,
        foto: user.foto || null
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error en inicio de sesión' });
  }
});

// 3. Cierre de sesión
router.post('/auth/logout', async (req, res) => {
  try {
    const cabecera = req.headers['authorization'];
    const token = cabecera && cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : null;

    if (token) {
      const sesiones = await almacen.leer('sesiones');
      const activas = sesiones.filter(s => s && s.token !== token);
      await almacen.escribir('sesiones', activas);
    }

    if (req.usuario) {
      await almacen.anexarLinea('bitacora.jsonl', {
        usuarioId: req.usuario.id,
        tipo: 'logout',
        recurso: 'auth',
        fecha: new Date().toISOString()
      });
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error al cerrar sesión' });
  }
});

// 4. Perfil del usuario actual
router.get('/auth/yo', exigirRol(), async (req, res) => {
  try {
    const usuarios = await almacen.leer('usuarios');
    const user = usuarios.find(u => u && u.id === req.usuario.id);

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({
      id: user.id,
      nombre: user.nombre,
      apellido: user.apellido,
      correo: user.correo,
      rol: user.rol,
      foto: user.foto || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error al consultar perfil' });
  }
});

// 5. Actualizar perfil
router.put('/auth/perfil', exigirRol(), async (req, res) => {
  try {
    const { nombre, apellido, foto } = req.body || {};
    const cambios = {};

    if (typeof nombre === 'string' && nombre.trim()) {
      cambios.nombre = nombre.trim();
    }
    if (typeof apellido === 'string' && apellido.trim()) {
      cambios.apellido = apellido.trim();
    }
    if (foto !== undefined) {
      cambios.foto = foto;
    }

    const actualizado = await almacen.actualizar('usuarios', req.usuario.id, cambios);
    res.json({
      id: actualizado.id,
      nombre: actualizado.nombre,
      apellido: actualizado.apellido,
      correo: actualizado.correo,
      rol: actualizado.rol,
      foto: actualizado.foto || null
    });
  } catch (error) {
    res.status(error.estado || 500).json({ error: error.message || 'Error al actualizar perfil' });
  }
});

// 6. Cambiar contraseña
router.post('/auth/clave', exigirRol(), async (req, res) => {
  try {
    const { actual, nueva } = req.body || {};
    const usuarios = await almacen.leer('usuarios');
    const user = usuarios.find(u => u && u.id === req.usuario.id);

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const coincide = await bcrypt.compare(actual || '', user.claveHash || '');
    if (!coincide) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
    }

    if (!nueva || nueva.length < 8 || !/[a-zA-Z]/.test(nueva) || !/[0-9]/.test(nueva)) {
      return res.status(400).json({
        error: 'La nueva contraseña debe tener al menos 8 caracteres e incluir letras y números'
      });
    }

    const claveHash = await bcrypt.hash(nueva, 10);
    await almacen.actualizar('usuarios', user.id, { claveHash });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error al cambiar contraseña' });
  }
});

// 7. Restablecer contraseña por admin
router.post('/admin/usuarios/:id/restablecer', exigirRol('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const usuarios = await almacen.leer('usuarios');
    const user = usuarios.find(u => u && u.id === id);

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const claveTemporal = generarClaveTemporal(10);
    const claveHash = await bcrypt.hash(claveTemporal, 10);
    await almacen.actualizar('usuarios', user.id, { claveHash });

    res.json({ claveTemporal });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error al restablecer contraseña' });
  }
});

// 8. Registro de eventos en bitácora
router.post('/eventos', async (req, res) => {
  try {
    const { tipo, recurso } = req.body || {};

    if (!tipo || !recurso) {
      return res.status(400).json({ error: 'Tipo y recurso son obligatorios' });
    }

    await almacen.anexarLinea('bitacora.jsonl', {
      usuarioId: req.usuario ? req.usuario.id : null,
      tipo,
      recurso,
      fecha: new Date().toISOString()
    });

    res.status(201).json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error al registrar evento' });
  }
});

export default router;
