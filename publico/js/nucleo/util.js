// publico/js/nucleo/util.js · Funciones de utilidad comunes

import { escapar } from './ui.js';

export function normalizar(texto) {
  if (texto === null || texto === undefined) return '';
  let s = String(texto).trim().toUpperCase();
  s = s.replace(/Ñ/g, '\uE000');
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC');
  s = s.replace(/\uE000/g, 'Ñ');
  return s;
}

export function barajar(lista) {
  if (!Array.isArray(lista)) return [];
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export function fechaLarga(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'long'
  }).format(d);
}

export function fechaRelativa(iso) {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return '';

  const ahora = new Date();
  const difSegundos = Math.round((fecha.getTime() - ahora.getTime()) / 1000);

  if (Math.abs(difSegundos) < 45) {
    return 'hace un momento';
  }

  const rtf = new Intl.RelativeTimeFormat('es-EC', { numeric: 'auto' });
  const difMinutos = Math.round(difSegundos / 60);
  if (Math.abs(difMinutos) < 60) {
    return rtf.format(difMinutos, 'minute');
  }

  const difHoras = Math.round(difMinutos / 60);
  if (Math.abs(difHoras) < 24) {
    return rtf.format(difHoras, 'hour');
  }

  const difDias = Math.round(difHoras / 24);
  if (Math.abs(difDias) < 30) {
    return rtf.format(difDias, 'day');
  }

  const difMeses = Math.round(difDias / 30);
  if (Math.abs(difMeses) < 12) {
    return rtf.format(difMeses, 'month');
  }

  const difAnios = Math.round(difDias / 365);
  return rtf.format(difAnios, 'year');
}

export function parametro(nombre) {
  if (typeof window === 'undefined' || !window.location) return null;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(nombre);
}

export function formatoBasico(texto) {
  if (texto === null || texto === undefined || texto === '') return '';

  const escapado = escapar(texto);
  const conNegrita = escapado.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const bloques = conNegrita.trim().split(/\n\s*\n/);

  const htmlBloques = bloques.map(bloque => {
    const lineas = bloque.split('\n').map(l => l.trim()).filter(Boolean);
    if (lineas.length === 0) return '';

    const sonTodosItems = lineas.every(l => l.startsWith('- '));
    if (sonTodosItems) {
      const items = lineas.map(l => `<li>${l.slice(2)}</li>`).join('');
      return `<ul>${items}</ul>`;
    }

    const partes = [];
    let itemsLista = [];

    for (const linea of lineas) {
      if (linea.startsWith('- ')) {
        itemsLista.push(`<li>${linea.slice(2)}</li>`);
      } else {
        if (itemsLista.length > 0) {
          partes.push(`<ul>${itemsLista.join('')}</ul>`);
          itemsLista = [];
        }
        partes.push(linea);
      }
    }

    if (itemsLista.length > 0) {
      partes.push(`<ul>${itemsLista.join('')}</ul>`);
    }

    const salida = [];
    let parrafo = [];

    for (const p of partes) {
      if (p.startsWith('<ul>')) {
        if (parrafo.length > 0) {
          salida.push(`<p>${parrafo.join('<br>')}</p>`);
          parrafo = [];
        }
        salida.push(p);
      } else {
        parrafo.push(p);
      }
    }

    if (parrafo.length > 0) {
      salida.push(`<p>${parrafo.join('<br>')}</p>`);
    }

    return salida.join('');
  });

  return htmlBloques.join('');
}

export default {
  normalizar,
  barajar,
  fechaLarga,
  fechaRelativa,
  parametro,
  formatoBasico
};
