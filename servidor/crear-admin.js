// servidor/crear-admin.js · Crear usuario administrador desde consola

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import bcrypt from 'bcryptjs';
import almacen from './almacen.js';

const rl = readline.createInterface({ input, output });

try {
  console.log('=== Crear Usuario Administrador ===');
  const nombre = (await rl.question('Nombre: ')).trim();
  const apellido = (await rl.question('Apellido: ')).trim();
  const correo = (await rl.question('Correo: ')).trim().toLowerCase();
  const clave = (await rl.question('Contraseña: ')).trim();

  if (!nombre || !apellido || !correo || !clave) {
    console.error('Error: Todos los campos son obligatorios.');
    process.exit(1);
  }

  if (clave.length < 8) {
    console.error('Error: La contraseña debe tener al menos 8 caracteres.');
    process.exit(1);
  }

  const usuarios = await almacen.leer('usuarios');
  const existente = usuarios.find(u => u && u.correo && u.correo.toLowerCase() === correo);

  if (existente) {
    console.error(`Error: Ya existe un usuario registrado con el correo ${correo}.`);
    process.exit(1);
  }

  const claveHash = await bcrypt.hash(clave, 10);
  const nuevo = await almacen.agregar('usuarios', {
    nombre,
    apellido,
    correo,
    claveHash,
    rol: 'admin',
    activo: true,
    foto: null,
    consentimiento: {
      aceptado: true,
      fecha: new Date().toISOString()
    }
  });

  console.log(`\nAdministrador creado con éxito:`);
  console.log(`- ID: ${nuevo.id}`);
  console.log(`- Nombre: ${nuevo.nombre} ${nuevo.apellido}`);
  console.log(`- Correo: ${nuevo.correo}`);
  console.log(`- Rol: ${nuevo.rol}`);
} catch (error) {
  console.error('Error al crear administrador:', error);
} finally {
  rl.close();
}
