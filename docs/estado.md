# docs/estado.md · Estado del proyecto (máximo 30 líneas)
Sprint terminado: S06 · Fecha: 2026-10-26 · Velocidad real: 28 puntos
 
## Funciona
- Motor de gamificación y cliente (registrarIntento, mostrarLogros, logrosDe).
- Módulos núcleo: retroalimentacion.js (mostrarRetro, mostrarResumen), selector-tema.js y catalogo-actividades.js.
- Actividades lúdicas interactivas: Flashcards (3D flip), Completar conceptos, Emparejar términos, Encuentra la pareja (P04.4) y Sopa de letras (P05.1).
- Certificados y diplomas (P05.2): servidor (/api/certificados), PDF (pdf.js) y verificación pública (verificar.html).
- Vitrina de insignias y certificado de cumplimiento en perfil (P05.3): barras .progreso por condición y descarga con generarDiploma.
- Resúmenes de progreso en servidor (P06.1): GET /api/resumen/estudiante/:id y GET /api/resumen/grupo/:grupoId con promedios, evolución temporal y pendientes.
- Banco de preguntas y generación con IA (P08.1): preparador, ganchos con puedeEditarAsignatura, interfaz banco-preguntas.html y ruta /api/ia/generar-preguntas.
- Canciones educativas (karaoke LRC) y noticias.
- Página de inicio (P03.3): estados sin/con sesión, último tema, asignaturas con avance y noticias.
 
## Decisiones y cambios respecto a docs/contratos.md
- Se integró visualización interactiva de logros formativos en el perfil del usuario.
- Se implementaron 3 actividades interactivas completas con retroalimentación inmediata.
 
## Problemas conocidos
- Ninguno.
 
## Pendiente para el siguiente sprint
- Módulo de Quiz evaluativo por niveles (/api/quiz/ y paginas/quiz.html).
