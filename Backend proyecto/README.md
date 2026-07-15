# VocaTest — API REST

Backend Express 5 con Prisma y PostgreSQL. Implementa autenticación por token,
usuarios, perfiles, preferencias, universidades, carreras, favoritos, historial,
test vocacional y salas de evaluación.

## Ejecución local

```powershell
Copy-Item .env.example .env
npm.cmd ci
npm.cmd run db:generate
npm.cmd run db:local:init
npm.cmd run dev
```

En desarrollo, el API intenta usar PostgreSQL. Si Render corta la conexión,
continúa automáticamente con `data/local-prisma.db`. La aplicación y Prisma
Studio comparten esa misma base SQLite local.

`db:migrate` y `db:seed-test` se reservan para PostgreSQL y deben ejecutarse
solo cuando Render esté disponible y el equipo haya coordinado la actualización.

No ejecutes `node seed.js` sobre la base compartida: ese archivo elimina datos
antes de volver a poblarlos. `npm run db:seed-test` usa `upsert` y es seguro para
inicializar o actualizar únicamente las preguntas y áreas vocacionales.

## Variables de entorno

- `DATABASE_URL`: conexión PostgreSQL.
- `AUTH_SECRET`: frase larga y aleatoria para firmar sesiones.
- `FRONTEND_URL`: orígenes autorizados, separados por coma.
- `PGSSL`: `true` para una conexión externa que requiera SSL; `false` para la URL
  interna de Render.
- `PORT`: puerto local, normalmente `3000`.

## Rutas principales

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET|PUT|DELETE /api/db/users`
- `GET|POST|DELETE /api/db/users/:id/favoritos`
- `GET|POST /api/db/users/:id/historial`
- `GET|POST|PUT|DELETE /api/db/universidades`
- `GET /api/db/test`
- `POST /api/db/test/calcular`
- `GET|POST|PATCH|DELETE /api/db/salas`

Las rutas privadas requieren `Authorization: Bearer <token>`.

## Verificación

```powershell
npm.cmd run check
npm.cmd test
npx.cmd prisma validate
```

## Prisma Studio

Para ver y editar la misma base local que usa el backend cuando Render falla:

```powershell
cd "C:\Users\André\Documents\Programación Web - Proyecto Final\backend-repo\Backend proyecto"
npm.cmd run db:studio
```

Abre `http://localhost:5555`. Para inspeccionar PostgreSQL de Render, cuando su
URL vuelva a funcionar, utiliza:

```powershell
npm.cmd run db:studio:render
```

Revisa especialmente estas tablas:

- `UniversidadUser`: favoritos de cada usuario.
- `HistorialTest`: resultados guardados del test vocacional.
- `User`: usuario y carrera recomendada más reciente.

`db:studio` modifica solo la base local. `db:studio:render` modifica la base
compartida de Render; evita borrar registros de otros integrantes al usarlo.
