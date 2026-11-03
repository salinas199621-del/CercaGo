# CercaGo

Marketplace local con API REST, PostgreSQL, Socket.IO, app Expo para cliente/comercio/repartidor y panel web administrativo.

## Requisitos

- Node.js 24.3+
- PostgreSQL 15+
- npm 10+

## Inicio rápido

1. Copia `apps/api/.env.example` a `apps/api/.env` y configura PostgreSQL, un `JWT_SECRET` aleatorio de al menos 32 caracteres y las variables iniciales de administrador (contraseña de al menos 16 caracteres).
2. Crea la base de datos y ejecuta `apps/api/sql/schema.sql`.
   Si ya habías creado la base anteriormente, ejecuta también `apps/api/sql/migrations/001_store_discovery_fields.sql`.
3. Desde la raíz ejecuta `npm install`.
4. Crea la cuenta de administración inicial con `npm run create-admin -w @cercago/api`.
5. En terminales separadas ejecuta `npm run dev:api`, `npm run dev:mobile` y `npm run dev:admin`.

En la pantalla de acceso puedes entrar a la demo como cliente, comercio o repartidor. La demo usa datos locales de ejemplo, no necesita PostgreSQL ni API y no persiste cambios en el backend.

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

El API corre en `http://localhost:4000`; el panel en `http://localhost:5173`. Para un dispositivo móvil físico, define `EXPO_PUBLIC_API_URL` con la IP LAN de la máquina que ejecuta el API (incluyendo `:4000/api`).

Los repartidores comparten su ubicación mientras la app está activa; el API limita las ofertas a un radio configurable por `app_settings.delivery_zone_radius_km` (15 km por defecto). El comercio debe configurar latitud y longitud para publicar pedidos listos. La app móvil usa URL de imagen para los productos; configure almacenamiento de objetos/CDN antes de producción.

## Estructura

```text
apps/
  admin/       Panel React/Vite para administración global
  api/         Express + TypeScript + PostgreSQL + Socket.IO
  mobile/      App Expo/React Native con navegación por rol
```

La aplicación incluye los flujos principales para un MVP. Antes de operar en producción, configure TLS, secretos gestionados, almacenamiento de imágenes, proveedor de pagos, observabilidad, límites de tasa, copias de seguridad y pruebas de integración/aceptación.
