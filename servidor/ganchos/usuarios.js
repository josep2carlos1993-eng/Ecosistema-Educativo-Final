// servidor/ganchos/usuarios.js · Ganchos para la colección usuarios

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista)) return lista;
  return lista.map(item => {
    if (!item) return item;
    const { claveHash, ...resto } = item;
    return resto;
  });
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!datos) return datos;

  const copia = { ...datos };
  delete copia.claveHash;
  delete copia.correo;

  if (anterior) {
    copia.correo = anterior.correo;
    copia.claveHash = anterior.claveHash;

    // Evita que un admin se quite el rol o se desactive a sí mismo
    if (usuario && usuario.id === anterior.id) {
      if (copia.rol !== undefined && copia.rol !== anterior.rol) {
        const err = new Error('No puedes cambiar tu propio rol de administrador');
        err.estado = 400;
        throw err;
      }

      if (copia.activo !== undefined && copia.activo === false && anterior.activo === true) {
        const err = new Error('No puedes desactivar tu propia cuenta de administrador');
        err.estado = 400;
        throw err;
      }
    }
  }

  return copia;
}

export default {
  filtrarLista,
  antesDeGuardar
};
