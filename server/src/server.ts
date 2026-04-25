import express from "express";
import { randomUUID } from "crypto";
import { createServer } from "http";
import { Server } from "socket.io";
import { createClient } from "redis";

const app = express();
const server = createServer(app);
app.use(express.json());

const SESSION_CODE_LENGTH = 6;
const SESSION_CODE_TTL_SECONDS = 60 * 60 * 2;
const SESSION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SESSION_CODE_MAX_ATTEMPTS = 12;
const ENABLE_MEMORY_FALLBACK =
  process.env.ENABLE_MEMORY_FALLBACK !== "false" &&
  process.env.NODE_ENV !== "production";

type MemorySessionValue = {
  sessionId: string;
  expiresAt: number;
};

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
});
const inMemorySessions = new Map<string, MemorySessionValue>();
let loggedMemoryFallback = false;

redisClient.on("error", (error) => {
  console.error("Redis client error:", error);
});

async function ensureRedisConnected(): Promise<void> {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}

function saveInMemorySession(code: string, sessionId: string): void {
  inMemorySessions.set(code, {
    sessionId,
    expiresAt: Date.now() + SESSION_CODE_TTL_SECONDS * 1000,
  });
}

function getInMemorySession(code: string): string | null {
  const entry = inMemorySessions.get(code);

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    inMemorySessions.delete(code);
    return null;
  }

  return entry.sessionId;
}

async function saveSessionCode(
  code: string,
  sessionId: string,
): Promise<boolean> {
  try {
    await ensureRedisConnected();

    const key = `session:code:${code}`;
    const setResult = await redisClient.set(key, sessionId, {
      EX: SESSION_CODE_TTL_SECONDS,
      NX: true,
    });
    return setResult === "OK";
  } catch (error) {
    if (!ENABLE_MEMORY_FALLBACK) {
      throw error;
    }

    if (!loggedMemoryFallback) {
      console.warn(
        "Redis unavailable, using in-memory session store (dev fallback).",
      );
      loggedMemoryFallback = true;
    }

    if (getInMemorySession(code)) {
      return false;
    }

    saveInMemorySession(code, sessionId);
    return true;
  }
}

async function getSessionByCode(code: string): Promise<string | null> {
  try {
    await ensureRedisConnected();
    return await redisClient.get(`session:code:${code}`);
  } catch (error) {
    if (!ENABLE_MEMORY_FALLBACK) {
      throw error;
    }

    if (!loggedMemoryFallback) {
      console.warn(
        "Redis unavailable, using in-memory session store (dev fallback).",
      );
      loggedMemoryFallback = true;
    }

    return getInMemorySession(code);
  }
}

function generateSessionCode(length: number = SESSION_CODE_LENGTH): string {
  return Array.from({ length }, () => {
    const randomIndex = Math.floor(
      Math.random() * SESSION_CODE_ALPHABET.length,
    );
    return SESSION_CODE_ALPHABET[randomIndex];
  }).join("");
}

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3001;

// Health endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "Server is running" });
});

app.post("/sessions", async (req, res) => {
  try {
    const sessionId = randomUUID();

    for (let attempt = 0; attempt < SESSION_CODE_MAX_ATTEMPTS; attempt += 1) {
      const code = generateSessionCode();

      const wasStored = await saveSessionCode(code, sessionId);

      if (wasStored) {
        return res.status(201).json({ sessionId, code });
      }
    }

    return res.status(503).json({
      message: "Could not generate a unique session code. Try again.",
    });
  } catch (error) {
    console.error("Failed to create session:", error);
    return res.status(503).json({
      message:
        "Session service is unavailable. Start Redis or enable dev memory fallback.",
    });
  }
});

app.get("/sessions/:code", async (req, res) => {
  try {
    const normalizedCode = req.params.code.trim().toUpperCase();

    if (normalizedCode.length !== SESSION_CODE_LENGTH) {
      return res.status(400).json({
        message: "Session code must be 6 characters long.",
      });
    }

    const sessionId = await getSessionByCode(normalizedCode);

    if (!sessionId) {
      return res.status(404).json({
        message: "Session not found or expired.",
      });
    }

    return res.status(200).json({
      sessionId,
      code: normalizedCode,
    });
  } catch (error) {
    console.error("Failed to fetch session by code:", error);
    return res.status(503).json({
      message:
        "Session service is unavailable. Start Redis or enable dev memory fallback.",
    });
  }
});

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Handle ping from client
  socket.on("ping", (data) => {
    console.log("Received ping from client:", data);
    // Respond with pong
    socket.emit("pong", { timestamp: new Date().toISOString() });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
