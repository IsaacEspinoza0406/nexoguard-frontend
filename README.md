# NexoGuard — Frontend

NexoGuard es un proyecto destinado a ayudar a propietarios de sitios web a revisar aspectos observables de seguridad y comprender los hallazgos. Este frontend será la interfaz para consultar y gestionar esas revisiones.

La aplicación utiliza Next.js, React, TypeScript y Tailwind CSS. Permite registro (`/`), inicio de sesión (`/login`) y acceso a la cuenta privada con cierre de sesión (`/cuenta`). Next.js consulta al backend desde el servidor antes de renderizar el área privada; no basta con que exista una cookie.

El [backend complementario](https://github.com/IsaacEspinoza0406/nexoguard-backend) proporciona la API NestJS y la persistencia Prisma/MySQL. El registro se probó de extremo a extremo en Docker local con datos ficticios y limpieza posterior.

## Estructura

```text
src/app/
  layout.tsx       Diseño raíz y metadatos
  page.tsx         Formulario de registro y comunicación con la API
  page.test.tsx    Pruebas del formulario con API simulada
  globals.css      Estilos globales y Tailwind
  login/           Pantalla de acceso y pruebas
  cuenta/          Página privada, logout y gestor de sitios/verificación
src/lib/           Cliente de API con credenciales y CSRF
```

En la raíz se encuentran las configuraciones de Next.js, TypeScript, ESLint, Jest y PostCSS, además del Dockerfile. `NEXT_PUBLIC_API_URL` identifica la URL pública para el navegador y por defecto es `http://127.0.0.1:3001`. Nunca incluyas secretos en variables `NEXT_PUBLIC_`, pues se exponen al navegador.

## Instalación y ejecución

Con Node.js 24, npm y el backend local configurado y en ejecución, desde este directorio:

```bash
npm ci
npm run dev
```

La página se sirve en `http://127.0.0.1:3000`. Para generar y ejecutar una compilación de producción se pueden usar `npm run build` y `npm start`.

## Docker y validación

El Dockerfile incorpora `NEXT_PUBLIC_API_URL` durante la compilación. Compose fija la URL local para el navegador. Si se modifica, es necesario reconstruir la imagen; el hostname interno `back` no es accesible desde el navegador. `API_INTERNAL_URL`, exclusiva del servidor y configurable en ejecución, se establece como `http://back:3001` en Docker y usa `http://127.0.0.1:3001` por defecto fuera de Docker. El backend local solo acepta el origen `http://127.0.0.1:3000`; utiliza esa dirección y no `localhost`.

Login y logout obtienen primero `/auth/csrf`, envían cookies con `credentials: 'include'` y el token en `X-CSRF-Token`. No guardan tokens ni contraseñas en almacenamiento local. En producción se requiere HTTPS y frontend/API bajo un mismo hostname para el renderizado autenticado; las cookies son host-only. El contrato detallado se documenta en el backend, en `AUTH.md`. La configuración Docker/MySQL actual sigue destinada a desarrollo local.

Las comprobaciones configuradas son:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Las pruebas del formulario simulan la API; no prueban persistencia real. El flujo local obtiene un token CSRF con cookie HttpOnly y envía correo y contraseña con credenciales. No guarda el token ni la contraseña en almacenamiento local.

## Funcionalidades previstas

En `/cuenta` ya se pueden registrar y listar sitios propios, generar o renovar un desafío y solicitar la comprobación de un archivo publicado en `https://<dominio>/.well-known/nexoguard-verification.txt`. El código caduca en 30 minutos; la verificación, en 30 días. Cada subdominio requiere prueba propia. Renovar invalida desafíos y verificaciones anteriores. El código se mantiene solo en memoria de la pantalla; al perderlo se genera otro. El backend comprueba propiedad, CSRF, DNS público y conexión HTTPS sin redirecciones. El contrato y los límites están en `SITES.md` del repositorio backend.

Las pruebas del gestor usan API simulada y no demuestran DNS público ni persistencia por sí solas. La integración separada del backend usa MySQL real y respuestas DNS/HTTPS controladas, con limpieza exclusiva de sus cuentas ficticias.

En cada sitio se puede iniciar un análisis manual con propiedad vigente, consultar su estado, los últimos 50 trabajos y sus resultados con evidencia y recomendaciones separadas. El backend valida propietario y revisión actual; el botón no es una barrera de autorización. Se conservan cookies y CSRF. El contrato y las limitaciones están en `ANALYSIS.md` del backend. El ensayo público del motor propio fue completado según evidencia aportada por el propietario; véase el apartado final, sin atribuir observación directa al agente.

Programación diaria/semanal y alertas en aplicación disponibles, con activación expresa por sitio y aviso inicial a 30 días. SSL Labs complementario muestra estado, fecha y notas del proveedor; su acceso real requiere registro institucional y configuración del backend. La configuración de origen, cookies, proxy y TLS requiere validación del despliegue de producción.

La comparación por comprobación y el catálogo completo de recomendaciones se describen en [COMPARISONS.md](../back/COMPARISONS.md). No se calculan puntuaciones globales ni se atribuyen mejoras a datos no evaluados.

Contrato, migración, política aprobada y comprobaciones de programación/alertas: [MONITORING.md](../back/MONITORING.md).

Integración externa, consentimiento, configuración privada y límites: [SSL-LABS.md](../back/SSL-LABS.md).


## Evidencia pública y cierre académico

Actualización del 20/11/2026: el propietario aportó evidencia del ensayo público completado en nexoguard-prueba-243751.pages.dev: propiedad verificada, análisis inicial 15:27:05, publicación corregida y segundo análisis observado 15:34:14 (8 APROBADO, 3 NO_APLICABLE y CSP presente pero NO_EVALUADO). Comparación: 2 mejoras (HSTS y protección frente a marcos), 6 aprobadas sin cambios, 4 no comparables y ninguna regresión. Es evidencia aportada por el propietario, no observación directa del agente. Detalle y límites en [matriz de validación](../docs/MATRIZ_VALIDACION.md).

SSL Labs real completado con cuatro endpoints A; el propietario confirmó su conservación visual y desaparición del aviso tras actualizar frontend. Programación diaria configurada no equivale a ejecución automática real observada; esa ejecución sigue pendiente. No se declara el sistema listo para producción.
