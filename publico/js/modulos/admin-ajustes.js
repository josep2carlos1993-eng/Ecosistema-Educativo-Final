// publico/js/modulos/admin-ajustes.js · Panel de configuración de IA y plataforma
import { montarPlantilla } from '../nucleo/plantilla.js';
import api from '../nucleo/api.js';
import { aviso, escapar } from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Configuración de Inteligencia Artificial', roles: ['admin'] });

const contenido = document.getElementById('contenido');

const MODELOS_BASE = [
  { id: 'gemini-1.5-flash', nombre: 'Gemini 1.5 Flash (Recomendado - Rápido y económico)' },
  { id: 'gemini-1.5-flash-latest', nombre: 'Gemini 1.5 Flash (Latest)' },
  { id: 'gemini-1.5-pro', nombre: 'Gemini 1.5 Pro (Razonamiento profundo)' },
  { id: 'gemini-1.5-pro-latest', nombre: 'Gemini 1.5 Pro (Latest)' },
  { id: 'gemini-2.0-flash', nombre: 'Gemini 2.0 Flash (Nueva generación - Ultra veloz)' },
  { id: 'gemini-2.0-flash-lite', nombre: 'Gemini 2.0 Flash Lite (Alta eficiencia)' },
  { id: 'gemini-2.5-flash', nombre: 'Gemini 2.5 Flash' },
  { id: 'gemini-3.8-flash', nombre: 'Gemini 3.8 Flash' },
  { id: 'gemini-4-argon', nombre: 'Gemini 4 Argon' }
];

if (contenido) {
  contenido.innerHTML = `
    <div class="ajustes-panel">
      <div class="ajustes-tarjeta">
        <div class="ajustes-header">
          <div>
            <h2 class="h3">Configuración de Inteligencia Artificial</h2>
            <p class="texto-secundario">Define el modelo y las credenciales de la API para generación pedagógica y banco de preguntas.</p>
          </div>
          <span class="insignia insignia--primario" id="badge-estado">Verificando...</span>
        </div>

        <form id="form-ajustes-ia" class="ajustes-form">
          <div class="campo">
            <label for="ia-proveedor">Proveedor de IA:</label>
            <select id="ia-proveedor" name="iaProveedor" required>
              <option value="gemini">Google Gemini API (Recomendado)</option>
              <option value="openai">OpenAI API</option>
            </select>
          </div>

          <div class="campo">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--espacio-xs);">
              <label for="ia-modelo-select" style="margin-bottom: 0;">Modelo de IA:</label>
              <button type="button" class="boton boton--secundario" id="btn-detectar-modelos" style="font-size: var(--tamano-fuente-sm); padding: 2px 10px;">
                🔄 Detectar modelos activos en mi cuenta
              </button>
            </div>
            <select id="ia-modelo-select" name="iaModeloSelect" required>
              <option value="" disabled>Selecciona un modelo...</option>
              ${MODELOS_BASE.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('')}
              <option value="personalizado">✍️ Otro modelo (escribir nombre manualmente)</option>
            </select>
            <small class="texto-pistas" id="pista-modelos">
              Si tu cuenta de Google tiene modelos específicos habilitados, pulsa "Detectar modelos activos en mi cuenta".
            </small>
          </div>

          <div class="campo" id="contenedor-modelo-personalizado" style="display: none;">
            <label for="ia-modelo-manual">Nombre del modelo personalizado o URL proxy:</label>
            <input
              type="text"
              id="ia-modelo-manual"
              placeholder="Ej. gemini-2.0-flash, gemini-1.5-flash-latest o URL completa"
            >
          </div>

          <div class="campo">
            <label for="ia-clave">Clave de API (Gemini API Key):</label>
            <div class="ajustes-clave-wrapper">
              <input
                type="password"
                id="ia-clave"
                name="iaClave"
                autocomplete="off"
                placeholder="Pega aquí tu Gemini API Key..."
              >
              <button type="button" class="boton boton--secundario" id="btn-toggle-clave" title="Mostrar/Ocultar clave">👁️</button>
            </div>
            <small class="texto-pistas" id="clave-ayuda">
              Deja este campo en blanco si no deseas cambiar la clave guardada actualmente.
            </small>
          </div>

          <div class="campo">
            <label for="ia-limite">Límite diario de consultas IA por usuario:</label>
            <input
              type="number"
              id="ia-limite"
              name="limiteIADiario"
              min="1"
              max="500"
              value="30"
              required
            >
          </div>

          <div id="resultado-conexion" class="estado-conexion" role="alert" aria-live="polite"></div>

          <div class="ajustes-acciones">
            <button type="button" class="boton boton--secundario" id="btn-probar-ia">
              🔌 Probar conexión
            </button>
            <button type="submit" class="boton boton--primario" id="btn-guardar-ia">
              💾 Guardar configuración
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  const form = document.getElementById('form-ajustes-ia');
  const selProveedor = document.getElementById('ia-proveedor');
  const selModelo = document.getElementById('ia-modelo-select');
  const contModeloManual = document.getElementById('contenedor-modelo-personalizado');
  const inputModeloManual = document.getElementById('ia-modelo-manual');
  const pistaModelos = document.getElementById('pista-modelos');
  const btnDetectarModelos = document.getElementById('btn-detectar-modelos');
  const inputClave = document.getElementById('ia-clave');
  const btnToggleClave = document.getElementById('btn-toggle-clave');
  const inputLimite = document.getElementById('ia-limite');
  const badgeEstado = document.getElementById('badge-estado');
  const claveAyuda = document.getElementById('clave-ayuda');
  const resultadoConexion = document.getElementById('resultado-conexion');
  const btnProbar = document.getElementById('btn-probar-ia');
  const btnGuardar = document.getElementById('btn-guardar-ia');

  // Alternar campo personalizado
  selModelo.addEventListener('change', () => {
    if (selModelo.value === 'personalizado') {
      contModeloManual.style.display = 'block';
      inputModeloManual.required = true;
      inputModeloManual.focus();
    } else {
      contModeloManual.style.display = 'none';
      inputModeloManual.required = false;
    }
  });

  // Alternar visualización de clave
  btnToggleClave?.addEventListener('click', () => {
    if (inputClave.type === 'password') {
      inputClave.type = 'text';
      btnToggleClave.textContent = '🔒';
    } else {
      inputClave.type = 'password';
      btnToggleClave.textContent = '👁️';
    }
  });

  function obtenerModeloSeleccionado() {
    if (selModelo.value === 'personalizado') {
      return inputModeloManual.value.trim();
    }
    return selModelo.value;
  }

  function fijarModeloEnSelect(modeloId) {
    if (!modeloId) return;
    const modeloLimpio = modeloId.replace(/^models\//, '');
    const opcionExistente = Array.from(selModelo.options).find(o => o.value === modeloLimpio);
    if (opcionExistente) {
      selModelo.value = modeloLimpio;
      contModeloManual.style.display = 'none';
      inputModeloManual.required = false;
    } else {
      selModelo.value = 'personalizado';
      contModeloManual.style.display = 'block';
      inputModeloManual.required = true;
      inputModeloManual.value = modeloLimpio;
    }
  }

  function actualizarOpcionesSelect(listaModelos, esGoogle = false) {
    if (!Array.isArray(listaModelos) || listaModelos.length === 0) return;
    const actual = obtenerModeloSeleccionado();

    selModelo.innerHTML = `
      <option value="" disabled>Selecciona un modelo...</option>
      ${listaModelos.map(m => `<option value="${m.id}">${escapar(m.nombre)}</option>`).join('')}
      <option value="personalizado">✍️ Otro modelo (escribir nombre manualmente)</option>
    `;

    if (esGoogle) {
      pistaModelos.textContent = `✅ ${listaModelos.length} modelos detectados directamente desde tu cuenta de Google.`;
      pistaModelos.style.color = 'var(--color-exito, #137333)';
    }

    fijarModeloEnSelect(actual || listaModelos[0]?.id);
  }

  // Detectar modelos con la clave ingresada
  async function consultarModelosRemotos() {
    const clave = inputClave.value.trim();
    btnDetectarModelos.disabled = true;
    btnDetectarModelos.textContent = '⏳ Consultando...';

    try {
      const ruta = clave ? `/api/ia/modelos?clave=${encodeURIComponent(clave)}` : '/api/ia/modelos';
      const datos = await api.llamar('GET', ruta);
      if (datos && Array.isArray(datos.modelos) && datos.modelos.length > 0) {
        actualizarOpcionesSelect(datos.modelos, datos.origen === 'google');
        if (datos.origen === 'google') {
          aviso(`Se detectaron ${datos.modelos.length} modelos compatibles en tu cuenta de Google.`, 'exito');
        } else {
          aviso('Listado de modelos estándar cargado.', 'info');
        }
      }
    } catch (err) {
      aviso('No se pudo consultar la lista de modelos: ' + err.message, 'error');
    } finally {
      btnDetectarModelos.disabled = false;
      btnDetectarModelos.textContent = '🔄 Detectar modelos activos en mi cuenta';
    }
  }

  btnDetectarModelos?.addEventListener('click', consultarModelosRemotos);

  // Al pegar la clave, ofrecer auto-detección
  inputClave?.addEventListener('change', () => {
    if (inputClave.value.trim().length > 10) {
      consultarModelosRemotos();
    }
  });

  // Cargar configuración existente
  async function cargarConfiguracion() {
    try {
      const config = await api.llamar('GET', '/api/ia/configuracion');
      selProveedor.value = config.iaProveedor || 'gemini';
      inputLimite.value = config.limiteIADiario || 30;

      if (Array.isArray(config.modelosDisponibles) && config.modelosDisponibles.length > 0) {
        actualizarOpcionesSelect(config.modelosDisponibles, config.tieneClave);
      }

      fijarModeloEnSelect(config.iaModelo || 'gemini-1.5-flash');

      if (config.tieneClave) {
        badgeEstado.textContent = 'API Key Configurada';
        badgeEstado.className = 'insignia insignia--exito';
        claveAyuda.textContent = `Clave registrada: ${config.claveEnmascarada}. Déjalo en blanco para conservarla o ingresa una nueva.`;
      } else {
        badgeEstado.textContent = 'Sin API Key';
        badgeEstado.className = 'insignia insignia--alerta';
        claveAyuda.textContent = 'No hay ninguna clave registrada aún. Ingresa tu Gemini API Key.';
      }
    } catch (err) {
      badgeEstado.textContent = 'Error';
      badgeEstado.className = 'insignia insignia--error';
      aviso('No se pudo cargar la configuración de IA: ' + err.message, 'error');
    }
  }

  // Probar conexión
  btnProbar?.addEventListener('click', async () => {
    resultadoConexion.className = 'estado-conexion';
    resultadoConexion.style.display = 'none';
    resultadoConexion.textContent = '';
    btnProbar.disabled = true;
    btnProbar.textContent = '⏳ Probando conexión...';

    const modelo = obtenerModeloSeleccionado();
    if (!modelo) {
      resultadoConexion.className = 'estado-conexion estado-conexion--error';
      resultadoConexion.textContent = 'Selecciona o ingresa un modelo de IA para probar.';
      resultadoConexion.style.display = 'block';
      btnProbar.disabled = false;
      btnProbar.textContent = '🔌 Probar conexión';
      return;
    }

    try {
      const resp = await api.llamar('POST', '/api/ia/probar', {
        iaProveedor: selProveedor.value,
        iaModelo: modelo,
        iaClave: inputClave.value.trim() || undefined
      });

      resultadoConexion.className = 'estado-conexion estado-conexion--exito';
      resultadoConexion.textContent = `✅ ${resp.mensaje || 'Conexión con IA exitosa.'}`;
      resultadoConexion.style.display = 'block';
      aviso('Prueba de conexión exitosa', 'exito');
    } catch (err) {
      resultadoConexion.className = 'estado-conexion estado-conexion--error';
      resultadoConexion.textContent = `❌ ${err.message || 'Error al conectar con la IA.'}`;
      resultadoConexion.style.display = 'block';
      aviso('Fallo en la prueba de conexión: ' + err.message, 'error');
    } finally {
      btnProbar.disabled = false;
      btnProbar.textContent = '🔌 Probar conexión';
    }
  });

  // Guardar configuración
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const modelo = obtenerModeloSeleccionado();
    if (!modelo) {
      aviso('Por favor selecciona o ingresa un modelo de IA.', 'alerta');
      return;
    }

    btnGuardar.disabled = true;
    btnGuardar.textContent = '💾 Guardando...';

    const datos = {
      iaProveedor: selProveedor.value,
      iaModelo: modelo,
      limiteIADiario: Number(inputLimite.value) || 30
    };

    const clave = inputClave.value.trim();
    if (clave) {
      datos.iaClave = clave;
    }

    try {
      const resp = await api.llamar('PUT', '/api/ia/configuracion', datos);
      aviso(resp.mensaje || 'Configuración guardada correctamente', 'exito');
      inputClave.value = '';
      await cargarConfiguracion();
    } catch (err) {
      aviso('Error al guardar configuración: ' + err.message, 'error');
    } finally {
      btnGuardar.disabled = false;
      btnGuardar.textContent = '💾 Guardar configuración';
    }
  });

  await cargarConfiguracion();
}
