import { config } from "../config.js";
import { HttpError } from "../utils/http.js";
import { verifyToken } from "../utils/security.js";

export function requireAuth(req, _res, next) {
  const authorization = req.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new HttpError(401, "Debes iniciar sesión."));
  }

  const payload = verifyToken(token, config.authSecret);

  if (!payload) {
    return next(new HttpError(401, "La sesión venció o no es válida."));
  }

  req.auth = {
    id: Number(payload.sub),
    rol: payload.rol,
  };

  return next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.auth?.rol)) {
      return next(new HttpError(403, "No tienes permiso para esta acción."));
    }

    return next();
  };
}

export function requireSelfOrAdmin(req, _res, next) {
  const requestedId = Number(req.params.id);

  if (req.auth?.rol !== "Administrador" && req.auth?.id !== requestedId) {
    return next(new HttpError(403, "No tienes permiso para ver este usuario."));
  }

  return next();
}
