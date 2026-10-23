import { Router } from "express";
import { asyncRoute } from "../../middleware/async-handler.js";
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
import { Permission } from "../auth/permissions.js";
import type { AuthVerifier } from "../auth/verifier.js";
import type { UserRepository } from "../users/user-repository.js";
import { pageNewestFirst, type DiscoveryFilter } from "./discovery.js";
import {
  assertHostRole,
  assertPermission,
  auditAllowed,
  boundsError,
  guardOwned,
  readCursor,
} from "./http.js";
import {
  presentCategory,
  presentCity,
  presentExperienceCard,
  presentHostQueueItem,
  presentLanguage,
  presentOwnExperience,
  presentOwnHost,
  presentPublicExperience,
  presentPublicHost,
  presentSlot,
  presentVerification,
} from "./present.js";
import {
  availabilityQuerySchema,
  categoryBodySchema,
  cityBodySchema,
  cityStatusBodySchema,
  discoveryQuerySchema,
  documentBodySchema,
  experienceBodySchema,
  experiencePatchSchema,
  hostIdParamsSchema,
  hostQueueQuerySchema,
  idParamsSchema,
  imageDecisionSchema,
  imageParamsSchema,
  languageBodySchema,
  listingDecisionSchema,
  listingQueueQuerySchema,
  onboardingBodySchema,
  pageQuerySchema,
  scheduleBodySchema,
  verificationDecisionSchema,
} from "./schemas.js";
import type { CatalogueService, ExperiencePatch } from "./service.js";

export type CatalogueRouterDependencies = {
  verifier: AuthVerifier;
  users: UserRepository;
  audit: AuditWriter;
  catalogue: CatalogueService;
};

export function createCatalogueRouter(
  deps: CatalogueRouterDependencies,
): Router {
  const authenticate = createAuthenticate(deps.verifier, deps.users);
  const router = Router();

  router.get(
    "/cities",
    validateQuery(pageQuerySchema),
    asyncRoute(async (_req, res) => {
      const query = readParsedQuery(res, pageQuerySchema);
      const rows = await deps.catalogue.listCities("ACTIVE");
      res.status(200).json(page(rows, query, presentCity));
    }),
  );

  router.get(
    "/languages",
    validateQuery(pageQuerySchema),
    asyncRoute(async (_req, res) => {
      const query = readParsedQuery(res, pageQuerySchema);
      const rows = await deps.catalogue.listLanguages(true);
      res.status(200).json(
        page(
          rows.map((language) => ({ ...language, id: language.code })),
          query,
          presentLanguage,
        ),
      );
    }),
  );

  router.get(
    "/categories",
    validateQuery(pageQuerySchema),
    asyncRoute(async (_req, res) => {
      const query = readParsedQuery(res, pageQuerySchema);
      const rows = await deps.catalogue.listCategories(true);
      res.status(200).json(
        page(
          rows.map((category) => ({ ...category, id: category.slug })),
          query,
          presentCategory,
        ),
      );
    }),
  );

  router.get(
    "/experiences",
    validateQuery(discoveryQuerySchema),
    asyncRoute(async (_req, res) => {
      const query = readParsedQuery(res, discoveryQuerySchema);
      boundsError(query.minPrice, query.maxPrice, "maxPrice");
      boundsError(query.minDuration, query.maxDuration, "maxDuration");
      const filter: DiscoveryFilter = { limit: query.limit ?? 20 };
      assignFilter(filter, query);
      const cursor = readCursor(query.cursor);
      if (cursor !== undefined) {
        filter.cursor = cursor;
      }
      const rows = await deps.catalogue.search(filter);
      res
        .status(200)
        .json(
          page(rows, { ...query, limit: filter.limit }, presentExperienceCard),
        );
    }),
  );

  router.get(
    "/experiences/:id",
    validateParams(idParamsSchema),
    asyncRoute(async (_req, res) => {
      const params = readParsedParams(res, idParamsSchema);
      const experience = await deps.catalogue.publicExperience(params.id);
      if (experience === null) {
        throw missing();
      }
      res.status(200).json(presentPublicExperience(experience));
    }),
  );

  router.get(
    "/experiences/:id/availability",
    validateParams(idParamsSchema),
    validateQuery(availabilityQuerySchema),
    asyncRoute(async (_req, res) => {
      const params = readParsedParams(res, idParamsSchema);
      const query = readParsedQuery(res, availabilityQuerySchema);
      boundsError(dateValue(query.from), dateValue(query.to), "to");
      if (dateValue(query.to) - dateValue(query.from) > 62 * 86_400_000) {
        throw new HttpError(
          400,
          "VALIDATION_ERROR",
          "Request validation failed.",
          [{ field: "to", message: "Invalid value." }],
        );
      }
      const availability = await deps.catalogue.publicAvailability(params.id, {
        from: query.from,
        to: query.to,
        ...(query.partySize === undefined
          ? {}
          : { partySize: query.partySize }),
      });
      if (availability === null) {
        throw missing();
      }
      res.status(200).json({
        timezone: availability.timezone,
        slots: availability.slots.map(presentSlot),
      });
    }),
  );

  router.post(
    "/hosts/onboarding",
    authenticate,
    validateBody(onboardingBodySchema),
    asyncRoute(async (_req, res) => {
      const actor = await assertHostRole(res, deps.audit, "host.onboarding");
      const body = readParsedBody(res, onboardingBodySchema);
      const host = await deps.catalogue.onboard(actor.userId, {
        publicName: body.publicName,
        submit: body.submit,
        ...(body.bio === undefined ? {} : { bio: body.bio }),
      });
      res.status(200).json(presentVerification(host));
    }),
  );

  router.get(
    "/hosts/me",
    authenticate,
    asyncRoute(async (_req, res) => {
      const actor = await assertHostRole(res, deps.audit, "host.read.self");
      const host = await deps.catalogue.ownHost(actor.userId);
      if (host === null) {
        throw new HttpError(
          403,
          "HOST_PROFILE_REQUIRED",
          "Create a host profile before continuing.",
        );
      }
      res.status(200).json(presentOwnHost(host));
    }),
  );

  router.get(
    "/hosts/me/verification",
    authenticate,
    asyncRoute(async (_req, res) => {
      const actor = await assertHostRole(
        res,
        deps.audit,
        "host.verification.read",
      );
      const host = await deps.catalogue.ownHost(actor.userId);
      if (host === null) {
        throw new HttpError(
          403,
          "HOST_PROFILE_REQUIRED",
          "Create a host profile before continuing.",
        );
      }
      res.status(200).json(presentVerification(host));
    }),
  );

  router.post(
    "/hosts/me/documents",
    authenticate,
    validateBody(documentBodySchema),
    asyncRoute(async (_req, res) => {
      const actor = await assertHostRole(
        res,
        deps.audit,
        "host.document.create",
      );
      const body = readParsedBody(res, documentBodySchema);
      const document = await deps.catalogue.addDocument(
        actor.userId,
        body.documentType,
      );
      res.status(201).json({
        id: document.id,
        documentType: document.documentType,
        verificationState: document.verificationState,
        upload: { status: "unavailable" },
      });
    }),
  );

  router.get(
    "/hosts/me/experiences",
    authenticate,
    validateQuery(pageQuerySchema),
    asyncRoute(async (_req, res) => {
      const actor = await assertHostRole(
        res,
        deps.audit,
        "experience.read.own",
      );
      await assertPermission(
        res,
        deps.audit,
        Permission.EXPERIENCE_WRITE_OWN,
        "experience.read.own",
        "experience",
        actor.userId,
      );
      const query = readParsedQuery(res, pageQuerySchema);
      const rows = await deps.catalogue.listOwnExperiences(actor.userId);
      res.status(200).json(page(rows, query, presentOwnExperience));
    }),
  );

  router.post(
    "/hosts/me/experiences",
    authenticate,
    validateBody(experienceBodySchema),
    asyncRoute(async (_req, res) => {
      const actor = await assertHostRole(res, deps.audit, "experience.create");
      await assertPermission(
        res,
        deps.audit,
        Permission.EXPERIENCE_WRITE_OWN,
        "experience.create",
        "experience",
        actor.userId,
      );
      const body = readParsedBody(res, experienceBodySchema);
      const experience = await deps.catalogue.createExperience(actor.userId, {
        cityId: body.cityId,
        category: body.category,
        title: body.title,
        description: body.description,
        durationMinutes: body.durationMinutes,
        basePriceMinor: body.basePriceMinor,
        currency: body.currency,
        capacity: body.capacity,
        inclusions: body.inclusions,
        exclusions: body.exclusions,
        meetingArea: body.meetingArea,
        accessibilityNotes: body.accessibilityNotes ?? "",
        safetyNotes: body.safetyNotes ?? "",
        cancellationPolicy: body.cancellationPolicy,
        languageCodes: body.languageCodes,
      });
      res.status(201).json(presentOwnExperience(experience));
    }),
  );

  router.get(
    "/hosts/me/experiences/:id",
    authenticate,
    validateParams(idParamsSchema),
    asyncRoute(async (_req, res) => {
      const actor = await assertHostRole(
        res,
        deps.audit,
        "experience.read.own",
      );
      const params = readParsedParams(res, idParamsSchema);
      const experience = await guardOwned(
        res,
        deps.audit,
        "experience.read.own",
        () => deps.catalogue.ownExperience(actor.userId, params.id),
      );
      res.status(200).json(presentOwnExperience(experience));
    }),
  );

  router.patch(
    "/hosts/me/experiences/:id",
    authenticate,
    validateParams(idParamsSchema),
    validateBody(experiencePatchSchema),
    asyncRoute(async (_req, res) => {
      const actor = await assertHostRole(res, deps.audit, "experience.update");
      await assertPermission(
        res,
        deps.audit,
        Permission.EXPERIENCE_WRITE_OWN,
        "experience.update",
        "experience",
        actor.userId,
      );
      const params = readParsedParams(res, idParamsSchema);
      const body = readParsedBody(res, experiencePatchSchema);
      const experience = await guardOwned(
        res,
        deps.audit,
        "experience.update",
        () =>
          deps.catalogue.updateExperience(
            actor.userId,
            params.id,
            toPatch(body),
          ),
      );
      res.status(200).json(presentOwnExperience(experience));
    }),
  );

  router.post(
    "/hosts/me/experiences/:id/submit",
    authenticate,
    validateParams(idParamsSchema),
    asyncRoute(async (_req, res) => {
      const actor = await assertHostRole(res, deps.audit, "experience.submit");
      await assertPermission(
        res,
        deps.audit,
        Permission.EXPERIENCE_WRITE_OWN,
        "experience.submit",
        "experience",
        actor.userId,
      );
      const params = readParsedParams(res, idParamsSchema);
      const experience = await guardOwned(
        res,
        deps.audit,
        "experience.submit",
        () => deps.catalogue.submitExperience(actor.userId, params.id),
      );
      res.status(200).json(presentOwnExperience(experience));
    }),
  );

  router.put(
    "/hosts/me/experiences/:id/availability",
    authenticate,
    validateParams(idParamsSchema),
    validateBody(scheduleBodySchema),
    asyncRoute(async (_req, res) => {
      const actor = await assertHostRole(
        res,
        deps.audit,
        "availability.replace",
      );
      await assertPermission(
        res,
        deps.audit,
        Permission.AVAILABILITY_WRITE_OWN,
        "availability.replace",
        "experience",
        actor.userId,
      );
      const params = readParsedParams(res, idParamsSchema);
      const body = readParsedBody(res, scheduleBodySchema);
      const experience = await guardOwned(
        res,
        deps.audit,
        "availability.replace",
        () => deps.catalogue.replaceAvailability(actor.userId, params.id, body),
      );
      res.status(200).json({
        slots: experience.slots.map(presentSlot),
        blackouts: experience.blackouts.map((blackout) => ({
          id: blackout.id,
          startsAt: blackout.startsAt,
          endsAt: blackout.endsAt,
        })),
      });
    }),
  );

  router.post(
    "/hosts/me/experiences/:id/images",
    authenticate,
    validateParams(idParamsSchema),
    asyncRoute(async (_req, res) => {
      const actor = await assertHostRole(
        res,
        deps.audit,
        "experience.image.create",
      );
      await assertPermission(
        res,
        deps.audit,
        Permission.EXPERIENCE_WRITE_OWN,
        "experience.image.create",
        "experience",
        actor.userId,
      );
      const params = readParsedParams(res, idParamsSchema);
      const experience = await guardOwned(
        res,
        deps.audit,
        "experience.image.create",
        () => deps.catalogue.addImage(actor.userId, params.id),
      );
      res.status(201).json(presentOwnExperience(experience));
    }),
  );

  router.get(
    "/hosts/:id",
    validateParams(idParamsSchema),
    asyncRoute(async (_req, res) => {
      const params = readParsedParams(res, idParamsSchema);
      const host = await deps.catalogue.publicHost(params.id);
      if (host === null) {
        throw missing();
      }
      res.status(200).json(presentPublicHost(host));
    }),
  );

  router.post(
    "/admin/cities",
    authenticate,
    validateBody(cityBodySchema),
    asyncRoute(async (_req, res) => {
      await assertPermission(
        res,
        deps.audit,
        Permission.CITY_ACTIVATE,
        "city.create",
        "city",
        "new",
      );
      const body = readParsedBody(res, cityBodySchema);
      const city = await deps.catalogue.createCity(body);
      await auditAllowed(
        res,
        deps.audit,
        "city.create",
        "city",
        city.id,
        "catalogue",
      );
      res.status(201).json(presentCity(city));
    }),
  );

  router.get(
    "/admin/cities",
    authenticate,
    validateQuery(pageQuerySchema),
    asyncRoute(async (_req, res) => {
      await assertPermission(
        res,
        deps.audit,
        Permission.CITY_ACTIVATE,
        "city.read",
        "city",
        "collection",
      );
      const query = readParsedQuery(res, pageQuerySchema);
      const rows = await deps.catalogue.listCities("ANY");
      res.status(200).json(page(rows, query, presentCity));
    }),
  );

  router.post(
    "/admin/cities/:id/activation",
    authenticate,
    validateParams(idParamsSchema),
    validateBody(cityStatusBodySchema),
    asyncRoute(async (_req, res) => {
      const params = readParsedParams(res, idParamsSchema);
      await assertPermission(
        res,
        deps.audit,
        Permission.CITY_ACTIVATE,
        "city.activate",
        "city",
        params.id,
      );
      const body = readParsedBody(res, cityStatusBodySchema);
      const result = await deps.catalogue.setCityStatus(params.id, body.status);
      if (result === null) {
        throw missing();
      }
      if (result.changed) {
        await auditAllowed(
          res,
          deps.audit,
          "city.activate",
          "city",
          result.value.id,
          body.reason,
        );
      }
      res.status(200).json(presentCity(result.value));
    }),
  );

  router.post(
    "/admin/languages",
    authenticate,
    validateBody(languageBodySchema),
    asyncRoute(async (_req, res) => {
      await assertPermission(
        res,
        deps.audit,
        Permission.CITY_ACTIVATE,
        "language.create",
        "language",
        "new",
      );
      const body = readParsedBody(res, languageBodySchema);
      const language = await deps.catalogue.createLanguage(body);
      await auditAllowed(
        res,
        deps.audit,
        "language.create",
        "language",
        language.code,
        "catalogue",
      );
      res.status(201).json(presentLanguage(language));
    }),
  );

  router.post(
    "/admin/categories",
    authenticate,
    validateBody(categoryBodySchema),
    asyncRoute(async (_req, res) => {
      await assertPermission(
        res,
        deps.audit,
        Permission.CITY_ACTIVATE,
        "category.create",
        "category",
        "new",
      );
      const body = readParsedBody(res, categoryBodySchema);
      const category = await deps.catalogue.createCategory(body);
      await auditAllowed(
        res,
        deps.audit,
        "category.create",
        "category",
        category.slug,
        "catalogue",
      );
      res.status(201).json(presentCategory(category));
    }),
  );

  router.get(
    "/admin/hosts",
    authenticate,
    validateQuery(hostQueueQuerySchema),
    asyncRoute(async (_req, res) => {
      await assertPermission(
        res,
        deps.audit,
        Permission.HOST_VERIFY,
        "host.verification.list",
        "host",
        "collection",
      );
      const query = readParsedQuery(res, hostQueueQuerySchema);
      const rows = await deps.catalogue.listHosts();
      const filtered =
        query.verificationStatus === undefined
          ? rows
          : rows.filter(
              (host) => host.verificationStatus === query.verificationStatus,
            );
      res.status(200).json(page(filtered, query, presentHostQueueItem));
    }),
  );

  router.post(
    "/admin/hosts/:hostId/verification",
    authenticate,
    validateParams(hostIdParamsSchema),
    validateBody(verificationDecisionSchema),
    asyncRoute(async (_req, res) => {
      const params = readParsedParams(res, hostIdParamsSchema);
      await assertPermission(
        res,
        deps.audit,
        Permission.HOST_VERIFY,
        "host.verification.decide",
        "host",
        params.hostId,
      );
      const body = readParsedBody(res, verificationDecisionSchema);
      const result = await deps.catalogue.decideVerification(
        params.hostId,
        body.decision,
        body.reason,
      );
      if (result === null) {
        throw missing();
      }
      if (result.changed) {
        await auditAllowed(
          res,
          deps.audit,
          "host.verification.decide",
          "host",
          params.hostId,
          body.reason,
        );
      }
      res.status(200).json(presentHostQueueItem(result.value));
    }),
  );

  router.get(
    "/admin/hosts/:hostId/documents",
    authenticate,
    validateParams(hostIdParamsSchema),
    asyncRoute(async (_req, res) => {
      const params = readParsedParams(res, hostIdParamsSchema);
      await assertPermission(
        res,
        deps.audit,
        Permission.DOCUMENT_READ,
        "host.document.read",
        "host",
        params.hostId,
      );
      const documents = await deps.catalogue.reviewDocuments(params.hostId);
      if (documents === null) {
        throw missing();
      }
      await auditAllowed(
        res,
        deps.audit,
        "host.document.read",
        "host",
        params.hostId,
        "document-review",
      );
      res.status(200).json({ items: documents });
    }),
  );

  router.get(
    "/admin/experiences",
    authenticate,
    validateQuery(listingQueueQuerySchema),
    asyncRoute(async (_req, res) => {
      await assertPermission(
        res,
        deps.audit,
        Permission.EXPERIENCE_MODERATE,
        "experience.moderate.list",
        "experience",
        "collection",
      );
      const query = readParsedQuery(res, listingQueueQuerySchema);
      const rows = await deps.catalogue.listExperiences();
      const filtered =
        query.listingStatus === undefined
          ? rows
          : rows.filter((row) => row.listingStatus === query.listingStatus);
      res.status(200).json(page(filtered, query, presentOwnExperience));
    }),
  );

  router.post(
    "/admin/experiences/:id/moderation",
    authenticate,
    validateParams(idParamsSchema),
    validateBody(listingDecisionSchema),
    asyncRoute(async (_req, res) => {
      const params = readParsedParams(res, idParamsSchema);
      await assertPermission(
        res,
        deps.audit,
        Permission.EXPERIENCE_MODERATE,
        "experience.moderate",
        "experience",
        params.id,
      );
      const body = readParsedBody(res, listingDecisionSchema);
      const result = await deps.catalogue.decideListing(
        params.id,
        body.decision,
        body.reason,
      );
      if (result === null) {
        throw missing();
      }
      if (result.changed) {
        await auditAllowed(
          res,
          deps.audit,
          "experience.moderate",
          "experience",
          params.id,
          body.reason,
        );
      }
      res.status(200).json(presentOwnExperience(result.value));
    }),
  );

  router.post(
    "/admin/experiences/:id/images/:imageId/moderation",
    authenticate,
    validateParams(imageParamsSchema),
    validateBody(imageDecisionSchema),
    asyncRoute(async (_req, res) => {
      const params = readParsedParams(res, imageParamsSchema);
      await assertPermission(
        res,
        deps.audit,
        Permission.EXPERIENCE_MODERATE,
        "experience.image.moderate",
        "experience",
        params.id,
      );
      const body = readParsedBody(res, imageDecisionSchema);
      const result = await deps.catalogue.decideImage(
        params.id,
        params.imageId,
        body.decision === "APPROVE" ? "APPROVED" : "REJECTED",
      );
      if (result === null) {
        throw missing();
      }
      if (result.changed) {
        await auditAllowed(
          res,
          deps.audit,
          "experience.image.moderate",
          "experience",
          params.imageId,
          body.reason,
        );
      }
      res.status(200).json(presentOwnExperience(result.value));
    }),
  );

  return router;
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

function assignFilter(
  filter: DiscoveryFilter,
  query: {
    city?: string | undefined;
    date?: string | undefined;
    category?: string | undefined;
    language?: string | undefined;
    minPrice?: number | undefined;
    maxPrice?: number | undefined;
    minDuration?: number | undefined;
    maxDuration?: number | undefined;
    partySize?: number | undefined;
  },
): void {
  if (query.city !== undefined) {
    filter.city = query.city;
  }
  if (query.date !== undefined) {
    filter.date = query.date;
  }
  if (query.category !== undefined) {
    filter.category = query.category;
  }
  if (query.language !== undefined) {
    filter.language = query.language;
  }
  if (query.minPrice !== undefined) {
    filter.minPrice = query.minPrice;
  }
  if (query.maxPrice !== undefined) {
    filter.maxPrice = query.maxPrice;
  }
  if (query.minDuration !== undefined) {
    filter.minDuration = query.minDuration;
  }
  if (query.maxDuration !== undefined) {
    filter.maxDuration = query.maxDuration;
  }
  if (query.partySize !== undefined) {
    filter.partySize = query.partySize;
  }
}

function toPatch(body: {
  cityId?: string | undefined;
  category?: string | undefined;
  title?: string | undefined;
  description?: string | undefined;
  durationMinutes?: number | undefined;
  basePriceMinor?: number | undefined;
  currency?: string | undefined;
  capacity?: number | undefined;
  inclusions?: string | undefined;
  exclusions?: string | undefined;
  meetingArea?: string | undefined;
  accessibilityNotes?: string | undefined;
  safetyNotes?: string | undefined;
  cancellationPolicy?: string | undefined;
  languageCodes?: string[] | undefined;
}): ExperiencePatch {
  const patch: ExperiencePatch = {};
  if (body.cityId !== undefined) {
    patch.cityId = body.cityId;
  }
  if (body.category !== undefined) {
    patch.category = body.category;
  }
  if (body.title !== undefined) {
    patch.title = body.title;
  }
  if (body.description !== undefined) {
    patch.description = body.description;
  }
  if (body.durationMinutes !== undefined) {
    patch.durationMinutes = body.durationMinutes;
  }
  if (body.basePriceMinor !== undefined) {
    patch.basePriceMinor = body.basePriceMinor;
  }
  if (body.currency !== undefined) {
    patch.currency = body.currency;
  }
  if (body.capacity !== undefined) {
    patch.capacity = body.capacity;
  }
  if (body.inclusions !== undefined) {
    patch.inclusions = body.inclusions;
  }
  if (body.exclusions !== undefined) {
    patch.exclusions = body.exclusions;
  }
  if (body.meetingArea !== undefined) {
    patch.meetingArea = body.meetingArea;
  }
  if (body.accessibilityNotes !== undefined) {
    patch.accessibilityNotes = body.accessibilityNotes;
  }
  if (body.safetyNotes !== undefined) {
    patch.safetyNotes = body.safetyNotes;
  }
  if (body.cancellationPolicy !== undefined) {
    patch.cancellationPolicy = body.cancellationPolicy;
  }
  if (body.languageCodes !== undefined) {
    patch.languageCodes = body.languageCodes;
  }
  return patch;
}

function dateValue(day: string): number {
  return Date.parse(`${day}T00:00:00.000Z`);
}

function missing(): HttpError {
  return new HttpError(404, "NOT_FOUND", "Not found.");
}
