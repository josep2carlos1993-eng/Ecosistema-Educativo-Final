// servidor/rutas/resumen.js · Rutas para resúmenes de progreso de estudiantes y grupos
import { Router } from 'express';
import almacen from '../almacen.js';

const router = Router();

/**
 * Calcula el promedio formativo (escala de 0 a 10) con 1 decimal,
 * excluyendo actividades de tipo "tema-revisado".
 * @param {Array} intentosLista
 * @returns {number}
 */
export function calcularPromedio(intentosLista) {
  const validos = (intentosLista || []).filter(i =>
    i &&
    i.actividad !== 'tema-revisado' &&
    typeof i.puntaje === 'number' &&
    typeof i.maximo === 'number' &&
    !isNaN(i.puntaje) &&
    !isNaN(i.maximo) &&
    i.maximo > 0
  );

  if (validos.length === 0) return 0;
  const suma = validos.reduce((acc, i) => acc + (Number(i.puntaje) / Number(i.maximo)) * 10, 0);
  return Math.round((suma / validos.length) * 10) / 10;
}

/**
 * Devuelve la semana ISO en formato YYYY-Www para una fecha dada.
 * @param {string|Date} fechaStr
 * @returns {string|null}
 */
export function obtenerSemana(fechaStr) {
  const d = new Date(fechaStr);
  if (isNaN(d.getTime())) return null;

  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7; // Lunes = 0
  target.setUTCDate(target.getUTCDate() - dayNr + 3); // Jueves más cercano
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  const weekNr = 1 + Math.ceil((firstThursday - target) / 604800000);
  const year = new Date(firstThursday).getUTCFullYear();
  return `${year}-W${String(weekNr).padStart(2, '0')}`;
}

/**
 * Construye un mapa de la última conexión para cada usuario a partir de bitacora.jsonl.
 * @param {Array} bitacora
 * @returns {Map<string, string>}
 */
function construirMapaUltimaConexion(bitacora) {
  const mapa = new Map();
  for (const reg of bitacora) {
    if (reg && reg.usuarioId && reg.fecha) {
      mapa.set(reg.usuarioId, reg.fecha);
    }
  }
  return mapa;
}

// GET /api/resumen/estudiante/:id
router.get('/resumen/estudiante/:id', async (req, res) => {
  if (!req.usuario) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const targetId = req.params.id === 'yo' ? req.usuario.id : req.params.id;

  try {
    // Lectura única de cada colección y de bitacora.jsonl
    const [
      usuarios,
      distributivo,
      asignaturas,
      unidades,
      temas,
      progresoTemas,
      intentos,
      logros,
      bitacora
    ] = await Promise.all([
      almacen.leer('usuarios'),
      almacen.leer('distributivo'),
      almacen.leer('asignaturas'),
      almacen.leer('unidades'),
      almacen.leer('temas'),
      almacen.leer('progreso-temas'),
      almacen.leer('intentos'),
      almacen.leer('logros'),
      almacen.leerLineas('bitacora.jsonl')
    ]);

    // Verificación de acceso: propio estudiante, docente de sus grupos o admin
    let autorizado = false;
    if (req.usuario.rol === 'admin' || req.usuario.id === targetId) {
      autorizado = true;
    } else if (req.usuario.rol === 'docente') {
      const gruposDocente = distributivo.filter(g => g && g.docenteId === req.usuario.id);
      autorizado = gruposDocente.some(g => Array.isArray(g.estudiantes) && g.estudiantes.includes(targetId));
    }

    if (!autorizado) {
      return res.status(403).json({ error: 'Acceso no autorizado al resumen del estudiante' });
    }

    const usuarioTarget = usuarios.find(u => u && u.id === targetId);
    if (!usuarioTarget && targetId !== req.usuario.id) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    // 1. Puntos y nivelQuizMax desde logros
    const logro = logros.find(l => l && l.usuarioId === targetId);
    const puntos = logro?.puntos || 0;
    const niveles = Object.values(logro?.nivelQuiz || {}).map(Number).filter(n => !isNaN(n));
    const nivelQuizMax = niveles.length > 0 ? Math.max(...niveles) : 0;

    // 2. Temas publicados del estudiante y pendientes
    const gruposEstudiante = distributivo.filter(
      g => g && Array.isArray(g.estudiantes) && g.estudiantes.includes(targetId)
    );
    const idsAsignaturas = new Set(gruposEstudiante.map(g => g.asignaturaId).filter(Boolean));
    const unidadesEstudiante = unidades.filter(
      u => u && idsAsignaturas.has(u.asignaturaId) && u.visible !== false
    );
    const idsUnidades = new Set(unidadesEstudiante.map(u => u.id));
    let temasPublicados = temas.filter(
      t => t && idsUnidades.has(t.unidadId) && t.estado === 'publicado'
    );

    // Si no tiene asignaturas/grupos vinculados (o rol admin), usar todos los temas publicados
    if (temasPublicados.length === 0 && (idsAsignaturas.size === 0 || req.usuario.rol === 'admin')) {
      temasPublicados = temas.filter(t => t && t.estado === 'publicado');
    }

    const revisadosSet = new Set(
      progresoTemas.filter(p => p && p.usuarioId === targetId).map(p => p.temaId)
    );
    const revisadosCount = temasPublicados.filter(t => revisadosSet.has(t.id)).length;
    const pctTemas = temasPublicados.length > 0
      ? Math.round((revisadosCount / temasPublicados.length) * 100)
      : 0;

    const pendientes = temasPublicados
      .filter(t => !revisadosSet.has(t.id))
      .map(t => ({ temaId: t.id, titulo: t.titulo }));

    // 3. Intentos del estudiante y cálculo de promedios
    const intentosEstudiante = intentos.filter(i => i && i.usuarioId === targetId);
    const promedio = calcularPromedio(intentosEstudiante);

    // porActividad: [{ actividad, promedio, intentos }]
    const actividadesMap = new Map();
    for (const i of intentosEstudiante) {
      if (!i || i.actividad === 'tema-revisado' || !i.actividad) continue;
      if (!actividadesMap.has(i.actividad)) {
        actividadesMap.set(i.actividad, []);
      }
      actividadesMap.get(i.actividad).push(i);
    }
    const porActividad = Array.from(actividadesMap.entries()).map(([actividad, lista]) => ({
      actividad,
      promedio: calcularPromedio(lista),
      intentos: lista.length
    }));

    // porTema: [{ temaId, titulo, promedio, intentos }]
    const temasMap = new Map();
    for (const i of intentosEstudiante) {
      if (!i || i.actividad === 'tema-revisado' || !i.temaId) continue;
      if (!temasMap.has(i.temaId)) {
        temasMap.set(i.temaId, []);
      }
      temasMap.get(i.temaId).push(i);
    }
    const porTema = Array.from(temasMap.entries()).map(([temaId, lista]) => {
      const tema = temas.find(t => t && t.id === temaId);
      return {
        temaId,
        titulo: tema?.titulo || 'Tema desconocido',
        promedio: calcularPromedio(lista),
        intentos: lista.length
      };
    });

    // evolucion: [{ semana, promedio }] (últimas 8 semanas con datos)
    const semanasMap = new Map();
    for (const i of intentosEstudiante) {
      if (!i || i.actividad === 'tema-revisado' || !i.fecha) continue;
      const semana = obtenerSemana(i.fecha);
      if (!semana) continue;
      if (!semanasMap.has(semana)) {
        semanasMap.set(semana, []);
      }
      semanasMap.get(semana).push(i);
    }
    const semanasOrdenadas = Array.from(semanasMap.keys()).sort();
    const ultimasSemanas = semanasOrdenadas.slice(-8);
    const evolucion = ultimasSemanas.map(semana => ({
      semana,
      promedio: calcularPromedio(semanasMap.get(semana))
    }));

    // 4. Última conexión
    const mapaConexiones = construirMapaUltimaConexion(bitacora);
    const ultimaConexion = mapaConexiones.get(targetId) || null;

    // 5. Tiempo total en minutos
    const totalSegundos = intentosEstudiante.reduce((acc, i) => acc + (Number(i.duracionSeg) || 0), 0);
    const tiempoMin = Math.round(totalSegundos / 60);

    // 6. Últimos intentos (20)
    const ultimosIntentos = [...intentosEstudiante]
      .sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime())
      .slice(0, 20);

    return res.json({
      puntos,
      nivelQuizMax,
      pctTemas,
      promedio,
      porActividad,
      porTema,
      evolucion,
      pendientes,
      ultimaConexion,
      tiempoMin,
      ultimosIntentos
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Error al obtener resumen del estudiante' });
  }
});

// GET /api/resumen/grupo/:grupoId
router.get('/resumen/grupo/:grupoId', async (req, res) => {
  if (!req.usuario) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    // Lectura única de cada colección y de bitacora.jsonl
    const [
      usuarios,
      distributivo,
      asignaturas,
      unidades,
      temas,
      progresoTemas,
      intentos,
      alertas,
      bitacora
    ] = await Promise.all([
      almacen.leer('usuarios'),
      almacen.leer('distributivo'),
      almacen.leer('asignaturas'),
      almacen.leer('unidades'),
      almacen.leer('temas'),
      almacen.leer('progreso-temas'),
      almacen.leer('intentos'),
      almacen.leer('alertas'),
      almacen.leerLineas('bitacora.jsonl')
    ]);

    const grupo = distributivo.find(g => g && g.id === req.params.grupoId);
    if (!grupo) {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }

    const autorizado =
      req.usuario.rol === 'admin' ||
      (req.usuario.rol === 'docente' && grupo.docenteId === req.usuario.id);

    if (!autorizado) {
      return res.status(403).json({ error: 'Acceso no autorizado al resumen del grupo' });
    }

    // Temas publicados de la asignatura correspondiente al grupo
    const unidadesGrupo = unidades.filter(
      u => u && u.asignaturaId === grupo.asignaturaId && u.visible !== false
    );
    const idsUnidadesGrupo = new Set(unidadesGrupo.map(u => u.id));
    const temasGrupo = temas.filter(
      t => t && idsUnidadesGrupo.has(t.unidadId) && t.estado === 'publicado'
    );

    const estudiantesIds = Array.isArray(grupo.estudiantes) ? grupo.estudiantes : [];
    const estudiantesSet = new Set(estudiantesIds);

    const mapaConexiones = construirMapaUltimaConexion(bitacora);
    const intentosGrupo = intentos.filter(i => i && estudiantesSet.has(i.usuarioId));

    // Estudiantes: [{ id, nombre, apellido, promedio, actividades, pctTemas, ultimaConexion, alertasActivas }]
    const estudiantesResumen = estudiantesIds.map(estId => {
      const u = usuarios.find(usr => usr && usr.id === estId);
      const nombre = u?.nombre || 'Estudiante';
      const apellido = u?.apellido || '';

      const intentosEst = intentosGrupo.filter(i => i.usuarioId === estId);
      const promedio = calcularPromedio(intentosEst);
      const actividades = intentosEst.filter(i => i.actividad !== 'tema-revisado').length;

      const revisadosEst = new Set(
        progresoTemas.filter(p => p && p.usuarioId === estId).map(p => p.temaId)
      );
      const revisadosCount = temasGrupo.filter(t => revisadosEst.has(t.id)).length;
      const pctTemas = temasGrupo.length > 0
        ? Math.round((revisadosCount / temasGrupo.length) * 100)
        : 0;

      const ultimaConexion = mapaConexiones.get(estId) || null;

      const alertasActivas = alertas.filter(
        a => a && a.estudianteId === estId && a.estado === 'activa' && (!a.grupoId || a.grupoId === grupo.id)
      ).length;

      return {
        id: estId,
        nombre,
        apellido,
        promedio,
        actividades,
        pctTemas,
        ultimaConexion,
        alertasActivas
      };
    });

    // porTema: [{ temaId, titulo, promedio, intentos }]
    const temasMap = new Map();
    for (const t of temasGrupo) {
      temasMap.set(t.id, t.titulo);
    }
    for (const i of intentosGrupo) {
      if (i.temaId && !temasMap.has(i.temaId)) {
        const t = temas.find(tema => tema && tema.id === i.temaId);
        temasMap.set(i.temaId, t?.titulo || 'Tema desconocido');
      }
    }

    const porTema = Array.from(temasMap.entries()).map(([temaId, titulo]) => {
      const intentosTema = intentosGrupo.filter(
        i => i.temaId === temaId && i.actividad !== 'tema-revisado'
      );
      return {
        temaId,
        titulo,
        promedio: calcularPromedio(intentosTema),
        intentos: intentosTema.length
      };
    });

    return res.json({
      grupo,
      estudiantes: estudiantesResumen,
      porTema
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Error al obtener resumen del grupo' });
  }
});

export default router;

