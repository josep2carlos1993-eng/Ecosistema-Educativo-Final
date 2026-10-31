// servidor/gamificacion.js · Motor de gamificación y procesamiento de intentos
import almacen from './almacen.js';
import { asignaturaDeTema, asignaturasDe } from './acceso.js';

// Registro en memoria de intentos por usuario en la última hora: Map<usuarioId, number[]>
const intentosRecientes = new Map();

function extraerValor(obj, ruta) {
  if (!obj || !ruta) return undefined;
  const partes = ruta.split('.');
  let actual = obj;
  for (const parte of partes) {
    if (actual == null) return undefined;
    actual = actual[parte];
  }
  return actual;
}

export async function procesarIntento(usuario, datos) {
  if (!usuario || !usuario.id) {
    const error = new Error('No autenticado');
    error.estado = 401;
    throw error;
  }

  if (!datos || typeof datos !== 'object') {
    const error = new Error('Datos del intento no proporcionados');
    error.estado = 400;
    throw error;
  }

  const reglas = await almacen.leerConfig('reglas-gamificacion');
  if (!reglas || !reglas.puntos) {
    const error = new Error('Configuración de gamificación no disponible');
    error.estado = 500;
    throw error;
  }

  const actividad = datos.actividad;
  if (!actividad || typeof reglas.puntos[actividad] !== 'number') {
    const error = new Error(`Actividad "${actividad}" no válida o no registrada en las reglas`);
    error.estado = 400;
    throw error;
  }

  const puntaje = Number(datos.puntaje);
  const maximo = Number(datos.maximo);

  if (isNaN(puntaje) || isNaN(maximo) || maximo <= 0 || puntaje < 0 || puntaje > maximo) {
    const error = new Error('Puntaje o máximo inválido: debe cumplirse 0 ≤ puntaje ≤ máximo y máximo > 0');
    error.estado = 400;
    throw error;
  }

  // Validación de acceso al tema si viene temaId
  if (datos.temaId) {
    const asignatura = await asignaturaDeTema(datos.temaId);
    if (!asignatura) {
      const error = new Error('Tema no encontrado');
      error.estado = 404;
      throw error;
    }

    if (usuario.rol !== 'admin') {
      const asignaturasPermitidas = await asignaturasDe(usuario);
      const tieneAcceso = asignaturasPermitidas.some(a => a && a.id === asignatura.id);
      if (!tieneAcceso) {
        const error = new Error('No tienes acceso al tema especificado');
        error.estado = 403;
        throw error;
      }
    }
  }

  // Límite de intentos por hora (en memoria)
  const ahora = Date.now();
  const limiteHora = reglas.limiteIntentosHora || 30;
  const ventanaHora = 60 * 60 * 1000;

  const timestampsPrevios = intentosRecientes.get(usuario.id) || [];
  const timestampsFiltrados = timestampsPrevios.filter(t => ahora - t < ventanaHora);

  if (timestampsFiltrados.length >= limiteHora) {
    const error = new Error('Has superado el límite de intentos permitidos por hora');
    error.estado = 429;
    throw error;
  }

  timestampsFiltrados.push(ahora);
  intentosRecientes.set(usuario.id, timestampsFiltrados);

  // Cálculo de puntos base y bono
  const puntosBase = Math.round((reglas.puntos[actividad] * puntaje) / maximo);
  const bonoSinErrores = (datos.errores === 0 && puntaje === maximo) ? (reglas.bonoSinErrores || 0) : 0;
  let puntosOtorgados = puntosBase + bonoSinErrores;

  // Condiciones para asignar 0 puntos
  const todosLosIntentos = await almacen.leer('intentos');
  const intentosUsuario = todosLosIntentos.filter(i => i && i.usuarioId === usuario.id);

  // 1. Actividad única con clave ya registrada con puntos
  if (reglas.unicas && Array.isArray(reglas.unicas[actividad])) {
    const camposClave = reglas.unicas[actividad];
    const claveActual = camposClave.map(c => String(extraerValor(datos, c) ?? '')).join('::');

    const yaCompletadaConPuntos = intentosUsuario.some(i => {
      if (i.actividad !== actividad || !(i.puntos > 0)) return false;
      const clavePrevia = camposClave.map(c => String(extraerValor(i, c) ?? '')).join('::');
      return clavePrevia === claveActual;
    });

    if (yaCompletadaConPuntos) {
      puntosOtorgados = 0;
    }
  }

  // 2. Requiere aprobación y detalle.aprobado !== true
  if (Array.isArray(reglas.requiereAprobado) && reglas.requiereAprobado.includes(actividad)) {
    if (!datos.detalle || datos.detalle.aprobado !== true) {
      puntosOtorgados = 0;
    }
  }

  // 3. Máximo diario de intentos con puntos
  if (reglas.maxDiario && typeof reglas.maxDiario[actividad] === 'number') {
    const hoyIso = new Date().toISOString().slice(0, 10);
    const intentosHoyConPuntos = intentosUsuario.filter(i => {
      return i.actividad === actividad &&
        i.puntos > 0 &&
        i.fecha &&
        i.fecha.slice(0, 10) === hoyIso;
    }).length;

    if (intentosHoyConPuntos >= reglas.maxDiario[actividad]) {
      puntosOtorgados = 0;
    }
  }

  // Guardar el intento
  const nuevoIntento = {
    usuarioId: usuario.id,
    actividad,
    temaId: datos.temaId ? String(datos.temaId) : null,
    nivel: typeof datos.nivel === 'number' ? datos.nivel : 1,
    puntaje,
    maximo,
    errores: typeof datos.errores === 'number' ? datos.errores : 0,
    duracionSeg: typeof datos.duracionSeg === 'number' ? datos.duracionSeg : 0,
    detalle: datos.detalle || null,
    puntos: puntosOtorgados
  };

  const intentoGuardado = await almacen.agregar('intentos', nuevoIntento);

  // Actualizar o crear logros del usuario
  const listaLogros = await almacen.leer('logros');
  let logrosUsuario = listaLogros.find(l => l && l.usuarioId === usuario.id);
  let esNuevoLogro = false;

  if (!logrosUsuario) {
    esNuevoLogro = true;
    logrosUsuario = {
      usuarioId: usuario.id,
      puntos: 0,
      insignias: [],
      nivelQuiz: {}
    };
  }

  if (!Array.isArray(logrosUsuario.insignias)) logrosUsuario.insignias = [];
  if (!logrosUsuario.nivelQuiz || typeof logrosUsuario.nivelQuiz !== 'object') logrosUsuario.nivelQuiz = {};

  logrosUsuario.puntos = (logrosUsuario.puntos || 0) + puntosOtorgados;

  // Actualizar nivel de quiz si corresponde
  if (actividad === 'quiz' && datos.temaId && typeof datos.nivel === 'number') {
    const aprobado = datos.detalle && datos.detalle.aprobado === true;
    if (aprobado || puntaje === maximo) {
      const nivelPrevio = logrosUsuario.nivelQuiz[datos.temaId] || 0;
      if (datos.nivel > nivelPrevio) {
        logrosUsuario.nivelQuiz[datos.temaId] = datos.nivel;
      }
    }
  }

  // Evaluar insignias no obtenidas
  const listaInsignias = await almacen.leer('insignias');
  const obtenidasIds = new Set(logrosUsuario.insignias.map(i => i.id));
  const noObtenidas = listaInsignias.filter(i => i && !obtenidasIds.has(i.id));

  const historialCompleto = [...intentosUsuario, intentoGuardado];
  const insigniasNuevas = [];

  for (const ins of noObtenidas) {
    const condicion = ins.condicion;
    if (!condicion || !condicion.tipo) continue;

    let cumple = false;

    switch (condicion.tipo) {
      case 'conteo': {
        const act = condicion.actividad;
        const minimo = condicion.minimo || 1;
        if (reglas.unicas && Array.isArray(reglas.unicas[act])) {
          const campos = reglas.unicas[act];
          const claves = new Set();
          for (const it of historialCompleto) {
            if (it.actividad === act) {
              const k = campos.map(c => String(extraerValor(it, c) ?? '')).join('::');
              claves.add(k);
            }
          }
          cumple = claves.size >= minimo;
        } else {
          const total = historialCompleto.filter(it => it.actividad === act).length;
          cumple = total >= minimo;
        }
        break;
      }

      case 'sinErrores': {
        const act = condicion.actividad;
        cumple = historialCompleto.some(it => it.actividad === act && it.errores === 0);
        break;
      }

      case 'puntos': {
        const minimo = condicion.minimo || 0;
        cumple = logrosUsuario.puntos >= minimo;
        break;
      }

      case 'nivelQuiz': {
        const nivelMinimo = condicion.nivel || 1;
        cumple = Object.values(logrosUsuario.nivelQuiz).some(n => Number(n) >= nivelMinimo);
        break;
      }

      case 'racha': {
        const diasMinimos = condicion.dias || 1;
        const diasConIntento = new Set(
          historialCompleto
            .filter(it => it.fecha)
            .map(it => new Date(it.fecha).toISOString().slice(0, 10))
        );

        let racha = 0;
        const fechaCursor = new Date();
        while (true) {
          const iso = fechaCursor.toISOString().slice(0, 10);
          if (diasConIntento.has(iso)) {
            racha++;
            fechaCursor.setUTCDate(fechaCursor.getUTCDate() - 1);
          } else {
            break;
          }
        }
        cumple = racha >= diasMinimos;
        break;
      }
    }

    if (cumple) {
      const fechaOtorgada = new Date().toISOString();
      logrosUsuario.insignias.push({
        id: ins.id,
        fecha: fechaOtorgada
      });
      insigniasNuevas.push({
        id: ins.id,
        nombre: ins.nombre,
        icono: ins.icono
      });
    }
  }

  // Guardar logros
  if (esNuevoLogro) {
    await almacen.agregar('logros', logrosUsuario);
  } else {
    await almacen.actualizar('logros', logrosUsuario.id, logrosUsuario);
  }

  // Evaluar alertas en try/catch
  try {
    const moduloAlertas = await import('./alertas.js');
    const fnAlertas = moduloAlertas.evaluarAlertas || moduloAlertas.default?.evaluarAlertas;
    if (typeof fnAlertas === 'function') {
      await fnAlertas(intentoGuardado, usuario);
    }
  } catch (errorAlertas) {
    // Alerta no interrumpe el flujo de gamificación
  }

  return {
    puntosGanados: puntosOtorgados,
    puntosTotales: logrosUsuario.puntos,
    insigniasNuevas
  };
}

export default {
  procesarIntento
};
