// publico/js/nucleo/api.js · Cliente API del ecosistema educativo

export async function llamar(metodo, ruta, cuerpo = null) {
  const url = ruta.startsWith('/') ? ruta : `/${ruta}`;
  const headers = {};

  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('token') : null;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const esFormData = typeof FormData !== 'undefined' && cuerpo instanceof FormData;
  const opciones = {
    method: metodo.toUpperCase(),
    headers
  };

  if (cuerpo !== null && cuerpo !== undefined) {
    if (esFormData) {
      opciones.body = cuerpo;
    } else {
      headers['Content-Type'] = 'application/json';
      opciones.body = JSON.stringify(cuerpo);
    }
  }

  const respuesta = await fetch(url, opciones);

  if (respuesta.status === 401) {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('usuario');
    }
    if (typeof window !== 'undefined' && window.location) {
      const actual = window.location.pathname;
      if (!actual.endsWith('ingreso.html') && !actual.endsWith('registro.html')) {
        window.location.href = '/paginas/ingreso.html';
      }
    }
    let mensaje = 'Sesión no autorizada o expirada';
    try {
      const errJson = await respuesta.json();
      if (errJson && errJson.error) mensaje = errJson.error;
    } catch {
      // Ignorar si no viene en formato JSON
    }
    throw new Error(mensaje);
  }

  if (respuesta.status === 204) {
    return null;
  }

  let datos;
  const tipoContenido = respuesta.headers.get('content-type') || '';
  if (tipoContenido.includes('application/json')) {
    datos = await respuesta.json();
  } else {
    const texto = await respuesta.text();
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = texto;
    }
  }

  if (datos && typeof datos === 'object' && 'error' in datos && datos.error) {
    throw new Error(datos.error);
  }

  if (!respuesta.ok) {
    throw new Error(respuesta.statusText || `Error HTTP ${respuesta.status}`);
  }

  return datos;
}

export async function listar(col, filtros = {}) {
  const parametros = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== '') {
      parametros.append(clave, valor);
    }
  }
  const consulta = parametros.toString();
  const ruta = `/api/${col}${consulta ? `?${consulta}` : ''}`;
  return llamar('GET', ruta);
}

export async function obtener(col, id) {
  return llamar('GET', `/api/${col}/${encodeURIComponent(id)}`);
}

export async function crear(col, datos) {
  return llamar('POST', `/api/${col}`, datos);
}

export async function actualizar(col, id, cambios) {
  return llamar('PUT', `/api/${col}/${encodeURIComponent(id)}`, cambios);
}

export async function eliminar(col, id) {
  return llamar('DELETE', `/api/${col}/${encodeURIComponent(id)}`);
}

export async function subir(archivo) {
  const formData = new FormData();
  formData.append('archivo', archivo);
  return llamar('POST', '/api/subidas', formData);
}

export async function ia(tarea, datos) {
  return llamar('POST', `/api/ia/${encodeURIComponent(tarea)}`, datos);
}

export default {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
  llamar,
  subir,
  ia
};
