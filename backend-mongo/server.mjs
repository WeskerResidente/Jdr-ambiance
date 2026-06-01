import { createServer } from "node:http";
import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual, createHash } from "node:crypto";
import { MongoClient } from "mongodb";

const PORT = Number(process.env.PORT ?? process.env.JDR_API_PORT ?? 8000);
const MONGO_URI = process.env.MONGODB_URI ?? process.env.JDR_MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB ?? process.env.JDR_MONGODB_DB ?? "jdr_ambiances";
const SESSION_DAYS = 30;
const HASH_ITERATIONS = 210000;
const HASH_KEY_LENGTH = 32;
const HASH_DIGEST = "sha256";

if (!MONGO_URI) {
  console.error("MONGODB_URI manquant. Configure la variable d'environnement avant de lancer le backend.");
  process.exit(1);
}

const client = new MongoClient(MONGO_URI);
await client.connect();
const db = client.db(DB_NAME);

const collections = {
  users: db.collection("users"),
  sessions: db.collection("sessions"),
  sounds: db.collection("user_sounds"),
  soundFolders: db.collection("user_sound_folders"),
  customSounds: db.collection("user_custom_sounds"),
  campaignImages: db.collection("user_campaign_images"),
  externalLinks: db.collection("user_external_links"),
  scenes: db.collection("user_scenes"),
  favoriteCategories: db.collection("user_favorite_categories")
};

await Promise.all([
  collections.users.createIndex({ email: 1 }, { unique: true }),
  collections.sessions.createIndex({ tokenHash: 1 }, { unique: true }),
  collections.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ...syncCollections().map((collection) => collection.createIndex({ userId: 1, itemId: 1 }, { unique: true })),
  ...syncCollections().map((collection) => collection.createIndex({ userId: 1 }))
]);

function syncCollections() {
  return [
    collections.sounds,
    collections.soundFolders,
    collections.customSounds,
    collections.campaignImages,
    collections.externalLinks,
    collections.scenes,
    collections.favoriteCategories
  ];
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function sendError(response, status, message) {
  sendJson(response, status, { error: message });
}

async function readBody(request) {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function normalizePath(requestUrl) {
  const parsedUrl = new URL(requestUrl, "http://localhost");
  let path = parsedUrl.pathname;
  if (path.startsWith("/api/")) path = path.slice(4);
  return path;
}

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

function validateCredentials(payload) {
  const email = normalizeEmail(payload.email);
  const password = String(payload.password ?? "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error("Adresse email invalide."), { status: 422 });
  }

  if (password.length < 8) {
    throw Object.assign(new Error("Le mot de passe doit contenir au moins 8 caracteres."), { status: 422 });
  }

  return { email, password };
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_DIGEST).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, user) {
  const expected = Buffer.from(user.passwordHash, "hex");
  const actual = Buffer.from(hashPassword(password, user.passwordSalt).hash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function userPayload(user) {
  return {
    id: user._id,
    email: user.email,
    createdAt: user.createdAt
  };
}

async function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await collections.sessions.insertOne({
    _id: randomUUID(),
    userId,
    tokenHash: tokenHash(token),
    createdAt: now.toISOString(),
    expiresAt
  });

  return token;
}

function bearerToken(request) {
  const header = request.headers.authorization ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

async function requireCurrentUser(request) {
  const token = bearerToken(request);
  if (!token) {
    throw Object.assign(new Error("Session manquante."), { status: 401 });
  }

  const session = await collections.sessions.findOne({
    tokenHash: tokenHash(token),
    expiresAt: { $gt: new Date() }
  });

  if (!session) {
    throw Object.assign(new Error("Session expiree. Reconnecte-toi."), { status: 401 });
  }

  const user = await collections.users.findOne({ _id: session.userId });
  if (!user) {
    throw Object.assign(new Error("Session invalide."), { status: 401 });
  }

  return user;
}

function defaultSyncData() {
  return {
    sounds: [],
    soundFolders: [],
    customSounds: [],
    campaignImages: [],
    externalLinks: [],
    scenes: [],
    favoriteCategoriesByFolder: {}
  };
}

const syncConfig = [
  ["sounds", collections.sounds],
  ["soundFolders", collections.soundFolders],
  ["customSounds", collections.customSounds],
  ["campaignImages", collections.campaignImages],
  ["externalLinks", collections.externalLinks],
  ["scenes", collections.scenes]
];

async function saveSyncItems(userId, collection, items, updatedAt) {
  await collection.deleteMany({ userId });
  const documents = items
    .filter((item) => item && typeof item === "object")
    .map((item, index) => ({
      userId,
      itemId: String(item.id ?? `${collection.collectionName}-${index}`),
      data: item,
      updatedAt
    }));

  if (documents.length > 0) await collection.insertMany(documents);
}

async function saveFavorites(userId, favoritesByFolder, updatedAt) {
  await collections.favoriteCategories.deleteMany({ userId });
  const documents = Object.entries(favoritesByFolder ?? {})
    .filter(([, items]) => Array.isArray(items))
    .map(([folderId, items]) => ({
      userId,
      itemId: folderId,
      data: items,
      updatedAt
    }));

  if (documents.length > 0) await collections.favoriteCategories.insertMany(documents);
}

async function saveUserData(userId, data, updatedAt) {
  for (const [key, collection] of syncConfig) {
    await saveSyncItems(userId, collection, Array.isArray(data[key]) ? data[key] : [], updatedAt);
  }

  await saveFavorites(userId, data.favoriteCategoriesByFolder, updatedAt);
}

async function readUserData(userId) {
  const data = defaultSyncData();

  for (const [key, collection] of syncConfig) {
    data[key] = (await collection.find({ userId }).sort({ updatedAt: 1 }).toArray()).map((item) => item.data);
  }

  const favorites = await collections.favoriteCategories.find({ userId }).toArray();
  data.favoriteCategoriesByFolder = Object.fromEntries(favorites.map((item) => [item.itemId, Array.isArray(item.data) ? item.data : []]));

  return data;
}

async function hasSyncData(userId) {
  for (const collection of syncCollections()) {
    if (await collection.findOne({ userId }, { projection: { _id: 1 } })) return true;
  }

  return false;
}

async function lastSyncUpdate(userId) {
  const dates = [];
  for (const collection of syncCollections()) {
    const item = await collection.find({ userId }).sort({ updatedAt: -1 }).limit(1).next();
    if (item?.updatedAt) dates.push(item.updatedAt);
  }

  return dates.sort().at(-1) ?? null;
}

async function handleRequest(request, response) {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  const path = normalizePath(request.url);
  const body = request.method === "POST" ? await readBody(request) : {};

  if (request.method === "GET" && path === "/health") {
    sendJson(response, 200, { ok: true, database: "mongodb", dbName: DB_NAME });
    return;
  }

  if (request.method === "POST" && path === "/auth/register") {
    const { email, password } = validateCredentials(body);
    const existingUser = await collections.users.findOne({ email });
    if (existingUser) {
      sendError(response, 409, "Un compte existe deja avec cette adresse email.");
      return;
    }

    const { salt, hash } = hashPassword(password);
    const user = {
      _id: randomUUID(),
      email,
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: new Date().toISOString()
    };

    await collections.users.insertOne(user);
    sendJson(response, 201, { user: userPayload(user), token: await createSession(user._id) });
    return;
  }

  if (request.method === "POST" && path === "/auth/login") {
    const { email, password } = validateCredentials(body);
    const user = await collections.users.findOne({ email });

    if (!user || !verifyPassword(password, user)) {
      sendError(response, 401, "Email ou mot de passe incorrect.");
      return;
    }

    sendJson(response, 200, { user: userPayload(user), token: await createSession(user._id) });
    return;
  }

  if (request.method === "GET" && path === "/auth/me") {
    sendJson(response, 200, userPayload(await requireCurrentUser(request)));
    return;
  }

  if (request.method === "POST" && path === "/auth/logout") {
    const token = bearerToken(request);
    if (token) await collections.sessions.deleteMany({ tokenHash: tokenHash(token) });
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && path === "/sync") {
    const user = await requireCurrentUser(request);
    const exists = await hasSyncData(user._id);
    sendJson(response, 200, {
      data: exists ? await readUserData(user._id) : null,
      updatedAt: exists ? await lastSyncUpdate(user._id) : null
    });
    return;
  }

  if (request.method === "POST" && path === "/sync") {
    const user = await requireCurrentUser(request);
    if (!body.data || typeof body.data !== "object") {
      sendError(response, 422, "Donnees de synchronisation invalides.");
      return;
    }

    const updatedAt = new Date().toISOString();
    await saveUserData(user._id, body.data, updatedAt);
    sendJson(response, 200, { ok: true, updatedAt });
    return;
  }

  sendError(response, 404, "Route introuvable.");
}

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    const status = Number.isInteger(error.status) ? error.status : 500;
    sendError(response, status, status === 500 ? "Erreur serveur." : error.message);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend MongoDB JDR Ambiances lance sur http://0.0.0.0:${PORT}`);
});
