import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DIR_GANCHOS = path.resolve('servidor', 'ganchos');
const ganchosPorColeccion = new Map();

export async function cargarGanchos() {
  ganchosPorColeccion.clear();
  try {
    const archivos = await fs.readdir(DIR_GANCHOS);
    for (const archivo of archivos) {
      if (archivo.endsWith('.js') && !archivo.startsWith('.')) {
        const col = archivo.slice(0, -3);
        const rutaCompleta = path.join(DIR_GANCHOS, archivo);
        const modulo = await import(pathToFileURL(rutaCompleta).href);
        ganchosPorColeccion.set(col, modulo.default || modulo);
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error al cargar ganchos:', error);
    }
  }
}

await cargarGanchos();

export async function aplicar(col, nombre, ...args) {
  const gancho = ganchosPorColeccion.get(col);
  if (!gancho || typeof gancho[nombre] !== 'function') {
    return args[0];
  }
  const res = await gancho[nombre](...args);
  return res !== undefined ? res : args[0];
}

export default {
  aplicar,
  cargarGanchos
};
