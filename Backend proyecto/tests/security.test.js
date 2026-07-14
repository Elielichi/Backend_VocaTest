import assert from "node:assert/strict";
import test from "node:test";

import {
  createToken,
  generateRoomCode,
  hashPassword,
  verifyPassword,
  verifyToken,
} from "../src/utils/security.js";

test("protege y verifica contraseñas nuevas", () => {
  const hash = hashPassword("ClaveSegura9");

  assert.notEqual(hash, "ClaveSegura9");
  assert.equal(verifyPassword("ClaveSegura9", hash), true);
  assert.equal(verifyPassword("Incorrecta", hash), false);
});

test("mantiene compatibilidad con usuarios antiguos sin hash", () => {
  assert.equal(verifyPassword("admin123", "admin123"), true);
  assert.equal(verifyPassword("otra", "admin123"), false);
});

test("firma tokens y rechaza firmas inválidas", () => {
  const token = createToken({ id: 3, rol: "Administrador" }, "secreto");

  assert.deepEqual(verifyToken(token, "secreto").sub, 3);
  assert.equal(verifyToken(token, "otro-secreto"), null);
});

test("genera códigos de sala legibles de ocho caracteres", () => {
  const code = generateRoomCode();
  assert.match(code, /^[A-Z2-9]{8}$/);
});
