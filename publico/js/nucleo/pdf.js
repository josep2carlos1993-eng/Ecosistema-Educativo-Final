// publico/js/nucleo/pdf.js · Generación y descarga de diplomas y certificados en PDF
import api from './api.js';
import { fechaLarga } from './util.js';

async function asegurarJsPDF() {
  if (window.jspdf?.jsPDF) {
    return window.jspdf.jsPDF;
  }
  if (window.jsPDF) {
    return window.jsPDF;
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.async = true;
    script.onload = () => {
      const jsPDFClass = window.jspdf?.jsPDF || window.jsPDF;
      if (jsPDFClass) {
        resolve(jsPDFClass);
      } else {
        reject(new Error('Librería jsPDF no disponible tras la carga'));
      }
    };
    script.onerror = () => reject(new Error('Error al cargar la librería jsPDF desde CDN'));
    document.head.appendChild(script);
  });
}

export async function generarDiploma({ tipo = 'cumplimiento', temaId = null, nivel = null } = {}) {
  // 1. Solicitar o recuperar el certificado emitido en el servidor
  const certificado = await api.llamar('POST', '/api/certificados', { tipo, temaId, nivel });
  if (!certificado || !certificado.codigo) {
    throw new Error('No se pudo obtener el certificado del servidor');
  }

  // 2. Cargar jsPDF si no está presente en la ventana
  const jsPDFClass = await asegurarJsPDF();

  // 3. Crear documento A4 horizontal (297 mm × 210 mm)
  const doc = new jsPDFClass({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // 4. Leer tokens de diseño con getComputedStyle
  const estilo = getComputedStyle(document.documentElement);
  const colorPrimario = estilo.getPropertyValue('--color-primario').trim() || '#002e45';
  const colorSecundario = estilo.getPropertyValue('--color-secundario').trim() || '#264763';
  const colorAcento = estilo.getPropertyValue('--color-acento').trim() || '#ff6900';
  const colorTexto = estilo.getPropertyValue('--color-texto').trim() || '#182d3e';
  const colorTextoSuave = estilo.getPropertyValue('--color-texto-suave').trim() || '#4a6170';

  // 5. Dibujar marco decorativo
  // Marco exterior
  doc.setDrawColor(colorPrimario);
  doc.setLineWidth(2.5);
  doc.rect(10, 10, 277, 190);

  // Marco interior
  doc.setDrawColor(colorAcento);
  doc.setLineWidth(0.8);
  doc.rect(14, 14, 269, 182);

  // Adornos en las 4 esquinas
  doc.setFillColor(colorSecundario);
  doc.rect(12, 12, 4, 4, 'F');
  doc.rect(281, 12, 4, 4, 'F');
  doc.rect(12, 194, 4, 4, 'F');
  doc.rect(281, 194, 4, 4, 'F');

  // 6. Contenido del diploma
  const centroX = 148.5;

  // Nombre de la plataforma
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(colorPrimario);
  doc.text('ECOSISTEMA EDUCATIVO DIGITAL', centroX, 32, { align: 'center' });

  // Título del certificado
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(colorPrimario);
  doc.text('CERTIFICADO DE RECONOCIMIENTO', centroX, 48, { align: 'center' });

  // Línea de acento
  doc.setDrawColor(colorAcento);
  doc.setLineWidth(0.8);
  doc.line(98.5, 54, 198.5, 54);

  // "Otorgado a"
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(colorTextoSuave);
  doc.text('Otorgado a', centroX, 68, { align: 'center' });

  // Nombre del estudiante
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(colorAcento);
  doc.text(certificado.nombreCompleto || 'Estudiante Destacado', centroX, 84, { align: 'center' });

  // Detalle del logro
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(colorTexto);
  const lineasDetalle = doc.splitTextToSize(certificado.detalle || 'Por su destacada participación académica y formativa.', 210);
  doc.text(lineasDetalle, centroX, 100, { align: 'center' });

  // Fecha larga
  const textoFecha = fechaLarga(certificado.fecha) || 'Ecuador';
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(colorTextoSuave);
  doc.text(`Emitido en Ecuador el ${textoFecha}`, centroX, 126, { align: 'center' });

  // Firmas institucionales
  doc.setDrawColor(colorTextoSuave);
  doc.setLineWidth(0.4);
  doc.line(55, 154, 115, 154);
  doc.line(182, 154, 242, 154);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(colorTextoSuave);
  doc.text('Dirección Académica', 85, 160, { align: 'center' });
  doc.text('Coordinación de Formación', 212, 160, { align: 'center' });

  // Pie de autenticidad y código de verificación
  const host = typeof window !== 'undefined' ? (window.location.origin || '') : '';
  const urlVerificacion = `${host}/paginas/verificar.html?codigo=${encodeURIComponent(certificado.codigo)}`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(colorPrimario);
  doc.text(`Código de autenticidad: ${certificado.codigo}`, centroX, 178, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(colorTextoSuave);
  doc.text(`Verificación oficial en línea: ${urlVerificacion}`, centroX, 185, { align: 'center' });

  // 7. Descargar PDF con el formato solicitado: diploma-<codigo>.pdf
  doc.save(`diploma-${certificado.codigo}.pdf`);

  return { codigo: certificado.codigo };
}

export default {
  generarDiploma
};

