import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";

import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import clinicRoutes from "./routes/clinicRoutes.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import slotRoutes from "./routes/slotRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import queueRoutes from "./routes/queueRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { initializeQueueSocket } from "./sockets/queueSocket.js";

const requiredEnv = ["MONGO_URI", "JWT_SECRET"];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(`Missing environment variables: ${missingEnv.join(", ")}`);
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

const isProduction = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT) || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 300;

const configuredOrigins = CLIENT_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const defaultDevOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const allowedOrigins = isProduction
  ? configuredOrigins
  : Array.from(new Set([...configuredOrigins, ...defaultDevOrigins]));

const allowAllOrigins = allowedOrigins.includes("*");

const isOriginAllowed = (origin) => {
  if (!origin) {
    return true;
  }

  if (allowAllOrigins) {
    return true;
  }

  return allowedOrigins.includes(origin);
};

const corsOriginHandler = (origin, callback) => {
  if (isOriginAllowed(origin)) {
    return callback(null, true);
  }

  return callback(new Error(`Origin ${origin} is not allowed by CORS`));
};

const corsOptions = {
  origin: corsOriginHandler,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "Pragma", "Expires"],
  optionsSuccessStatus: 204,
};

const io = new Server(server, {
  cors: {
    origin: corsOriginHandler,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);
app.disable("x-powered-by");

if (isProduction) {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(compression());
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(
  rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      if (req.method === "OPTIONS") {
        return true;
      }

      if (!isProduction && req.method === "GET") {
        return true;
      }

      return false;
    },
  })
);
app.use(express.json({ limit: "250kb" }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/ready", (req, res) => {
  const state = mongoose.connection.readyState;
  const dbConnected = state === 1;

  if (!dbConnected) {
    return res.status(503).json({ status: "degraded", dbConnected: false });
  }

  return res.json({ status: "ready", dbConnected: true });
});

app.use("/api/clinics", clinicRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/slots", slotRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/queue", queueRoutes);
app.use("/api/auth", authRoutes);

initializeQueueSocket(io);

app.use(notFoundHandler);
app.use(errorHandler);

let shuttingDown = false;

function listenOnPort(port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };

    const onListening = () => {
      server.off("error", onError);
      resolve(port);
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port);
  });
}

async function startListeningWithFallback(basePort) {
  let currentPort = basePort;

  while (currentPort <= basePort + 20) {
    try {
      const boundPort = await listenOnPort(currentPort);
      return boundPort;
    } catch (error) {
      if (error.code !== "EADDRINUSE") {
        throw error;
      }

      if (isProduction) {
        throw error;
      }

      console.warn(`Port ${currentPort} is in use, trying ${currentPort + 1}...`);
      currentPort += 1;
    }
  }

  throw new Error(`No available port found in range ${basePort}-${basePort + 20}`);
}

async function startServer() {
  try {
    await connectDB();

    const boundPort = await startListeningWithFallback(PORT);
    console.log(`ClinicQ backend listening on port ${boundPort} (${process.env.NODE_ENV || "development"})`);
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`${signal} received. Shutting down gracefully...`);

  server.close(async () => {
    try {
      await mongoose.connection.close();
      console.log("MongoDB connection closed");
      process.exit(0);
    } catch (error) {
      console.error("Error while closing MongoDB connection:", error.message);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

startServer();
