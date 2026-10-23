import { Router, type Request } from "express";
import { asyncRoute } from "../../middleware/async-handler.js";
import { getRequestId } from "../../middleware/request-context.js";
import {
  readParsedBody,
  readParsedParams,
  readParsedQuery,
  validateBody,
  validateParams,
  validateQuery,
} from "../../middleware/validate.js";
import { HttpError } from "../../shared/http-error.js";
import type { AuditWriter } from "../audit/audit-writer.js";
import { createAuthenticate } from "../auth/authenticate.js";
import { getActor } from "../auth/actor.js";
import { Permission } from "../auth/permissions.js";
import type { AuthVerifier } from "../auth/verifier.js";
import { pageNewestFirst } from "../catalogue/discovery.js";
import {
  assertHostRole,
  assertPermission,
  guardOwned,
  readCursor,
} from "../catalogue/http.js";
import { ResourceNotOwnedError } from "../catalogue/service.js";
import type { UserRepository } from "../users/user-repository.js";
import { invalid } from "./errors.js";
import { presentBooking, presentOffer, presentTripRequest } from "./present.js";
import {
  cancelBodySchema,
  checkInBodySchema,
  disputeBodySchema,
  idParamsSchema,
  noShowBodySchema,
  offerBodySchema,
  pageQuerySchema,
  slotBookingBodySchema,
  tripRequestBodySchema,
} from "./schemas.js";
import type { BookingService } from "./service.js";

export type BookingRouterDependencies = {
  verifier: AuthVerifier;
  users: UserRepository;
  audit: AuditWriter;
  bookings: BookingService;
};

export function createBookingRouter(deps: BookingRouterDependencies): Router {
  const authenticate = createAuthenticate(deps.verifier, deps.users);
  const router = Router();

  router.post(
    "/trip-requests",
    authenticate,
    validateBody(tripRequestBodySchema),
    asyncRoute(async (req, res) => {
      const actor = await assertPermission(
        res,
        deps.audit,
        Permission.REQUEST_WRITE_OWN,
        "trip-request.create",
        "trip_request",
        "new",
      );
      const body = readParsedBody(res, tripRequestBodySchema);
      const result = await deps.bookings.createTripRequest(
        actor.userId,
        idempotencyKey(req),
        {
          cityId: body.cityId,
          startsOn: body.startsOn,
          endsOn: body.endsOn,
          partySize: body.partySize,
          currency: body.currency,
          ...(body.budgetMinor === undefined
            ? {}
            : { budgetMinor: body.budgetMinor }),
          ...(body.preferences === undefined
            ? {}
            : { preferences: body.preferences }),
        },
      );
      res
        .status(result.replayed ? 200 : 201)
        .json(presentTripRequest(result.value));
    }),
  );

  router.get(
    "/trip-requests/:id",
    authenticate,
    validateParams(idParamsSchema),
    asyncRoute(async (_req, res) => {
      const actor = getActor(res);
      const params = readParsedParams(res, idParamsSchema);
      const request = await guardOwned(
        res,
        deps.audit,
        "trip-request.read",
        () => deps.bookings.readTripRequest(actor.userId, params.id),
      );
      res.status(200).json(presentTripRequest(request));
    }),
  );

  router.get(
    "/trip-requests/:id/offers",
    authenticate,
    validateParams(idParamsSchema),
    asyncRoute(async (_req, res) => {
      const actor = getActor(res);
      const params = readParsedParams(res, idParamsSchema);
      const offers = await guardOwned(res, deps.audit, "offer.list", () =>
        deps.bookings.listOffers(actor.userId, params.id),
      );
      res.status(200).json({ items: offers.map(presentOffer) });
    }),
  );

  router.post(
    "/trip-requests/:id/offers",
    authenticate,
    validateParams(idParamsSchema),
    validateBody(offerBodySchema),
    asyncRoute(async (_req, res) => {
      const actor = await assertPermission(
        res,
        deps.audit,
        Permission.OFFER_WRITE_OWN,
        "offer.create",
        "offer",
        "new",
      );
      const params = readParsedParams(res, idParamsSchema);
      const body = readParsedBody(res, offerBodySchema);
      const offer = await guardOwned(res, deps.audit, "offer.create", () =>
        deps.bookings.createOffer(actor.userId, params.id, body),
      );
      res.status(201).json(presentOffer(offer));
    }),
  );

  router.post(
    "/offers/:id/withdraw",
    authenticate,
    validateParams(idParamsSchema),
    asyncRoute(async (_req, res) => {
      const actor = await assertPermission(
        res,
        deps.audit,
        Permission.OFFER_WRITE_OWN,
        "offer.withdraw",
        "offer",
        readParsedParams(res, idParamsSchema).id,
      );
      const params = readParsedParams(res, idParamsSchema);
      const offer = await guardOwned(res, deps.audit, "offer.withdraw", () =>
        deps.bookings.withdrawOffer(actor.userId, params.id),
      );
      res.status(200).json(presentOffer(offer));
    }),
  );

  router.post(
    "/offers/:id/accept",
    authenticate,
    validateParams(idParamsSchema),
    asyncRoute(async (_req, res) => {
      const actor = await assertPermission(
        res,
        deps.audit,
        Permission.REQUEST_WRITE_OWN,
        "offer.accept",
        "offer",
        readParsedParams(res, idParamsSchema).id,
      );
      const params = readParsedParams(res, idParamsSchema);
      const result = await guardOwned(res, deps.audit, "offer.accept", () =>
        deps.bookings.acceptOffer(actor.userId, params.id),
      );
      res
        .status(result.replayed ? 200 : 201)
        .json(presentBooking(result.value));
    }),
  );

  router.post(
    "/bookings",
    authenticate,
    validateBody(slotBookingBodySchema),
    asyncRoute(async (req, res) => {
      const actor = await assertPermission(
        res,
        deps.audit,
        Permission.BOOKING_CREATE_OWN,
        "booking.create",
        "booking",
        "new",
      );
      const body = readParsedBody(res, slotBookingBodySchema);
      const result = await deps.bookings.createSlotBooking(
        actor.userId,
        idempotencyKey(req),
        body,
      );
      res
        .status(result.replayed ? 200 : 201)
        .json(presentBooking(result.value));
    }),
  );

  router.get(
    "/bookings/:id",
    authenticate,
    validateParams(idParamsSchema),
    asyncRoute(async (_req, res) => {
      const actor = await assertPermission(
        res,
        deps.audit,
        Permission.BOOKING_READ_OWN,
        "booking.read",
        "booking",
        readParsedParams(res, idParamsSchema).id,
      );
      const params = readParsedParams(res, idParamsSchema);
      const booking = await guardOwned(res, deps.audit, "booking.read", () =>
        deps.bookings.readBooking(actor.userId, params.id),
      );
      res.status(200).json(presentBooking(booking));
    }),
  );

  router.get(
    "/me/bookings",
    authenticate,
    validateQuery(pageQuerySchema),
    asyncRoute(async (_req, res) => {
      const actor = await assertPermission(
        res,
        deps.audit,
        Permission.BOOKING_READ_OWN,
        "booking.list",
        "booking",
        actorId(res),
      );
      const query = readParsedQuery(res, pageQuerySchema);
      const rows = await deps.bookings.listBookings(actor.userId, "traveller");
      res.status(200).json(page(rows, query, presentBooking));
    }),
  );

  router.get(
    "/hosts/me/bookings",
    authenticate,
    validateQuery(pageQuerySchema),
    asyncRoute(async (_req, res) => {
      const actor = await assertHostRole(res, deps.audit, "booking.list.host");
      await assertPermission(
        res,
        deps.audit,
        Permission.BOOKING_READ_OWN,
        "booking.list.host",
        "booking",
        actor.userId,
      );
      const query = readParsedQuery(res, pageQuerySchema);
      const rows = await deps.bookings.listBookings(actor.userId, "host");
      res.status(200).json(page(rows, query, presentBooking));
    }),
  );

  router.post(
    "/bookings/:id/cancel",
    authenticate,
    validateParams(idParamsSchema),
    validateBody(cancelBodySchema),
    asyncRoute(async (_req, res) => {
      await transition(deps, res, "cancel");
    }),
  );

  router.post(
    "/bookings/:id/check-in",
    authenticate,
    validateParams(idParamsSchema),
    validateBody(checkInBodySchema),
    asyncRoute(async (_req, res) => {
      const body = readParsedBody(res, checkInBodySchema);
      await transition(deps, res, "check_in", body.method);
    }),
  );

  router.post(
    "/bookings/:id/complete",
    authenticate,
    validateParams(idParamsSchema),
    asyncRoute(async (_req, res) => {
      await transition(deps, res, "complete");
    }),
  );

  router.post(
    "/bookings/:id/no-show",
    authenticate,
    validateParams(idParamsSchema),
    validateBody(noShowBodySchema),
    asyncRoute(async (_req, res) => {
      await transition(deps, res, "no_show");
    }),
  );

  router.post(
    "/bookings/:id/disputes",
    authenticate,
    validateParams(idParamsSchema),
    validateBody(disputeBodySchema),
    asyncRoute(async (_req, res) => {
      await transition(deps, res, "dispute");
    }),
  );

  return router;
}

async function transition(
  deps: BookingRouterDependencies,
  res: Parameters<typeof getActor>[0],
  action: "cancel" | "check_in" | "complete" | "no_show" | "dispute",
  method?: "HOST_CODE" | "PARTICIPANT_CODE" | "MANUAL",
): Promise<void> {
  const params = readParsedParams(res, idParamsSchema);
  const actor = await assertPermission(
    res,
    deps.audit,
    Permission.BOOKING_READ_OWN,
    `booking.${action}`,
    "booking",
    params.id,
  );
  try {
    const result = await deps.bookings.transition(
      actor.userId,
      params.id,
      action,
      method,
    );
    res.status(200).json(presentBooking(result.value));
  } catch (error: unknown) {
    if (error instanceof ResourceNotOwnedError) {
      await deps.audit.write({
        actorUserId: actor.userId,
        action: `booking.${action}`,
        resourceType: error.resourceType,
        resourceId: error.resourceId,
        requestId: getRequestId(res),
        outcome: "DENIED",
        reason: "not-owner",
      });
    } else if (error instanceof HttpError && error.statusCode === 403) {
      await deps.audit.write({
        actorUserId: actor.userId,
        action: `booking.${action}`,
        resourceType: "booking",
        resourceId: params.id,
        requestId: getRequestId(res),
        outcome: "DENIED",
        reason: "forbidden",
      });
    }
    throw error;
  }
}

function idempotencyKey(req: Request): string {
  const header = req.header("idempotency-key");
  if (header === undefined || !/^[A-Za-z0-9_-]{8,128}$/.test(header)) {
    throw invalid("Idempotency-Key");
  }
  return header;
}

function actorId(res: Parameters<typeof getActor>[0]): string {
  return getActor(res).userId;
}

function page<T extends { createdAt: string; id: string }, R>(
  rows: readonly T[],
  query: { cursor?: string | undefined; limit?: number | undefined },
  present: (row: T) => R,
): { items: R[]; nextCursor: string | null } {
  const cursor = readCursor(query.cursor);
  const paged = pageNewestFirst(rows, cursor, query.limit ?? 20);
  return { items: paged.items.map(present), nextCursor: paged.nextCursor };
}
