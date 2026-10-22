# API contracts

OpenAPI is the contract shared with the Flutter app. This folder is documentation only. Do not add a TypeScript package here for the mobile app to import.

OpenAPI covers `GET /health`, JWT auth (`POST /api/v1/auth/register`, `login`, `refresh`, `logout`), the account seam (`GET` and `PATCH /api/v1/me`, `GET /api/v1/users/{userId}`), and Phase 3 discovery/host catalogue routes. Bookings and payment capture are not in this contract yet.

Protected routes expect `Authorization: Bearer <accessToken>`. Access tokens are HS256 JWTs with user id only; roles come from the server, not the token. See `apps/api/.env.example` for `AUTH_MODE` and `JWT_*` settings.
