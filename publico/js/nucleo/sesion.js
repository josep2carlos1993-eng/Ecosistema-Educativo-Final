// publico/js/nucleo/sesion.js · Gestión de sesiones en el navegador
import { llamar } from './api.js';
import { aviso } from './ui.js';

export function token() {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem('token');
}

export function usuarioActual() {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem('usuario');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function iniciar(correo, clave) {
  const res = await llamar('POST', '/api/auth/login', { correo, clave });
  if (res && res.token && res.usuario) {
    sessionStorage.setItem('token', res.token);
    sessionStorage.setItem('usuario', JSON.stringify(res.usuario));
  }
  return res;
}

export async function registrar(datos) {
  const res = await llamar('POST', '/api/auth/registro', datos);
  if (datos && datos.correo && datos.clave) {
    await iniciar(datos.correo, datos.clave);
  }
  return res;
}

export async function cerrar() {
  try {
    await llamar('POST', '/api/auth/logout');
  } catch (err) {
    console.warn('Error al cerrar sesión:', err);
  } finally {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('usuario');
    }
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = '/paginas/ingreso.html';
    }
  }
}

export function exigirRol(roles) {
  if (!roles) return true;
  const lista = Array.isArray(roles) ? roles : [roles];
  if (lista.length === 0 || lista.includes('publico')) {
    return true;
  }

  const usuario = usuarioActual();
  if (!usuario) {
    if (typeof window !== 'undefined' && window.location) {
      if (!window.location.pathname.endsWith('ingreso.html')) {
        window.location.href = '/paginas/ingreso.html';
      }
    }
    return false;
  }

  if (lista.includes('sesion') || lista.includes(usuario.rol)) {
    return true;
  }

  // Rol no permitido
  if (typeof window !== 'undefined' && window.location) {
    sessionStorage.setItem(
      'aviso_pendiente',
      JSON.stringify({ texto: 'No tienes permisos para acceder a esta página.', tipo: 'error' })
    );
    if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
      window.location.href = '/index.html';
    } else {
      aviso('No tienes permisos para acceder a esta página.', 'error');
    }
  }
  return false;
}

export default {
  token,
  usuarioActual,
  iniciar,
  registrar,
  cerrar,
  exigirRol
};
