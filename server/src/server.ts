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
const MAX_PLAYERS_PER_SESSION = 6;
const ENABLE_MEMORY_FALLBACK =
  process.env.ENABLE_MEMORY_FALLBACK !== "false" &&
  process.env.NODE_ENV !== "production";

type MemorySessionValue = {
  sessionId: string;
  expiresAt: number;
};
type SessionPlayer = {
  playerId: string;
  playerName: string;
  joinedAt: string;
};
type ColorCard = {
  id: string;
  name: string;
  hex: string;
};
type BoardCell = {
  value: ColorCard | null;
  isWildcard: boolean;
};

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
});
const inMemorySessions = new Map<string, MemorySessionValue>();
const inMemorySessionPlayers = new Map<string, Map<string, SessionPlayer>>();
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

async function addPlayerToSession(
  sessionId: string,
  player: SessionPlayer,
): Promise<{
  isFull: boolean;
  playerCount: number;
}> {
  const playersKey = `session:players:${sessionId}`;

  try {
    await ensureRedisConnected();

    const alreadyInRoom = await redisClient.hExists(
      playersKey,
      player.playerId,
    );
    const playerCount = await redisClient.hLen(playersKey);

    if (!alreadyInRoom && playerCount >= MAX_PLAYERS_PER_SESSION) {
      return { isFull: true, playerCount };
    }

    await redisClient.hSet(playersKey, player.playerId, JSON.stringify(player));
    await redisClient.expire(playersKey, SESSION_CODE_TTL_SECONDS);

    const updatedCount = await redisClient.hLen(playersKey);
    return { isFull: false, playerCount: updatedCount };
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

    const players = inMemorySessionPlayers.get(sessionId) ?? new Map();
    const alreadyInRoom = players.has(player.playerId);

    if (!alreadyInRoom && players.size >= MAX_PLAYERS_PER_SESSION) {
      return { isFull: true, playerCount: players.size };
    }

    players.set(player.playerId, player);
    inMemorySessionPlayers.set(sessionId, players);

    return { isFull: false, playerCount: players.size };
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

function hashStringToSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: number): () => number {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithSeed<T>(array: T[], seed: number): T[] {
  const copy = [...array];
  const random = createSeededRandom(seed);

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function generatePlayerBoard(
  sessionId: string,
  playerId: string,
): BoardCell[][] {
  const boardSize = 5;
  const wildcardIndex = 2;
  const colorCatalog: ColorCard[] = [
    { id: "red-500", name: "Red", hex: "#EF4444" },
    { id: "blue-500", name: "Blue", hex: "#3B82F6" },
    { id: "green-500", name: "Green", hex: "#22C55E" },
    { id: "yellow-500", name: "Yellow", hex: "#EAB308" },
    { id: "purple-500", name: "Purple", hex: "#A855F7" },
    { id: "orange-500", name: "Orange", hex: "#F97316" },
    { id: "pink-500", name: "Pink", hex: "#EC4899" },
    { id: "teal-500", name: "Teal", hex: "#14B8A6" },
    { id: "indigo-500", name: "Indigo", hex: "#6366F1" },
    { id: "lime-500", name: "Lime", hex: "#84CC16" },
    { id: "cyan-500", name: "Cyan", hex: "#06B6D4" },
    { id: "amber-500", name: "Amber", hex: "#F59E0B" },
    { id: "emerald-500", name: "Emerald", hex: "#10B981" },
    { id: "violet-500", name: "Violet", hex: "#8B5CF6" },
    { id: "rose-500", name: "Rose", hex: "#F43F5E" },
    { id: "sky-500", name: "Sky", hex: "#0EA5E9" },
    { id: "fuchsia-500", name: "Fuchsia", hex: "#D946EF" },
    { id: "stone-500", name: "Stone", hex: "#78716C" },
    { id: "slate-500", name: "Slate", hex: "#64748B" },
    { id: "zinc-500", name: "Zinc", hex: "#71717A" },
    { id: "neutral-500", name: "Neutral", hex: "#737373" },
    { id: "gray-500", name: "Gray", hex: "#6B7280" },
    { id: "brown-500", name: "Brown", hex: "#A16207" },
    { id: "mint-500", name: "Mint", hex: "#34D399" },
    { id: "coral-500", name: "Coral", hex: "#FB7185" },
    { id: "navy-500", name: "Navy", hex: "#1D4ED8" },
    { id: "olive-500", name: "Olive", hex: "#65A30D" },
    { id: "magenta-500", name: "Magenta", hex: "#C026D3" },
    { id: "aqua-500", name: "Aqua", hex: "#2DD4BF" },
    { id: "gold-500", name: "Gold", hex: "#FACC15" },
  ];
  const neededCells = boardSize * boardSize - 1;
  const values = colorCatalog.slice(0, neededCells);
  const seed = hashStringToSeed(`${sessionId}:${playerId}`);
  const shuffledValues = shuffleWithSeed(values, seed);
  let valuePointer = 0;

  return Array.from({ length: boardSize }, (_, rowIndex) => {
    return Array.from({ length: boardSize }, (_, columnIndex) => {
      if (rowIndex === wildcardIndex && columnIndex === wildcardIndex) {
        return { value: null, isWildcard: true };
      }

      const value = shuffledValues[valuePointer];
      valuePointer += 1;
      return { value, isWildcard: false };
    });
  });
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

app.post("/sessions/:code/join", async (req, res) => {
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

    const body = req.body as {
      playerId?: string;
      playerName?: string;
    };

    const player: SessionPlayer = {
      playerId: body.playerId?.trim() || randomUUID(),
      playerName: body.playerName?.trim() || "Player",
      joinedAt: new Date().toISOString(),
    };

    const { isFull, playerCount } = await addPlayerToSession(sessionId, player);
    const board = generatePlayerBoard(sessionId, player.playerId);

    if (isFull) {
      return res.status(409).json({
        message: "Session is full.",
        maxPlayers: MAX_PLAYERS_PER_SESSION,
      });
    }

    const eventPayload = {
      sessionId,
      code: normalizedCode,
      player,
      playerCount,
      maxPlayers: MAX_PLAYERS_PER_SESSION,
      board,
    };

    io.to(sessionId).emit("player_joined", eventPayload);

    return res.status(200).json(eventPayload);
  } catch (error) {
    console.error("Failed to join session:", error);
    return res.status(503).json({
      message:
        "Session service is unavailable. Start Redis or enable dev memory fallback.",
    });
  }
});

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("join_session_room", (sessionId: string) => {
    if (!sessionId || typeof sessionId !== "string") {
      return;
    }

    socket.join(sessionId);
  });

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
