import { leerConfig } from './almacen.js';

export async function puede(usuario, accion, col, registro = null) {
  const permisos = await leerConfig('permisos');
  if (!permisos || typeof permisos !== 'object' || !permisos[col]) {
    return false;
  }

  const reglas = permisos[col][accion];
  if (!Array.isArray(reglas) || reglas.length === 0) {
    return false;
  }

  for (const regla of reglas) {
    if (regla === 'servidor') {
      // "servidor" nunca se permite desde la API
      continue;
    }
    if (regla === 'publico') {
      return true;
    }
    if (!usuario) {
      continue;
    }
    if (regla === 'sesion') {
      return true;
    }
    if (regla === usuario.rol) {
      return true;
    }
    if (regla === 'propio') {
      if (!registro) {
        return true;
      }
      if (registro.usuarioId && registro.usuarioId === usuario.id) {
        return true;
      }
      if (col === 'usuarios' && registro.id === usuario.id) {
        return true;
      }
    }
  }

  return false;
}

export default { puede };
