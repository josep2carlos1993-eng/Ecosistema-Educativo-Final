// publico/js/modulos/ingreso.js · Módulo de inicio de sesión
import { montarPlantilla } from '../nucleo/plantilla.js';
import { iniciar, usuarioActual } from '../nucleo/sesion.js';
import { aviso, escapar } from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Iniciar Sesión', roles: ['publico'] });

// Si ya tiene sesión, redirige al inicio
if (usuarioActual()) {
  window.location.href = '/index.html';
}

const contenido = document.getElementById('contenido');
if (contenido) {
  contenido.innerHTML = `
    <div class="ingreso-contenedor">
      <div class="tarjeta ingreso-tarjeta">
        <div class="ingreso-encabezado">
          <h1>Iniciar Sesión</h1>
          <p>Ingresa tus credenciales para acceder a tus asignaturas y contenidos.</p>
        </div>

        <div id="alerta-error" class="alerta alerta--error oculto" role="alert" style="margin-bottom: var(--espacio-m);"></div>

        <form id="formulario-ingreso" class="pila pila--media" novalidate>
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
              autocomplete="current-password"
              placeholder="••••••••"
              required
              aria-describedby="error-clave"
            >
            <span class="campo__error" id="error-clave" aria-live="polite"></span>
          </div>

          <button type="submit" id="btn-ingresar" class="btn btn--primario" style="width: 100%; margin-top: var(--espacio-s);">
            Ingresar
          </button>
        </form>

        <div class="ingreso-pie">
          ¿No tienes una cuenta aún?
          <a href="/paginas/registro.html" class="enlace">Regístrate aquí</a>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('formulario-ingreso');
  const inputCorreo = document.getElementById('campo-correo');
  const inputClave = document.getElementById('campo-clave');
  const errorCorreo = document.getElementById('error-correo');
  const errorClave = document.getElementById('error-clave');
  const btnIngresar = document.getElementById('btn-ingresar');
  const alertaError = document.getElementById('alerta-error');

  function ocultarAlerta() {
    alertaError.classList.add('oculto');
    alertaError.textContent = '';
  }

  function mostrarAlerta(msg) {
    alertaError.textContent = msg;
    alertaError.classList.remove('oculto');
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
    errorClave.textContent = '';
    inputClave.removeAttribute('aria-invalid');
    return true;
  }

  // Validación en vivo
  inputCorreo.addEventListener('input', () => {
    ocultarAlerta();
    validarCorreo();
  });
  inputCorreo.addEventListener('blur', validarCorreo);

  inputClave.addEventListener('input', () => {
    ocultarAlerta();
    validarClave();
  });
  inputClave.addEventListener('blur', validarClave);

  // Envío del formulario
  form.addEventListener('submit', async e => {
    e.preventDefault();
    ocultarAlerta();

    const okCorreo = validarCorreo();
    const okClave = validarClave();

    if (!okCorreo || !okClave) {
      if (!okCorreo) inputCorreo.focus();
      else inputClave.focus();
      return;
    }

    // Botón deshabilitado mientras envía
    btnIngresar.disabled = true;
    const textoOriginal = btnIngresar.textContent;
    btnIngresar.textContent = 'Ingresando...';

    try {
      await iniciar(inputCorreo.value.trim(), inputClave.value);
      window.location.href = '/index.html';
    } catch (err) {
      const mensaje = err.message || 'No se pudo iniciar sesión. Verifica tus datos.';
      mostrarAlerta(mensaje);
      aviso(mensaje, 'error');
      btnIngresar.disabled = false;
      btnIngresar.textContent = textoOriginal;
      inputClave.focus();
    }
  });
}
