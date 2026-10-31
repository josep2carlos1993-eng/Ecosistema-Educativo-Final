# Ecosistema Educativo Digital

Plataforma web educativa modular para contenidos, actividades gamificadas, tutoría socrática y gestión académica.

## Requisitos

- Node.js 20 o superior (LTS)
- npm (incluido con Node.js)

## Instalación y puesta en marcha

1. Instalar dependencias del proyecto:
   ```bash
   npm install
   ```

2. Configurar las variables de entorno:
   ```bash
   # En Windows PowerShell:
   Copy-Item .env.ejemplo .env

   # En Linux / macOS / Bash:
   cp .env.ejemplo .env
   ```

3. Iniciar el servidor:
   ```bash
   npm start
   ```

El servidor estará disponible en `http://localhost:3000`.
