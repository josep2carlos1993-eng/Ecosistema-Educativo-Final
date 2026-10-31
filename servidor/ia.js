// servidor/ia.js · Motor de ejecución de tareas de Inteligencia Artificial
import fs from 'node:fs/promises';
import path from 'node:path';
import almacen from './almacen.js';

const DIR_PROMPTS = path.resolve('servidor', 'prompts');

/**
 * Reemplaza las variables {{clave}} en una plantilla de texto.
 */
function compilarPlantilla(plantilla, datos = {}) {
  return plantilla.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, clave) => {
    return datos[clave] !== undefined ? String(datos[clave]) : '';
  });
}

/**
 * Genera preguntas formativas simuladas si no hay clave de IA configurada.
 */
function generarPreguntasSimuladas(datos) {
  const cantidad = Number(datos.cantidad) || 5;
  const tema = datos.tema || 'el tema';
  const preguntas = [];

  const tipos = ['opcion', 'vf', 'completar'];

  for (let i = 0; i < cantidad; i++) {
    const tipo = tipos[i % tipos.length];

    if (tipo === 'opcion') {
      preguntas.push({
        tipo: 'opcion',
        enunciado: `¿Cuál es una característica fundamental de ${tema} en el contexto estudiado?`,
        opciones: [
          `Representa una transformación estructural clave en ${tema}`,
          `Constituye un evento secundario sin mayor relevancia`,
          `Ocurrió exclusivamente fuera del territorio ecuatoriano`,
          `Fue descartado por las normativas de la época`
        ],
        correcta: 0,
        retroalimentacion: `Es correcta porque define el impacto formativo central de ${tema}.`
      });
    } else if (tipo === 'vf') {
      const esVerdadera = i % 2 === 0;
      preguntas.push({
        tipo: 'vf',
        enunciado: esVerdadera
          ? `Las reformas vinculadas a ${tema} consolidaron derechos fundamentales en el país.`
          : `${tema} no tuvo ningún impacto en el desarrollo social ecuatoriano.`,
        opciones: ['Verdadero', 'Falso'],
        correcta: esVerdadera,
        retroalimentacion: esVerdadera
          ? `Efectivamente, ${tema} sentó las bases institucionales y ciudadanas analizadas.`
          : `Es falso, puesto que ${tema} fue determinante en la historia nacional.`
      });
    } else {
      preguntas.push({
        tipo: 'completar',
        enunciado: `El principio formativo esencial de ${tema} se consolidó mediante la educación ____.`,
        opciones: [],
        correcta: 'laica',
        retroalimentacion: `La educación laica fue el pilar fundamental que transformó el pensamiento crítico en ${tema}.`
      });
    }
  }

  return preguntas;
}

/**
 * Genera una intervención socrática simulada de respaldo para el tutor.
 */
function generarRespuestaTutorSimulada(datos) {
  const asig = datos.asignatura || 'esta asignatura';
  return {
    respuesta: `¡Excelente iniciativa! Como tu tutor socrático en ${asig}, mi rol es guiarte para que descubras las ideas esenciales. Al reflexionar sobre este concepto, piensa en los antecedentes y en cómo se conectan los procesos que hemos revisado en clase.`,
    sugerencia: `¿Qué idea o hipótesis inicial tienes sobre este tema? Cuéntame con tus propias palabras y lo analizaremos juntos.`
  };
}

/**
 * Extrae y parsea JSON de una respuesta de texto de IA.
 */
function extraerJSON(texto) {
  if (!texto) return null;
  const limpio = texto.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim();
  try {
    return JSON.parse(limpio);
  } catch {
    const iniArr = limpio.indexOf('[');
    const finArr = limpio.lastIndexOf(']');
    if (iniArr !== -1 && finArr > iniArr) {
      return JSON.parse(limpio.slice(iniArr, finArr + 1));
    }
    const iniObj = limpio.indexOf('{');
    const finObj = limpio.lastIndexOf('}');
    if (iniObj !== -1 && finObj > iniObj) {
      return JSON.parse(limpio.slice(iniObj, finObj + 1));
    }
    throw new Error('La respuesta del modelo no contiene un formato JSON válido.');
  }
}

/**
 * Lista los modelos disponibles en la cuenta del usuario para generateContent.
 */
export async function listarModelosGemini(apiKey) {
  const clave = (apiKey || '').trim();
  if (!clave) return [];

  const versiones = ['v1beta', 'v1'];
  for (const v of versiones) {
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/${v}/models?key=${clave}`);
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data.models)) {
          const validos = data.models
            .filter(m => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent'))
            .map(m => {
              const id = m.name.replace(/^models\//, '');
              return {
                id,
                nombre: `${m.displayName || id} (${id})`,
                version: v
              };
            });
          if (validos.length > 0) return validos;
        }
      }
    } catch (e) {
      console.warn(`Error al listar modelos en ${v}:`, e.message);
    }
  }
  return [];
}

/**
 * Llama a la API de Google Gemini gestionando versiones (v1beta, v1) y nombres de modelos.
 */
export async function llamarGeminiAPI({ apiKey, modelo, contenidos, formato = 'json' }) {
  const clave = (apiKey || '').trim();
  if (!clave) throw new Error('No se ha configurado ninguna clave de API.');

  const modeloLimpio = (modelo || 'gemini-1.5-flash').replace(/^models\//, '').trim();

  // Si el usuario especificó una URL proxy completa
  if (modelo.startsWith('http')) {
    const resp = await fetch(`${modelo}?key=${clave}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: contenidos })
    });
    if (!resp.ok) {
      throw new Error(`Error en API proxy (${resp.status}): ${await resp.text()}`);
    }
    const data = await resp.json();
    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return formato === 'json' ? extraerJSON(texto) : texto;
  }

  // Rutas candidatas: probar v1beta primero y fallback a v1 si devuelve 404
  const versiones = ['v1beta', 'v1'];
  let ultimoError = null;

  for (const version of versiones) {
    const url = `https://generativelanguage.googleapis.com/${version}/models/${encodeURIComponent(modeloLimpio)}:generateContent?key=${clave}`;
    const cuerpo = {
      contents: contenidos,
      generationConfig: {
        temperature: 0.3
      }
    };

    if (formato === 'json' && version === 'v1beta') {
      cuerpo.generationConfig.responseMimeType = 'application/json';
    }

    try {
      const respuesta = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo)
      });

      if (respuesta.ok) {
        const data = await respuesta.json();
        const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return formato === 'json' ? extraerJSON(texto) : texto;
      }

      const txt = await respuesta.text();
      let msg = txt;
      try {
        const errObj = JSON.parse(txt);
        if (errObj?.error?.message) msg = errObj.error.message;
      } catch {}

      if (respuesta.status !== 404) {
        throw new Error(`Gemini (${respuesta.status}): ${msg}`);
      }
      ultimoError = new Error(`Gemini (404): ${msg}`);
    } catch (err) {
      if (!err.message?.includes('404')) {
        throw err;
      }
      ultimoError = err;
    }
  }

  // Si devolvió 404 en ambas versiones, consultar los modelos reales de la cuenta
  let sugerencias = '';
  try {
    const remotos = await listarModelosGemini(clave);
    if (remotos.length > 0) {
      sugerencias = ` Modelos disponibles en tu cuenta de Google: ${remotos.map(r => r.id).slice(0, 6).join(', ')}`;
    }
  } catch {}

  throw new Error(`${ultimoError?.message || 'Modelo no encontrado.'}.${sugerencias}`);
}

/**
 * Prueba la conexión directa con el proveedor de IA y el modelo seleccionado.
 */
export async function probarConexion({ apiKey, modelo = 'gemini-1.5-flash', proveedor = 'gemini' } = {}) {
  const clave = (apiKey || '').trim();
  if (!clave) {
    throw new Error('No se ha configurado ninguna clave de API.');
  }

  if (proveedor.includes('openai')) {
    const respuesta = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${clave}`
      },
      body: JSON.stringify({
        model: modelo,
        messages: [{ role: 'user', content: 'Responde solo "OK".' }],
        max_tokens: 5
      })
    });

    if (!respuesta.ok) {
      const txt = await respuesta.text();
      throw new Error(`OpenAI (${respuesta.status}): ${txt}`);
    }
    return { ok: true, modelo, proveedor: 'openai' };
  }

  // Gemini API
  const textoRespuesta = await llamarGeminiAPI({
    apiKey: clave,
    modelo,
    contenidos: [
      {
        role: 'user',
        parts: [{ text: 'Responde únicamente con la palabra "CONECTADO".' }]
      }
    ],
    formato: 'texto'
  });

  return { ok: true, modelo, respuesta: String(textoRespuesta).trim(), proveedor: 'gemini' };
}

export async function ejecutarTarea(tarea, datos, usuario, { formato = 'json' } = {}) {
  if (!usuario) {
    const error = new Error('No autenticado');
    error.estado = 401;
    throw error;
  }

  // Verificar límite diario y ajustes
  const ajustes = await almacen.leerConfig('ajustes');
  const limiteDiario = ajustes?.limiteIADiario ?? 30;

  try {
    const consumos = await almacen.leerLineas('consumo-ia.jsonl');
    const hoyStr = new Date().toISOString().slice(0, 10);
    const consumosHoy = consumos.filter(
      c => c && c.usuarioId === usuario.id && c.fecha && c.fecha.startsWith(hoyStr) && c.ok !== false
    );

    if (consumosHoy.length >= limiteDiario) {
      const error = new Error(`Límite diario de IA alcanzado (${limiteDiario} consultas al día)`);
      error.estado = 429;
      throw error;
    }
  } catch (err) {
    if (err.estado === 429) throw err;
  }

  // Leer y compilar el prompt
  const rutaPrompt = path.join(DIR_PROMPTS, `${tarea}.txt`);
  let plantilla = '';
  try {
    plantilla = await fs.readFile(rutaPrompt, 'utf-8');
  } catch {
    const error = new Error(`Prompt para la tarea "${tarea}" no encontrado`);
    error.estado = 404;
    throw error;
  }

  const promptCompleto = compilarPlantilla(plantilla, datos);
  const partes = promptCompleto.split('### USUARIO');
  const sistema = partes[0].trim();
  const promptUsuario = (partes[1] || '').trim();

  // Leer configuración desde ajustes.json (prioridad) o variables de entorno
  const apiKey = (ajustes?.iaClave || process.env.IA_CLAVE || '').trim();
  const proveedor = (ajustes?.iaProveedor || process.env.IA_PROVEEDOR || 'gemini').trim().toLowerCase();
  const modelo = (ajustes?.iaModelo || process.env.IA_MODELO || 'gemini-1.5-flash').trim();

  let resultado = null;

  if (apiKey && apiKey.length > 0) {
    try {
      if (proveedor.includes('openai')) {
        const respuesta = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: modelo,
            messages: [
              { role: 'system', content: sistema },
              { role: 'user', content: promptUsuario }
            ],
            temperature: 0.3
          })
        });

        if (!respuesta.ok) {
          throw new Error(`Error en API de IA (${respuesta.status}): ${await respuesta.text()}`);
        }

        const data = await respuesta.json();
        const texto = data.choices?.[0]?.message?.content || '';
        resultado = formato === 'json' ? extraerJSON(texto) : texto;
      } else {
        // Gemini API con fallback inteligente
        resultado = await llamarGeminiAPI({
          apiKey,
          modelo,
          contenidos: [
            {
              role: 'user',
              parts: [{ text: `${sistema}\n\n${promptUsuario}` }]
            }
          ],
          formato
        });
      }
    } catch (apiErr) {
      console.warn('Fallo llamada IA en vivo, usando generador didáctico de respaldo:', apiErr.message);
      if (tarea === 'generar-preguntas') {
        resultado = generarPreguntasSimuladas(datos);
      } else if (tarea === 'tutor') {
        resultado = generarRespuestaTutorSimulada(datos);
      } else {
        throw apiErr;
      }
    }
  } else {
    // Si no hay API key configurada en entorno local, usar generador didáctico estructurado
    if (tarea === 'generar-preguntas') {
      resultado = generarPreguntasSimuladas(datos);
    } else if (tarea === 'tutor') {
      resultado = generarRespuestaTutorSimulada(datos);
    } else {
      resultado = [];
    }
  }

  // Anexar registro en bitácora consumo-ia.jsonl
  try {
    await almacen.anexarLinea('consumo-ia.jsonl', {
      usuarioId: usuario.id,
      tarea,
      entrada: datos,
      salida: resultado,
      ok: true,
      fecha: new Date().toISOString()
    });
  } catch (logErr) {
    console.warn('No se pudo registrar en consumo-ia.jsonl:', logErr.message);
  }

  return resultado;
}

export default {
  ejecutarTarea,
  probarConexion,
  listarModelosGemini,
  llamarGeminiAPI
};
