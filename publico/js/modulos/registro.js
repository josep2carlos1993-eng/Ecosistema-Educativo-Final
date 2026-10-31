// publico/js/modulos/registro.js · Módulo de registro de estudiantes
import { montarPlantilla } from '../nucleo/plantilla.js';
import { registrar, usuarioActual } from '../nucleo/sesion.js';
import { aviso } from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Crear Cuenta', roles: ['publico'] });

// Si ya tiene sesión activa, redirige al inicio
if (usuarioActual()) {
  window.location.href = '/index.html';
}

const contenido = document.getElementById('contenido');
if (contenido) {
  contenido.innerHTML = `
    <div class="registro-contenedor">
      <div class="tarjeta registro-tarjeta">
        <div class="registro-encabezado">
          <h1>Registro de Estudiante</h1>
          <p>Crea tu cuenta para comenzar tus actividades y evaluaciones.</p>
        </div>

        <div id="alerta-error" class="alerta alerta--error oculto" role="alert" style="margin-bottom: var(--espacio-m);"></div>

        <form id="formulario-registro" class="pila pila--media" novalidate>
          <div class="registro-fila-nombres">
            <div class="campo">
              <label for="campo-nombre">Nombre</label>
              <input
                type="text"
                id="campo-nombre"
                name="nombre"
                autocomplete="given-name"
                placeholder="Ej. Carlos"
                required
                aria-describedby="error-nombre"
              >
              <span class="campo__error" id="error-nombre" aria-live="polite"></span>
            </div>

            <div class="campo">
              <label for="campo-apellido">Apellido</label>
              <input
                type="text"
                id="campo-apellido"
                name="apellido"
                autocomplete="family-name"
                placeholder="Ej. Morales"
                required
                aria-describedby="error-apellido"
              >
              <span class="campo__error" id="error-apellido" aria-live="polite"></span>
            </div>
          </div>

          <div class="campo">
            <label for="campo-correo">Correo electrónico</label>
            <input
              type="email"
              id="campo-correo"
              name="correo"
              autocomplete="email"
              placeholder="tu.correo@ejemplo.com"
              required
              aria-describedby="error-correo"
            >
            <span class="campo__error" id="error-correo" aria-live="polite"></span>
          </div>

          <div class="campo">
            <label for="campo-clave">Contraseña</label>
            <input
              type="password"
              id="campo-clave"
              name="clave"
              autocomplete="new-password"
              placeholder="Mínimo 8 caracteres, letras y números"
              required
              aria-describedby="error-clave"
            >
            <span class="campo__error" id="error-clave" aria-live="polite"></span>
          </div>

          <div class="campo">
            <div class="registro-casilla">
              <input
                type="checkbox"
                id="campo-consentimiento"
                name="consentimiento"
                required
                aria-describedby="error-consentimiento"
              >
              <label for="campo-consentimiento">
                Acepto el <a href="/paginas/privacidad.html" target="_blank" rel="noopener">aviso de privacidad</a>
              </label>
            </div>
            <span class="campo__error" id="error-consentimiento" aria-live="polite"></span>
          </div>

          <button type="submit" id="btn-registro" class="btn btn--primario" style="width: 100%; margin-top: var(--espacio-s);">
            Crear Cuenta
          </button>
        </form>

        <div class="registro-pie">
          ¿Ya tienes una cuenta?
          <a href="/paginas/ingreso.html" class="enlace">Inicia sesión aquí</a>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('formulario-registro');
  const inputNombre = document.getElementById('campo-nombre');
  const inputApellido = document.getElementById('campo-apellido');
  const inputCorreo = document.getElementById('campo-correo');
  const inputClave = document.getElementById('campo-clave');
  const checkConsentimiento = document.getElementById('campo-consentimiento');

  const errorNombre = document.getElementById('error-nombre');
  const errorApellido = document.getElementById('error-apellido');
  const errorCorreo = document.getElementById('error-correo');
  const errorClave = document.getElementById('error-clave');
  const errorConsentimiento = document.getElementById('error-consentimiento');

  const btnRegistro = document.getElementById('btn-registro');
  const alertaError = document.getElementById('alerta-error');

  function ocultarAlerta() {
    alertaError.classList.add('oculto');
    alertaError.textContent = '';
  }

  function mostrarAlerta(msg) {
    alertaError.textContent = msg;
    alertaError.classList.remove('oculto');
  }

  function validarNombre() {
    const val = inputNombre.value.trim();
    if (!val) {
      errorNombre.textContent = 'El nombre es obligatorio';
      inputNombre.setAttribute('aria-invalid', 'true');
      return false;
    }
    errorNombre.textContent = '';
    inputNombre.removeAttribute('aria-invalid');
    return true;
  }

  function validarApellido() {
    const val = inputApellido.value.trim();
    if (!val) {
      errorApellido.textContent = 'El apellido es obligatorio';
      inputApellido.setAttribute('aria-invalid', 'true');
      return false;
    }
    errorApellido.textContent = '';
    inputApellido.removeAttribute('aria-invalid');
    return true;
  }

  function validarCorreo() {
    const val = inputCorreo.value.trim();
    if (!val) {
      errorCorreo.textContent = 'El correo electrónico es obligatorio';
      inputCorreo.setAttribute('aria-invalid', 'true');
      return false;
    }
    const formatoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    if (!formatoValido) {
      errorCorreo.textContent = 'Ingresa un correo electrónico válido';
      inputCorreo.setAttribute('aria-invalid', 'true');
      return false;
    }
    errorCorreo.textContent = '';
    inputCorreo.removeAttribute('aria-invalid');
    return true;
  }

  function validarClave() {
    const val = inputClave.value;
    if (!val) {
      errorClave.textContent = 'La contraseña es obligatoria';
      inputClave.setAttribute('aria-invalid', 'true');
      return false;
    }
    if (val.length < 8) {
      errorClave.textContent = 'Debe tener al menos 8 caracteres';
      inputClave.setAttribute('aria-invalid', 'true');
      return false;
    }
    if (!/[a-zA-Z]/.test(val) || !/[0-9]/.test(val)) {
      errorClave.textContent = 'Debe incluir al menos una letra y un número';
      inputClave.setAttribute('aria-invalid', 'true');
      return false;
    }
    errorClave.textContent = '';
    inputClave.removeAttribute('aria-invalid');
    return true;
  }

  function validarConsentimiento() {
    if (!checkConsentimiento.checked) {
      errorConsentimiento.textContent = 'Debes aceptar el aviso de privacidad para registrarte';
      checkConsentimiento.setAttribute('aria-invalid', 'true');
      return false;
    }
    errorConsentimiento.textContent = '';
    checkConsentimiento.removeAttribute('aria-invalid');
    return true;
  }

  // Validación en vivo
  inputNombre.addEventListener('input', () => { ocultarAlerta(); validarNombre(); });
  inputNombre.addEventListener('blur', validarNombre);

  inputApellido.addEventListener('input', () => { ocultarAlerta(); validarApellido(); });
  inputApellido.addEventListener('blur', validarApellido);

  inputCorreo.addEventListener('input', () => { ocultarAlerta(); validarCorreo(); });
  inputCorreo.addEventListener('blur', validarCorreo);

  inputClave.addEventListener('input', () => { ocultarAlerta(); validarClave(); });
  inputClave.addEventListener('blur', validarClave);

  checkConsentimiento.addEventListener('change', () => { ocultarAlerta(); validarConsentimiento(); });

  // Envío del formulario
  form.addEventListener('submit', async e => {
    e.preventDefault();
    ocultarAlerta();

    const okNombre = validarNombre();
    const okApellido = validarApellido();
    const okCorreo = validarCorreo();
    const okClave = validarClave();
    const okConsentimiento = validarConsentimiento();

    if (!okNombre || !okApellido || !okCorreo || !okClave || !okConsentimiento) {
      if (!okNombre) inputNombre.focus();
      else if (!okApellido) inputApellido.focus();
      else if (!okCorreo) inputCorreo.focus();
      else if (!okClave) inputClave.focus();
      else checkConsentimiento.focus();
      return;
    }

    // Botón deshabilitado mientras envía
    btnRegistro.disabled = true;
    const textoOriginal = btnRegistro.textContent;
    btnRegistro.textContent = 'Creando cuenta...';

    try {
      await registrar({
        nombre: inputNombre.value.trim(),
        apellido: inputApellido.value.trim(),
        correo: inputCorreo.value.trim(),
        clave: inputClave.value,
        consentimiento: true
      });

      // Tras registrar e iniciar sesión automáticamente → /index.html
      window.location.href = '/index.html';
    } catch (err) {
      const mensaje = err.message || 'No se pudo completar el registro.';
      mostrarAlerta(mensaje);
      aviso(mensaje, 'error');
      btnRegistro.disabled = false;
      btnRegistro.textContent = textoOriginal;
    }
  });
}
