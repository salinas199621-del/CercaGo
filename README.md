# CercaGo

Marketplace local con API REST, PostgreSQL, Socket.IO, app Expo para cliente/comercio/repartidor y panel web administrativo.

## Requisitos

- Node.js 24.3+
- PostgreSQL 15+
- npm 10+

## Inicio rápido

1. Copia `apps/api/.env.example` a `apps/api/.env` y configura PostgreSQL, un `JWT_SECRET` aleatorio de al menos 32 caracteres y las variables iniciales de administrador (contraseña de al menos 16 caracteres).
2. Crea la base de datos y ejecuta `apps/api/sql/schema.sql`.
   Si ya habías creado la base anteriormente, ejecuta en orden `apps/api/sql/migrations/001_store_discovery_fields.sql`, `apps/api/sql/migrations/002_venezuelan_marketplace_features.sql` y `apps/api/sql/migrations/003_bcv_exchange_rate.sql`.
3. Ejecuta `apps/api/sql/seed_catalog.sql` después de crear los comercios para cargar seis productos de ejemplo por comercio, según su categoría.
4. Desde la raíz ejecuta `npm install`.
5. Crea la cuenta de administración inicial con `npm run create-admin -w @cercago/api`.
6. En terminales separadas ejecuta `npm run dev:api`, `npm run dev:mobile` y `npm run dev:admin`.

En la pantalla de acceso puedes entrar a la demo como cliente, comercio o repartidor. Los perfiles de demo usan datos locales; el tipo de cambio sí consulta el endpoint público de la API. Sin API disponible se indica que no hay tasa, en lugar de mostrar un valor inventado.

## Probar la demo desde un teléfono con GitHub Pages

El despliegue de prueba publica la app Expo como web estática (no instala una app nativa). No necesita API, PostgreSQL ni secretos: sus perfiles de demostración usan datos locales.

1. Crea un repositorio en GitHub. Si no quieres publicar el código, revisa primero si tu plan permite GitHub Pages para repositorios privados.
2. Desde esta carpeta, abre una terminal y sube el proyecto (reemplaza `TU_USUARIO/TU_REPOSITORIO`):

   ```powershell
   git init
   git add .
   git commit -m "Preparar CercaGo"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   git push -u origin main
   ```

3. En GitHub abre **Settings → Pages** y elige **GitHub Actions** como fuente de despliegue.
4. Abre **Actions** y espera a que termine el workflow **Deploy CercaGo demo**. En su resumen encontrarás el enlace público.
5. Abre ese enlace en tu teléfono. Para instalarlo como acceso directo, usa **Añadir a pantalla de inicio** en el navegador; esto es una app web, no una descarga desde App Store/Google Play.

Después de cada `git push` a `main`, GitHub volverá a publicar la demo. No subas archivos `.env` ni secretos al repositorio.

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
