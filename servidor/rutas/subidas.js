// servidor/rutas/subidas.js · Subida de archivos con multer
import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { exigirRol } from '../auth.js';
import { leerConfig } from '../almacen.js';

const router = Router();

const rutaDestino = path.resolve('publico', 'recursos', 'subidas');
if (!fs.existsSync(rutaDestino)) {
  fs.mkdirSync(rutaDestino, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, rutaDestino);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const nombreAleatorio = crypto.randomBytes(16).toString('hex') + extension;
    cb(null, nombreAleatorio);
  }
});

// POST /subidas (montado en /api/subidas)
router.post('/subidas', exigirRol(), async (req, res) => {
  const ajustes = await leerConfig('ajustes');
  const maxSubidaMB = (ajustes && typeof ajustes.maxSubidaMB === 'number') ? ajustes.maxSubidaMB : 10;

  const esAdminODocente = req.usuario && (req.usuario.rol === 'admin' || req.usuario.rol === 'docente');
  const limiteBytes = esAdminODocente ? maxSubidaMB * 1024 * 1024 : 2 * 1024 * 1024;

  const permitidas = esAdminODocente
    ? ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.mp3']
    : ['.jpg', '.jpeg', '.png', '.webp'];

  const mimesPermitidos = esAdminODocente
    ? ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'audio/mpeg', 'audio/mp3', 'audio/x-mp3']
    : ['image/jpeg', 'image/png', 'image/webp'];

  const upload = multer({
    storage,
    limits: { fileSize: limiteBytes },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (
        permitidas.includes(ext) &&
        (mimesPermitidos.includes(file.mimetype) || (esAdminODocente && file.mimetype.startsWith('audio/')))
      ) {
        cb(null, true);
      } else {
        const mensaje = esAdminODocente
          ? 'Solo se permiten imágenes (JPG, PNG, WEBP), documentos PDF o audios MP3'
          : 'Solo se permiten imágenes en formato JPG, PNG o WEBP';
        const err = new Error(mensaje);
        err.codigo = 'TIPO_INVALIDO';
        cb(err, false);
      }
    }
  }).single('archivo');

  upload(req, res, err => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const maxMB = esAdminODocente ? maxSubidaMB : 2;
        return res.status(400).json({ error: `El archivo excede el tamaño máximo permitido de ${maxMB} MB` });
      }
      return res.status(400).json({ error: err.message || 'Error al procesar el archivo' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se ha subido ningún archivo' });
    }

    const url = `/recursos/subidas/${req.file.filename}`;
    res.json({ url });
  });
});

export default router;
