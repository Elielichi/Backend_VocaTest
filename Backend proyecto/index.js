import express from 'express';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

import { PrismaClient } from './generated/prisma/index.js';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const FRONTEND_UNIVERSIDADES_PATH = path.join(
  __dirname,
  '..',
  'PROYECTO-PROGRA.-WEB-2026-1',
  'src',
  'data',
  'universidades.js'
);

const ROLES = {
  estudiantes: 'Estudiante',
  profesores: 'Profesor',
  administradores: 'Administrador'
};

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

///////
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});
///////

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function normalizeRole(role = ROLES.estudiantes) {
  const cleanRole = String(role).trim().toLowerCase();

  if (cleanRole === 'admin' || cleanRole === 'administrador' || cleanRole === 'administradores') {
    return ROLES.administradores;
  }

  if (cleanRole === 'profesor' || cleanRole === 'profesores') {
    return ROLES.profesores;
  }

  return ROLES.estudiantes;
}

function getPassword(user) {
  return user.contrasena || user['contraseña'] || user.password;
}

function loadFrontendUniversidades() {
  if (!fs.existsSync(FRONTEND_UNIVERSIDADES_PATH)) {
    return [];
  }

  const source = fs
    .readFileSync(FRONTEND_UNIVERSIDADES_PATH, 'utf8')
    .replace('const universidades =', 'universidades =')
    .replace(/export default universidades;?\s*$/, '');

  const sandbox = { universidades: [] };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return Array.isArray(sandbox.universidades) ? sandbox.universidades : [];
}

function buildInitialDatabase() {
  const universidades = loadFrontendUniversidades().map((universidad, index) => ({
    id: universidad.id || index + 1,
    nombre: universidad.nombre,
    tipo: universidad.tipo,
    ubicacion: universidad.ubicacion,
    costoMatricula: universidad.costoMatricula,
    webOficial: universidad.webOficial
  }));

  const logos = loadFrontendUniversidades().map((universidad, index) => ({
    id: index + 1,
    universidad_id: universidad.id || index + 1,
    url: universidad.logo || '',
    descripcion: `Logo de ${universidad.nombre}`
  }));

  const carreras = [];
  const escalas = [];

  loadFrontendUniversidades().forEach((universidad, uniIndex) => {
    const universidadId = universidad.id || uniIndex + 1;

    (universidad.carreras || []).forEach((carrera) => {
      carreras.push({
        id: carreras.length + 1,
        universidad_id: universidadId,
        nombre: carrera.nombre,
        facultad: carrera.facultad,
        duracion: carrera.duracion,
        creditos: carrera.creditos,
        descripcion: carrera.descripcion,
        planEstudios: carrera.planEstudios
      });
    });

    (universidad.escalas || []).forEach((escala) => {
      escalas.push({
        id: escalas.length + 1,
        universidad_id: universidadId,
        escala: escala.escala,
        rango: escala.rango
      });
    });
  });

  return {
    universidad: universidades,
    carreras,
    escalas,
    logos,
    users: [
      {
        id: 1,
        nombres: 'Carlos',
        apellidos: 'Mendoza Torres',
        correo: 'estudiante@ulima.edu.pe',
        contrasena: 'ulima123',
        rol: ROLES.estudiantes,
        ciudad: 'Lima',
        tipoColegio: 'Privado',
        telefono: '987654321',
        edad: 18,
        sexo: 'Masculino',
        carreraRecomendada: 'Ingenieria de Sistemas y Computacion',
        ultimoIngreso: null,
        activo: true
      },
      {
        id: 2,
        nombres: 'Maria',
        apellidos: 'Garcia Lopez',
        correo: 'profesor@ulima.edu.pe',
        contrasena: 'profe123',
        rol: ROLES.profesores,
        ciudad: 'Lima',
        telefono: '999123456',
        edad: 38,
        sexo: 'Femenino',
        especialidad: 'Ingenieria de Sistemas',
        gradoAcademico: 'Magister en Ingenieria de Software',
        activo: true
      },
      {
        id: 3,
        nombres: 'Admin',
        apellidos: 'VocaTest',
        correo: 'admin@vocatest.pe',
        contrasena: 'admin123',
        rol: ROLES.administradores,
        ciudad: 'Lima',
        activo: true
      }
    ],
    universidad_users: []
  };
}

function getDb() {
  if (!fs.existsSync(DB_PATH)) {
    writeJson(DB_PATH, buildInitialDatabase());
  }

  return readJson(DB_PATH, buildInitialDatabase());
}

function saveDb(db) {
  writeJson(DB_PATH, db);
}

function nextId(items) {
  return items.length ? Math.max(...items.map((item) => Number(item.id) || 0)) + 1 : 1;
}

function sendNotFound(res, entity) {
  return res.status(404).json({ ok: false, mensaje: `${entity} no encontrado.` });
}

function createCrudRoutes(entityName) {
  app.get(`/api/${entityName}`, (req, res) => {
    const db = getDb();
    res.json({ ok: true, data: db[entityName] });
  });

  app.get(`/api/${entityName}/:id`, (req, res) => {
    const db = getDb();
    const item = db[entityName].find((record) => String(record.id) === req.params.id);

    if (!item) return sendNotFound(res, entityName);
    return res.json({ ok: true, data: item });
  });

  app.post(`/api/${entityName}`, (req, res) => {
    const db = getDb();
    const item = { id: nextId(db[entityName]), ...req.body };
    db[entityName].push(item);
    saveDb(db);
    res.status(201).json({ ok: true, data: item });
  });

  app.put(`/api/${entityName}/:id`, (req, res) => {
    const db = getDb();
    const index = db[entityName].findIndex((record) => String(record.id) === req.params.id);

    if (index === -1) return sendNotFound(res, entityName);

    db[entityName][index] = { ...db[entityName][index], ...req.body, id: db[entityName][index].id };
    saveDb(db);
    return res.json({ ok: true, data: db[entityName][index] });
  });

  app.delete(`/api/${entityName}/:id`, (req, res) => {
    const db = getDb();
    const exists = db[entityName].some((record) => String(record.id) === req.params.id);

    if (!exists) return sendNotFound(res, entityName);

    db[entityName] = db[entityName].filter((record) => String(record.id) !== req.params.id);
    saveDb(db);
    return res.json({ ok: true, mensaje: `${entityName} eliminado.` });
  });
}

////////////
app.get('/api/db/users', async (req, res) => {
  try {
    const usuarios = await prisma.user.findMany({
      orderBy: {
        id: 'asc',
      },
    });

    return res.json({
      ok: true,
      data: usuarios,
    });
  } catch (error) {
    console.error('Error obteniendo usuarios desde PostgreSQL:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'No se pudieron obtener los usuarios.',
    });
  }
});
////////////

////////////
app.post('/api/db/users', async (req, res) => {
  try {
    const {
      nombres,
      apellidos,
      correo,
      contrasena,
      rol,
    } = req.body;

    if (!nombres || !apellidos || !correo || !contrasena) {
      return res.status(400).json({
        ok: false,
        mensaje:
          'Nombres, apellidos, correo y contraseña son obligatorios.',
      });
    }

    const usuarioExistente = await prisma.user.findUnique({
      where: {
        correo: correo.trim().toLowerCase(),
      },
    });

    if (usuarioExistente) {
      return res.status(409).json({
        ok: false,
        mensaje: 'El correo ya está registrado.',
      });
    }

    const nuevoUsuario = await prisma.user.create({
      data: {
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        correo: correo.trim().toLowerCase(),
        contrasena,
        rol: rol || 'Estudiante',
      },
    });

    return res.status(201).json({
      ok: true,
      data: nuevoUsuario,
    });
  } catch (error) {
    console.error('Error creando usuario:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'No se pudo crear el usuario.',
    });
  }
});
///////////////

app.get('/', (req, res) => {
  res.json({
    ok: true,
    mensaje: `Backend VocaTest funcionando en el puerto ${PORT}.`,
    endpoints: [
      '/api/auth/login',
      '/api/auth/register',
      '/api/db/users',
      '/api/db/universidades',
      '/api/db/carreras',
      '/api/db/escalas',
      '/api/db/logos',
      '/api/universidad_users'
    ]
  });
});

/////////////////////
app.post('/api/auth/login', async (req, res) => {
  try {
    const correo = String(req.body.correo || '')
      .trim()
      .toLowerCase();

    const contrasena = getPassword(req.body);

    if (!correo || !contrasena) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Correo y contraseña son obligatorios.'
      });
    }

    const usuario = await prisma.user.findUnique({
      where: {
        correo
      }
    });

    if (!usuario || usuario.contrasena !== contrasena) {
      return res.status(401).json({
        ok: false,
        mensaje: 'Credenciales incorrectas.'
      });
    }

    return res.json({
      ok: true,
      data: usuario,
      rol: usuario.rol
    });
  } catch (error) {
    console.error('Error iniciando sesión:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'No se pudo iniciar sesión.',
      error: error.message
    });
  }
});
/////////////////////

/////////////////////
app.post('/api/auth/register', async (req, res) => {
  try {
    const correo = String(req.body.correo || '')
      .trim()
      .toLowerCase();

    const contrasena = getPassword(req.body);

    if (
      !req.body.nombres ||
      !req.body.apellidos ||
      !correo ||
      !contrasena
    ) {
      return res.status(400).json({
        ok: false,
        mensaje:
          'Nombres, apellidos, correo y contraseña son obligatorios.'
      });
    }

    const usuarioExistente = await prisma.user.findUnique({
      where: {
        correo
      }
    });

    if (usuarioExistente) {
      return res.status(409).json({
        ok: false,
        mensaje: 'Este correo ya está registrado.'
      });
    }

    const nuevoUsuario = await prisma.user.create({
      data: {
        nombres: String(req.body.nombres).trim(),
        apellidos: String(req.body.apellidos).trim(),
        correo,
        contrasena,
        rol: normalizeRole(req.body.rol)
      }
    });

    return res.status(201).json({
      ok: true,
      data: nuevoUsuario
    });
  } catch (error) {
    console.error('Error registrando usuario:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'No se pudo registrar al usuario.',
      error: error.message
    });
  }
});
/////////////////////

app.get('/api/users/tipo/:tipo', (req, res) => {
  const db = getDb();
  const role = normalizeRole(req.params.tipo);
  const users = db.users.filter((user) => user.rol === role);
  res.json({ ok: true, data: users });
});

app.get('/api/universidad/:id/full', (req, res) => {
  const db = getDb();
  const universidad = db.universidad.find((item) => String(item.id) === req.params.id);

  if (!universidad) return sendNotFound(res, 'universidad');

  return res.json({
    ok: true,
    data: {
      ...universidad,
      logo: db.logos.find((logo) => logo.universidad_id === universidad.id) || null,
      carreras: db.carreras.filter((carrera) => carrera.universidad_id === universidad.id),
      escalas: db.escalas.filter((escala) => escala.universidad_id === universidad.id)
    }
  });
});

createCrudRoutes('universidad');
createCrudRoutes('carreras');
createCrudRoutes('escalas');
createCrudRoutes('logos');
createCrudRoutes('users');
createCrudRoutes('universidad_users');

//////////////////////////////
app.get("/api/db/universidades", async (req, res) => {
  try {
    const universidades =
      await prisma.universidad.findMany({
        include: {
          carreras: true,
          escalas: true,
          logos: true,
        },
        orderBy: {
          id: "asc",
        },
      });

    return res.json({
      ok: true,
      data: universidades,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});
//////////////////////////////

//////////////////////////////
app.put("/api/db/users/:id", async (req, res) => {
  try {
    const { nombres, apellidos, correo, contrasena, rol } = req.body;

    const dataToUpdate = {};
    if (nombres !== undefined) dataToUpdate.nombres = nombres;
    if (apellidos !== undefined) dataToUpdate.apellidos = apellidos;
    if (correo !== undefined) dataToUpdate.correo = correo.trim().toLowerCase();
    if (contrasena !== undefined) dataToUpdate.contrasena = contrasena;
    if (rol !== undefined) dataToUpdate.rol = rol;

    const usuarioActualizado = await prisma.user.update({
      where: { id: Number(req.params.id) },
      data: dataToUpdate,
    });

    return res.json({ ok: true, data: usuarioActualizado });
  } catch (error) {
    console.error("Error actualizando usuario:", error);
    return res.status(500).json({ ok: false, mensaje: "No se pudo actualizar el usuario.", error: error.message });
  }
});
//////////////////////////////

//////////////////////////////
app.delete("/api/db/users/:id", async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: Number(req.params.id) } });
    return res.json({ ok: true, mensaje: "Usuario eliminado." });
  } catch (error) {
    console.error("Error eliminando usuario:", error);
    return res.status(500).json({ ok: false, mensaje: "No se pudo eliminar el usuario.", error: error.message });
  }
});
//////////////////////////////

//////////////////////////////
app.get("/api/db/carreras", async (req, res) => {
  try {
    const carreras = await prisma.carrera.findMany({
      include: {
        universidad: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    return res.json({
      ok: true,
      data: carreras,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});
//////////////////////////////

//////////////////////////////
app.get("/api/db/escalas", async (req, res) => {
  try {
    const escalas = await prisma.escala.findMany({
      include: {
        universidad: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    return res.json({
      ok: true,
      data: escalas,
    });
  } catch (error) {
    console.error("Error obteniendo escalas:", error);

    return res.status(500).json({
      ok: false,
      mensaje: "No se pudieron obtener las escalas.",
      error: error.message,
    });
  }
});
//////////////////////////////

//////////////////////////////
app.get("/api/db/logos", async (req, res) => {
  try {
    const logos = await prisma.logo.findMany({
      include: {
        universidad: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    return res.json({
      ok: true,
      data: logos,
    });
  } catch (error) {
    console.error("Error obteniendo logos:", error);

    return res.status(500).json({
      ok: false,
      mensaje: "No se pudieron obtener los logos.",
      error: error.message,
    });
  }
});
//////////////////////////////

//////////////////////////////
app.get('/api/db/universidad-users', async (req, res) => {
  try {
    const favoritos = await prisma.universidadUser.findMany({
      include: {
        user: true,
        universidad: true
      },
      orderBy: {
        fechaAgregado: 'desc'
      }
    });

    return res.json({
      ok: true,
      data: favoritos
    });
  } catch (error) {
    console.error('Error obteniendo universidades favoritas:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'No se pudieron obtener las universidades favoritas.',
      error: error.message
    });
  }
});
//////////////////////////////

//////////////////////////////
app.get('/api/db/historial-tests', async (req, res) => {
  try {
    const historial = await prisma.historialTest.findMany({
      include: {
        user: true
      },
      orderBy: {
        fecha: 'desc'
      }
    });

    return res.json({
      ok: true,
      data: historial
    });
  } catch (error) {
    console.error('Error obteniendo historial de tests:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'No se pudo obtener el historial de tests.',
      error: error.message
    });
  }
});
//////////////////////////////

//////////////////////////////
// Agregar a favoritos
app.post("/api/db/favoritos", async (req, res) => {
  try {
    const { userId, universidadId } = req.body;

    if (!userId || !universidadId) {
      return res.status(400).json({ ok: false, mensaje: "userId y universidadId son obligatorios." });
    }

    const nuevoFavorito = await prisma.universidadUser.create({
      data: { userId: Number(userId), universidadId: Number(universidadId) },
    });

    return res.status(201).json({ ok: true, data: nuevoFavorito });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ ok: false, mensaje: "Ya está en favoritos." });
    }
    console.error("Error agregando favorito:", error);
    return res.status(500).json({ ok: false, mensaje: "No se pudo agregar el favorito.", error: error.message });
  }
});
//////////////////////////////

//////////////////////////////
// Quitar de favoritos
app.delete("/api/db/favoritos", async (req, res) => {
  try {
    const { userId, universidadId } = req.body;

    if (!userId || !universidadId) {
      return res.status(400).json({ ok: false, mensaje: "userId y universidadId son obligatorios." });
    }

    await prisma.universidadUser.delete({
      where: {
        userId_universidadId: {
          userId: Number(userId),
          universidadId: Number(universidadId),
        },
      },
    });

    return res.json({ ok: true, mensaje: "Favorito eliminado." });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ ok: false, mensaje: "El favorito no existe." });
    }
    console.error("Error eliminando favorito:", error);
    return res.status(500).json({ ok: false, mensaje: "No se pudo eliminar el favorito.", error: error.message });
  }
});
//////////////////////////////

//////////////////////////////
// Listar favoritos de un usuario con datos completos de la universidad
app.get("/api/db/favoritos/usuario/:userId", async (req, res) => {
  try {
    const favoritos = await prisma.universidadUser.findMany({
      where: { userId: Number(req.params.userId) },
      include: {
        universidad: {
          include: { logos: true },
        },
      },
      orderBy: { fechaAgregado: "desc" },
    });

    return res.json({ ok: true, data: favoritos });
  } catch (error) {
    console.error("Error obteniendo favoritos:", error);
    return res.status(500).json({ ok: false, mensaje: "No se pudieron obtener los favoritos.", error: error.message });
  }
});
//////////////////////////////
app.use((req, res) => {
  res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada.' });
});

// PARA RENDER MEJOR SERIA ESTO:
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor backend corriendo en el puerto ${PORT}`);
