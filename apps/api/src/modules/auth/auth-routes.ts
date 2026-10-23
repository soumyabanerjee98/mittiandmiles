import { Router } from "express";
import { z } from "zod";
import { asyncRoute } from "../../middleware/async-handler.js";
import { readParsedBody, validateBody } from "../../middleware/validate.js";
import type { AuthService } from "./auth-service.js";

const localePattern = /^[a-z]{2}(-[A-Z]{2})?$/;

const registerBodySchema = z
  .object({
    email: z.email(),
    password: z.string().min(12).max(128),
    locale: z.string().regex(localePattern).optional().default("en"),
  })
  .strict();

const loginBodySchema = z
  .object({
    email: z.email(),
    password: z.string().min(1).max(128),
  })
  .strict();

const refreshBodySchema = z
  .object({
    refreshToken: z.string().min(16).max(512),
  })
  .strict();

const logoutBodySchema = refreshBodySchema;

export function createAuthRouter(auth: AuthService): Router {
  const router = Router();

  router.post(
    "/auth/register",
    validateBody(registerBodySchema),
    asyncRoute(async (_req, res) => {
      const body = readParsedBody(res, registerBodySchema);
      const tokens = await auth.register(body);
      res.status(201).json(tokens);
    }),
  );

  router.post(
    "/auth/login",
    validateBody(loginBodySchema),
    asyncRoute(async (_req, res) => {
      const body = readParsedBody(res, loginBodySchema);
      const tokens = await auth.login(body);
      res.status(200).json(tokens);
    }),
  );

  router.post(
    "/auth/refresh",
    validateBody(refreshBodySchema),
    asyncRoute(async (_req, res) => {
      const body = readParsedBody(res, refreshBodySchema);
      const tokens = await auth.refresh(body.refreshToken);
      res.status(200).json(tokens);
    }),
  );

  router.post(
    "/auth/logout",
    validateBody(logoutBodySchema),
    asyncRoute(async (_req, res) => {
      const body = readParsedBody(res, logoutBodySchema);
      await auth.logout(body.refreshToken);
      res.status(204).send();
    }),
  );

  return router;
}
