require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
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

app.get('/', (req, res) => {
  res.json({
    ok: true,
    mensaje: 'Backend VocaTest funcionando en el puerto 3000.',
    endpoints: [
      '/api/auth/login',
      '/api/auth/register',
      '/api/universidad',
      '/api/carreras',
      '/api/escalas',
      '/api/logos',
      '/api/users',
      '/api/users/tipo/:tipo',
      '/api/universidad_users'
    ]
  });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { correo, contrasena, password } = req.body;

    const correoNormalizado = String(correo || '')
      .trim()
      .toLowerCase();

    const passwordIngresado = contrasena || password;

    if (!correoNormalizado || !passwordIngresado) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Correo y contraseña son obligatorios.'
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        correo: correoNormalizado
      }
    });

    if (!user || user.contrasena !== passwordIngresado) {
      return res.status(401).json({
        ok: false,
        mensaje: 'Credenciales incorrectas.'
      });
    }

    if (!user.activo) {
      return res.status(403).json({
        ok: false,
        mensaje: 'La cuenta se encuentra desactivada.'
      });
    }

    const usuarioActualizado = await prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        ultimoIngreso: new Date().toLocaleDateString('es-PE')
      }
    });

    const { contrasena: _, ...usuarioSinContrasena } = usuarioActualizado;

    return res.json({
      ok: true,
      data: usuarioSinContrasena,
      rol: usuarioActualizado.rol
    });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Ocurrió un error al iniciar sesión.'
    });
  }
});

app.post('/api/auth/register', (req, res) => {
  const db = getDb();
  const correo = String(req.body.correo || '').trim().toLowerCase();

  if (!req.body.nombres || !req.body.apellidos || !correo || !getPassword(req.body)) {
    return res.status(400).json({ ok: false, mensaje: 'Nombres, apellidos, correo y contrasena son obligatorios.' });
  }

  if (db.users.some((user) => user.correo.toLowerCase() === correo)) {
    return res.status(409).json({ ok: false, mensaje: 'Este correo ya esta registrado.' });
  }

  const user = {
    id: nextId(db.users),
    nombres: req.body.nombres,
    apellidos: req.body.apellidos,
    correo,
    contrasena: getPassword(req.body),
    rol: normalizeRole(req.body.rol),
    ciudad: req.body.ciudad || '',
    telefono: req.body.telefono || '',
    edad: req.body.edad || '',
    sexo: req.body.sexo || '',
    tipoColegio: req.body.tipoColegio || '',
    carreraRecomendada: req.body.carreraRecomendada || '',
    ultimoIngreso: new Date().toLocaleDateString('es-PE'),
    activo: true
  };

  db.users.push(user);
  saveDb(db);
  return res.status(201).json({ ok: true, data: user });
});

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

app.use((req, res) => {
  res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada.' });
});

async function iniciarServidor() {
  try {
    await prisma.$connect();

    console.log('Conexión con PostgreSQL establecida correctamente.');

    app.listen(PORT, () => {
      console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('No se pudo conectar con PostgreSQL:');
    console.error(error);
    process.exit(1);
  }
}

iniciarServidor();
