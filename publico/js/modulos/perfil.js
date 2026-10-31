// publico/js/modulos/perfil.js · Módulo de gestión del perfil de usuario
import { montarPlantilla } from '../nucleo/plantilla.js';
import api from '../nucleo/api.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { aviso, escapar } from '../nucleo/ui.js';
import { logrosDe } from '../nucleo/gamificacion.js';
import { fechaLarga } from '../nucleo/util.js';
import { generarDiploma } from '../nucleo/pdf.js';

await montarPlantilla({ titulo: 'Mi Perfil', roles: ['sesion'] });

const contenido = document.getElementById('contenido');
if (contenido) {
  let usuario = usuarioActual() || {};

  try {
    const fresh = await api.llamar('GET', '/api/auth/yo');
    if (fresh) {
      usuario = { ...usuario, ...fresh };
      sessionStorage.setItem('usuario', JSON.stringify(usuario));
    }
  } catch (err) {
    console.warn('No se pudo refrescar datos de usuario:', err);
  }

  let urlFotoActual = usuario.foto || null;

  function renderizarFoto(url, nombre = '', apellido = '') {
    if (url) {
      return `<img src="${escapar(url)}" alt="Foto de perfil" class="perfil-foto-preview" id="img-foto-preview">`;
    }
    const iniciales = `${(nombre[0] || 'U').toUpperCase()}${(apellido[0] || '').toUpperCase()}`;
    return `<div class="perfil-foto-placeholder" id="placeholder-foto">${escapar(iniciales)}</div>`;
  }

  contenido.innerHTML = `
    <div class="pila pila--amplia">
      <div class="perfil-grid">
        <!-- 1. Datos Personales -->
        <section class="tarjeta pila pila--media">
          <header class="tarjeta__encabezado">
            <h2>Datos Personales</h2>
            <p>Actualiza tu información pública y fotografía de perfil.</p>
          </header>

          <form id="form-perfil" class="pila pila--media" novalidate>
            <div class="perfil-foto-contenedor">
              <div id="contenedor-avatar">
                ${renderizarFoto(urlFotoActual, usuario.nombre, usuario.apellido)}
              </div>
              <div class="pila pila--compacta">
                <label for="campo-foto" class="btn btn--secundario btn--pequeno" style="cursor: pointer; display: inline-block;">
                  Seleccionar foto
                </label>
                <input type="file" id="campo-foto" accept="image/jpeg,image/png,image/webp" class="sr-only">
                <span style="font-size: var(--texto-xs); color: var(--color-texto-suave);">JPG, PNG o WEBP (máx. 2 MB)</span>
                <span class="campo__error" id="error-foto" aria-live="polite"></span>
              </div>
            </div>

            <div class="campo">
              <label for="perfil-nombre">Nombre</label>
              <input type="text" id="perfil-nombre" name="nombre" value="${escapar(usuario.nombre || '')}" required>
              <span class="campo__error" id="error-nombre" aria-live="polite"></span>
            </div>

            <div class="campo">
              <label for="perfil-apellido">Apellido</label>
              <input type="text" id="perfil-apellido" name="apellido" value="${escapar(usuario.apellido || '')}" required>
              <span class="campo__error" id="error-apellido" aria-live="polite"></span>
            </div>

            <div class="campo">
              <label for="perfil-correo">Correo electrónico</label>
              <input type="email" id="perfil-correo" value="${escapar(usuario.correo || '')}" disabled>
              <span style="font-size: var(--texto-xs); color: var(--color-texto-suave);">El correo institucional no puede modificarse.</span>
            </div>

            <div class="campo">
              <label>Rol asignado</label>
              <div><span class="insignia insignia--primario">${escapar(usuario.rol || 'estudiante')}</span></div>
            </div>

            <button type="submit" id="btn-guardar-perfil" class="btn btn--primario" style="margin-top: var(--espacio-s);">
              Guardar Cambios
            </button>
          </form>
        </section>

        <!-- 2. Seguridad / Cambiar Contraseña -->
        <section class="tarjeta pila pila--media">
          <header class="tarjeta__encabezado">
            <h2>Seguridad</h2>
            <p>Modifica tu contraseña de acceso periódicamente para proteger tu cuenta.</p>
          </header>

          <form id="form-clave" class="pila pila--media" novalidate>
            <div class="campo">
              <label for="clave-actual">Contraseña actual</label>
              <input type="password" id="clave-actual" autocomplete="current-password" required>
              <span class="campo__error" id="error-clave-actual" aria-live="polite"></span>
            </div>

            <div class="campo">
              <label for="clave-nueva">Nueva contraseña</label>
              <input
                type="password"
                id="clave-nueva"
                autocomplete="new-password"
                placeholder="Mínimo 8 caracteres, letras y números"
                required
              >
              <span class="campo__error" id="error-clave-nueva" aria-live="polite"></span>
            </div>

            <div class="campo">
              <label for="clave-repetir">Repetir nueva contraseña</label>
              <input type="password" id="clave-repetir" autocomplete="new-password" required>
              <span class="campo__error" id="error-clave-repetir" aria-live="polite"></span>
            </div>

            <button type="submit" id="btn-cambiar-clave" class="btn btn--primario" style="margin-top: var(--espacio-s);">
              Actualizar Contraseña
            </button>
          </form>
        </section>
      </div>

      <!-- Sección de logros requerida (vacía para Sprint 5) -->
      <section id="logros"></section>
    </div>
  `;

  // Elementos Datos Personales
  const formPerfil = document.getElementById('form-perfil');
  const inputNombre = document.getElementById('perfil-nombre');
  const inputApellido = document.getElementById('perfil-apellido');
  const inputFoto = document.getElementById('campo-foto');
  const errorNombre = document.getElementById('error-nombre');
  const errorApellido = document.getElementById('error-apellido');
  const errorFoto = document.getElementById('error-foto');
  const btnGuardarPerfil = document.getElementById('btn-guardar-perfil');
  const contenedorAvatar = document.getElementById('contenedor-avatar');

  // Subida de imagen
  inputFoto.addEventListener('change', async e => {
    errorFoto.textContent = '';
    const archivo = e.target.files && e.target.files[0];
    if (!archivo) return;

    if (archivo.size > 2 * 1024 * 1024) {
      errorFoto.textContent = 'El archivo supera el límite de 2 MB.';
      inputFoto.value = '';
      return;
    }

    try {
      btnGuardarPerfil.disabled = true;
      const res = await api.subir(archivo);
      if (res && res.url) {
        urlFotoActual = res.url;
        contenedorAvatar.innerHTML = renderizarFoto(urlFotoActual, inputNombre.value, inputApellido.value);
        aviso('Foto subida con éxito. Recuerda guardar cambios.', 'info');
      }
    } catch (err) {
      errorFoto.textContent = err.message || 'Error al subir la imagen';
      aviso(err.message || 'Error al subir la imagen', 'error');
    } finally {
      btnGuardarPerfil.disabled = false;
    }
  });

  // Envío Formulario Perfil
  formPerfil.addEventListener('submit', async e => {
    e.preventDefault();
    errorNombre.textContent = '';
    errorApellido.textContent = '';

    const nombre = inputNombre.value.trim();
    const apellido = inputApellido.value.trim();

    if (!nombre) {
      errorNombre.textContent = 'El nombre no puede estar vacío';
      inputNombre.focus();
      return;
    }
    if (!apellido) {
      errorApellido.textContent = 'El apellido no puede estar vacío';
      inputApellido.focus();
      return;
    }

    btnGuardarPerfil.disabled = true;
    const txt = btnGuardarPerfil.textContent;
    btnGuardarPerfil.textContent = 'Guardando...';

    try {
      const resp = await api.llamar('PUT', '/api/auth/perfil', {
        nombre,
        apellido,
        foto: urlFotoActual
      });

      // Actualizar usuario guardado en sessionStorage
      const sesionActual = usuarioActual() || {};
      const usuarioActualizado = {
        ...sesionActual,
        nombre: resp.nombre,
        apellido: resp.apellido,
        foto: resp.foto
      };
      sessionStorage.setItem('usuario', JSON.stringify(usuarioActualizado));

      // Actualizar texto en el encabezado
      const enlaceEncabezado = document.querySelector('.encabezado__usuario-enlace');
      if (enlaceEncabezado) {
        enlaceEncabezado.textContent = `${resp.nombre} (${resp.rol})`;
      }

      aviso('Perfil actualizado correctamente', 'exito');
    } catch (err) {
      aviso(err.message || 'No se pudo actualizar el perfil', 'error');
    } finally {
      btnGuardarPerfil.disabled = false;
      btnGuardarPerfil.textContent = txt;
    }
  });

  // Elementos Cambiar Contraseña
  const formClave = document.getElementById('form-clave');
  const inputClaveActual = document.getElementById('clave-actual');
  const inputClaveNueva = document.getElementById('clave-nueva');
  const inputClaveRepetir = document.getElementById('clave-repetir');
  const errorClaveActual = document.getElementById('error-clave-actual');
  const errorClaveNueva = document.getElementById('error-clave-nueva');
  const errorClaveRepetir = document.getElementById('error-clave-repetir');
  const btnCambiarClave = document.getElementById('btn-cambiar-clave');

  formClave.addEventListener('submit', async e => {
    e.preventDefault();
    errorClaveActual.textContent = '';
    errorClaveNueva.textContent = '';
    errorClaveRepetir.textContent = '';

    const actual = inputClaveActual.value;
    const nueva = inputClaveNueva.value;
    const repetir = inputClaveRepetir.value;

    if (!actual) {
      errorClaveActual.textContent = 'Ingresa tu contraseña actual';
      inputClaveActual.focus();
      return;
    }
    if (!nueva || nueva.length < 8 || !/[a-zA-Z]/.test(nueva) || !/[0-9]/.test(nueva)) {
      errorClaveNueva.textContent = 'La nueva contraseña debe tener mínimo 8 caracteres con letras y números';
      inputClaveNueva.focus();
      return;
    }
    if (nueva !== repetir) {
      errorClaveRepetir.textContent = 'Las contraseñas no coinciden';
      inputClaveRepetir.focus();
      return;
    }

    btnCambiarClave.disabled = true;
    const txtClave = btnCambiarClave.textContent;
    btnCambiarClave.textContent = 'Actualizando...';

    try {
      await api.llamar('POST', '/api/auth/clave', { actual, nueva });
      aviso('Contraseña actualizada con éxito', 'exito');
      formClave.reset();
    } catch (err) {
      aviso(err.message || 'Error al actualizar contraseña', 'error');
      errorClaveActual.textContent = err.message || 'Error al actualizar contraseña';
    } finally {
      btnCambiarClave.disabled = false;
      btnCambiarClave.textContent = txtClave;
    }
  });

  // Renderizar sección de logros pedagógicos (solo estudiantes)
  async function cargarLogros() {
    const seccionLogros = document.getElementById('logros');
    if (!seccionLogros) return;

    if (usuario.rol !== 'estudiante') {
      seccionLogros.innerHTML = '';
      return;
    }

    try {
      const [datosLogros, todasInsignias, estadoCertificado] = await Promise.all([
        logrosDe('yo').catch(() => ({ puntos: 0, insignias: [] })),
        api.listar('insignias').catch(() => []),
        api.llamar('GET', '/api/certificados/estado').catch(() => ({ condiciones: [], cumple: false }))
      ]);

      const puntos = datosLogros?.puntos || 0;
      const insigniasDesbloqueadas = new Map(
        (datosLogros?.insignias || []).map(ins => [ins.id, ins])
      );

      const condiciones = estadoCertificado?.condiciones || [];
      const cumpleCertificado = Boolean(estadoCertificado?.cumple);

      seccionLogros.innerHTML = `
        <div class="logros-contenedor">
          <!-- 1. Puntos totales e información de logros -->
          <div class="tarjeta pila pila--media">
            <header class="tarjeta__encabezado">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espacio-s);">
                <div>
                  <h2>🏆 Mis Logros Académicos</h2>
                  <p>Progreso pedagógico y puntos acumulados en tus actividades formativas.</p>
                </div>
                <div class="logros-banner-puntos">
                  <span class="logros-banner-puntos__etiqueta">Puntos Totales</span>
                  <span class="logros-banner-puntos__valor" id="puntos-usuario">${puntos} pts</span>
                </div>
              </div>
            </header>

            <!-- 2. Vitrina de insignias: obtenidas y bloqueadas -->
            <section class="pila pila--s">
              <h3 style="font-size: var(--texto-m); color: var(--color-primario); margin: 0;">
                🏅 Vitrina de Insignias
              </h3>
              ${todasInsignias.length === 0 ? `
                <p style="color: var(--color-texto-suave); font-size: var(--texto-s);">No hay insignias registradas en el catálogo.</p>
              ` : `
                <div class="vitrina-insignias">
                  ${todasInsignias.map(ins => {
                    const obtenida = insigniasDesbloqueadas.has(ins.id);
                    const fechaObj = obtenida ? insigniasDesbloqueadas.get(ins.id) : null;
                    const fechaTexto = fechaObj?.fecha ? fechaLarga(fechaObj.fecha) : '';

                    if (obtenida) {
                      return `
                        <article class="tarjeta-insignia tarjeta-insignia--obtenida">
                          <span class="tarjeta-insignia__icono" aria-hidden="true">${escapar(ins.icono || '🏅')}</span>
                          <div class="tarjeta-insignia__contenido">
                            <div class="tarjeta-insignia__encabezado">
                              <h4 class="tarjeta-insignia__nombre">${escapar(ins.nombre)}</h4>
                              <span class="insignia insignia--exito" style="font-size: var(--texto-xs);">Obtenida</span>
                            </div>
                            ${fechaTexto ? `
                              <span class="tarjeta-insignia__fecha">Obtenida el ${escapar(fechaTexto)}</span>
                            ` : ''}
                          </div>
                        </article>
                      `;
                    }

                    return `
                      <article class="tarjeta-insignia tarjeta-insignia--bloqueada">
                        <span class="tarjeta-insignia__icono" aria-hidden="true">${escapar(ins.icono || '🔒')}</span>
                        <div class="tarjeta-insignia__contenido">
                          <div class="tarjeta-insignia__encabezado">
                            <h4 class="tarjeta-insignia__nombre">${escapar(ins.nombre)}</h4>
                            <span class="insignia" style="font-size: var(--texto-xs);">Bloqueada</span>
                          </div>
                          <p class="tarjeta-insignia__condicion">
                            <strong>Condición:</strong> ${escapar(ins.descripcion || 'Cumplir el objetivo formativo asociado.')}
                          </p>
                        </div>
                      </article>
                    `;
                  }).join('')}
                </div>
              `}
            </section>
          </div>

          <!-- 3. Certificado de cumplimiento -->
          <section class="certificado-tarjeta pila pila--media">
            <header class="tarjeta__encabezado">
              <div style="display: flex; align-items: center; gap: var(--espacio-s);">
                <span style="font-size: var(--texto-2xl);" aria-hidden="true">📜</span>
                <div>
                  <h2 style="margin: 0; color: var(--color-primario); font-size: var(--texto-l);">
                    Certificado de Cumplimiento
                  </h2>
                  <p style="margin: var(--espacio-xs) 0 0 0; color: var(--color-texto-suave); font-size: var(--texto-s);">
                    Acredita tu trayectoria y excelencia académica completando todos los requisitos formativos.
                  </p>
                </div>
              </div>
            </header>

            <div class="certificado-condiciones-lista">
              ${condiciones.map(cond => {
                const porcentaje = cond.requerido > 0 
                  ? Math.min(100, Math.round((cond.actual / cond.requerido) * 100))
                  : (cond.cumple ? 100 : 0);

                return `
                  <div class="certificado-condicion">
                    <div class="certificado-condicion__cabecera">
                      <span class="certificado-condicion__nombre">
                        ${cond.cumple ? '✅' : '⏳'} ${escapar(cond.nombre)}
                      </span>
                      <span class="certificado-condicion__valores">
                        ${cond.actual} / ${cond.requerido} (${porcentaje}%)
                      </span>
                    </div>
                    <div class="progreso ${cond.cumple ? 'progreso--exito' : 'progreso--primario'}" role="progressbar" aria-valuenow="${porcentaje}" aria-valuemin="0" aria-valuemax="100">
                      <span class="progreso__barra" style="width: ${porcentaje}%;"></span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <div class="certificado-acciones">
              <div>
                <span class="insignia ${cumpleCertificado ? 'insignia--exito' : 'insignia--advertencia'}">
                  ${cumpleCertificado ? '🎉 Requisitos cumplidos al 100%' : '⏳ Requisitos en progreso'}
                </span>
              </div>
              <button type="button"
                      id="btn-descargar-certificado"
                      class="btn btn--primario"
                      ${cumpleCertificado ? '' : 'disabled'}>
                🎓 Descargar certificado
              </button>
            </div>
          </section>
        </div>
      `;

      // Manejador para la descarga del diploma
      const btnDescargar = document.getElementById('btn-descargar-certificado');
      if (btnDescargar && cumpleCertificado) {
        btnDescargar.addEventListener('click', async () => {
          const textoOriginal = btnDescargar.textContent;
          try {
            btnDescargar.disabled = true;
            btnDescargar.textContent = 'Generando diploma PDF...';
            const res = await generarDiploma({ tipo: 'cumplimiento' });
            aviso(`¡Certificado descargado con éxito! Código: ${res.codigo}`, 'exito');
          } catch (error) {
            aviso(error.message || 'No se pudo generar el certificado', 'error');
          } finally {
            btnDescargar.disabled = false;
            btnDescargar.textContent = textoOriginal;
          }
        });
      }

    } catch (e) {
      seccionLogros.innerHTML = `
        <div class="tarjeta" style="color: var(--color-error); padding: var(--espacio-m);">
          No se pudieron cargar los logros formativos ni el estado del certificado.
        </div>
      `;
    }
  }

  await cargarLogros();
}
