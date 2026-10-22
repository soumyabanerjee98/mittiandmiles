# API modules

`auth`, `users`, and `audit` hold the Phase 2 foundation: JWT access and refresh tokens (`jose`, HS256), opaque refresh sessions in PostgreSQL, email/password registration and login, a development bearer-token seam, server-side permissions, and append-only audit writes. JWT payloads do not include roles; `authenticate` loads grants from the database.

`catalogue` is the Phase 3 discovery and host-onboarding module: cities, languages, categories, host verification, experience listings, availability, and admin review. It does not create bookings or capture payments. Identity documents are private storage references only. Object storage is not configured, so uploads and document bytes are unavailable. Role assignment has no public route.
