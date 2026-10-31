// publico/js/nucleo/ui.js · Utilidades de interfaz de usuario y accesibilidad

export function escapar(texto) {
  if (texto === null || texto === undefined) return '';
  const mapa = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return String(texto).replace(/[&<>"']/g, c => mapa[c]);
}

export function limpiar(html) {
  if (typeof window !== 'undefined' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
    return window.DOMPurify.sanitize(html);
  }
  return escapar(html);
}

export function cargando(activo) {
  if (typeof document === 'undefined') return;
  let indicador = document.querySelector('.cargando');
  if (activo) {
    if (!indicador) {
      indicador = document.createElement('div');
      indicador.className = 'cargando';
      indicador.setAttribute('role', 'status');
      indicador.setAttribute('aria-live', 'polite');
      indicador.setAttribute('aria-label', 'Cargando contenido...');
      indicador.innerHTML = '<span class="cargando-spinner" aria-hidden="true"></span>';
      document.body.appendChild(indicador);
    }
    indicador.hidden = false;
  } else if (indicador) {
    indicador.remove();
  }
}

function obtenerContenedorAvisos() {
  let contenedor = document.getElementById('contenedor-avisos');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.id = 'contenedor-avisos';
    contenedor.className = 'contenedor-avisos';
    contenedor.setAttribute('aria-live', 'polite');
    contenedor.setAttribute('aria-atomic', 'true');
    document.body.appendChild(contenedor);
  }
  return contenedor;
}

export function aviso(texto, tipo = 'info') {
  if (typeof document === 'undefined') return;
  const contenedor = obtenerContenedorAvisos();
  const toast = document.createElement('div');
  toast.className = `aviso aviso-${tipo}`;
  toast.setAttribute('role', 'status');
  toast.textContent = texto;

  contenedor.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('desvanecer');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

export function modal({ titulo, contenido, acciones = [] }) {
  return new Promise(resolve => {
    if (typeof document === 'undefined') {
      return resolve(null);
    }

    const focoAnterior = document.activeElement;

    const fondo = document.createElement('div');
    fondo.className = 'modal-fondo';

    const dialogo = document.createElement('div');
    dialogo.className = 'modal';
    dialogo.setAttribute('role', 'dialog');
    dialogo.setAttribute('aria-modal', 'true');
    dialogo.setAttribute('tabindex', '-1');

    const idTitulo = `modal-titulo-${Date.now()}`;
    dialogo.setAttribute('aria-labelledby', idTitulo);

    const encabezado = document.createElement('div');
    encabezado.className = 'modal-encabezado';
    const h2 = document.createElement('h2');
    h2.id = idTitulo;
    h2.textContent = titulo || 'Información';
    encabezado.appendChild(h2);

    const cuerpo = document.createElement('div');
    cuerpo.className = 'modal-cuerpo';
    if (contenido instanceof HTMLElement) {
      cuerpo.appendChild(contenido);
    } else {
      cuerpo.innerHTML = limpiar(contenido || '');
    }

    const pie = document.createElement('div');
    pie.className = 'modal-acciones';

    const botonesAccion = acciones.length > 0 ? acciones : [{ texto: 'Cerrar', valor: null }];

    const cerrarModal = valor => {
      document.removeEventListener('keydown', manejarTeclado);
      fondo.remove();
      if (focoAnterior && typeof focoAnterior.focus === 'function') {
        focoAnterior.focus();
      }
      resolve(valor);
    };

    botonesAccion.forEach(a => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = a.clase || 'btn';
      boton.textContent = a.texto;
      boton.addEventListener('click', () => {
        cerrarModal(a.valor !== undefined ? a.valor : null);
      });
      pie.appendChild(boton);
    });

    dialogo.appendChild(encabezado);
    dialogo.appendChild(cuerpo);
    dialogo.appendChild(pie);
    fondo.appendChild(dialogo);
    document.body.appendChild(fondo);

    fondo.addEventListener('click', e => {
      if (e.target === fondo) {
        cerrarModal(null);
      }
    });

    const selectorFoco = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const manejarTeclado = e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cerrarModal(null);
        return;
      }

      if (e.key === 'Tab') {
        const interactivos = Array.from(dialogo.querySelectorAll(selectorFoco));
        if (interactivos.length === 0) {
          e.preventDefault();
          return;
        }

        const primero = interactivos[0];
        const ultimo = interactivos[interactivos.length - 1];

        if (e.shiftKey && document.activeElement === primero) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primero.focus();
        }
      }
    };

    document.addEventListener('keydown', manejarTeclado);

    const elementosEnfocables = dialogo.querySelectorAll(selectorFoco);
    if (elementosEnfocables.length > 0) {
      elementosEnfocables[0].focus();
    } else {
      dialogo.focus();
    }
  });
}

export async function confirmar(texto) {
  const resultado = await modal({
    titulo: 'Confirmación',
    contenido: texto,
    acciones: [
      { texto: 'Cancelar', valor: false, clase: 'btn-secundario' },
      { texto: 'Aceptar', valor: true, clase: 'btn-primario' }
    ]
  });
  return resultado === true;
}

export default {
  aviso,
  confirmar,
  modal,
  cargando,
  escapar,
  limpiar
};
