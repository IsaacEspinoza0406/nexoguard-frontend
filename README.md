# NexoGuard — Frontend

NexoGuard es un proyecto destinado a ayudar a propietarios de sitios web a revisar aspectos observables de seguridad y comprender los hallazgos. Este frontend será la interfaz para consultar y gestionar esas revisiones.

La aplicación utiliza Next.js, React, TypeScript y Tailwind CSS. La página inicial permite registrar una cuenta mediante la API local; todavía no implementa inicio de sesión ni otras funcionalidades de negocio.

## Estructura

```text
src/app/
  layout.tsx       Diseño raíz y metadatos
  page.tsx         Formulario de registro y comunicación con la API
  page.test.tsx    Pruebas del formulario con API simulada
  globals.css      Estilos globales y Tailwind
```

En la raíz se encuentran las configuraciones de Next.js, TypeScript, ESLint, Jest y PostCSS, además del Dockerfile. `NEXT_PUBLIC_API_URL` identifica la URL pública para el navegador y por defecto es `http://127.0.0.1:3001`. Nunca incluyas secretos en variables `NEXT_PUBLIC_`, pues se exponen al navegador.

## Instalación y ejecución

Con Node.js 24 y npm disponibles, desde este directorio:

```bash
npm ci
npm run dev
```

La página se sirve en `http://127.0.0.1:3000`. Para generar y ejecutar una compilación de producción se pueden usar `npm run build` y `npm start`.

## Docker y validación

El Dockerfile incorpora `NEXT_PUBLIC_API_URL` durante la compilación. La configuración Docker Compose se encuentra en la raíz del espacio de trabajo, fuera de este repositorio, y fija la URL local para el navegador. Si se modifica, es necesario reconstruir la imagen; el hostname interno `back` no es accesible desde el navegador. El backend local solo acepta el origen `http://127.0.0.1:3000`.

Las comprobaciones configuradas son:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Las pruebas del formulario simulan la API; no prueban persistencia real. El flujo local obtiene un token CSRF con cookie HttpOnly y envía correo y contraseña con credenciales. No guarda el token ni la contraseña en almacenamiento local.

## Funcionalidades previstas

Se prevén pantallas de acceso, listado de sitios, verificación de dominio, resultados, historial y alertas. Estas funcionalidades todavía deben desarrollarse. La configuración local de origen, cookies y CSRF requiere revisión antes de un despliegue de producción.
