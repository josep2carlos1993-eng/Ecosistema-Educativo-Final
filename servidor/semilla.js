// servidor/semilla.js · Inicialización de datos semilla
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import bcrypt from 'bcryptjs';

const DIR_SEMILLA = path.resolve('datos', 'semilla');
const DIR_DATOS = path.resolve('datos');

async function main() {
  const forzar = process.argv.includes('--forzar');

  if (forzar) {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    const respuesta = await rl.question('¿Desea sobrescribir las colecciones existentes con los datos semilla? (s/N): ');
    rl.close();

    const normalizada = respuesta.trim().toLowerCase();
    if (normalizada !== 's' && normalizada !== 'si' && normalizada !== 'y') {
      console.log('Operación cancelada por el usuario.');
      process.exit(0);
    }
  }

  try {
    const archivos = await fs.readdir(DIR_SEMILLA);
    const jsonArchivos = archivos.filter(a => a.endsWith('.json') && !a.startsWith('.')).sort();

    console.log(`=== Cargando datos semilla (${forzar ? 'Modo Forzado' : 'Modo Seguro'}) ===`);

    for (const archivo of jsonArchivos) {
      const col = archivo.slice(0, -5);
      const rutaOrigen = path.join(DIR_SEMILLA, archivo);
      const rutaDestino = path.join(DIR_DATOS, archivo);

      let existe = false;
      try {
        await fs.access(rutaDestino);
        existe = true;
      } catch {
        existe = false;
      }

      if (existe && !forzar) {
        console.log(`- Colección "${col}" ya existe. Omitiendo (usa --forzar para sobrescribir).`);
        continue;
      }

      if (archivo === 'usuarios.json') {
        const contenidoRaw = await fs.readFile(rutaOrigen, 'utf-8');
        const usuarios = JSON.parse(contenidoRaw);
        const claveHash = await bcrypt.hash('Demo12345', 10);

        const usuariosConClave = usuarios.map(u => ({
          ...u,
          claveHash
        }));

        await fs.writeFile(rutaDestino, JSON.stringify(usuariosConClave, null, 2), 'utf-8');
        console.log(`+ Colección "${col}" generada con claveHash para todos los usuarios ("Demo12345").`);
      } else {
        await fs.copyFile(rutaOrigen, rutaDestino);
        console.log(`+ Colección "${col}" copiada exitosamente a datos/.`);
      }
    }

    console.log('\nProceso de inicialización de datos semilla finalizado con éxito.');
  } catch (error) {
    console.error('Error al procesar datos semilla:', error.message);
    process.exit(1);
  }
}

main();
