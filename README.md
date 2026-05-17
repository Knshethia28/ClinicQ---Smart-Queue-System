<div align="center">

# 🏥 ClinicQ

### Smart Queue & Outpatient Flow Platform

A full-stack healthcare queue management system that connects patient discovery, appointment scheduling, real-time queue execution, and clinic administration into a single, premium experience.

[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6.4-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.11-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?logo=socket.io&logoColor=white)](https://socket.io)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-4.1-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Data Models](#-data-models)
- [Project Structure](#-project-structure)
- [Demo Credentials](#-demo-credentials)
- [License](#-license)

---

## 🔍 Overview

ClinicQ is a comprehensive patient-flow operating system for clinics and hospitals. It provides two distinct dashboard experiences—one for **clinic administrators** (doctors, staff) and one for **patients**—connected by a real-time, WebSocket-powered queue engine.

The platform helps clinics manage doctors, configure appointment slots, run a live queue with walk-in and emergency support, and allows patients to discover nearby clinics, book appointments, and track queue position in real time.

---

## ✨ Features

### 🩺 Clinic Dashboard

- **Doctor Management** — Add, edit, and remove doctors with specialization, working hours, lunch breaks, and working days.
- **Slot Generation** — Auto-generate time slots per doctor based on configurable duration and capacity.
- **Live Queue Engine** — Real-time patient queue with token assignment (`T-001`, `T-002`, …).
- **Walk-in Support** — Add walk-in patients directly to the queue.
- **Emergency Triage** — Emergency walk-ins are auto-promoted to the front of the queue.
- **Queue Reordering** — Drag-and-drop manual queue reorder with position persistence.
- **Call Next / Complete** — One-click patient flow through `booked → active → completed`.
- **Queue Statistics** — Live stats: waiting count, active patient, completed today, average consultation time.
- **ETA Estimation** — Estimated wait-time range per patient based on historical consultation duration.

### 👤 Patient Dashboard

- **Nearby Clinic Discovery** — Geolocation-based search powered by:
  - Google Places API
  - OpenStreetMap Overpass API
  - Nominatim geocoding
  - Geoapify Places API
- **Appointment Booking** — Browse available slots for a doctor and book appointments.
- **Real-Time Queue Tracking** — Live position and wait-time updates via WebSocket.
- **Clinic Favorites** — Save frequently visited clinics for quick access.

### 🔐 Authentication

- JWT-based authentication with role separation (`clinic` / `patient`)
- Secure password hashing with bcrypt
- Persistent login state via `localStorage`

### 🎨 UI & Design

- Premium “Elegant Health” dark-mode UI with glassmorphism, mesh gradients, and micro-animations.
- Typography powered by **Inter** and **Outfit** from Google Fonts.
- Radix UI primitives for accessible, composable components.
- Recharts-powered data visualizations.
- Fully responsive layout.

---

## 🏗 Architecture

```text
┌─────────────────────────────────────────────────────┐
│                    Client (React)                   │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │  Login /     │  │   Clinic     │  │  Patient  │ │
│  │  Sign Up     │  │  Dashboard   │  │ Dashboard │ │
│  └──────────────┘  └──────┬───────┘  └─────┬─────┘ │
│                           │                │        │
│            REST API ──────┴────────────────┘        │
│            Socket.IO (real-time queue updates)      │
└───────────────────────────┬─────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────┐
│                 Server (Express.js)                 │
│                                                     │
│  ┌──────────┐ ┌───────────┐ ┌─────────────────────┐ │
│  │ Routes   │ │Controllers│ │ Services            │ │
│  │ /auth    │→│ auth      │→│ • queueService      │ │
│  │ /clinics │ │ clinic    │ │ • slotService       │ │
│  │ /doctors │ │ doctor    │ │ • discoveryService  │ │
│  │ /slots   │ │ slot      │ └─────────────────────┘ │
│  │ /appts   │ │ appt      │                         │
│  │ /queue   │ │ queue     │ ┌─────────────────────┐ │
│  └──────────┘ └───────────┘ │ Middleware          │ │
│                             │ • JWT auth          │ │
│                             │ • Rate limiting     │ │
│                             │ • CORS / Helmet     │ │
│                             │ • Error handling    │ │
│                             └─────────────────────┘ │
│  ┌──────────────────┐                               │
│  │ Socket.IO Server │                               │
│  │  (queueSocket)   │                               │
│  └──────────────────┘                               │
└───────────────────────────┬─────────────────────────┘
                            │
                  ┌─────────▼─────────┐
                  │   MongoDB Atlas   │
                  │ • Users           │
                  │ • Clinics         │
                  │ • Doctors         │
                  │ • Slots           │
                  │ • Appointments    │
                  └───────────────────┘
```

---

## 🛠 Tech Stack

### Frontend

| Technology | Purpose |
| --- | --- |
| **React 18** | Component library |
| **TypeScript 6** | Type safety |
| **Vite 6** | Build tool & dev server |
| **Tailwind CSS 4** | Utility-first styling |
| **Radix UI** | Accessible headless components |
| **Recharts** | Data visualization / charts |
| **Lucide React** | Icon library |
| **Socket.IO Client** | Real-time communication |
| **React Hook Form** | Form management |
| **Sonner** | Toast notifications |
| **@dnd-kit** | Drag-and-drop queue reordering |

### Backend

| Technology | Purpose |
| --- | --- |
| **Node.js** | Runtime |
| **Express 4** | HTTP framework |
| **Mongoose 8** | MongoDB ODM |
| **Socket.IO 4** | WebSocket server |
| **bcryptjs** | Password hashing |
| **jsonwebtoken** | JWT authentication |
| **Helmet** | Security headers |
| **express-rate-limit** | Rate limiting |
| **compression** | Response compression |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- **MongoDB** (local or [MongoDB Atlas](https://www.mongodb.com/atlas) connection string)

### 1. Clone the repository

```bash
git clone https://github.com/Knshethia28/ClinicQ---Smart-Queue-System.git
cd ClinicQ---Smart-Queue-System
```

### 2. Set up the backend

```bash
cd server
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
npm install
```

### 3. Seed demo data (optional)

```bash
npm run seed
```

### 4. Start the backend

```bash
# Development (hot reload via nodemon)
npm run dev

# Production
npm start
```

The backend runs on **port 5000** by default (auto-increments if the port is in use).

### 5. Set up the frontend

```bash
cd ..
cp .env.example .env
# Ensure VITE_API_BASE_URL points to your backend (default: http://localhost:5000)
npm install
```

### 6. Start the frontend

```bash
npm run dev
```

The frontend runs at **http://localhost:3000**.

### 7. Build for production

```bash
npm run build
```

Output is written to the `build/` directory.

---

## 🔑 Environment Variables

### Frontend (`/.env`)

| Variable | Description | Default |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:5000` |

### Backend (`/server/.env`)

| Variable | Description | Default |
| --- | --- | --- |
| `NODE_ENV` | Environment (`development` / `production`) | `development` |
| `MONGO_URI` | MongoDB connection string | — |
| `JWT_SECRET` | Secret key for JWT signing | — |
| `PORT` | Server port | `5000` |
| `CLIENT_ORIGIN` | Allowed CORS origins (comma-separated) | `http://localhost:3000` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms | `900000` (15 min) |
| `RATE_LIMIT_MAX` | Max requests per window | `300` |
| `GOOGLE_PLACES_API_KEY` | Google Places API key (clinic discovery) | — |
| `GEOAPIFY_API_KEY` | Geoapify API key (clinic discovery) | — |

---

## 📡 API Reference

All endpoints are prefixed with `/api`.

### Health & Readiness

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Basic health check |
| `GET` | `/api/ready` | Health check with DB status |

### Authentication (`/api/auth`)

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Authenticate user |
| `POST` | `/api/auth/signup` | Register a new user (clinic or patient) |

### Clinics (`/api/clinics`)

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/clinics` | List clinics |
| `GET` | `/api/clinics/nearby` | Discover nearby clinics (geolocation-based) |

### Doctors (`/api/doctors`)

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/doctors` | List doctors (filtered by clinic) |
| `POST` | `/api/doctors` | Create a doctor |
| `PUT` | `/api/doctors/:id` | Update a doctor |
| `DELETE` | `/api/doctors/:id` | Delete a doctor |

### Slots (`/api/slots`)

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/slots` | List slots for a doctor |
| `POST` | `/api/slots/generate` | Auto-generate slots from doctor availability |

### Appointments (`/api/appointments`)

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/appointments` | List appointments |
| `POST` | `/api/appointments` | Book an appointment |
| `PATCH` | `/api/appointments/:id` | Update appointment status |
| `DELETE` | `/api/appointments/:id` | Cancel an appointment |

### Queue (`/api/queue`)

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/queue/:doctorId` | Get live queue for a doctor |
| `POST` | `/api/queue/:doctorId/walk-in` | Add a walk-in patient |
| `POST` | `/api/queue/:doctorId/call-next` | Call the next patient |
| `POST` | `/api/queue/:doctorId/complete` | Complete current consultation |
| `POST` | `/api/queue/:doctorId/reorder` | Reorder a patient in the queue |

### WebSocket Events

| Event | Direction | Description |
| --- | --- | --- |
| `joinDoctorQueue` | Client → Server | Subscribe to queue updates for a doctor |
| `queueUpdated` | Server → Client | Broadcast when the queue changes |

---

## 📊 Data Models

### User

| Field | Type | Description |
| --- | --- | --- |
| `username` | String | Unique login name |
| `email` | String | User email |
| `passwordHash` | String | Bcrypt hash |
| `role` | Enum | `clinic` or `patient` |
| `clinicId` | ObjectId | Linked clinic (for clinic role) |
| `clinicName` | String | Clinic display name |
| `facilityType` | Enum | `clinic` or `hospital` |
| `fullName` | String | Patient full name |
| `phone` | String | Patient phone |

### Clinic

| Field | Type | Description |
| --- | --- | --- |
| `name` | String | Clinic name |
| `address` | String | Physical address |
| `location` | GeoJSON Point | `[lng, lat]` coordinates (2dsphere indexed) |
| `operatingHours` | String | Human-readable hours |
| `facilityType` | Enum | `clinic` or `hospital` |

### Doctor

| Field | Type | Description |
| --- | --- | --- |
| `clinicId` | ObjectId | Parent clinic |
| `name` | String | Doctor name |
| `specialization` | String | Medical specialty |
| `slotDuration` | Number | Minutes per slot (min: 5) |
| `availabilityStart` | String | Start time (`HH:MM`) |
| `availabilityEnd` | String | End time (`HH:MM`) |
| `lunchStart` / `lunchEnd` | String | Lunch break window |
| `workingDays` | [String] | `['Mon','Tue',...]` |
| `slotCapacity` | Number | Patients per slot |

### Slot

| Field | Type | Description |
| --- | --- | --- |
| `doctorId` | ObjectId | Parent doctor |
| `date` | String | `YYYY-MM-DD` |
| `startTime` / `endTime` | String | `HH:MM` |
| `capacity` | Number | Max bookings |
| `bookedCount` | Number | Current bookings |

### Appointment

| Field | Type | Description |
| --- | --- | --- |
| `patientName` | String | Patient display name |
| `phone` | String | Contact number |
| `doctorId` | ObjectId | Assigned doctor |
| `slotId` | ObjectId | Booked slot (`null` for walk-ins) |
| `isEmergency` | Boolean | Emergency flag |
| `status` | Enum | `booked` → `active` → `completed` / `cancelled` |
| `manualQueuePosition` | Number | Manual reorder position |
| `estimatedTravelMinutes` | Number | Travel ETA |
| `activatedAt` / `completedAt` | Date | Lifecycle timestamps |

---

## 📂 Project Structure

```text
ClinicQ/
├── index.html                      # App entry point
├── package.json                    # Frontend dependencies & scripts
├── vite.config.ts                  # Vite + Tailwind + path aliases
├── tsconfig.json                   # TypeScript configuration
├── .env.example                    # Frontend env template
│
├── src/
│   ├── main.tsx                    # React entry point
│   ├── App.tsx                     # Root component (auth, routing)
│   ├── lib.ts                      # Constants, types, helpers, utilities
│   ├── ui.tsx                      # Shared UI component exports
│   ├── index.css                   # Global styles
│   │
│   ├── components/
│   │   ├── ClinicDashboard.tsx     # Clinic admin dashboard
│   │   ├── PatientDashboard.tsx    # Patient-facing dashboard
│   │   ├── auth/                   # Auth-related components
│   │   └── ui/                     # Radix-based UI primitives (48 components)
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── tabs.tsx
│   │       ├── chart.tsx
│   │       └── ...
│   │
│   └── styles/                     # Additional stylesheets
│
├── server/
│   ├── server.js                   # Express + Socket.IO entry point
│   ├── package.json                # Backend dependencies & scripts
│   ├── .env.example                # Backend env template
│   │
│   ├── config/
│   │   └── db.js                   # MongoDB connection
│   │
│   ├── models/
│   │   ├── User.js                 # User model
│   │   ├── Clinic.js               # Clinic model (with geospatial index)
│   │   ├── Doctor.js               # Doctor model
│   │   ├── Slot.js                 # Time slot model
│   │   └── Appointment.js          # Appointment / queue item model
│   │
│   ├── routes/
│   │   ├── authRoutes.js           # Auth endpoints
│   │   ├── clinicRoutes.js         # Clinic endpoints
│   │   ├── doctorRoutes.js         # Doctor CRUD
│   │   ├── slotRoutes.js           # Slot generation
│   │   ├── appointmentRoutes.js    # Appointment booking
│   │   └── queueRoutes.js          # Queue operations
│   │
│   ├── controllers/
│   │   ├── authController.js       # Login / signup logic
│   │   ├── clinicController.js     # Clinic + nearby discovery
│   │   ├── doctorController.js     # Doctor management
│   │   ├── slotController.js       # Slot generation logic
│   │   ├── appointmentController.js# Booking logic
│   │   └── queueController.js      # Queue operations
│   │
│   ├── services/
│   │   ├── queueService.js         # Queue engine (triage, reorder, ETA)
│   │   ├── slotService.js          # Slot generation algorithms
│   │   └── discoveryService.js     # Multi-provider clinic discovery
│   │
│   ├── middleware/
│   │   ├── auth.js                 # JWT verification middleware
│   │   └── errorHandler.js         # Global error + 404 handler
│   │
│   ├── sockets/
│   │   └── queueSocket.js          # WebSocket event handlers
│   │
│   ├── seed/
│   │   └── seedData.js             # Demo data seeder
│   │
│   └── utils/                      # Shared server utilities
│
└── build/                          # Production build output
```

---

## 🔑 Demo Credentials

| Role | Username | Password |
| --- | --- | --- |
| Clinic Admin | `clinic` | `clinic123` |
| Patient | `patient1` | `patient123` |

---

## 📄 License

This project is private and not currently licensed for public distribution.

---

<div align="center">
  <sub>Built with ❤️ for better healthcare experiences</sub>
</div>
