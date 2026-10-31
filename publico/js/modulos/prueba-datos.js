// publico/js/modulos/prueba-datos.js · Módulo para prueba de datos y API

import { montarPlantilla } from '../nucleo/plantilla.js';
import { crear, listar } from '../nucleo/api.js';
import { aviso, escapar, cargando } from '../nucleo/ui.js';
import { fechaRelativa } from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Prueba de datos', roles: ['publico'] });

const contenido = document.getElementById('contenido');
if (contenido) {
  contenido.innerHTML = `
    <div class="contenedor-prueba">
      <section class="tarjeta pila">
        <header class="tarjeta__encabezado">
          <h2>Nuevo registro en colección "prueba"</h2>
          <p style="color: var(--color-texto-suave); font-size: var(--texto-s); margin-bottom: 0;">
            Ingresa un texto para enviarlo mediante <code>api.crear('prueba', ...)</code> y almacenarlo de forma segura.
          </p>
        </header>

        <form id="form-prueba" class="pila" autocomplete="off">
          <div class="campo">
            <label for="campo-texto">Texto del registro</label>
            <input type="text" id="campo-texto" name="texto" placeholder="Escribe el contenido aquí..." required>
          </div>

          <div class="fila">
            <button type="submit" class="btn btn--primario" id="btn-guardar">Guardar en "prueba"</button>
            <button type="button" class="btn btn--secundario" id="btn-recargar">Actualizar lista</button>
          </div>
        </form>
      </section>

      <section class="pila">
        <div class="fila fila--entre">
          <h3>Registros almacenados</h3>
          <span class="insignia insignia--primario" id="conteo-registros">0 registros</span>
        </div>

        <div id="lista-registros" class="pila pila--compacta"></div>
      </section>
    </div>
  `;

  const form = document.getElementById('form-prueba');
  const inputTexto = document.getElementById('campo-texto');
  const listaContenedor = document.getElementById('lista-registros');
  const conteoElemento = document.getElementById('conteo-registros');
  const btnRecargar = document.getElementById('btn-recargar');

  async function cargarLista() {
    try {
      cargando(true);
      const registros = await listar('prueba');
      conteoElemento.textContent = `${registros.length} registro${registros.length === 1 ? '' : 's'}`;

      if (!registros || registros.length === 0) {
        listaContenedor.innerHTML = `
          <div class="vacio">
            <div class="vacio__icono" aria-hidden="true">📭</div>
            <div class="vacio__titulo">No hay registros</div>
            <p class="vacio__texto">Aún no se han guardado elementos en la colección "prueba". Agrega uno con el formulario.</p>
          </div>
        `;
        return;
      }

      const itemsHtml = registros.map(r => `
        <article class="item-registro">
          <div class="pila pila--compacta">
            <strong>${escapar(r.texto || '(Sin texto)')}</strong>
            <small style="color: var(--color-texto-suave);">ID: <code>${escapar(r.id)}</code> · ${fechaRelativa(r.fecha)}</small>
          </div>
          <span class="insignia insignia--exito">Almacenado</span>
        </article>
      `).join('');

      listaContenedor.innerHTML = itemsHtml;
    } catch (error) {
      aviso(error.message || 'Error al obtener registros', 'error');
    } finally {
      cargando(false);
    }
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const texto = inputTexto.value.trim();
    if (!texto) {
      aviso('El campo de texto no puede estar vacío', 'advertencia');
      return;
    }

    try {
      cargando(true);
      const nuevo = await crear('prueba', { texto });
      aviso(`Registro creado con éxito (ID: ${nuevo.id})`, 'exito');
      inputTexto.value = '';
      await cargarLista();
    } catch (error) {
      aviso(error.message || 'Error al guardar el registro', 'error');
    } finally {
      cargando(false);
    }
  });

  if (btnRecargar) {
    btnRecargar.addEventListener('click', async () => {
      await cargarLista();
      aviso('Lista actualizada', 'info');
    });
  }

  // Carga inicial
  await cargarLista();
}
