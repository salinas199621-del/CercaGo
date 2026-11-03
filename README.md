# CercaGo

Marketplace local con API REST, PostgreSQL, Socket.IO, app React Native para cliente/comercio/repartidor y panel web administrativo.

## Requisitos

- Node.js 24.3+
- PostgreSQL 15+
- npm 10+

## Inicio rápido

1. Copia `apps/api/.env.example` a `apps/api/.env` y configura PostgreSQL, un `JWT_SECRET` aleatorio de al menos 32 caracteres y las variables iniciales de administrador (contraseña de al menos 16 caracteres).
2. Crea la base de datos y ejecuta `apps/api/sql/schema.sql`.
   Si ya habías creado la base anteriormente, ejecuta en orden las migraciones 001 a 006 de `apps/api/sql/migrations/`. Antes de aplicar `006_account_recovery.sql`, revisa teléfonos duplicados con `SELECT phone, COUNT(*) FROM users WHERE phone IS NOT NULL AND phone <> '' GROUP BY phone HAVING COUNT(*) > 1;` y resuélvelos manualmente; la migración crea un índice único y no modifica registros existentes.
3. Desde la raíz ejecuta `npm install`.
4. Crea la cuenta de administración inicial con `npm run create-admin -w @cercago/api`.
5. En terminales separadas ejecuta `npm run dev:api`, `npm run dev:mobile` y `npm run dev:admin`.

No hay cuentas, pedidos ni comercios de prueba en el acceso. Crea usuarios con el formulario de registro y afilia comercios reales desde la administración. El acceso admite correo o teléfono venezolano +58; la sesión nativa se protege con Keychain/Keystore y el JWT dura 30 días por defecto (`JWT_EXPIRES_IN`). El cliente puede editar nombre, correo y teléfono desde su perfil; el número se almacena en formato canónico +58. Para activar la recuperación de contraseña configura SMTP para correo y/o Twilio para SMS en el entorno del API. La tasa consulta DolarAPI, después el servidor y finalmente la última tasa oficial guardada en el dispositivo.

## Publicar y probar la web

La página pública de CercaGo es informativa: presenta el servicio, explica cómo funciona y dirige a descargar la aplicación Android. No reproduce las pantallas de la app. Render y GitHub Pages publican la misma web; el API está en `/api`, el panel administrativo en `/admin/` y la página de descarga en `/download/`. El enlace principal de descarga apunta al APK oficial de la versión más reciente.

La cotización oficial en bolívares se consulta desde DolarAPI en el cliente y desde el BCV/DolarAPI en el servidor. La app valida que DolarAPI responda con USD y fuente oficial, conserva la última tasa válida en el dispositivo como respaldo y muestra su fecha. El servidor comprueba la tasa al iniciar y cada hora; los pedidos guardan la tasa vigente al momento de crearse.

## Banners y actualizaciones de la app

Los anuncios del Home se definen en `apps/mobile/public/promotions.json`. Cada entrada admite `mediaType` (`image` o `video`), una URL HTTPS en `mediaUrl`, texto, color `tint` y un `linkUrl` HTTPS opcional. En web, los videos usan HTML5 con reproducción automática silenciada. La app obtiene el manifiesto publicado y permite guardar una configuración local desde **Menú → Ajustes**; actualizar el JSON publicado no requiere reinstalar el APK.

`apps/mobile/public/app-version.json` contiene `app_version` y `update_url`. Cuando se publique una nueva versión nativa, actualiza este manifiesto después de publicar el APK. La web puede recargarse para recibir nuevos archivos; Android abre la descarga y requiere la confirmación de instalación del APK. No se borran los datos de sesión.

Las fotos de comprobantes se reducen y envían en JPEG/PNG/WebP al API, que las guarda en el mensaje del pedido. En la web se puede elegir una foto; en Android/iOS se abre el selector nativo de imágenes.

GitHub Pages publica la web informativa, pero no instala una app nativa:

1. En GitHub, abre **Settings → Pages** y elige **GitHub Actions** como fuente de despliegue.
2. Abre **Actions** y espera a que termine el workflow de despliegue web. El sitio público de este repositorio es [CercaGo](https://salinas199621-del.github.io/CercaGo/).
3. Después de cada `git push` a `main`, GitHub volverá a publicar el sitio. No subas archivos `.env` ni secretos al repositorio.
4. El mismo despliegue publica el panel admin en `https://salinas199621-del.github.io/CercaGo/admin/`.

Para abrir la web en el teléfono, comparte el enlace público. Para dejarla como acceso directo, usa **Añadir a pantalla de inicio** en el navegador; sigue siendo una aplicación web, no una descarga de Play Store.

## Desplegar API y base de datos para uso real

El repositorio incluye `render.yaml` para desplegar la API Node en Render. Para PostgreSQL se puede usar Neon. Los planes gratuitos son útiles para pruebas, pero pueden dormir o tener límites; revisa los precios y límites actuales antes de operar el marketplace.

1. Crea un proyecto PostgreSQL en Neon y copia la cadena de conexión (usa la cadena recomendada por Neon con SSL). No la compartas ni la guardes en Git.
2. En Render, crea un **Blueprint** conectado a este repositorio y acepta `render.yaml`. Configura `DATABASE_URL` con la cadena de Neon cuando Render la solicite. `JWT_SECRET` se genera automáticamente y `CLIENT_ORIGIN` permite el sitio web de GitHub Pages.
3. Cuando la base esté creada, abre el SQL Editor de Neon y ejecuta una vez `apps/api/sql/schema.sql`. Para una base ya existente, aplica en orden las migraciones 001 a 006.
4. En Render, espera a que el servicio `cercago-api` esté activo. Comprueba `https://TU-API.onrender.com/health`; debe responder `{"status":"ok"}`.
5. Crea el administrador inicial ejecutando `npm run create-admin -w @cercago/api` desde tu equipo, con `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_NAME` y una contraseña de 16–72 bytes configurados temporalmente en la terminal. No añadas esos valores al repositorio.
6. En GitHub abre **Settings → Secrets and variables → Actions → Variables** y crea `CERCAGO_API_URL` con la URL del API más `/api`, por ejemplo `https://cercago-api.onrender.com/api`.
7. El workflow de GitHub Actions publica la web informativa y el panel de administración. La aplicación Android usa el API de Render por HTTPS.

Para restablecer contraseña, configura SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`) y/o Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`) como variables secretas del servicio API. Sin un proveedor configurado, el API no simula el envío del código.

## Inicio de sesión con Google (pospuesto)

Por ahora, CercaGo usa correo y contraseña para iniciar sesión y crear cuentas. Google queda pospuesto: no hace falta configurar Google Cloud ni añadir variables OAuth para publicar la versión actual. El backend conserva el endpoint de Google para reactivarlo más adelante.

Para reactivarlo después, configura las credenciales de OAuth en Google Cloud, el Client ID web en el backend y los clientes/orígenes necesarios para la web y Android. La migración `004_google_sign_in.sql` y el endpoint se mantienen; no son necesarios para cuentas de correo y contraseña.


## Generar e instalar un APK de Android

El APK es una aplicación Android instalada en el teléfono y no depende de GitHub Pages. Este proyecto no integra actualizaciones OTA: los cambios de código no se instalan solos. Para cada versión se genera otro APK; cada usuario debe descargarlo y abrirlo para instalar la actualización. El primer APK nativo usa la clave de desarrollo de Android; para instalarlo sobre la versión anterior firmada por otro proveedor hay que desinstalar primero la app anterior.

La página pública ofrece la descarga en `https://salinas199621-del.github.io/CercaGo/download/` y en la pantalla de acceso. El APK se distribuye desde el asset `CercaGo.apk` del GitHub Release más reciente, en `https://github.com/salinas199621-del/CercaGo/releases/latest/download/CercaGo.apk`. Para publicar otra versión, actualiza la versión y el `versionCode` en `apps/mobile/android/app/build.gradle`, y publica una etiqueta `apk-vX.Y.Z`; GitHub Actions compilará la app Android nativa y adjuntará el APK.

1. Publica el API y PostgreSQL en un servidor accesible por HTTPS. Configura el API con `DATABASE_URL`, `JWT_SECRET` y `CLIENT_ORIGIN` (el origen del panel web publicado). No uses `localhost` en el APK: en el móvil, localhost apunta al propio móvil.
2. Ejecuta el esquema o las migraciones indicadas al inicio de este README en PostgreSQL. El API consulta la tasa oficial BCV al arrancar; no pongas credenciales de la base de datos en GitHub ni en la app.
3. Instala JDK 17 y Android SDK Platform 36; configura `ANDROID_HOME` y acepta las licencias del SDK.
4. Copia `apps/mobile/.env.example` a `apps/mobile/.env` y configura `CERCAGO_API_URL` con la URL HTTPS pública del API.
5. Desde la raíz, compila el APK nativo:

   ```powershell
   npm run build:apk -w @cercago/mobile
   ```

   El APK se genera en `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`. Descárgalo en Android, permite la instalación desde esa fuente si el sistema lo solicita y abre el archivo.
6. Para distribuir una versión, publica una etiqueta nueva con formato `apk-vX.Y.Z`; GitHub Actions compilará el APK nativo y lo adjuntará al Release.

El APK necesita una URL HTTPS de API accesible desde el teléfono. Crea cuentas desde Registro; el perfil, tema y avatar se conservan en el dispositivo. Los temas disponibles son Turquesa, Azul Marino, Naranja Vibrante, Verde Esmeralda y Modo Oscuro.

El API corre en `http://localhost:4000`; la web móvil y el panel en `http://localhost:5173`. Para una app nativa instalada en un teléfono durante desarrollo, configura `CERCAGO_API_URL` con la IP LAN de tu PC, mantén ambos dispositivos en la misma red y deja el API encendido. Si Windows Firewall pregunta, permite Node.js en la red privada.

El chat y los pedidos requieren API, PostgreSQL y Socket.IO activos. El chat consulta mensajes periódicamente como respaldo si la conexión en tiempo real se interrumpe.

Las direcciones pueden guardar coordenadas mediante GPS. En el teléfono, el navegador requiere HTTPS para conceder ubicación; para probar en una red local HTTP usa una app nativa o abre la versión web publicada por HTTPS. El mapa web usa OpenStreetMap; el mapa nativo de Android está pendiente de configuración.

Los repartidores comparten su ubicación mientras la app está activa; el API limita las ofertas a un radio configurable por `app_settings.delivery_zone_radius_km` (15 km por defecto). El comercio debe configurar latitud y longitud para publicar pedidos listos. La app móvil usa URL de imagen para los productos; configure almacenamiento de objetos/CDN antes de producción.

## Estructura

```text
apps/
  admin/       Panel React/Vite para administración global
  api/         Express + TypeScript + PostgreSQL + Socket.IO
  mobile/      App React Native nativa, web Vite y navegación por rol
```

La aplicación incluye los flujos principales para un MVP. Antes de operar en producción, configure TLS, secretos gestionados, almacenamiento de imágenes, proveedor de pagos, observabilidad, límites de tasa, copias de seguridad y pruebas de integración/aceptación.

## Funciones para Venezuela

- La tasa se expresa en bolívares por USD y se obtiene de la publicación oficial del [BCV](https://www.bcv.org.ve/), incluyendo su fecha de valor. El API la sincroniza al iniciar y cada seis horas; el SuperAdmin puede solicitar una consulta inmediata desde **Panel de administración → Tasa oficial del BCV**. Si BCV no está disponible, se conserva la última tasa BCV válida y no se sustituye por una tasa manual o de prueba. Los pedidos nuevos requieren una tasa oficial disponible y guardan una copia para el recibo.
- Los comercios configuran banco, RIF/cédula, teléfono, delivery propio y delivery gratis desde su perfil. El distintivo **DELIVERY GRATIS** depende exclusivamente de la opción activada por el comercio.
- El pago móvil se coordina en el chat del pedido. El cliente debe esperar la aceptación del comercio y, antes de que el pedido pase a preparación, enviar por chat el número de referencia o un enlace HTTP(S) a la captura. El servicio no procesa transferencias ni verifica pagos bancarios automáticamente.
- El chat admite referencia o enlace a un comprobante ya alojado; para recibir y alojar imágenes directamente hay que integrar un proveedor de almacenamiento de archivos antes de producción.
- Las direcciones del cliente admiten edición, eliminación y selección predeterminada. Al marcar el pedido como entregado aparece la solicitud de reseña del comercio y, si aplica, del repartidor.
