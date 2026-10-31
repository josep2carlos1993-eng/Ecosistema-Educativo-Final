// publico/js/modulos/verificar.js · Módulo público de verificación de certificados
import { montarPlantilla } from '../nucleo/plantilla.js';
import api from '../nucleo/api.js';
import { parametro, fechaLarga } from '../nucleo/util.js';
import { escapar } from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Verificación de Certificados', roles: ['publico'] });

const contenido = document.getElementById('contenido');
if (!contenido) {
  throw new Error('Contenedor #contenido no encontrado');
}

function renderizarVista(codigoInicial = '') {
  contenido.innerHTML = `
    <div class="verificar-contenedor">
      <div class="verificar-tarjeta">
        <header class="verificar-encabezado">
          <div class="verificar-icono-cabecera" aria-hidden="true">🛡️</div>
          <h1 class="verificar-titulo">Verificación de Certificados</h1>
          <p class="verificar-descripcion">
            Ingresa el código alfanumérico que figura en el diploma emitido por el Ecosistema Educativo Digital para autenticar su validez oficial.
          </p>
        </header>

        <form class="verificar-formulario" id="form-verificar">
          <label for="input-codigo" class="campo__etiqueta">
            Código de Verificación (ej. EE-2026-ABC123)
          </label>
          <div class="verificar-fila-entrada">
            <input type="text"
                   id="input-codigo"
                   class="campo__control verificar-input"
                   placeholder="EE-2026-XXXXXX"
                   value="${escapar(codigoInicial)}"
                   required
                   autocomplete="off"
                   spellcheck="false">
            <button type="submit" class="btn btn--primario" id="btn-consultar">
              🔍 Verificar
            </button>
          </div>
        </form>

        <div id="contenedor-resultado" aria-live="polite"></div>
      </div>
    </div>
  `;

  const form = document.getElementById('form-verificar');
  const input = document.getElementById('input-codigo');

  if (form && input) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const codigo = input.value.trim();
      if (codigo) {
        await consultarCertificado(codigo);
      }
    });
  }

  if (codigoInicial) {
    consultarCertificado(codigoInicial);
  }
}

async function consultarCertificado(codigo) {
  const contenedorResultado = document.getElementById('contenedor-resultado');
  const btnConsultar = document.getElementById('btn-consultar');
  if (!contenedorResultado) return;

  if (btnConsultar) {
    btnConsultar.disabled = true;
    btnConsultar.textContent = 'Verificando...';
  }

  contenedorResultado.innerHTML = `
    <div style="text-align: center; padding: var(--espacio-m); color: var(--color-texto-suave);">
      <span class="cargando cargando--pequeno" aria-hidden="true"></span> Comprobando autenticidad del certificado...
    </div>
  `;

  try {
    const res = await api.llamar('GET', `/api/certificados/verificar/${encodeURIComponent(codigo)}`);

    if (res && res.valido) {
      const fechaTexto = res.fecha ? fechaLarga(res.fecha) : 'Fecha registrada';

      contenedorResultado.innerHTML = `
        <div class="verificar-resultado verificar-resultado--valido">
          <div class="verificar-resultado__cabecera">
            <span class="verificar-resultado__icono" aria-hidden="true">✅</span>
            <div>
              <h2 class="verificar-resultado__titulo">Certificado Auténtico y Válido</h2>
              <span style="font-size: var(--texto-xs); color: var(--color-exito); font-weight: var(--peso-seminegrita);">
                Registro oficial confirmado en el Ecosistema Educativo
              </span>
            </div>
          </div>

          <div class="verificar-datos-grid">
            <div class="verificar-dato-fila">
              <span class="verificar-dato-etiqueta">Otorgado a:</span>
              <span class="verificar-dato-valor verificar-dato-valor--destacado">
                ${escapar(res.nombreCompleto || 'Estudiante')}
              </span>
            </div>

            <div class="verificar-dato-fila">
              <span class="verificar-dato-etiqueta">Logro Académico:</span>
              <span class="verificar-dato-valor">
                ${escapar(res.detalle || 'Cumplimiento de objetivos educativos')}
              </span>
            </div>

            <div class="verificar-dato-fila">
              <span class="verificar-dato-etiqueta">Fecha de Emisión:</span>
              <span class="verificar-dato-valor">
                ${escapar(fechaTexto)}
              </span>
            </div>

            <div class="verificar-dato-fila">
              <span class="verificar-dato-etiqueta">Código Oficial:</span>
              <span class="verificar-dato-valor verificar-dato-valor--codigo">
                ${escapar(codigo.toUpperCase())}
              </span>
            </div>
          </div>
        </div>
      `;
    } else {
      contenedorResultado.innerHTML = `
        <div class="verificar-resultado verificar-resultado--invalido">
          <div class="verificar-resultado__cabecera" style="justify-content: center;">
            <span class="verificar-resultado__icono" aria-hidden="true">❌</span>
            <h2 class="verificar-resultado__titulo">Certificado No Encontrado</h2>
          </div>
          <p style="margin: 0; font-size: var(--texto-s); color: var(--color-texto-suave);">
            El código <strong>${escapar(codigo.toUpperCase())}</strong> no corresponde a ningún certificado válido o emitido en esta plataforma.
          </p>
          <p style="margin: 0; font-size: var(--texto-xs); color: var(--color-texto-suave);">
            Por favor, revisa que el código haya sido escrito exactamente como figura en el documento oficial.
          </p>
        </div>
      `;
    }
  } catch (error) {
    contenedorResultado.innerHTML = `
      <div class="alerta alerta--error" style="margin-top: var(--espacio-m);">
        ${escapar(error.message || 'Error al conectar con el servicio de verificación')}
      </div>
    `;
  } finally {
    if (btnConsultar) {
      btnConsultar.disabled = false;
      btnConsultar.textContent = '🔍 Verificar';
    }
  }
}

// Iniciar con el parámetro de la URL si viene provisto
const codigoInicial = parametro('codigo') || '';
renderizarVista(codigoInicial);

