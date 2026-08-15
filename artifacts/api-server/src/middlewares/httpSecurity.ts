import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function normalizeOrigin(value: string) {
  return value.trim().replace(/\/$/, "");
}

export function trustedPortalOrigins() {
  return [process.env.PORTAL_ORIGIN, process.env.PORTAL_ORIGINS]
    .filter((value): value is string => Boolean(value?.trim()))
    .flatMap((value) => value.split(","))
    .map(normalizeOrigin)
    .filter(Boolean);
}

export function reportCorsConfiguration() {
  const origins = trustedPortalOrigins();
  if (origins.length === 0) {
    logger.warn(
      "PORTAL_ORIGIN/PORTAL_ORIGINS is not configured; browser origin allowlisting is not enforced",
    );
  } else {
    logger.info({ origins }, "Portal origin allowlist enabled");
  }
}

export function securityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("Cache-Control", "no-store");
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }
  next();
}

/**
 * Adds a CSRF-style Origin check for credentialed state-changing browser calls.
 * It becomes strict as soon as PORTAL_ORIGIN(S) is configured, while leaving
 * non-browser/server requests (without Origin) untouched.
 */
export function enforceTrustedOrigin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!unsafeMethods.has(req.method)) return next();
  const origin = req.get("origin");
  if (!origin) return next();

  const trusted = trustedPortalOrigins();
  if (trusted.length === 0) return next();
  if (trusted.includes(normalizeOrigin(origin))) return next();

  logger.warn(
    { method: req.method, path: req.path, origin },
    "Blocked request from untrusted browser origin",
  );
  res.status(403).json({ error: "Origem não autorizada." });
}
