import { Router, type Request } from "express";
import { asyncRoute } from "../../middleware/async-handler.js";
import { getRequestId } from "../../middleware/request-context.js";
import {
  readParsedBody,
  readParsedParams,
  validateBody,
  validateParams,
} from "../../middleware/validate.js";
import { HttpError } from "../../shared/http-error.js";
import type { AuditWriter } from "../audit/audit-writer.js";
import { createAuthenticate } from "../auth/authenticate.js";
import { getActor } from "../auth/actor.js";
import { Permission } from "../auth/permissions.js";
import type { AuthVerifier } from "../auth/verifier.js";
import { assertHostRole, assertPermission } from "../catalogue/http.js";
import { ResourceNotOwnedError } from "../catalogue/service.js";
import type { UserRepository } from "../users/user-repository.js";
import { invalid } from "./errors.js";
import {
  presentIntent,
  presentPayout,
  presentRefund,
  presentStatus,
} from "./present.js";
import {
  idParamsSchema,
  paymentIntentBodySchema,
  payoutBodySchema,
  providerParamsSchema,
  refundBodySchema,
  reviewBodySchema,
} from "./schemas.js";
import type { PaymentService } from "./service.js";

export type PaymentRouterDependencies = {
  verifier: AuthVerifier;
  users: UserRepository;
  audit: AuditWriter;
  payments: PaymentService;
};

const hits = new Map<string, { count: number; reset: number }>();

export function createPaymentRouter(deps: PaymentRouterDependencies): Router {
  const authenticate = createAuthenticate(deps.verifier, deps.users);
  const router = Router();

  router.post(
    "/bookings/:id/payment-intent",
    authenticate,
    validateParams(idParamsSchema),
    validateBody(paymentIntentBodySchema),
    asyncRoute(async (req, res) => {
      const actor = await assertPermission(
        res,
        deps.audit,
        Permission.BOOKING_CREATE_OWN,
        "payment.intent",
        "booking",
        readParsedParams(res, idParamsSchema).id,
      );
      limit(`intent:${actor.userId}`);
      const params = readParsedParams(res, idParamsSchema);
      const result = await deps.payments.createIntent(
        actor,
        params.id,
        idempotencyKey(req),
      );
      res
        .status(result.replayed ? 200 : 201)
        .json(presentIntent(result.attempt, result.keyId));
    }),
  );

  router.get(
    "/bookings/:id/payment-status",
    authenticate,
    validateParams(idParamsSchema),
    asyncRoute(async (_req, res) => {
      const actor = await assertPermission(
        res,
        deps.audit,
        Permission.BOOKING_READ_OWN,
        "payment.status",
        "booking",
        readParsedParams(res, idParamsSchema).id,
      );
      const params = readParsedParams(res, idParamsSchema);
      try {
        const status = await deps.payments.readStatus(actor, params.id);
        res.status(200).json(presentStatus(status.booking, status.attempt));
      } catch (error: unknown) {
        if (error instanceof ResourceNotOwnedError) {
          await deps.audit.write({
            actorUserId: actor.userId,
            action: "payment.status",
            resourceType: error.resourceType,
            resourceId: error.resourceId,
            requestId: getRequestId(res),
            outcome: "DENIED",
            reason: "not-owner",
          });
        }
        throw error;
      }
    }),
  );

  router.post(
    "/bookings/:id/refund-requests",
    authenticate,
    validateParams(idParamsSchema),
    validateBody(refundBodySchema),
    asyncRoute(async (req, res) => {
      const actor = getActor(res);
      const params = readParsedParams(res, idParamsSchema);
      if (
        !actor.permissions.has(Permission.BOOKING_READ_OWN) &&
        !actor.permissions.has(Permission.REFUND_REVIEW)
      ) {
        await deps.audit.write({
          actorUserId: actor.userId,
          action: "refund.request",
          resourceType: "booking",
          resourceId: params.id,
          requestId: getRequestId(res),
          outcome: "DENIED",
          reason: "forbidden",
        });
        throw new HttpError(
          403,
          "FORBIDDEN",
          "You do not have access to this resource.",
        );
      }
      limit(`refund:${actor.userId}`);
      const body = readParsedBody(res, refundBodySchema);
      const result = await deps.payments.createRefundRequest(
        actor,
        params.id,
        idempotencyKey(req),
        {
          reasonCode: body.reasonCode,
          ...(body.amountMinor === undefined
            ? {}
            : { amountMinor: body.amountMinor }),
        },
      );
      res
        .status(result.replayed ? 200 : 201)
        .json(presentRefund(result.refund));
    }),
  );

  router.post(
    "/admin/refunds/:id/review",
    authenticate,
    validateParams(idParamsSchema),
    validateBody(reviewBodySchema),
    asyncRoute(async (_req, res) => {
      const params = readParsedParams(res, idParamsSchema);
      const actor = await assertPermission(
        res,
        deps.audit,
        Permission.REFUND_REVIEW,
        "refund.review",
        "refund",
        params.id,
      );
      const body = readParsedBody(res, reviewBodySchema);
      const refund = await deps.payments.reviewRefund(
        params.id,
        body.decision,
        body.amountMinor,
      );
      await deps.audit.write({
        actorUserId: actor.userId,
        action: "refund.review",
        resourceType: "refund",
        resourceId: refund.id,
        requestId: getRequestId(res),
        outcome: "ALLOWED",
        metadata: { decision: body.decision },
      });
      res.status(200).json(presentRefund(refund));
    }),
  );

  router.get(
    "/hosts/me/payouts",
    authenticate,
    asyncRoute(async (_req, res) => {
      const actor = await assertHostRole(res, deps.audit, "payout.list");
      await assertPermission(
        res,
        deps.audit,
        Permission.PAYOUT_READ_OWN,
        "payout.list",
        "payout",
        actor.userId,
      );
      const rows = await deps.payments.listOwnPayouts(actor);
      res.status(200).json({ items: rows.map(presentPayout) });
    }),
  );

  router.get(
    "/hosts/me/earnings",
    authenticate,
    asyncRoute(async (_req, res) => {
      const actor = await assertHostRole(res, deps.audit, "earnings.read");
      await assertPermission(
        res,
        deps.audit,
        Permission.PAYOUT_READ_OWN,
        "earnings.read",
        "payout",
        actor.userId,
      );
      res.status(200).json(await deps.payments.ownEarnings(actor));
    }),
  );

  router.post(
    "/admin/payouts",
    authenticate,
    validateBody(payoutBodySchema),
    asyncRoute(async (req, res) => {
      const actor = await assertPermission(
        res,
        deps.audit,
        Permission.PAYOUT_REVIEW,
        "payout.record",
        "payout",
        "new",
      );
      const body = readParsedBody(res, payoutBodySchema);
      const result = await deps.payments.recordPayout(
        actor,
        idempotencyKey(req),
        body,
      );
      await deps.audit.write({
        actorUserId: actor.userId,
        action: "payout.record",
        resourceType: "payout",
        resourceId: result.payout.id,
        requestId: getRequestId(res),
        outcome: "ALLOWED",
        metadata: { settlement: "unconfirmed" },
      });
      res
        .status(result.replayed ? 200 : 201)
        .json(presentPayout(result.payout));
    }),
  );

  router.post(
    "/admin/reconciliation/runs",
    authenticate,
    asyncRoute(async (_req, res) => {
      const actor = await assertPermission(
        res,
        deps.audit,
        Permission.RECONCILIATION_READ,
        "reconciliation.run",
        "reconciliation",
        "run",
      );
      const created = await deps.payments.reconcile();
      await deps.audit.write({
        actorUserId: actor.userId,
        action: "reconciliation.run",
        resourceType: "reconciliation",
        resourceId: "run",
        requestId: getRequestId(res),
        outcome: "ALLOWED",
        metadata: { created: String(created.length) },
      });
      res.status(200).json({ items: created });
    }),
  );

  router.get(
    "/admin/reconciliation/exceptions",
    authenticate,
    asyncRoute(async (_req, res) => {
      await assertPermission(
        res,
        deps.audit,
        Permission.RECONCILIATION_READ,
        "reconciliation.read",
        "reconciliation",
        "exceptions",
      );
      res.status(200).json({ items: await deps.payments.listExceptions() });
    }),
  );

  router.post(
    "/webhooks/payments/:provider",
    validateParams(providerParamsSchema),
    asyncRoute(async (req, res) => {
      limit(`webhook:${req.ip ?? "unknown"}`);
      const params = readParsedParams(res, providerParamsSchema);
      const raw = rawBody(req);
      const eventHeader = deps.payments.eventIdHeader;
      await deps.payments.receiveWebhook(
        params.provider,
        raw,
        req.header(deps.payments.signatureHeader),
        eventHeader === null ? undefined : req.header(eventHeader),
      );
      res.status(200).json({ received: true });
    }),
  );

  return router;
}

function idempotencyKey(req: Request): string {
  const header = req.header("idempotency-key");
  if (header === undefined || !/^[A-Za-z0-9_-]{8,128}$/.test(header)) {
    throw invalid("Idempotency-Key");
  }
  return header;
}

function rawBody(req: Request): Buffer {
  const candidate = req as Request & { rawBody?: Buffer };
  if (candidate.rawBody === undefined) {
    throw new HttpError(
      400,
      "INVALID_JSON",
      "Request body must be valid JSON.",
    );
  }
  return candidate.rawBody;
}

function limit(key: string): void {
  const now = Date.now();
  const current = hits.get(key);
  if (current === undefined || current.reset < now) {
    hits.set(key, { count: 1, reset: now + 60_000 });
    return;
  }
  current.count += 1;
  if (current.count > 200) {
    throw new HttpError(429, "RATE_LIMITED", "Too many requests.");
  }
}
