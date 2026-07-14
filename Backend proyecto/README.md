# VocaTest — API REST

Backend Express 5 con Prisma y PostgreSQL. Implementa autenticación por token,
usuarios, perfiles, preferencias, universidades, carreras, favoritos, historial,
test vocacional y salas de evaluación.

## Ejecución local

```powershell
Copy-Item .env.example .env
npm.cmd ci
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:seed-test
npm.cmd run dev
```

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
