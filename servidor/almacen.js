import fs from 'node:fs/promises';
import path from 'node:path';

const DIR_DATOS = path.resolve('datos');
const RE_COL = /^[a-z0-9-]+(?:\/[a-z0-9_-]+)?$/;

const colasEscritura = new Map();
let fechaUltimoRespaldo = null;

function validarCol(col) {
  if (typeof col !== 'string' || !RE_COL.test(col)) {
    const err = new Error(`Nombre de colección inválido: ${col}`);
    err.estado = 400;
    throw err;
  }
}

function rutaColeccion(col) {
  validarCol(col);
  return path.join(DIR_DATOS, `${col}.json`);
}

function encolarEscritura(ruta, operacion) {
  const colaActual = colasEscritura.get(ruta) || Promise.resolve();
  const siguiente = colaActual.then(operacion, operacion);
  colasEscritura.set(ruta, siguiente);
  return siguiente;
}

async function escribirArchivoSeguro(ruta, contenido) {
  await fs.mkdir(path.dirname(ruta), { recursive: true });
  const rutaTmp = `${ruta}.${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`;
  await fs.writeFile(rutaTmp, contenido, 'utf-8');
  await fs.rename(rutaTmp, ruta);
}

async function verificarRespaldoDiario() {
  const hoy = new Date().toISOString().slice(0, 10);
  if (fechaUltimoRespaldo === hoy) return;

  const dirRespaldos = path.join(DIR_DATOS, 'respaldos');
  const dirDestino = path.join(dirRespaldos, hoy);

  try {
    await fs.access(dirDestino);
    fechaUltimoRespaldo = hoy;
    return;
  } catch {
    // Si no existe, procedemos a crearlo
  }

  try {
    await fs.mkdir(dirDestino, { recursive: true });

    // Copiar contenidos de datos/ (sin incluir respaldos/)
    const elementos = await fs.readdir(DIR_DATOS, { withFileTypes: true }).catch(() => []);
    for (const el of elementos) {
      if (el.name === 'respaldos') continue;
      const origen = path.join(DIR_DATOS, el.name);
      const destino = path.join(dirDestino, el.name);
      await fs.cp(origen, destino, { recursive: true });
    }

    // Conservar los 14 más recientes
    const respaldos = await fs.readdir(dirRespaldos).catch(() => []);
    const fechas = respaldos
      .filter(nombre => /^\d{4}-\d{2}-\d{2}$/.test(nombre))
      .sort();

    if (fechas.length > 14) {
      const aEliminar = fechas.slice(0, fechas.length - 14);
      for (const antigua of aEliminar) {
        await fs.rm(path.join(dirRespaldos, antigua), { recursive: true, force: true });
      }
    }

    fechaUltimoRespaldo = hoy;
  } catch (error) {
    console.error('Error al realizar respaldo diario:', error);
  }
}

export function prefijoId(col) {
  const base = col.split('/')[0];
  const letras = base.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 3);
  return letras.padEnd(3, 'x');
}

export function siguienteId(col, lista) {
  const prefijo = prefijoId(col);
  const regex = new RegExp(`^${prefijo}_(\\d{6})$`);
  let max = 0;
  for (const reg of lista) {
    if (reg && typeof reg.id === 'string') {
      const m = reg.id.match(regex);
      if (m) {
        const num = parseInt(m[1], 10);
        if (num > max) max = num;
      }
    }
  }
  return `${prefijo}_${String(max + 1).padStart(6, '0')}`;
}

export async function leer(col) {
  const ruta = rutaColeccion(col);
  try {
    const raw = await fs.readFile(ruta, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function escribir(col, lista) {
  const ruta = rutaColeccion(col);
  await verificarRespaldoDiario();
  return encolarEscritura(ruta, async () => {
    const contenido = JSON.stringify(lista, null, 2);
    await escribirArchivoSeguro(ruta, contenido);
  });
}

export async function agregar(col, reg) {
  const lista = await leer(col);
  const nuevo = {
    ...reg,
    id: siguienteId(col, lista),
    fecha: new Date().toISOString()
  };
  lista.push(nuevo);
  await escribir(col, lista);
  return nuevo;
}

export async function actualizar(col, id, cambios) {
  const lista = await leer(col);
  const indice = lista.findIndex(r => r && r.id === id);
  if (indice === -1) {
    const err = new Error('Registro no encontrado');
    err.estado = 404;
    throw err;
  }
  const actualizado = {
    ...lista[indice],
    ...cambios,
    id // id nunca cambia
  };
  lista[indice] = actualizado;
  await escribir(col, lista);
  return actualizado;
}

export async function eliminar(col, id) {
  const lista = await leer(col);
  const filtrada = lista.filter(r => !r || r.id !== id);
  await escribir(col, filtrada);
  return true;
}

export async function buscar(col, filtro = {}) {
  const lista = await leer(col);
  const claves = Object.keys(filtro);
  if (claves.length === 0) return lista;

  return lista.filter(item => {
    if (!item) return false;
    return claves.every(k => String(item[k]) === String(filtro[k]));
  });
}

export async function anexarLinea(archivo, obj) {
  const ruta = path.isAbsolute(archivo)
    ? archivo
    : path.join(DIR_DATOS, archivo.replace(/^datos[\\/]/, ''));

  await verificarRespaldoDiario();
  return encolarEscritura(ruta, async () => {
    await fs.mkdir(path.dirname(ruta), { recursive: true });
    const linea = JSON.stringify(obj) + '\n';
    await fs.appendFile(ruta, linea, 'utf-8');
  });
}

export async function leerLineas(archivo) {
  const ruta = path.isAbsolute(archivo)
    ? archivo
    : path.join(DIR_DATOS, archivo.replace(/^datos[\\/]/, ''));

  try {
    const raw = await fs.readFile(ruta, 'utf-8');
    return raw
      .split('\n')
      .map(linea => linea.trim())
      .filter(Boolean)
      .map(linea => JSON.parse(linea));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function leerConfig(nombre) {
  const archivo = nombre.endsWith('.json') ? nombre : `${nombre}.json`;
  const ruta = path.join(DIR_DATOS, 'config', archivo);
  try {
    const raw = await fs.readFile(ruta, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

export async function escribirConfig(nombre, obj) {
  const archivo = nombre.endsWith('.json') ? nombre : `${nombre}.json`;
  const ruta = path.join(DIR_DATOS, 'config', archivo);
  await verificarRespaldoDiario();
  return encolarEscritura(ruta, async () => {
    const contenido = JSON.stringify(obj, null, 2);
    await escribirArchivoSeguro(ruta, contenido);
  });
}

export default {
  leer,
  escribir,
  agregar,
  actualizar,
  eliminar,
  buscar,
  anexarLinea,
  leerLineas,
  leerConfig,
  escribirConfig
};
