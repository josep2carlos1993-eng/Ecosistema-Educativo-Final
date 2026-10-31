// servidor/auth.js · Middleware de autenticación, control de roles y limpieza de sesiones

import almacen from './almacen.js';

// Limpieza de sesiones vencidas al cargarse el módulo
try {
  const sesiones = await almacen.leer('sesiones');
  const ahora = new Date().toISOString();
  const activas = sesiones.filter(s => s && s.expira && s.expira > ahora);
  if (activas.length !== sesiones.length) {
    await almacen.escribir('sesiones', activas);
  }
} catch (error) {
  console.error('Error al depurar sesiones vencidas:', error);
}

export async function cargarUsuario(req, res, next) {
  req.usuario = null;
  const cabeceraAuth = req.headers['authorization'];

  if (!cabeceraAuth || !cabeceraAuth.startsWith('Bearer ')) {
    return next();
  }

  const token = cabeceraAuth.slice(7).trim();
  if (!token) {
    return next();
  }

  try {
    const sesiones = await almacen.leer('sesiones');
    const ahora = new Date().toISOString();
    const sesion = sesiones.find(s => s && s.token === token);

    if (!sesion || !sesion.expira || sesion.expira <= ahora) {
      return next();
    }

    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find(u => u && u.id === sesion.usuarioId && u.activo);

    if (usuario) {
      req.usuario = {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        rol: usuario.rol
      };
    }
  } catch (error) {
    console.error('Error en cargarUsuario:', error);
  }

  next();
}

export function exigirRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Sesión no iniciada o token inválido' });
    }

    if (roles.length > 0 && !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'Acceso no autorizado para su rol' });
    }

    next();
  };
}

export default {
  cargarUsuario,
  exigirRol
};
