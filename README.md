# NexoGuard — Frontend

NexoGuard es un proyecto destinado a ayudar a propietarios de sitios web a revisar aspectos observables de seguridad y comprender los hallazgos. Este frontend será la interfaz para consultar y gestionar esas revisiones.

La aplicación utiliza Next.js, React, TypeScript y Tailwind CSS. Actualmente muestra una página inicial provisional y **no tiene integración funcional con una API ni funcionalidades de negocio**.

## Estructura

```text
src/app/
  layout.tsx       Diseño raíz y metadatos
  page.tsx         Página inicial provisional
  page.test.tsx    Prueba de la página inicial
  globals.css      Estilos globales y Tailwind
```

En la raíz se encuentran las configuraciones de Next.js, TypeScript, ESLint, Jest y PostCSS, además del Dockerfile. La plantilla `.env.example` no requiere variables por ahora. Nunca incluyas secretos en variables `NEXT_PUBLIC_`, pues se exponen al navegador.

## Instalación y ejecución

Con Node.js 24 y npm disponibles, desde este directorio:

```bash
npm ci
npm run dev
```

La página se sirve en `http://127.0.0.1:3000`. Para generar y ejecutar una compilación de producción se pueden usar `npm run build` y `npm start`.

## Docker y validación

El Dockerfile construye y ejecuta la aplicación. La configuración Docker Compose se encuentra en la raíz del espacio de trabajo, fuera de este repositorio, y conecta el frontend con los demás servicios locales. Todavía no existe integración funcional de API.

Las comprobaciones configuradas son:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

La prueba disponible comprueba que la página inicial muestra el nombre de NexoGuard; no valida flujos de negocio ni comunicación con el backend.

## Funcionalidades previstas

Se prevén pantallas de acceso, listado de sitios, verificación de dominio, resultados, historial y alertas, junto con la integración segura de la API y el manejo de estados de carga y error. Estas funcionalidades todavía deben desarrollarse.
