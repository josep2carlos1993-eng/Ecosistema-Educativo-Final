// publico/js/modulos/privacidad.js · Módulo de la página de privacidad
import { montarPlantilla } from '../nucleo/plantilla.js';

await montarPlantilla({ titulo: 'Aviso de Privacidad', roles: ['publico'] });

const contenido = document.getElementById('contenido');
if (contenido) {
  contenido.innerHTML = `
    <article class="tarjeta privacidad-tarjeta pila pila--media">
      <div>
        <span class="insignia insignia--info">Cumplimiento LOPDP Ecuador</span>
        <h2>Aviso de Privacidad y Protección de Datos Personales</h2>
        <p>
          En el Ecosistema Educativo Digital nos comprometemos a garantizar la confidencialidad,
          integridad y seguridad de los datos personales de todos nuestros usuarios.
        </p>
      </div>

      <section class="privacidad-seccion pila pila--compacta">
        <h3>1. Finalidad del Tratamiento</h3>
        <p>
          Los datos personales recolectados se utilizan exclusivamente con fines académicos, pedagógicos
          y de gestión formativa, facilitando la personalización del aprendizaje, el seguimiento del progreso educativo
          y el acceso seguro a las herramientas de la plataforma.
        </p>
      </section>

      <section class="privacidad-seccion pila pila--compacta">
        <h3>2. Datos Tratados</h3>
        <p>La plataforma recopila y procesa únicamente la siguiente información estrictamente necesaria:</p>
        <ul class="privacidad-lista">
          <li><strong>Datos de identificación:</strong> Nombre y apellido.</li>
          <li><strong>Datos de contacto y acceso:</strong> Dirección de correo electrónico.</li>
          <li><strong>Datos de actividad formativa:</strong> Progreso en temas, intentos en actividades, tiempo de dedicación y registros de navegación en la plataforma (bitácora).</li>
        </ul>
      </section>

      <section class="privacidad-seccion pila pila--compacta">
        <h3>3. Derechos de los Titulares (LOPDP del Ecuador)</h3>
        <p>
          De conformidad con la Ley Orgánica de Protección de Datos Personales (LOPDP) de la República del Ecuador,
          los usuarios tienen derecho al <strong>acceso</strong>, <strong>rectificación</strong>, <strong>actualización</strong>,
          <strong>oposición</strong> y <strong>eliminación</strong> de sus datos personales, así como a revocar su consentimiento
          en cualquier momento.
        </p>
      </section>

      <section class="privacidad-seccion pila pila--compacta">
        <h3>4. Canal de Contacto</h3>
        <p>
          Para ejercer cualquiera de sus derechos o formular consultas relativas a su privacidad, puede comunicarse
          con nuestro canal de atención al correo electrónico:
          <a href="mailto:privacidad@ecosistemaeducativo.edu.ec">privacidad@ecosistemaeducativo.edu.ec</a>.
        </p>
      </section>

      <div class="fila" style="margin-top: var(--espacio-m);">
        <a href="/paginas/registro.html" class="btn btn--primario">Volver al Registro</a>
        <a href="/index.html" class="btn btn--texto">Ir al Inicio</a>
      </div>
    </article>
  `;
}
