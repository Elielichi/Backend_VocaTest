export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function parseId(value, label = "ID") {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, `${label} inválido.`);
  }

  return id;
}

export function cleanOptional(value) {
  if (value === undefined) return undefined;
  const clean = String(value ?? "").trim();
  return clean || null;
}

export function publicUser(user) {
  if (!user) return null;
  const { contrasena: _contrasena, ...safeUser } = user;
  return safeUser;
}
