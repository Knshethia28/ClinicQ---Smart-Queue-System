# ClinicQ Backend

Production-focused backend for ClinicQ queue and slot management.

## Run Locally

1. Copy `.env.example` to `.env` and provide real values.
2. Install dependencies:
   - `npm install`
3. Start server:
   - `npm run dev`

## Required Environment Variables

- `MONGO_URI`: MongoDB Atlas connection string.
- `JWT_SECRET`: Secret used to sign auth tokens.
- `PORT`: API port (default `5000`).

## Optional Environment Variables

- `NODE_ENV`: `development` or `production`.
- `CLIENT_ORIGIN`: Allowed CORS origin.
- `RATE_LIMIT_WINDOW_MS`: Rate limit window in ms.
- `RATE_LIMIT_MAX`: Max requests per IP per window.
- `GOOGLE_PLACES_API_KEY`: Enables nearby clinic merge with Google Places.

## Production Hardening Included

- Server startup blocked until MongoDB is connected.
- Security headers with Helmet.
- Gzip compression.
- Global API rate limiting.
- Request payload size limit.
- Centralized error handling with stack hidden in production.
- Graceful shutdown on `SIGINT` and `SIGTERM`.
- Readiness endpoint at `/api/ready`.

## Health Endpoints

- `GET /api/health`
- `GET /api/ready`

## Auth Endpoints

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me` (requires `Authorization: Bearer <token>`)

## Seed Data

- `npm run seed`

## Required Realtime Events

- `queueUpdated`
- `appointmentBooked`
- `walkinAdded`
- `patientCalled`
