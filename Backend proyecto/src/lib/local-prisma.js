import { AsyncLocalStorage } from "node:async_hooks";

import {
  initializeLocalDatabase,
  loadDatabase as loadStoredDatabase,
  saveDatabase as saveStoredDatabase,
} from "./local-sqlite-store.js";

const transactionStorage = new AsyncLocalStorage();

function loadDatabase() {
  return transactionStorage.getStore()?.database || loadStoredDatabase();
}

function saveDatabase(database) {
  const transaction = transactionStorage.getStore();
  if (transaction) {
    transaction.database = database;
    return;
  }
  saveStoredDatabase(database);
}

function nextId(items) {
  return items.reduce((highest, item) => Math.max(highest, Number(item.id) || 0), 0) + 1;
}

function prismaError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function notFound(entity) {
  return prismaError("P2025", `${entity} no encontrado.`);
}

function universityWithRelations(database, university) {
  if (!university) return null;

  return {
    ...university,
    carreras: database.carreras
      .filter((career) => career.universidad_id === university.id)
      .sort((a, b) => a.id - b.id),
    escalas: database.escalas
      .filter((scale) => scale.universidad_id === university.id)
      .sort((a, b) => a.id - b.id),
    logos: database.logos
      .filter((logo) => logo.universidad_id === university.id)
      .sort((a, b) => a.id - b.id),
  };
}

function resultWithUser(database, result) {
  if (!result) return null;
  return { ...result, user: database.users.find((user) => user.id === result.userId) };
}

function roomWithRelations(database, room) {
  if (!room) return null;

  return {
    ...room,
    creador: database.users.find((user) => user.id === room.creadorId),
    resultados: database.resultados_sala
      .filter((result) => result.salaId === room.id)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .map((result) => resultWithUser(database, result)),
  };
}

function applySelect(record, select) {
  if (!select || !record) return record;

  return Object.fromEntries(
    Object.entries(select)
      .filter(([, enabled]) => enabled)
      .map(([key]) => [key, record[key]]),
  );
}

function userDefaults(data) {
  return {
    rol: "Estudiante",
    ciudad: null,
    tipoColegio: null,
    telefono: null,
    edad: null,
    sexo: null,
    carreraRecomendada: null,
    ultimoIngreso: null,
    activo: true,
    especialidad: null,
    gradoAcademico: null,
    notificacionesEmail: true,
    recordatorios: true,
    perfilPublico: true,
    ...data,
  };
}

export const localPrisma = {
  user: {
    async findUnique({ where }) {
      const database = loadDatabase();
      return (
        database.users.find((user) =>
          where.id !== undefined ? user.id === where.id : user.correo === where.correo,
        ) || null
      );
    },

    async findMany() {
      return loadDatabase().users.sort((a, b) => a.id - b.id);
    },

    async create({ data }) {
      const database = loadDatabase();
      if (database.users.some((user) => user.correo === data.correo)) {
        throw prismaError("P2002", "El correo ya existe.");
      }

      const user = userDefaults({ id: nextId(database.users), ...data });
      database.users.push(user);
      saveDatabase(database);
      return user;
    },

    async update({ where, data }) {
      const database = loadDatabase();
      const index = database.users.findIndex((user) =>
        where.id !== undefined ? user.id === where.id : user.correo === where.correo,
      );
      if (index < 0) throw notFound("Usuario");

      if (
        data.correo &&
        database.users.some(
          (user, userIndex) => userIndex !== index && user.correo === data.correo,
        )
      ) {
        throw prismaError("P2002", "El correo ya existe.");
      }

      database.users[index] = { ...database.users[index], ...data };
      saveDatabase(database);
      return database.users[index];
    },

    async delete({ where }) {
      const database = loadDatabase();
      const index = database.users.findIndex((user) => user.id === where.id);
      if (index < 0) throw notFound("Usuario");

      const [deleted] = database.users.splice(index, 1);
      database.universidad_users = database.universidad_users.filter(
        (item) => item.userId !== deleted.id,
      );
      database.historial_tests = database.historial_tests.filter(
        (item) => item.userId !== deleted.id,
      );
      database.salas = database.salas.filter((room) => room.creadorId !== deleted.id);
      database.resultados_sala = database.resultados_sala.filter(
        (item) => item.userId !== deleted.id,
      );
      saveDatabase(database);
      return deleted;
    },
  },

  universidad: {
    async findMany() {
      const database = loadDatabase();
      return database.universidad
        .sort((a, b) => a.id - b.id)
        .map((university) => universityWithRelations(database, university));
    },

    async findUnique({ where }) {
      const database = loadDatabase();
      return universityWithRelations(
        database,
        database.universidad.find((university) => university.id === where.id),
      );
    },

    async create({ data }) {
      const database = loadDatabase();
      const { carreras, logos, ...universityData } = data;
      const university = { id: nextId(database.universidad), ...universityData };
      database.universidad.push(university);

      for (const career of carreras?.create || []) {
        database.carreras.push({
          id: nextId(database.carreras),
          universidad_id: university.id,
          ...career,
        });
      }
      for (const logo of logos?.create || []) {
        database.logos.push({
          id: nextId(database.logos),
          universidad_id: university.id,
          ...logo,
        });
      }

      saveDatabase(database);
      return universityWithRelations(database, university);
    },

    async update({ where, data }) {
      const database = loadDatabase();
      const index = database.universidad.findIndex((item) => item.id === where.id);
      if (index < 0) throw notFound("Universidad");
      database.universidad[index] = { ...database.universidad[index], ...data };
      saveDatabase(database);
      return universityWithRelations(database, database.universidad[index]);
    },

    async delete({ where }) {
      const database = loadDatabase();
      const index = database.universidad.findIndex((item) => item.id === where.id);
      if (index < 0) throw notFound("Universidad");
      const [deleted] = database.universidad.splice(index, 1);
      database.carreras = database.carreras.filter(
        (item) => item.universidad_id !== deleted.id,
      );
      database.escalas = database.escalas.filter(
        (item) => item.universidad_id !== deleted.id,
      );
      database.logos = database.logos.filter(
        (item) => item.universidad_id !== deleted.id,
      );
      database.universidad_users = database.universidad_users.filter(
        (item) => item.universidadId !== deleted.id,
      );
      saveDatabase(database);
      return deleted;
    },
  },

  carrera: {
    async findMany({ where = {}, select, include } = {}) {
      const database = loadDatabase();
      return database.carreras
        .filter(
          (career) =>
            where.universidad_id === undefined ||
            career.universidad_id === where.universidad_id,
        )
        .sort((a, b) => a.id - b.id)
        .map((career) => {
          const result = include?.universidad
            ? {
                ...career,
                universidad: database.universidad.find(
                  (university) => university.id === career.universidad_id,
                ),
              }
            : career;
          return applySelect(result, select);
        });
    },

    async create({ data }) {
      const database = loadDatabase();
      if (!database.universidad.some((item) => item.id === data.universidad_id)) {
        throw prismaError("P2003", "La universidad no existe.");
      }
      const career = { id: nextId(database.carreras), ...data };
      database.carreras.push(career);
      saveDatabase(database);
      return career;
    },

    async update({ where, data }) {
      const database = loadDatabase();
      const index = database.carreras.findIndex((item) => item.id === where.id);
      if (index < 0) throw notFound("Carrera");
      database.carreras[index] = { ...database.carreras[index], ...data };
      saveDatabase(database);
      return database.carreras[index];
    },

    async delete({ where }) {
      const database = loadDatabase();
      const index = database.carreras.findIndex((item) => item.id === where.id);
      if (index < 0) throw notFound("Carrera");
      const [deleted] = database.carreras.splice(index, 1);
      saveDatabase(database);
      return deleted;
    },

    async deleteMany({ where }) {
      const database = loadDatabase();
      const before = database.carreras.length;
      const excludedIds = new Set(where.id?.notIn || []);
      database.carreras = database.carreras.filter(
        (career) =>
          career.universidad_id !== where.universidad_id || excludedIds.has(career.id),
      );
      saveDatabase(database);
      return { count: before - database.carreras.length };
    },
  },

  logo: {
    async create({ data }) {
      const database = loadDatabase();
      const logo = { id: nextId(database.logos), ...data };
      database.logos.push(logo);
      saveDatabase(database);
      return logo;
    },

    async deleteMany({ where }) {
      const database = loadDatabase();
      const before = database.logos.length;
      database.logos = database.logos.filter(
        (logo) => logo.universidad_id !== where.universidad_id,
      );
      saveDatabase(database);
      return { count: before - database.logos.length };
    },
  },

  universidadUser: {
    async findMany({ where }) {
      const database = loadDatabase();
      return database.universidad_users
        .filter((item) => item.userId === where.userId)
        .sort((a, b) => new Date(b.fechaAgregado) - new Date(a.fechaAgregado))
        .map((item) => ({
          ...item,
          universidad: universityWithRelations(
            database,
            database.universidad.find(
              (university) => university.id === item.universidadId,
            ),
          ),
        }));
    },

    async upsert({ where, create }) {
      const database = loadDatabase();
      const key = where.userId_universidadId;
      let favorite = database.universidad_users.find(
        (item) => item.userId === key.userId && item.universidadId === key.universidadId,
      );

      if (!favorite) {
        if (!database.users.some((user) => user.id === create.userId)) {
          throw prismaError("P2003", "El usuario no existe.");
        }
        if (!database.universidad.some((item) => item.id === create.universidadId)) {
          throw prismaError("P2003", "La universidad no existe.");
        }
        favorite = { ...create, fechaAgregado: new Date().toISOString() };
        database.universidad_users.push(favorite);
        saveDatabase(database);
      }

      return {
        ...favorite,
        universidad: universityWithRelations(
          database,
          database.universidad.find((item) => item.id === favorite.universidadId),
        ),
      };
    },

    async deleteMany({ where }) {
      const database = loadDatabase();
      const before = database.universidad_users.length;
      database.universidad_users = database.universidad_users.filter(
        (item) =>
          item.userId !== where.userId || item.universidadId !== where.universidadId,
      );
      saveDatabase(database);
      return { count: before - database.universidad_users.length };
    },
  },

  historialTest: {
    async findMany({ where, take }) {
      return loadDatabase()
        .historial_tests.filter((item) => item.userId === where.userId)
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, take);
    },

    async create({ data }) {
      const database = loadDatabase();
      if (!database.users.some((user) => user.id === data.userId)) {
        throw prismaError("P2003", "El usuario no existe.");
      }
      const entry = {
        id: nextId(database.historial_tests),
        fecha: new Date().toISOString(),
        ...data,
      };
      database.historial_tests.push(entry);
      saveDatabase(database);
      return entry;
    },
  },

  sala: {
    async findUnique({ where }) {
      const database = loadDatabase();
      const room = database.salas.find((item) =>
        where.id !== undefined ? item.id === where.id : item.codigo === where.codigo,
      );
      return roomWithRelations(database, room);
    },

    async findMany({ where = {} }) {
      const database = loadDatabase();
      return database.salas
        .filter((room) => where.creadorId === undefined || room.creadorId === where.creadorId)
        .sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn))
        .map((room) => roomWithRelations(database, room));
    },

    async create({ data }) {
      const database = loadDatabase();
      if (database.salas.some((room) => room.codigo === data.codigo)) {
        throw prismaError("P2002", "El cÃ³digo de sala ya existe.");
      }
      if (!database.users.some((user) => user.id === data.creadorId)) {
        throw prismaError("P2003", "El creador no existe.");
      }
      const room = {
        id: nextId(database.salas),
        activa: true,
        creadoEn: new Date().toISOString(),
        cerradoEn: null,
        ...data,
      };
      database.salas.push(room);
      saveDatabase(database);
      return roomWithRelations(database, room);
    },

    async update({ where, data }) {
      const database = loadDatabase();
      const index = database.salas.findIndex((room) => room.codigo === where.codigo);
      if (index < 0) throw notFound("Sala");
      database.salas[index] = { ...database.salas[index], ...data };
      saveDatabase(database);
      return roomWithRelations(database, database.salas[index]);
    },

    async delete({ where }) {
      const database = loadDatabase();
      const index = database.salas.findIndex((room) => room.id === where.id);
      if (index < 0) throw notFound("Sala");
      const [deleted] = database.salas.splice(index, 1);
      database.resultados_sala = database.resultados_sala.filter(
        (result) => result.salaId !== deleted.id,
      );
      saveDatabase(database);
      return deleted;
    },
  },

  resultadoSala: {
    async upsert({ where, update, create }) {
      const database = loadDatabase();
      const key = where.salaId_userId;
      const index = database.resultados_sala.findIndex(
        (item) => item.salaId === key.salaId && item.userId === key.userId,
      );
      let result;

      if (index >= 0) {
        database.resultados_sala[index] = {
          ...database.resultados_sala[index],
          ...update,
        };
        result = database.resultados_sala[index];
      } else {
        result = {
          id: nextId(database.resultados_sala),
          fecha: new Date().toISOString(),
          ...create,
        };
        database.resultados_sala.push(result);
      }

      saveDatabase(database);
      return resultWithUser(database, result);
    },
  },

  preguntaTest: {
    async findMany({ where = {} } = {}) {
      return loadDatabase()
        .preguntas_test.filter(
          (question) => where.activa === undefined || question.activa === where.activa,
        )
        .sort((a, b) => a.orden - b.orden);
    },
  },

  areaVocacional: {
    async findUnique({ where }) {
      return (
        loadDatabase().areas_vocacionales.find(
          (area) => area.codigo === where.codigo,
        ) || null
      );
    },
  },

  async $queryRaw() {
    initializeLocalDatabase();
    return [{ database: "local" }];
  },

  async $transaction(callback) {
    const activeTransaction = transactionStorage.getStore();
    if (activeTransaction) return callback(localPrisma);

    const transaction = { database: loadStoredDatabase() };
    return transactionStorage.run(transaction, async () => {
      const result = await callback(localPrisma);
      saveStoredDatabase(transaction.database);
      return result;
    });
  },

  async $disconnect() {},
};
