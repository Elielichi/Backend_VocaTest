import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

import { PrismaClient } from "./generated/prisma/index.js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const DB_PATH = path.join(__dirname, "data", "db.json");
const FRONTEND_UNIVERSIDADES_PATH = path.join(
  __dirname,
  "..",
  "PROYECTO-PROGRA.-WEB-2026-1",
  "src",
  "data",
  "universidades.js",
);

const ROLES = {
  estudiantes: "Estudiante",
  profesores: "Profesor",
  administradores: "Administrador",
};

app.use(cors());

app.use(
  bodyParser.json({
    limit: "15mb",
  }),
);

app.use(
  bodyParser.urlencoded({
    extended: true,
    limit: "15mb",
  }),
);

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
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

  if (
    cleanRole === "admin" ||
    cleanRole === "administrador" ||
    cleanRole === "administradores"
  ) {
    return ROLES.administradores;
  }

  if (cleanRole === "profesor" || cleanRole === "profesores") {
    return ROLES.profesores;
  }

  return ROLES.estudiantes;
}

function getPassword(user) {
  return user.contrasena || user["contraseña"] || user.password;
}

function loadFrontendUniversidades() {
  if (!fs.existsSync(FRONTEND_UNIVERSIDADES_PATH)) {
    return [];
  }

  const source = fs
    .readFileSync(FRONTEND_UNIVERSIDADES_PATH, "utf8")
    .replace("const universidades =", "universidades =")
    .replace(/export default universidades;?\s*$/, "");

  const sandbox = { universidades: [] };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return Array.isArray(sandbox.universidades) ? sandbox.universidades : [];
}

function buildInitialDatabase() {
  const universidades = loadFrontendUniversidades().map(
    (universidad, index) => ({
      id: universidad.id || index + 1,
      nombre: universidad.nombre,
      tipo: universidad.tipo,
      ubicacion: universidad.ubicacion,
      costoMatricula: universidad.costoMatricula,
      webOficial: universidad.webOficial,
    }),
  );

  const logos = loadFrontendUniversidades().map((universidad, index) => ({
    id: index + 1,
    universidad_id: universidad.id || index + 1,
    url: universidad.logo || "",
    descripcion: `Logo de ${universidad.nombre}`,
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
        planEstudios: carrera.planEstudios,
      });
    });

    (universidad.escalas || []).forEach((escala) => {
      escalas.push({
        id: escalas.length + 1,
        universidad_id: universidadId,
        escala: escala.escala,
        rango: escala.rango,
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
        nombres: "Carlos",
        apellidos: "Mendoza Torres",
        correo: "estudiante@ulima.edu.pe",
        contrasena: "ulima123",
        rol: ROLES.estudiantes,
        ciudad: "Lima",
        tipoColegio: "Privado",
        telefono: "987654321",
        edad: 18,
        sexo: "Masculino",
        carreraRecomendada: "Ingenieria de Sistemas y Computacion",
        ultimoIngreso: null,
        activo: true,
      },
      {
        id: 2,
        nombres: "Maria",
        apellidos: "Garcia Lopez",
        correo: "profesor@ulima.edu.pe",
        contrasena: "profe123",
        rol: ROLES.profesores,
        ciudad: "Lima",
        telefono: "999123456",
        edad: 38,
        sexo: "Femenino",
        especialidad: "Ingenieria de Sistemas",
        gradoAcademico: "Magister en Ingenieria de Software",
        activo: true,
      },
      {
        id: 3,
        nombres: "Admin",
        apellidos: "VocaTest",
        correo: "admin@vocatest.pe",
        contrasena: "admin123",
        rol: ROLES.administradores,
        ciudad: "Lima",
        activo: true,
      },
    ],
    universidad_users: [],
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
  return items.length
    ? Math.max(...items.map((item) => Number(item.id) || 0)) + 1
    : 1;
}

function sendNotFound(res, entity) {
  return res
    .status(404)
    .json({ ok: false, mensaje: `${entity} no encontrado.` });
}

function createCrudRoutes(entityName) {
  app.get(`/api/${entityName}`, (req, res) => {
    const db = getDb();
    res.json({ ok: true, data: db[entityName] });
  });

  app.get(`/api/${entityName}/:id`, (req, res) => {
    const db = getDb();
    const item = db[entityName].find(
      (record) => String(record.id) === req.params.id,
    );

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
    const index = db[entityName].findIndex(
      (record) => String(record.id) === req.params.id,
    );

    if (index === -1) return sendNotFound(res, entityName);

    db[entityName][index] = {
      ...db[entityName][index],
      ...req.body,
      id: db[entityName][index].id,
    };
    saveDb(db);
    return res.json({ ok: true, data: db[entityName][index] });
  });

  app.delete(`/api/${entityName}/:id`, (req, res) => {
    const db = getDb();
    const exists = db[entityName].some(
      (record) => String(record.id) === req.params.id,
    );

    if (!exists) return sendNotFound(res, entityName);

    db[entityName] = db[entityName].filter(
      (record) => String(record.id) !== req.params.id,
    );
    saveDb(db);
    return res.json({ ok: true, mensaje: `${entityName} eliminado.` });
  });
}

////////////
app.get("/api/db/users", async (req, res) => {
  try {
    const usuarios = await prisma.user.findMany({
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        correo: true,
        rol: true,
        ciudad: true,
        tipoColegio: true,
        telefono: true,
        edad: true,
        sexo: true,
        carreraRecomendada: true,
        ultimoIngreso: true,
        activo: true,
        especialidad: true,
        gradoAcademico: true,
      },

      orderBy: {
        id: "asc",
      },
    });

    return res.json({
      ok: true,
      data: usuarios,
    });
  } catch (error) {
    console.error("Error obteniendo usuarios desde PostgreSQL:", error);

    return res.status(500).json({
      ok: false,
      mensaje: "No se pudieron obtener los usuarios.",
    });
  }
});
////////////

////////////
app.post("/api/db/users", async (req, res) => {
  try {
    const { nombres, apellidos, correo, contrasena, rol } = req.body;

    if (!nombres || !apellidos || !correo || !contrasena) {
      return res.status(400).json({
        ok: false,
        mensaje: "Nombres, apellidos, correo y contraseña son obligatorios.",
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
        mensaje: "El correo ya está registrado.",
      });
    }

    const nuevoUsuario = await prisma.user.create({
      data: {
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        correo: correo.trim().toLowerCase(),
        contrasena,
        rol: rol || "Estudiante",
      },
    });

    return res.status(201).json({
      ok: true,
      data: nuevoUsuario,
    });
  } catch (error) {
    console.error("Error creando usuario:", error);

    return res.status(500).json({
      ok: false,
      mensaje: "No se pudo crear el usuario.",
    });
  }
});
///////////////

app.get("/", (req, res) => {
  res.json({
    ok: true,
    mensaje: `Backend VocaTest funcionando en el puerto ${PORT}.`,
    endpoints: [
      "/api/auth/login",
      "/api/auth/register",
      "/api/db/users",
      "/api/db/universidades",
      "/api/db/carreras",
      "/api/db/escalas",
      "/api/db/logos",
      "/api/universidad_users",
    ],
  });
});

/////////////////////
app.post("/api/auth/login", async (req, res) => {
  try {
    const correo = String(req.body.correo || "")
      .trim()
      .toLowerCase();

    const contrasena = String(req.body.contrasena || "").trim();

    if (!correo || !contrasena) {
      return res.status(400).json({
        ok: false,
        mensaje: "Correo y contraseña son obligatorios.",
      });
    }

    const usuario = await prisma.user.findUnique({
      where: {
        correo,
      },
    });

    if (!usuario || usuario.contrasena !== contrasena) {
      return res.status(401).json({
        ok: false,
        mensaje: "Correo o contraseña incorrectos.",
      });
    }

    if (!usuario.activo) {
      return res.status(403).json({
        ok: false,
        mensaje: "La cuenta se encuentra desactivada.",
      });
    }

    const fechaIngreso = new Date().toLocaleString("es-PE", {
      timeZone: "America/Lima",
    });

    const usuarioActualizado = await prisma.user.update({
      where: {
        id: usuario.id,
      },
      data: {
        ultimoIngreso: fechaIngreso,
      },
    });

    const { contrasena: passwordEliminado, ...usuarioSinContrasena } =
      usuarioActualizado;

    return res.status(200).json({
      ok: true,
      mensaje: "Inicio de sesión exitoso.",
      data: usuarioSinContrasena,
    });
  } catch (error) {
    console.error("Error iniciando sesión:", error);

    return res.status(500).json({
      ok: false,
      mensaje: "Ocurrió un error al iniciar sesión.",
    });
  }
});
/////////////////////

/////////////////////
app.post("/api/auth/register", async (req, res) => {
  try {
    const nombres = String(req.body.nombres || "").trim();
    const apellidos = String(req.body.apellidos || "").trim();

    const correo = String(req.body.correo || "")
      .trim()
      .toLowerCase();

    const contrasena = String(getPassword(req.body) || "").trim();

    const carreraRecomendada = req.body.carreraRecomendada
      ? String(req.body.carreraRecomendada).trim()
      : null;

    if (!nombres || !apellidos || !correo || !contrasena) {
      return res.status(400).json({
        ok: false,
        mensaje: "Nombres, apellidos, correo y contraseña son obligatorios.",
      });
    }

    const regexNombre = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/;

    if (!regexNombre.test(nombres)) {
      return res.status(400).json({
        ok: false,
        mensaje: "Los nombres solo pueden contener letras.",
      });
    }

    if (!regexNombre.test(apellidos)) {
      return res.status(400).json({
        ok: false,
        mensaje: "Los apellidos solo pueden contener letras.",
      });
    }

    const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!regexCorreo.test(correo)) {
      return res.status(400).json({
        ok: false,
        mensaje: "El correo electrónico no es válido.",
      });
    }

    const regexPassword = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

    if (!regexPassword.test(contrasena)) {
      return res.status(400).json({
        ok: false,
        mensaje:
          "La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.",
      });
    }

    const telefono = req.body.telefono
      ? String(req.body.telefono).trim()
      : null;

    if (telefono && !/^9\d{8}$/.test(telefono)) {
      return res.status(400).json({
        ok: false,
        mensaje: "El teléfono debe comenzar con 9 y tener 9 dígitos.",
      });
    }

    let edad = null;

    if (
      req.body.edad !== undefined &&
      req.body.edad !== null &&
      req.body.edad !== ""
    ) {
      edad = Number(req.body.edad);

      if (!Number.isInteger(edad) || edad < 15 || edad > 80) {
        return res.status(400).json({
          ok: false,
          mensaje: "La edad debe ser un número entero entre 15 y 80.",
        });
      }
    }

    const usuarioExistente = await prisma.user.findUnique({
      where: {
        correo,
      },
    });

    if (usuarioExistente) {
      return res.status(409).json({
        ok: false,
        mensaje: "Este correo ya está registrado.",
      });
    }

    const nuevoUsuario = await prisma.user.create({
      data: {
        nombres,
        apellidos,
        correo,
        contrasena,
        rol: normalizeRole(req.body.rol),

        ciudad: req.body.ciudad ? String(req.body.ciudad).trim() : null,

        telefono,
        edad,

        sexo: req.body.sexo ? String(req.body.sexo).trim() : null,

        tipoColegio: req.body.tipoColegio
          ? String(req.body.tipoColegio).trim()
          : null,

        carreraRecomendada,

        especialidad: req.body.especialidad
          ? String(req.body.especialidad).trim()
          : null,

        gradoAcademico: req.body.gradoAcademico
          ? String(req.body.gradoAcademico).trim()
          : null,

        activo: true,

        historialTests: carreraRecomendada
          ? {
              create: {
                resultado: carreraRecomendada,
              },
            }
          : undefined,
      },
    });

    const { contrasena: contrasenaEliminada, ...usuarioSinContrasena } =
      nuevoUsuario;

    return res.status(201).json({
      ok: true,
      mensaje: "Usuario registrado correctamente.",
      data: usuarioSinContrasena,
      rol: nuevoUsuario.rol,
    });
  } catch (error) {
    console.error("Error registrando usuario:", error);

    if (error.code === "P2002") {
      return res.status(409).json({
        ok: false,
        mensaje: "Este correo ya está registrado.",
      });
    }

    return res.status(500).json({
      ok: false,
      mensaje: "No se pudo registrar al usuario.",
    });
  }
});
/////////////////////

app.get("/api/users/tipo/:tipo", (req, res) => {
  const db = getDb();
  const role = normalizeRole(req.params.tipo);
  const users = db.users.filter((user) => user.rol === role);
  res.json({ ok: true, data: users });
});

app.get("/api/universidad/:id/full", (req, res) => {
  const db = getDb();
  const universidad = db.universidad.find(
    (item) => String(item.id) === req.params.id,
  );

  if (!universidad) return sendNotFound(res, "universidad");

  return res.json({
    ok: true,
    data: {
      ...universidad,
      logo:
        db.logos.find((logo) => logo.universidad_id === universidad.id) || null,
      carreras: db.carreras.filter(
        (carrera) => carrera.universidad_id === universidad.id,
      ),
      escalas: db.escalas.filter(
        (escala) => escala.universidad_id === universidad.id,
      ),
    },
  });
});

createCrudRoutes("universidad");
createCrudRoutes("carreras");
createCrudRoutes("escalas");
createCrudRoutes("logos");
createCrudRoutes("users");
createCrudRoutes("universidad_users");

//////////////////////////////
app.get("/api/db/universidades", async (req, res) => {
  try {
    const universidades = await prisma.universidad.findMany({
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

app.post("/api/db/universidades", async (req, res) => {
  try {
    const nombre = String(req.body.nombre || "").trim();
    const tipo = String(req.body.tipo || "Privada").trim();

    if (!nombre) {
      return res.status(400).json({
        ok: false,
        mensaje: "El nombre de la universidad es obligatorio.",
      });
    }

    const universidadExistente = await prisma.universidad.findFirst({
      where: {
        nombre: {
          equals: nombre,
          mode: "insensitive",
        },
      },
    });

    if (universidadExistente) {
      return res.status(409).json({
        ok: false,
        mensaje: "Ya existe una universidad con ese nombre.",
      });
    }

    const carrerasRecibidas = Array.isArray(req.body.carreras)
      ? req.body.carreras
      : [];

    const escalasRecibidas = Array.isArray(req.body.escalas)
      ? req.body.escalas
      : [];

    const carrerasValidas = carrerasRecibidas
      .map((carrera) => ({
        nombre: String(carrera.nombre || "").trim(),

        facultad: carrera.facultad ? String(carrera.facultad).trim() : null,

        duracion: carrera.duracion ? String(carrera.duracion).trim() : null,

        creditos:
          carrera.creditos !== undefined &&
          carrera.creditos !== null &&
          carrera.creditos !== ""
            ? Number(carrera.creditos)
            : null,

        descripcion: carrera.descripcion
          ? String(carrera.descripcion).trim()
          : null,

        planEstudios: carrera.planEstudios || null,
      }))
      .filter((carrera) => carrera.nombre);

    const escalasValidas = escalasRecibidas
      .map((escala) => ({
        escala: String(escala.escala || "").trim(),

        rango: escala.rango ? String(escala.rango).trim() : null,
      }))
      .filter((escala) => escala.escala);

    const dataUniversidad = {
      nombre,
      tipo,

      ubicacion: req.body.ubicacion ? String(req.body.ubicacion).trim() : null,

      costoMatricula: req.body.costoMatricula
        ? String(req.body.costoMatricula).trim()
        : null,

      webOficial: req.body.webOficial
        ? String(req.body.webOficial).trim()
        : null,
    };

    if (carrerasValidas.length > 0) {
      dataUniversidad.carreras = {
        create: carrerasValidas,
      };
    }

    if (escalasValidas.length > 0) {
      dataUniversidad.escalas = {
        create: escalasValidas,
      };
    }

    if (req.body.logo) {
      dataUniversidad.logos = {
        create: {
          url: String(req.body.logo),
          descripcion: `Logo de ${nombre}`,
        },
      };
    }

    const nuevaUniversidad = await prisma.universidad.create({
      data: dataUniversidad,

      include: {
        carreras: true,
        escalas: true,
        logos: true,
      },
    });

    return res.status(201).json({
      ok: true,
      mensaje: "Universidad registrada correctamente.",
      data: nuevaUniversidad,
    });
  } catch (error) {
    console.error("Error creando universidad:", error);

    return res.status(500).json({
      ok: false,
      mensaje: "No se pudo registrar la universidad.",
      error: error.message,
    });
  }
});

app.put("/api/db/universidades/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        ok: false,
        mensaje: "El ID de la universidad no es válido.",
      });
    }

    const universidadActual = await prisma.universidad.findUnique({
      where: {
        id,
      },

      include: {
        carreras: true,
        escalas: true,
        logos: true,
      },
    });

    if (!universidadActual) {
      return res.status(404).json({
        ok: false,
        mensaje: "La universidad no existe.",
      });
    }

    const nombre = String(req.body.nombre ?? universidadActual.nombre).trim();

    const tipo = String(req.body.tipo ?? universidadActual.tipo).trim();

    if (!nombre) {
      return res.status(400).json({
        ok: false,
        mensaje: "El nombre de la universidad es obligatorio.",
      });
    }

    const universidadRepetida = await prisma.universidad.findFirst({
      where: {
        nombre: {
          equals: nombre,
          mode: "insensitive",
        },

        NOT: {
          id,
        },
      },
    });

    if (universidadRepetida) {
      return res.status(409).json({
        ok: false,
        mensaje: "Ya existe otra universidad con ese nombre.",
      });
    }

    const datosActualizar = {
      nombre,
      tipo,

      ubicacion: req.body.ubicacion ? String(req.body.ubicacion).trim() : null,

      costoMatricula: req.body.costoMatricula
        ? String(req.body.costoMatricula).trim()
        : null,

      webOficial: req.body.webOficial
        ? String(req.body.webOficial).trim()
        : null,
    };

    /*
     * Solo se reemplaza el logo cuando el frontend
     * envía explícitamente la propiedad "logo".
     */
    if (req.body.logo !== undefined) {
      if (req.body.logo) {
        datosActualizar.logos = {
          deleteMany: {},

          create: {
            url: String(req.body.logo),
            descripcion: `Logo de ${nombre}`,
          },
        };
      } else {
        datosActualizar.logos = {
          deleteMany: {},
        };
      }
    }

    /*
     * Las carreras que ya existen tienen ID.
     * Solamente se crean las carreras nuevas, que no tienen ID.
     */
    const carrerasRecibidas = Array.isArray(req.body.carreras)
      ? req.body.carreras
      : [];

    const carrerasNuevas = carrerasRecibidas
      .filter((carrera) => !carrera.id)
      .map((carrera) => ({
        nombre: String(carrera.nombre || "").trim(),

        facultad: carrera.facultad ? String(carrera.facultad).trim() : null,

        duracion: carrera.duracion ? String(carrera.duracion).trim() : null,

        creditos:
          carrera.creditos !== undefined &&
          carrera.creditos !== null &&
          carrera.creditos !== ""
            ? Number(carrera.creditos)
            : null,

        descripcion: carrera.descripcion
          ? String(carrera.descripcion).trim()
          : null,

        planEstudios: carrera.planEstudios || null,
      }))
      .filter((carrera) => carrera.nombre);

    if (carrerasNuevas.length > 0) {
      datosActualizar.carreras = {
        create: carrerasNuevas,
      };
    }

    const universidadActualizada = await prisma.universidad.update({
      where: {
        id,
      },

      data: datosActualizar,

      include: {
        carreras: {
          orderBy: {
            id: "asc",
          },
        },

        escalas: {
          orderBy: {
            id: "asc",
          },
        },

        logos: {
          orderBy: {
            id: "asc",
          },
        },
      },
    });

    return res.json({
      ok: true,
      mensaje: "Universidad actualizada correctamente.",
      data: universidadActualizada,
    });
  } catch (error) {
    console.error("Error actualizando universidad:", error);

    return res.status(500).json({
      ok: false,
      mensaje: "No se pudo actualizar la universidad.",
      error: error.message,
    });
  }
});

app.delete("/api/db/universidades/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        ok: false,
        mensaje: "El ID de la universidad no es válido.",
      });
    }

    const universidad = await prisma.universidad.findUnique({
      where: {
        id,
      },
    });

    if (!universidad) {
      return res.status(404).json({
        ok: false,
        mensaje: "La universidad no existe.",
      });
    }

    await prisma.universidad.delete({
      where: {
        id,
      },
    });

    return res.json({
      ok: true,
      mensaje: "Universidad eliminada correctamente.",
    });
  } catch (error) {
    console.error("Error eliminando universidad:", error);

    return res.status(500).json({
      ok: false,
      mensaje: "No se pudo eliminar la universidad.",
      error: error.message,
    });
  }
});

app.delete("/api/db/carreras/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        ok: false,
        mensaje: "El ID de la carrera no es válido.",
      });
    }

    const carrera = await prisma.carrera.findUnique({
      where: {
        id,
      },
    });

    if (!carrera) {
      return res.status(404).json({
        ok: false,
        mensaje: "La carrera no existe.",
      });
    }

    await prisma.carrera.delete({
      where: {
        id,
      },
    });

    return res.json({
      ok: true,
      mensaje: "Carrera eliminada correctamente.",
    });
  } catch (error) {
    console.error("Error eliminando carrera:", error);

    return res.status(500).json({
      ok: false,
      mensaje: "No se pudo eliminar la carrera.",
      error: error.message,
    });
  }
});

app.put("/api/db/users/:id/profile", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        ok: false,
        mensaje: "El ID del usuario no es válido.",
      });
    }

    const passwordActual = String(req.body.passwordActual || "");

    if (!passwordActual) {
      return res.status(400).json({
        ok: false,
        mensaje: "Debes ingresar tu contraseña actual.",
      });
    }

    const usuario = await prisma.user.findUnique({
      where: {
        id,
      },
    });

    if (!usuario) {
      return res.status(404).json({
        ok: false,
        mensaje: "El usuario no existe.",
      });
    }

    if (usuario.contrasena !== passwordActual) {
      return res.status(401).json({
        ok: false,
        mensaje: "La contraseña actual es incorrecta.",
      });
    }

    const dataToUpdate = {};

    if (req.body.nombres !== undefined || req.body.apellidos !== undefined) {
      const nombres = String(req.body.nombres ?? usuario.nombres).trim();

      const apellidos = String(req.body.apellidos ?? usuario.apellidos).trim();

      const regexNombre = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/;

      if (!nombres || !regexNombre.test(nombres)) {
        return res.status(400).json({
          ok: false,
          mensaje: "Los nombres solo pueden contener letras.",
        });
      }

      if (!apellidos || !regexNombre.test(apellidos)) {
        return res.status(400).json({
          ok: false,
          mensaje: "Los apellidos solo pueden contener letras.",
        });
      }

      dataToUpdate.nombres = nombres;
      dataToUpdate.apellidos = apellidos;
    }

    if (req.body.correo !== undefined) {
      const correo = String(req.body.correo).trim().toLowerCase();

      const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!regexCorreo.test(correo)) {
        return res.status(400).json({
          ok: false,
          mensaje: "El correo electrónico no es válido.",
        });
      }

      if (correo === usuario.correo) {
        return res.status(400).json({
          ok: false,
          mensaje: "El nuevo correo debe ser diferente al actual.",
        });
      }

      const correoRegistrado = await prisma.user.findFirst({
        where: {
          correo,
          NOT: {
            id,
          },
        },
      });

      if (correoRegistrado) {
        return res.status(409).json({
          ok: false,
          mensaje: "Ese correo ya está registrado.",
        });
      }

      dataToUpdate.correo = correo;
    }

    if (req.body.nuevaContrasena !== undefined) {
      const nuevaContrasena = String(req.body.nuevaContrasena);

      const regexPassword = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

      if (!regexPassword.test(nuevaContrasena)) {
        return res.status(400).json({
          ok: false,
          mensaje:
            "La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.",
        });
      }

      if (nuevaContrasena === usuario.contrasena) {
        return res.status(400).json({
          ok: false,
          mensaje: "La nueva contraseña debe ser diferente a la actual.",
        });
      }

      dataToUpdate.contrasena = nuevaContrasena;
    }

    if (Object.keys(dataToUpdate).length === 0) {
      return res.status(400).json({
        ok: false,
        mensaje: "No se enviaron cambios.",
      });
    }

    const usuarioActualizado = await prisma.user.update({
      where: {
        id,
      },
      data: dataToUpdate,
    });

    const { contrasena: contrasenaEliminada, ...usuarioSinContrasena } =
      usuarioActualizado;

    return res.json({
      ok: true,
      mensaje: "Perfil actualizado correctamente.",
      data: usuarioSinContrasena,
    });
  } catch (error) {
    console.error("Error actualizando el perfil:", error);

    if (error.code === "P2002") {
      return res.status(409).json({
        ok: false,
        mensaje: "Ese correo ya está registrado.",
      });
    }

    return res.status(500).json({
      ok: false,
      mensaje: "No se pudo actualizar el perfil.",
    });
  }
});

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
    return res.status(500).json({
      ok: false,
      mensaje: "No se pudo actualizar el usuario.",
      error: error.message,
    });
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
    return res.status(500).json({
      ok: false,
      mensaje: "No se pudo eliminar el usuario.",
      error: error.message,
    });
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
app.get("/api/db/universidad-users", async (req, res) => {
  try {
    const favoritos = await prisma.universidadUser.findMany({
      include: {
        user: true,
        universidad: true,
      },
      orderBy: {
        fechaAgregado: "desc",
      },
    });

    return res.json({
      ok: true,
      data: favoritos,
    });
  } catch (error) {
    console.error("Error obteniendo universidades favoritas:", error);

    return res.status(500).json({
      ok: false,
      mensaje: "No se pudieron obtener las universidades favoritas.",
      error: error.message,
    });
  }
});
//////////////////////////////

app.get("/api/db/users/:userId/favoritos", async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        ok: false,
        mensaje: "El ID del usuario no es válido.",
      });
    }

    const usuario = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
      },
    });

    if (!usuario) {
      return res.status(404).json({
        ok: false,
        mensaje: "El usuario no existe.",
      });
    }

    const favoritos = await prisma.universidadUser.findMany({
      where: {
        userId,
      },

      include: {
        universidad: {
          include: {
            carreras: true,
            escalas: true,
            logos: true,
          },
        },
      },

      orderBy: {
        fechaAgregado: "desc",
      },
    });

    const universidades = favoritos.map((favorito) => ({
      id: favorito.universidad.id,
      nombre: favorito.universidad.nombre,
      tipo: favorito.universidad.tipo,
      ubicacion: favorito.universidad.ubicacion,
      costoMatricula: favorito.universidad.costoMatricula,
      webOficial: favorito.universidad.webOficial,

      logo: favorito.universidad.logos[0]?.url || "",

      carreras: favorito.universidad.carreras,
      escalas: favorito.universidad.escalas,

      fechaAgregado: favorito.fechaAgregado,
    }));

    return res.json({
      ok: true,
      data: universidades,
    });
  } catch (error) {
    console.error("Error obteniendo favoritos del usuario:", error);

    return res.status(500).json({
      ok: false,
      mensaje: "No se pudieron obtener las universidades favoritas.",
    });
  }
});

app.post("/api/db/users/:userId/favoritos/:universidadId", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const universidadId = Number(req.params.universidadId);

    if (
      !Number.isInteger(userId) ||
      !Number.isInteger(universidadId) ||
      userId <= 0 ||
      universidadId <= 0
    ) {
      return res.status(400).json({
        ok: false,
        mensaje: "El usuario o la universidad no son válidos.",
      });
    }

    const [usuario, universidad] = await Promise.all([
      prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
        },
      }),

      prisma.universidad.findUnique({
        where: {
          id: universidadId,
        },

        include: {
          carreras: true,
          escalas: true,
          logos: true,
        },
      }),
    ]);

    if (!usuario) {
      return res.status(404).json({
        ok: false,
        mensaje: "El usuario no existe.",
      });
    }

    if (!universidad) {
      return res.status(404).json({
        ok: false,
        mensaje: "La universidad no existe.",
      });
    }

    /*
     * El upsert evita favoritos duplicados.
     * La clave compuesta proviene de:
     * @@id([userId, universidadId])
     */
    const favorito = await prisma.universidadUser.upsert({
      where: {
        userId_universidadId: {
          userId,
          universidadId,
        },
      },

      update: {},

      create: {
        userId,
        universidadId,
      },
    });

    return res.status(201).json({
      ok: true,
      mensaje: "Universidad agregada a favoritos.",

      data: {
        id: universidad.id,
        nombre: universidad.nombre,
        tipo: universidad.tipo,
        ubicacion: universidad.ubicacion,
        costoMatricula: universidad.costoMatricula,
        webOficial: universidad.webOficial,
        logo: universidad.logos[0]?.url || "",
        carreras: universidad.carreras,
        escalas: universidad.escalas,
        fechaAgregado: favorito.fechaAgregado,
      },
    });
  } catch (error) {
    console.error("Error agregando universidad a favoritos:", error);

    return res.status(500).json({
      ok: false,
      mensaje: "No se pudo agregar la universidad a favoritos.",
    });
  }
});

app.delete(
  "/api/db/users/:userId/favoritos/:universidadId",
  async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      const universidadId = Number(req.params.universidadId);

      if (
        !Number.isInteger(userId) ||
        !Number.isInteger(universidadId) ||
        userId <= 0 ||
        universidadId <= 0
      ) {
        return res.status(400).json({
          ok: false,
          mensaje: "El usuario o la universidad no son válidos.",
        });
      }

      await prisma.universidadUser.deleteMany({
        where: {
          userId,
          universidadId,
        },
      });

      return res.json({
        ok: true,
        mensaje: "Universidad eliminada de favoritos.",
      });
    } catch (error) {
      console.error("Error eliminando universidad de favoritos:", error);

      return res.status(500).json({
        ok: false,
        mensaje: "No se pudo eliminar la universidad de favoritos.",
      });
    }
  },
);

//////////////////////////////
app.get("/api/db/historial-tests", async (req, res) => {
  try {
    const historial = await prisma.historialTest.findMany({
      include: {
        user: true,
      },
      orderBy: {
        fecha: "desc",
      },
    });

    return res.json({
      ok: true,
      data: historial,
    });
  } catch (error) {
    console.error("Error obteniendo historial de tests:", error);

    return res.status(500).json({
      ok: false,
      mensaje: "No se pudo obtener el historial de tests.",
      error: error.message,
    });
  }
});
//////////////////////////////

app.get("/api/db/users/:userId/historial", async (req, res) => {
  try {
    const userId = Number(req.params.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        ok: false,
        mensaje: "El ID del usuario no es válido.",
      });
    }

    const usuario = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
      },
    });

    if (!usuario) {
      return res.status(404).json({
        ok: false,
        mensaje: "El usuario no existe.",
      });
    }

    const historial = await prisma.historialTest.findMany({
      where: {
        userId,
      },

      orderBy: [
        {
          fecha: "desc",
        },
        {
          id: "desc",
        },
      ],

      take: 20,
    });

    return res.json({
      ok: true,
      data: historial,
    });
  } catch (error) {
    console.error("Error obteniendo historial del usuario:", error);

    return res.status(500).json({
      ok: false,
      mensaje: "No se pudo obtener el historial de tests.",
    });
  }
});

app.post("/api/db/users/:userId/historial", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const resultado = String(req.body.resultado || "").trim();

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        ok: false,
        mensaje: "El ID del usuario no es válido.",
      });
    }

    if (!resultado) {
      return res.status(400).json({
        ok: false,
        mensaje: "El resultado del test es obligatorio.",
      });
    }

    const usuario = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        activo: true,
      },
    });

    if (!usuario) {
      return res.status(404).json({
        ok: false,
        mensaje: "El usuario no existe.",
      });
    }

    if (!usuario.activo) {
      return res.status(403).json({
        ok: false,
        mensaje: "La cuenta del usuario está desactivada.",
      });
    }

    const historialCreado = await prisma.$transaction(async (tx) => {
      const nuevoHistorial = await tx.historialTest.create({
        data: {
          userId,
          resultado,
        },
      });

      await tx.user.update({
        where: {
          id: userId,
        },
        data: {
          carreraRecomendada: resultado,
        },
      });

      return nuevoHistorial;
    });

    return res.status(201).json({
      ok: true,
      mensaje: "Resultado guardado correctamente.",
      data: historialCreado,
    });
  } catch (error) {
    console.error("Error guardando resultado del test:", error);

    return res.status(500).json({
      ok: false,
      mensaje: "No se pudo guardar el resultado del test.",
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ ok: false, mensaje: "Ruta no encontrada." });
});

// PARA RENDER MEJOR SERIA ESTO:
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor backend corriendo en el puerto ${PORT}`);
});
