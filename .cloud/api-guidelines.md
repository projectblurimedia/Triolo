# API Guidelines

## Style

REST over HTTP. Standard verbs: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`. Resource-oriented URLs, e.g. `/api/v1/workers/:id/bookings`.

## Response Shape

All responses follow the same envelope:

```json
{
  "success": true,
  "message": "Booking created",
  "data": { }
}
```

Errors:

```json
{
  "success": false,
  "message": "Invalid mobile number",
  "error": { "code": "VALIDATION_ERROR", "details": [ ] }
}
```

## Versioning

Prefix all routes with `/api/v1/`. Breaking changes get a new version prefix, not a silent change to v1.

## Validation

Every request validated at the route boundary (before it reaches the service layer). Reject early with `400` and a clear `VALIDATION_ERROR`.

## Auth

- `Authorization: Bearer <JWT>` on all protected routes.
- 401 for missing/invalid/expired token, 403 for valid token but insufficient role/permission.

## Status Codes

`200` success, `201` created, `400` validation error, `401` unauthenticated, `403` unauthorized, `404` not found, `409` conflict (e.g. duplicate registration, double PIN use), `500` unexpected server error (never leak internals in the message).

## Documentation

Every new/changed endpoint gets an entry in `docs/api.md` (method, path, auth requirement, request body, response shape, error cases) in the same change that implements it.
