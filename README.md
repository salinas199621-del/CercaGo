# CercaGo

Marketplace local con API REST, PostgreSQL, Socket.IO, app Expo para cliente/comercio/repartidor y panel web administrativo.

## Requisitos

- Node.js 24.3+
- PostgreSQL 15+
- npm 10+

## Inicio rápido

1. Copia `apps/api/.env.example` a `apps/api/.env` y configura PostgreSQL, un `JWT_SECRET` aleatorio de al menos 32 caracteres y las variables iniciales de administrador (contraseña de al menos 16 caracteres).
2. Crea la base de datos y ejecuta `apps/api/sql/schema.sql`.
   Si ya habías creado la base anteriormente, ejecuta en orden `apps/api/sql/migrations/001_store_discovery_fields.sql`, `apps/api/sql/migrations/002_venezuelan_marketplace_features.sql`, `apps/api/sql/migrations/003_bcv_exchange_rate.sql` y `apps/api/sql/migrations/004_google_sign_in.sql`.
3. Ejecuta `apps/api/sql/seed_catalog.sql` después de crear los comercios para cargar seis productos de ejemplo por comercio, según su categoría.
4. Desde la raíz ejecuta `npm install`.
5. Crea la cuenta de administración inicial con `npm run create-admin -w @cercago/api`.
6. En terminales separadas ejecuta `npm run dev:api`, `npm run dev:mobile` y `npm run dev:admin`.

En la pantalla de acceso puedes entrar a la demo como cliente, comercio o repartidor. Los perfiles de demo usan datos locales; el tipo de cambio sí consulta el endpoint público de la API. Sin API disponible se indica que no hay tasa, en lugar de mostrar un valor inventado.

## Publicar y probar la web con GitHub Pages

GitHub Pages publica la app Expo como web estática (no instala una app nativa). La demo permite probar las interfaces con datos locales. Para usar cuentas reales, la tasa BCV y sincronizar pedidos/chat entre dispositivos, despliega también la API y PostgreSQL como se indica abajo.

1. En GitHub, abre **Settings → Pages** y elige **GitHub Actions** como fuente de despliegue.
2. Abre **Actions** y espera a que termine el workflow **Deploy CercaGo demo**. El sitio público de este repositorio es [CercaGo](https://salinas199621-del.github.io/CercaGo/).
3. Después de cada `git push` a `main`, GitHub volverá a publicar el sitio. No subas archivos `.env` ni secretos al repositorio.
4. Cuando configures `CERCAGO_API_URL` en las variables de Actions como se explica abajo, el mismo despliegue publicará el panel admin en `https://salinas199621-del.github.io/CercaGo/admin/`.

Para abrir la web en el teléfono, comparte el enlace público. Para dejarla como acceso directo, usa **Añadir a pantalla de inicio** en el navegador; sigue siendo una aplicación web, no una descarga de Play Store.

## Desplegar API y base de datos para uso real

El repositorio incluye `render.yaml` para desplegar la API Node en Render. Para PostgreSQL se puede usar Neon. Los planes gratuitos son útiles para pruebas, pero pueden dormir o tener límites; revisa los precios y límites actuales antes de operar el marketplace.

1. Crea un proyecto PostgreSQL en Neon y copia la cadena de conexión (usa la cadena recomendada por Neon con SSL). No la compartas ni la guardes en Git.
2. En Render, crea un **Blueprint** conectado a este repositorio y acepta `render.yaml`. Configura `DATABASE_URL` con la cadena de Neon cuando Render la solicite. `JWT_SECRET` se genera automáticamente y `CLIENT_ORIGIN` permite el sitio web de GitHub Pages.
3. Cuando la base esté creada, abre el SQL Editor de Neon y ejecuta una vez `apps/api/sql/schema.sql`. Solo para una base ya existente, aplica las migraciones 001, 002, 003 y 004 en ese orden.
4. En Render, espera a que el servicio `cercago-api` esté activo. Comprueba `https://TU-API.onrender.com/health`; debe responder `{"status":"ok"}`.
5. Crea el administrador inicial ejecutando `npm run create-admin -w @cercago/api` desde tu equipo, con `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_NAME` y una contraseña de 16–72 bytes configurados temporalmente en la terminal. No añadas esos valores al repositorio.
6. En GitHub abre **Settings → Secrets and variables → Actions → Variables** y crea `CERCAGO_API_URL` con la URL del API más `/api`, por ejemplo `https://cercago-api.onrender.com/api`. Configura también `GOOGLE_WEB_CLIENT_ID` como se explica abajo.
7. En **Actions**, vuelve a ejecutar **Deploy CercaGo demo**. El build incorporará la URL pública del API y publicará tanto la app como el panel de administración. La tasa BCV, el acceso a cuentas reales y la sincronización entre dispositivos dependerán de que la API y la base de datos estén disponibles.

## Iniciar sesión con Google

El botón permite crear o iniciar sesión en cuentas de cliente, tanto en la web como en Android. Los comercios y repartidores conservan sus formularios de alta; el SuperAdmin sigue usando correo y contraseña. El backend verifica el ID token firmado por Google y solo vincula cuentas con correo confirmado.

1. En [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials), crea un OAuth Client ID de tipo **Web application**. Añade `https://salinas199621-del.github.io` a los orígenes autorizados y, para desarrollo local, el origen local que uses (por ejemplo `http://localhost:8082`). El botón web usa Google Identity Services.
2. Usa el Web Client ID como `GOOGLE_WEB_CLIENT_ID` en Render y en la variable de repositorio de GitHub **Settings → Secrets and variables → Actions → Variables**. El ID de cliente no es una contraseña; no publiques client secrets.
3. Para Android, configura además un cliente OAuth Android en Google Cloud con el paquete `com.cercago.marketplace` y la huella SHA-1 del certificado EAS que firma el APK. El APK usa ese certificado; si después publicas en Google Play, registra también la huella de Play App Signing.
4. En Expo EAS, define `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` para los entornos **preview** y **production**. Se usa el Web Client ID en el flujo nativo para solicitar el token que el backend valida. La integración nativa requiere un APK/EAS build y no funciona en Expo Go.
5. Si la base de datos ya existía, ejecuta `apps/api/sql/migrations/004_google_sign_in.sql` antes de desplegar la API. Una base nueva incluye las columnas necesarias en `schema.sql`.


## Generar e instalar un APK de Android

El APK es una aplicación Android instalada en el teléfono y no depende de GitHub Pages. Este proyecto no integra actualizaciones OTA: los cambios de código no se instalan solos. Para cada versión se genera otro APK; si se distribuye directamente, cada usuario debe descargarlo y abrirlo para instalar la actualización. Conserva el mismo paquete y las credenciales de firma de EAS para que Android permita actualizar la instalación existente.

1. Publica el API y PostgreSQL en un servidor accesible por HTTPS. Configura el API con `DATABASE_URL`, `JWT_SECRET` y `CLIENT_ORIGIN` (el origen del panel web publicado). No uses `localhost` en el APK: en el móvil, localhost apunta al propio móvil.
2. Ejecuta el esquema o las migraciones indicadas al inicio de este README en PostgreSQL. El API consulta la tasa oficial BCV al arrancar; no pongas credenciales de la base de datos en GitHub ni en la app.
3. Crea una cuenta en [Expo](https://expo.dev/), instala/configura EAS desde la carpeta móvil y vincula el proyecto:

   ```powershell
   Set-Location "apps\mobile"
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```

4. En Expo, configura estas variables para el entorno **preview**:
   - `EXPO_PUBLIC_API_URL`: URL pública del API, por ejemplo `https://api.tudominio.com/api`. Es pública y queda incluida en el APK.
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`: Web Client ID de Google Cloud para habilitar el botón Google.
   - `GOOGLE_MAPS_ANDROID_API_KEY`: clave de Google Maps restringida para Android y para el paquete `com.cercago.marketplace`. Es necesaria para que el mapa nativo muestre los mapas de Google; no la guardes en el repositorio.
5. Desde `apps\mobile`, compila el APK de prueba:

   ```powershell
   npm run build:apk
   ```

   Al terminar, EAS muestra el enlace para descargar el APK. Descárgalo en Android, permite la instalación desde esa fuente si el sistema lo solicita y abre el archivo.
6. Para cada versión nueva, aumenta `expo.android.versionCode` en `app.json`, compila otro APK y comparte el enlace nuevo. Para distribución por Google Play usa `npm run build:production` y publica el AAB desde Play Console; Play puede instalar actualizaciones según los ajustes del usuario.

El APK usa cuentas/API reales cuando está conectado. Los botones de demo sirven para probar la interfaz, pero sus pedidos y chats locales no se comparten entre teléfonos. Para sincronización real, usa cuentas del backend desplegado.

El API corre en `http://localhost:4000`; el panel en `http://localhost:5173`. En Expo Web abierto desde un teléfono, la app usa automáticamente el mismo host de la página en el puerto `4000`; el API permite el origen LAN de Expo en modo desarrollo. Para una app nativa instalada en un teléfono, copia `apps/mobile/.env.example` a `apps/mobile/.env`, reemplaza la IP de ejemplo por la IP LAN de tu PC, mantén ambos dispositivos en la misma red y deja el API encendido. Si Windows Firewall pregunta, permite Node.js en la red privada.

La demo de los botones de acceso guarda los chats solo en el almacenamiento local del navegador: sirve para probar ambos roles en el mismo navegador, pero no sincroniza mensajes entre teléfonos. Para conversar entre dispositivos, inicia sesión con cuentas de la API y mantén API, PostgreSQL y Socket.IO activos. El chat consulta mensajes periódicamente como respaldo si la conexión en tiempo real se interrumpe.

Las direcciones pueden guardar coordenadas mediante GPS y se pueden seleccionar o mover en el mapa nativo. En el teléfono, el navegador requiere HTTPS para conceder ubicación; para probar en una red local HTTP usa Expo Go con la app nativa o abre la versión web publicada por HTTPS. El mapa web usa OpenStreetMap; en Android nativo, Google Maps puede requerir una clave en la configuración de compilación.

Los repartidores comparten su ubicación mientras la app está activa; el API limita las ofertas a un radio configurable por `app_settings.delivery_zone_radius_km` (15 km por defecto). El comercio debe configurar latitud y longitud para publicar pedidos listos. La app móvil usa URL de imagen para los productos; configure almacenamiento de objetos/CDN antes de producción.

## Estructura

```text
apps/
  admin/       Panel React/Vite para administración global
  api/         Express + TypeScript + PostgreSQL + Socket.IO
  mobile/      App Expo/React Native con navegación por rol
```

La aplicación incluye los flujos principales para un MVP. Antes de operar en producción, configure TLS, secretos gestionados, almacenamiento de imágenes, proveedor de pagos, observabilidad, límites de tasa, copias de seguridad y pruebas de integración/aceptación.

## Funciones para Venezuela

- La tasa se expresa en bolívares por USD y se obtiene de la publicación oficial del [BCV](https://www.bcv.org.ve/), incluyendo su fecha de valor. El API la sincroniza al iniciar y cada seis horas; el SuperAdmin puede solicitar una consulta inmediata desde **Panel de administración → Tasa oficial del BCV**. Si BCV no está disponible, se conserva la última tasa BCV válida y no se sustituye por una tasa manual o de prueba. Los pedidos nuevos requieren una tasa oficial disponible y guardan una copia para el recibo.
- Los comercios configuran banco, RIF/cédula, teléfono, delivery propio y delivery gratis desde su perfil. El distintivo **DELIVERY GRATIS** depende exclusivamente de la opción activada por el comercio.
- El pago móvil se coordina en el chat del pedido. El cliente debe esperar la aceptación del comercio y, antes de que el pedido pase a preparación, enviar por chat el número de referencia o un enlace HTTP(S) a la captura. El servicio no procesa transferencias ni verifica pagos bancarios automáticamente.
- El chat admite referencia o enlace a un comprobante ya alojado; para recibir y alojar imágenes directamente hay que integrar un proveedor de almacenamiento de archivos antes de producción.
- Las direcciones del cliente admiten edición, eliminación y selección predeterminada. Al marcar el pedido como entregado aparece la solicitud de reseña del comercio y, si aplica, del repartidor.
