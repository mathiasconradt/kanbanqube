#!/usr/bin/env node
"use strict";

const http = require("node:http");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const { spawn, execFile } = require("node:child_process");
const crypto = require("node:crypto");

const APP_DIR = __dirname;
const WORKSPACE_DIR = resolveWorkspaceDirectory(process.argv[2]);
const PUBLIC_DIR = path.join(APP_DIR, "public");
const BOARD_FILE_NAME = "board.json";
const BOARD_FILE_PATH = path.join(WORKSPACE_DIR, BOARD_FILE_NAME);
const BOARD_DIR_NAME = "board";
const BOARD_DIR = path.join(WORKSPACE_DIR, BOARD_DIR_NAME);
const BOARD_META_FILE_PATH = path.join(BOARD_DIR, "meta.json");
const UPLOADS_DIR_NAME = "uploads";
const UPLOADS_DIR = path.join(WORKSPACE_DIR, UPLOADS_DIR_NAME);
const SAMPLE_EXPORT_DIR = path.join(WORKSPACE_DIR, "trello_export");
const PORT = Number(process.env.PORT || 3000);
const gitExecutableCandidates = [
  "/usr/bin/git",
  "/bin/git",
  "/usr/local/bin/git",
  "/opt/homebrew/bin/git"
];
const sshExecutableCandidates = [
  "/usr/bin/ssh",
  "/bin/ssh",
  "/usr/local/bin/ssh",
  "/opt/homebrew/bin/ssh"
];
const gitSafePath = "/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin";
const syncStatus = {
  running: false,
  startedAt: "",
  finishedAt: "",
  ok: null,
  output: ""
};
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8"
};

const server = http.createServer((request, response) => {
  void handleRequest(request, response);
});

async function handleRequest(request, response) {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

    if (await handleApiRequest(request, response, url)) return;
    if (handleAssetRequest(request, response, url)) return;
    sendJson(response, 405, { error: "Method not allowed." });
  } catch (error) {
    sendJson(response, error.statusCode || 500, { error: error.message || "Unexpected server error." });
  }
}

async function handleApiRequest(request, response, url) {
  if (request.method === "GET") return handleGetApiRequest(response, url);
  if (request.method === "POST") return handlePostApiRequest(request, response, url);
  if (request.method === "PUT" && url.pathname === "/api/board") return saveBoardApiRequest(request, response);
  if (request.method === "DELETE" && url.pathname.startsWith(`/api/${UPLOADS_DIR_NAME}/`)) {
    const result = await deleteUploadedFile(url.pathname);
    sendJson(response, 200, result);
    return true;
  }
  return false;
}

async function handleGetApiRequest(response, url) {
  if (url.pathname === "/api/board") {
    sendJson(response, 200, await loadBoard());
    return true;
  }
  if (url.pathname === "/api/config") {
    sendJson(response, 200, await loadConfig());
    return true;
  }
  if (url.pathname === "/api/sync-status") {
    sendJson(response, 200, syncStatus);
    return true;
  }
  return false;
}

async function handlePostApiRequest(request, response, url) {
  if (url.pathname === "/api/uploads") {
    const files = await saveUploadedFiles(request);
    sendJson(response, 200, { files });
    return true;
  }
  if (url.pathname === "/api/import") {
    await importBoardApiRequest(request, response);
    return true;
  }
  if (url.pathname === "/api/sync") {
    await syncBoardApiRequest(response);
    return true;
  }
  return false;
}

function handleAssetRequest(request, response, url) {
  if (request.method === "GET" && url.pathname.startsWith(`/${UPLOADS_DIR_NAME}/`)) {
    serveUpload(url.pathname, response);
    return true;
  }
  if (request.method === "GET") {
    serveStatic(url.pathname, response);
    return true;
  }
  return false;
}

async function loadConfig() {
  return {
    boardFile: BOARD_FILE_NAME,
    storagePath: BOARD_DIR_NAME,
    workspacePath: WORKSPACE_DIR,
    hasGitRepo: await hasGitRepository(WORKSPACE_DIR),
    gitRemote: await gitRemoteOrigin(WORKSPACE_DIR),
    gitUserName: await gitUserName(WORKSPACE_DIR),
    gitUserEmail: await gitUserEmail(WORKSPACE_DIR)
  };
}

async function saveBoardApiRequest(request, response) {
  const payload = await readJsonBody(request);
  const board = await saveBoard(payload);
  sendJson(response, 200, board);
  return true;
}

async function importBoardApiRequest(request, response) {
  const currentBoard = await loadBoard();
  if ((currentBoard.cards || []).length > 0) {
    sendJson(response, 409, { error: "Import is only available when the board has no cards." });
    return;
  }
  const importedBoard = await readImportedBoard(request);
  const board = await saveBoard(importedBoard);
  sendJson(response, 200, board);
}

async function syncBoardApiRequest(response) {
  if (syncStatus.running) {
    sendJson(response, 409, {
      ok: false,
      output: syncStatus.output || "A git sync is already in progress.",
      startedAt: syncStatus.startedAt,
      finishedAt: syncStatus.finishedAt
    });
    return;
  }
  const result = await syncBoardRepository();
  sendJson(response, result.ok ? 200 : 500, result);
}

server.listen(PORT, async () => {
  await ensureBoardStorage();
  console.log(`KanbanQube running on http://localhost:${PORT} (workspace: ${WORKSPACE_DIR})`);
});

async function serveStatic(requestPath, response) {
  let safePath = requestPath === "/" ? "/index.html" : requestPath;
  if (safePath.includes("\0")) {
    return sendText(response, 400, "Invalid path.");
  }

  safePath = path.posix.normalize(safePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendText(response, 403, "Forbidden.");
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return sendText(response, 404, "Not found.");
    const ext = path.extname(filePath).toLowerCase();
    const body = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(body);
  } catch (error) {
    if (error.code === "ENOENT") return sendText(response, 404, "Not found.");
    throw error;
  }
}

async function serveUpload(requestPath, response) {
  let relativePath = decodeURIComponent(requestPath.slice(`/${UPLOADS_DIR_NAME}/`.length));
  if (!relativePath || relativePath.includes("\0") || relativePath.includes("/") || relativePath.includes("\\")) {
    return sendText(response, 400, "Invalid upload path.");
  }

  relativePath = path.basename(relativePath);
  const filePath = path.join(UPLOADS_DIR, relativePath);
  if (!filePath.startsWith(UPLOADS_DIR)) {
    return sendText(response, 403, "Forbidden.");
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return sendText(response, 404, "Not found.");
    const ext = path.extname(filePath).toLowerCase();
    const body = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(body);
  } catch (error) {
    if (error.code === "ENOENT") return sendText(response, 404, "Not found.");
    throw error;
  }
}

async function deleteUploadedFile(requestPath) {
  let relativePath = decodeURIComponent(requestPath.slice(`/api/${UPLOADS_DIR_NAME}/`.length));
  if (!relativePath || relativePath.includes("\0") || relativePath.includes("/") || relativePath.includes("\\")) {
    throw new Error("Invalid upload path.");
  }

  relativePath = path.basename(relativePath);
  const board = await loadBoard();
  if (isUploadReferenced(board, relativePath)) {
    return { deleted: false, referenced: true };
  }

  const filePath = path.join(UPLOADS_DIR, relativePath);
  if (!filePath.startsWith(UPLOADS_DIR)) {
    throw new Error("Invalid upload path.");
  }

  try {
    await fs.unlink(filePath);
    return { deleted: true };
  } catch (error) {
    if (error.code === "ENOENT") return { deleted: false };
    throw error;
  }
}

function isUploadReferenced(board, storedName) {
  return (board.cards || []).some((card) => {
    return (card.attachments || []).some((attachment) => uploadStoredName(attachment) === storedName);
  });
}

function uploadStoredName(attachment) {
  if (!attachment || typeof attachment !== "object") return "";
  if (nonEmptyString(attachment.fileName)) return path.basename(attachment.fileName);
  if (nonEmptyString(attachment.url)) {
    try {
      return path.basename(decodeURIComponent(new URL(attachment.url, "http://localhost").pathname));
    } catch {
      return "";
    }
  }
  return "";
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 5 * 1024 * 1024) {
      throw new Error("Request body too large.");
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

async function readBody(request, maxSize = 25 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxSize) {
      throw new Error("Request body too large.");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readImportedBoard(request) {
  const contentType = request.headers["content-type"] || "";
  if (contentType.includes("multipart/form-data")) {
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) throw new Error("Import request must include a file.");
    const boundary = boundaryMatch[1] || boundaryMatch[2];
    const body = await readBody(request, 50 * 1024 * 1024);
    const filePart = parseMultipartBody(body, boundary).find((part) => part.filename && part.data.length > 0);
    if (!filePart) throw new Error("Import request must include a JSON file.");
    return JSON.parse(filePart.data.toString("utf8"));
  }

  return readJsonBody(request);
}

async function saveUploadedFiles(request) {
  const contentType = request.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) {
    throw new Error("Upload request must use multipart/form-data.");
  }

  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const body = await readBody(request);
  const parts = parseMultipartBody(body, boundary);
  await fs.mkdir(UPLOADS_DIR, { recursive: true });

  const files = [];
  for (const part of parts) {
    if (!part.filename || part.data.length === 0) continue;
    const originalName = displayOriginalFileName(part.filename);
    const storedName = createStoredFileName(originalName);
    const filePath = path.join(UPLOADS_DIR, storedName);
    await fs.writeFile(filePath, part.data);
    files.push({
      id: createHexId(),
      name: originalName,
      fileName: storedName,
      url: `/${UPLOADS_DIR_NAME}/${encodeURIComponent(storedName)}`,
      mimeType: part.contentType || mimeTypeForFileName(originalName),
      bytes: part.data.length,
      date: new Date().toISOString(),
      isUpload: true
    });
  }

  return files;
}

function parseMultipartBody(body, boundary) {
  const delimiter = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = body.indexOf(delimiter);

  while (start !== -1) {
    start += delimiter.length;
    if (body[start] === 45 && body[start + 1] === 45) break;
    if (body[start] === 13 && body[start + 1] === 10) start += 2;

    const next = body.indexOf(delimiter, start);
    if (next === -1) break;

    let part = body.subarray(start, next);
    if (part.length >= 2 && part[part.length - 2] === 13 && part[part.length - 1] === 10) {
      part = part.subarray(0, -2);
    }

    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd !== -1) {
      const rawHeaders = part.subarray(0, headerEnd).toString("utf8");
      const data = part.subarray(headerEnd + 4);
      const disposition = rawHeaders.match(/content-disposition:\s*([^\r\n]+)/i)?.[1] || "";
      const contentType = rawHeaders.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || "";
      const filename = disposition.match(/filename="([^"]*)"/i)?.[1] || "";
      parts.push({ filename, contentType, data });
    }

    start = next;
  }

  return parts;
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(body);
}

function sendText(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(body);
}

function displayOriginalFileName(value) {
  const baseName = path.basename(String(value || "attachment"));
  return baseName.replace(/[\0\r\n]/g, "").trim() || "attachment";
}

function createStoredFileName(originalName) {
  const ext = path.extname(originalName);
  const base = sanitizeStoredFileName(path.basename(originalName, ext) || "attachment");
  const stamp = new Date().toISOString().replace(/[^0-9A-Za-z]/g, "");
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${base}.kbq_${stamp}${suffix}${ext}`;
}

function sanitizeStoredFileName(value) {
  let result = "";
  let previousWasUnderscore = true;
  for (const character of String(value)) {
    const isAlphaNumeric = (character >= "a" && character <= "z")
      || (character >= "A" && character <= "Z")
      || (character >= "0" && character <= "9");
    const isAllowedSymbol = character === "(" || character === ")" || character === "[" || character === "]" || character === "-";
    if (isAlphaNumeric || character === "_" || isAllowedSymbol) {
      result += character;
      previousWasUnderscore = false;
    } else if (!previousWasUnderscore) {
      result += "_";
      previousWasUnderscore = true;
    }
  }
  const trimmed = previousWasUnderscore ? result.slice(0, -1) : result;
  return trimmed || "attachment";
}

function mimeTypeForFileName(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  return mimeTypes[ext] || "application/octet-stream";
}

async function ensureBoardStorage() {
  if (await exists(BOARD_META_FILE_PATH)) return;
  const board = await seedBoard();
  await writeSplitBoard(board);
}

async function seedBoard() {
  try {
    if (await exists(BOARD_FILE_PATH)) {
      const raw = await fs.readFile(BOARD_FILE_PATH, "utf8");
      return normalizeBoard(JSON.parse(raw));
    }
  } catch {
    // Fall back to bundled sample or a clean starter board.
  }

  try {
    const entries = await fs.readdir(SAMPLE_EXPORT_DIR, { withFileTypes: true });
    const sample = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
      .sort((left, right) => left.name.localeCompare(right.name))[0];

    if (sample) {
      const raw = await fs.readFile(path.join(SAMPLE_EXPORT_DIR, sample.name), "utf8");
      return normalizeBoard(JSON.parse(raw));
    }
  } catch {
    // Fall back to a clean starter board.
  }

  return normalizeBoard(defaultBoardSkeleton());
}

async function loadBoard() {
  await ensureBoardStorage();
  const board = await readSplitBoard();
  return normalizeBoard(board);
}

async function saveBoard(candidateBoard) {
  const board = normalizeBoard(candidateBoard);
  await writeSplitBoard(board);
  return board;
}

async function writeJsonIfChanged(filePath, value) {
  const next = `${JSON.stringify(value, null, 2)}\n`;
  try {
    const current = await fs.readFile(filePath, "utf8");
    if (current === next) return;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await writeTextAtomically(filePath, next);
}

async function writeTextAtomically(filePath, text) {
  const directory = path.dirname(filePath);
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(tmpPath, text, "utf8");
  await fs.rename(tmpPath, filePath);
}

async function readSplitBoard() {
  const meta = await readJsonFile(BOARD_META_FILE_PATH, {});
  return {
    ...meta,
    lists: await readJsonCollection("lists"),
    labels: await readJsonCollection("labels"),
    members: await readJsonCollection("members"),
    cards: await readJsonCollection("cards"),
    checklists: await readJsonCollection("checklists"),
    actions: await readJsonCollection("actions")
  };
}

async function writeSplitBoard(board) {
  await fs.mkdir(BOARD_DIR, { recursive: true });
  const {
    lists,
    labels,
    members,
    cards,
    checklists,
    actions,
    ...meta
  } = board;

  await writeJsonIfChanged(BOARD_META_FILE_PATH, meta);
  await writeJsonCollection("lists", lists || []);
  await writeJsonCollection("labels", labels || []);
  await writeJsonCollection("members", members || []);
  await writeJsonCollection("cards", cards || []);
  await writeJsonCollection("checklists", checklists || []);
  await writeJsonCollection("actions", actions || []);
}

async function readJsonCollection(name) {
  const directory = path.join(BOARD_DIR, name);
  let entries = [];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const items = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    items.push(await readJsonFile(path.join(directory, entry.name), null));
  }
  return items.filter(Boolean);
}

async function writeJsonCollection(name, items) {
  const directory = path.join(BOARD_DIR, name);
  await fs.mkdir(directory, { recursive: true });
  const desiredFiles = new Set();

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const id = nonEmptyString(item.id) || createHexId();
    item.id = id;
    const fileName = `${encodeURIComponent(id)}.json`;
    desiredFiles.add(fileName);
    await writeJsonIfChanged(path.join(directory, fileName), item);
  }

  let entries = [];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".json") && !desiredFiles.has(entry.name)) {
      await fs.unlink(path.join(directory, entry.name));
    }
  }
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

function normalizeBoard(candidate) {
  const seededDefaults = defaultBoardSkeleton();
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const board = { ...seededDefaults, ...source };
  const boardId = nonEmptyString(board.id) || seededDefaults.id;
  const baseShortLink = nonEmptyString(source.shortLink) || boardId.slice(-8);
  const now = newestTimestamp([source.dateLastActivity]);

  const lists = normalizeLists(source.lists, boardId);
  const labels = normalizeLabels(source.labels, boardId);
  const members = normalizeMembers(source.members);
  const checklists = normalizeChecklists(source.checklists, boardId);
  const cards = normalizeCards(source.cards, boardId, lists, checklists);
  const actions = normalizeActions(source.actions, boardId, cards, lists, members);
  const badgeMap = buildBadgeMap(cards, checklists, actions);

  const normalizedCards = cards
    .map((card, index) => ({
      ...card,
      idShort: Number.isFinite(card.idShort) ? card.idShort : index + 1,
      badges: badgeMap.get(card.id)
    }))
    .sort((left, right) => left.pos - right.pos);
  lists.sort((left, right) => left.pos - right.pos);

  return {
    ...board,
    id: boardId,
    nodeId: nonEmptyString(source.nodeId) || `kanbanqube:board:${boardId}`,
    name: nonEmptyString(board.name) || "KanbanQube Board",
    desc: stringOrDefault(board.desc, ""),
    descData: board.descData ?? null,
    closed: Boolean(board.closed),
    creationMethod: board.creationMethod ?? null,
    creationMethodError: board.creationMethodError ?? null,
    creationMethodLoadingStartedAt: board.creationMethodLoadingStartedAt ?? null,
    creationMethodLoadingPhase: board.creationMethodLoadingPhase ?? null,
    dateClosed: board.dateClosed ?? null,
    dateLastActivity: source.dateLastActivity || now,
    dateLastView: source.dateLastView || now,
    datePluginDisable: source.datePluginDisable ?? null,
    enterpriseOwned: Boolean(source.enterpriseOwned),
    idBoardSource: source.idBoardSource ?? null,
    idEnterprise: source.idEnterprise ?? null,
    idMemberCreator: source.idMemberCreator ?? (members[0]?.id || null),
    idOrganization: source.idOrganization ?? null,
    idTags: Array.isArray(source.idTags) ? source.idTags : [],
    ixUpdate: Number.isFinite(source.ixUpdate) ? source.ixUpdate : Date.now(),
    labelNames: source.labelNames ?? buildLabelNames(labels),
    labels,
    limits: source.limits ?? {},
    lists,
    members,
    memberships: Array.isArray(source.memberships) ? source.memberships : [],
    cards: normalizedCards,
    actions,
    checklists,
    customFields: Array.isArray(source.customFields) ? source.customFields : [],
    pinned: Boolean(source.pinned),
    pluginData: Array.isArray(source.pluginData) ? source.pluginData : [],
    powerUps: Array.isArray(source.powerUps) ? source.powerUps : [],
    prefs: normalizePrefs(source.prefs),
    premiumFeatures: Array.isArray(source.premiumFeatures) ? source.premiumFeatures : [],
    shortLink: baseShortLink,
    shortUrl: nonEmptyString(source.shortUrl) || `https://kanbanqube.local/b/${baseShortLink}`,
    starred: Boolean(source.starred),
    subscribed: Boolean(source.subscribed),
    templateGallery: source.templateGallery ?? null,
    type: source.type ?? "board",
    url: nonEmptyString(source.url) || `https://kanbanqube.local/b/${baseShortLink}`,
    kanbanQubeMeta: {
      ...(source.kanbanQubeMeta && typeof source.kanbanQubeMeta === "object" ? source.kanbanQubeMeta : {}),
      version: 1,
      savedAt: source.kanbanQubeMeta?.savedAt || source.dateLastActivity || now,
      boardFile: BOARD_FILE_NAME
    }
  };
}

function normalizeLists(candidateLists, boardId) {
  const defaults = defaultBoardSkeleton().lists;
  const source = Array.isArray(candidateLists) && candidateLists.length > 0 ? candidateLists : defaults;
  return source.map((list, index) => ({
    ...list,
    id: nonEmptyString(list.id) || createHexId(),
    name: nonEmptyString(list.name) || `Lane ${index + 1}`,
    closed: Boolean(list.closed),
    color: list.color ?? null,
    idBoard: nonEmptyString(list.idBoard) || boardId,
    pos: normalizePos(list.pos, index)
  }));
}

function normalizeCards(candidateCards, boardId, lists, checklists) {
  const listIds = new Set(lists.map((list) => list.id));
  const checklistIds = new Set(checklists.map((checklist) => checklist.id));
  return (Array.isArray(candidateCards) ? candidateCards : []).map((card, index) => {
    const cardId = nonEmptyString(card.id) || createHexId();
    const targetListId = listIds.has(card.idList) ? card.idList : lists[0]?.id || null;
    const shortLink = nonEmptyString(card.shortLink) || cardId.slice(-8);
    const attachments = Array.isArray(card.attachments) ? card.attachments : [];
    return {
      ...card,
      id: cardId,
      idBoard: nonEmptyString(card.idBoard) || boardId,
      idList: targetListId,
      name: stringOrDefault(card.name, ""),
      desc: stringOrDefault(card.desc, ""),
      closed: Boolean(card.closed),
      pos: normalizePos(card.pos, index),
      idLabels: Array.isArray(card.idLabels) ? card.idLabels.filter(Boolean) : [],
      idMembers: Array.isArray(card.idMembers) ? card.idMembers.filter(Boolean) : [],
      idChecklists: Array.isArray(card.idChecklists)
        ? card.idChecklists.filter((checklistId) => checklistIds.has(checklistId))
        : [],
      attachments,
      cover: normalizeCover(card.cover),
      due: card.due ?? null,
      dueComplete: Boolean(card.dueComplete),
      start: card.start ?? null,
      subscribed: Boolean(card.subscribed),
      shortLink,
      shortUrl: nonEmptyString(card.shortUrl) || `https://kanbanqube.local/c/${shortLink}`,
      url: nonEmptyString(card.url) || `https://kanbanqube.local/c/${shortLink}`,
      dateLastActivity: newestTimestamp([
        card.dateLastActivity,
        ...collectDates(card.actions)
      ]),
      labels: Array.isArray(card.labels) ? card.labels : []
    };
  });
}

function normalizeChecklists(candidateChecklists, boardId) {
  return (Array.isArray(candidateChecklists) ? candidateChecklists : []).map((checklist, checklistIndex) => ({
    ...checklist,
    id: nonEmptyString(checklist.id) || createHexId(),
    idBoard: nonEmptyString(checklist.idBoard) || boardId,
    idCard: nonEmptyString(checklist.idCard) || null,
    name: nonEmptyString(checklist.name) || `Checklist ${checklistIndex + 1}`,
    checkItems: (Array.isArray(checklist.checkItems) ? checklist.checkItems : []).map((item, itemIndex) => ({
      ...item,
      id: nonEmptyString(item.id) || createHexId(),
      name: nonEmptyString(item.name) || `Item ${itemIndex + 1}`,
      pos: normalizePos(item.pos, itemIndex),
      state: item.state === "complete" ? "complete" : "incomplete",
      due: item.due ?? null,
      dueReminder: Number.isFinite(item.dueReminder) ? item.dueReminder : -1,
      idMember: item.idMember ?? null,
      idChecklist: nonEmptyString(item.idChecklist) || nonEmptyString(checklist.id) || null,
      nameData: item.nameData ?? { emoji: {} }
    }))
  }));
}

function normalizeLabels(candidateLabels, boardId) {
  return (Array.isArray(candidateLabels) ? candidateLabels : []).map((label) => ({
    ...label,
    id: nonEmptyString(label.id) || createHexId(),
    idBoard: nonEmptyString(label.idBoard) || boardId,
    name: stringOrDefault(label.name, ""),
    color: nonEmptyString(label.color) || "blue",
    uses: Number.isFinite(label.uses) ? label.uses : 0
  }));
}

function normalizeMembers(candidateMembers) {
  return (Array.isArray(candidateMembers) ? candidateMembers : []).map((member) => ({
    ...member,
    id: nonEmptyString(member.id) || createHexId(),
    fullName: nonEmptyString(member.fullName) || nonEmptyString(member.username) || "Unknown User",
    username: nonEmptyString(member.username) || slugify(nonEmptyString(member.fullName) || "user"),
    initials: nonEmptyString(member.initials) || initialsFor(member.fullName || member.username || "U"),
    nonPublic: member.nonPublic ?? {
      fullName: nonEmptyString(member.fullName) || nonEmptyString(member.username) || "Unknown User",
      initials: nonEmptyString(member.initials) || initialsFor(member.fullName || member.username || "U")
    }
  }));
}

function normalizeActions(candidateActions, boardId, cards, lists, members) {
  const cardMap = new Map(cards.map((card) => [card.id, card]));
  const listMap = new Map(lists.map((list) => [list.id, list]));
  const memberMap = new Map(members.map((member) => [member.id, member]));

  return (Array.isArray(candidateActions) ? candidateActions : []).map((action) => {
    const cardId = action?.data?.idCard || action?.data?.card?.id || null;
    const listId = action?.data?.list?.id || action?.data?.listAfter?.id || action?.data?.listBefore?.id || null;
    return {
      ...action,
      id: nonEmptyString(action.id) || createHexId(),
      idMemberCreator: action.idMemberCreator ?? action.memberCreator?.id ?? null,
      type: nonEmptyString(action.type) || "updateCard",
      date: newestTimestamp([action.date]),
      data: normalizeActionData(action.data, boardId, cardId ? cardMap.get(cardId) : null, listId ? listMap.get(listId) : null),
      memberCreator: action.memberCreator?.id && memberMap.has(action.memberCreator.id)
        ? memberMap.get(action.memberCreator.id)
        : action.memberCreator ?? null
    };
  }).sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
}

function normalizeActionData(data, boardId, card, list) {
  const source = data && typeof data === "object" ? data : {};
  return {
    ...source,
    board: source.board ?? {
      id: boardId
    },
    card: source.card ?? (card ? {
      id: card.id,
      name: card.name,
      idShort: card.idShort ?? null,
      shortLink: card.shortLink
    } : undefined),
    list: source.list ?? (list ? {
      id: list.id,
      name: list.name
    } : undefined)
  };
}

function normalizeCover(cover) {
  return {
    idAttachment: cover?.idAttachment ?? null,
    color: cover?.color ?? null,
    idUploadedBackground: cover?.idUploadedBackground ?? null,
    size: cover?.size ?? "normal",
    brightness: cover?.brightness ?? "dark",
    yPosition: Number.isFinite(cover?.yPosition) ? cover.yPosition : 0.5,
    idPlugin: cover?.idPlugin ?? null
  };
}

function normalizePrefs(prefs) {
  return {
    background: prefs?.background ?? "blue",
    backgroundColor: prefs?.backgroundColor ?? "#123c84",
    backgroundDarkColor: prefs?.backgroundDarkColor ?? "#0a214a",
    backgroundTopColor: prefs?.backgroundTopColor ?? "#174a98",
    backgroundBottomColor: prefs?.backgroundBottomColor ?? "#0a214a",
    canBePublic: prefs?.canBePublic ?? true,
    canBeEnterprise: prefs?.canBeEnterprise ?? true,
    canBeOrg: prefs?.canBeOrg ?? true,
    canInvite: prefs?.canInvite ?? true,
    cardAging: prefs?.cardAging ?? "regular",
    comments: prefs?.comments ?? "members",
    hideVotes: Boolean(prefs?.hideVotes),
    invitations: prefs?.invitations ?? "members",
    permissionLevel: prefs?.permissionLevel ?? "private",
    selfJoin: Boolean(prefs?.selfJoin),
    voting: prefs?.voting ?? "disabled"
  };
}

function buildBadgeMap(cards, checklists, actions) {
  const checklistsByCard = new Map();
  for (const checklist of checklists) {
    if (!checklist.idCard) continue;
    const current = checklistsByCard.get(checklist.idCard) || [];
    current.push(checklist);
    checklistsByCard.set(checklist.idCard, current);
  }

  const commentsByCard = new Map();
  for (const action of actions) {
    const cardId = action?.data?.idCard || action?.data?.card?.id;
    if (!cardId) continue;
    if (action.type === "commentCard") {
      commentsByCard.set(cardId, (commentsByCard.get(cardId) || 0) + 1);
    }
  }

  const badgeMap = new Map();
  for (const card of cards) {
    const cardChecklists = checklistsByCard.get(card.id) || [];
    const checklistItems = cardChecklists.flatMap((checklist) => checklist.checkItems);
    const checkedItems = checklistItems.filter((item) => item.state === "complete");

    badgeMap.set(card.id, {
      attachments: Array.isArray(card.attachments) ? card.attachments.length : 0,
      attachmentsByType: {
        trello: {
          board: 0,
          card: Array.isArray(card.attachments) ? card.attachments.length : 0
        }
      },
      checkItems: checklistItems.length,
      checkItemsChecked: checkedItems.length,
      checkItemsEarliestDue: null,
      comments: commentsByCard.get(card.id) || 0,
      description: Boolean(card.desc?.trim()),
      due: card.due ?? null,
      dueComplete: Boolean(card.dueComplete),
      externalSource: null,
      fogbugz: "",
      lastUpdatedByAi: false,
      location: false,
      maliciousAttachments: 0,
      start: card.start ?? null,
      subscribed: Boolean(card.subscribed),
      viewingMemberVoted: false,
      votes: 0
    });
  }
  return badgeMap;
}

function buildLabelNames(labels) {
  const labelNames = {
    green: "",
    yellow: "",
    orange: "",
    red: "",
    purple: "",
    blue: "",
    sky: "",
    lime: "",
    pink: "",
    black: "",
    green_dark: "",
    yellow_dark: "",
    orange_dark: "",
    red_dark: "",
    purple_dark: "",
    blue_dark: "",
    sky_dark: "",
    lime_dark: "",
    pink_dark: "",
    black_dark: ""
  };

  for (const label of labels) {
    if (label.color in labelNames && label.name && !labelNames[label.color]) {
      labelNames[label.color] = label.name;
    }
  }

  return labelNames;
}

function defaultBoardSkeleton() {
  const boardId = createHexId();
  const names = ["Backlog", "To Do", "In Progress", "In Review", "Done"];
  const lists = names.map((name, index) => ({
    id: createHexId(),
    idBoard: boardId,
    name,
    closed: false,
    pos: (index + 1) * 16384
  }));

  return {
    id: boardId,
    nodeId: `kanbanqube:board:${boardId}`,
    name: "KanbanQube Board",
    desc: "",
    descData: null,
    closed: false,
    creationMethod: null,
    creationMethodError: null,
    creationMethodLoadingStartedAt: null,
    creationMethodLoadingPhase: null,
    dateClosed: null,
    dateLastActivity: new Date().toISOString(),
    enterpriseOwned: false,
    idBoardSource: null,
    idEnterprise: null,
    idMemberCreator: null,
    idOrganization: null,
    idTags: [],
    ixUpdate: Date.now(),
    labelNames: {},
    labels: [],
    limits: {},
    lists,
    members: [],
    memberships: [],
    cards: [],
    actions: [],
    checklists: [],
    customFields: [],
    pinned: false,
    pluginData: [],
    powerUps: [],
    prefs: normalizePrefs({}),
    premiumFeatures: [],
    shortLink: boardId.slice(-8),
    shortUrl: `https://kanbanqube.local/b/${boardId.slice(-8)}`,
    starred: false,
    subscribed: false,
    templateGallery: null,
    type: "board",
    url: `https://kanbanqube.local/b/${boardId.slice(-8)}`
  };
}

async function syncBoardRepository() {
  syncStatus.running = true;
  syncStatus.startedAt = new Date().toISOString();
  syncStatus.finishedAt = "";
  syncStatus.ok = null;
  syncStatus.output = "Syncing with git…";

  if (!(await hasGitRepository(WORKSPACE_DIR))) {
    const result = {
      ok: false,
      output: `This folder does not contain a .git directory.\nWorkspace: ${WORKSPACE_DIR}`,
      startedAt: syncStatus.startedAt,
      finishedAt: new Date().toISOString()
    };
    Object.assign(syncStatus, { running: false, ok: false, output: result.output, finishedAt: result.finishedAt });
    return result;
  }

  const remote = await gitRemoteOrigin(WORKSPACE_DIR);
  const output = [];
  const updateOutput = () => {
    syncStatus.output = output.join("\n\n") || "Syncing with git…";
  };
  const startCommand = (label) => {
    output.push(`${label}\n\nRunning…`);
    updateOutput();
    return output.length - 1;
  };
  const finishCommand = (index, text) => {
    output[index] = text;
    updateOutput();
  };
  await checkSshAuth(WORKSPACE_DIR, remote, output);
  updateOutput();

  let commandIndex = startCommand("git status --porcelain");
  const status = await runGit(WORKSPACE_DIR, ["status", "--porcelain"]);
  finishCommand(commandIndex, formatGitCommandOutput("git status --porcelain", status, status.stdout.trim() ? "" : "Repository is clean."));
  if (status.code !== 0) {
    const result = { ok: false, output: output.join("\n\n"), startedAt: syncStatus.startedAt, finishedAt: new Date().toISOString() };
    Object.assign(syncStatus, { running: false, ok: false, output: result.output, finishedAt: result.finishedAt });
    return result;
  }

  if (status.stdout.trim()) {
    commandIndex = startCommand("git add --all");
    const add = await runGit(WORKSPACE_DIR, ["add", "--all"]);
    finishCommand(commandIndex, formatGitCommandOutput("git add --all", add));
    if (add.code !== 0) {
      const result = { ok: false, output: output.join("\n\n"), startedAt: syncStatus.startedAt, finishedAt: new Date().toISOString() };
      Object.assign(syncStatus, { running: false, ok: false, output: result.output, finishedAt: result.finishedAt });
      return result;
    }

    commandIndex = startCommand("git commit -m \"Update KanbanQube vault\"");
    const commit = await runGit(WORKSPACE_DIR, ["commit", "-m", "Update KanbanQube vault"]);
    finishCommand(commandIndex, formatGitCommandOutput("git commit -m \"Update KanbanQube vault\"", commit));
    if (commit.code !== 0) {
      const result = { ok: false, output: output.join("\n\n"), startedAt: syncStatus.startedAt, finishedAt: new Date().toISOString() };
      Object.assign(syncStatus, { running: false, ok: false, output: result.output, finishedAt: result.finishedAt });
      return result;
    }
  }

  commandIndex = startCommand("git pull --rebase");
  const pull = await runGit(WORKSPACE_DIR, ["pull", "--rebase"]);
  finishCommand(commandIndex, formatGitCommandOutput("git pull --rebase", pull));
  if (pull.code !== 0) {
    const result = { ok: false, output: output.join("\n\n"), startedAt: syncStatus.startedAt, finishedAt: new Date().toISOString() };
    Object.assign(syncStatus, { running: false, ok: false, output: result.output, finishedAt: result.finishedAt });
    return result;
  }

  commandIndex = startCommand("git push");
  const push = await runGit(WORKSPACE_DIR, ["push"]);
  finishCommand(commandIndex, formatGitCommandOutput("git push", push));
  const result = {
    ok: push.code === 0,
    output: output.join("\n\n"),
    startedAt: syncStatus.startedAt,
    finishedAt: new Date().toISOString()
  };
  Object.assign(syncStatus, { running: false, ok: result.ok, output: result.output, finishedAt: result.finishedAt });
  return result;
}

function resolveWorkspaceDirectory(argument) {
  if (typeof argument === "string" && argument.trim()) {
    return path.resolve(argument);
  }
  return process.cwd();
}

async function hasGitRepository(rootPath) {
  try {
    const stat = await fs.stat(path.join(rootPath, ".git"));
    return stat.isDirectory() || stat.isFile();
  } catch {
    return false;
  }
}

async function gitRemoteOrigin(rootPath) {
  const result = await runGit(rootPath, ["remote", "get-url", "origin"]);
  return result.code === 0 ? result.stdout.trim() : null;
}

async function gitUserName(rootPath) {
  const hasRepo = await hasGitRepository(rootPath);
  if (hasRepo) {
    const localResult = await runGit(rootPath, ["config", "--local", "--get", "user.name"]);
    const localName = localResult.code === 0 ? localResult.stdout.trim() : "";
    if (localName) return localName;
  }

  const globalResult = await runGit(rootPath, ["config", "--global", "--get", "user.name"]);
  const globalName = globalResult.code === 0 ? globalResult.stdout.trim() : "";
  return globalName || null;
}

async function gitUserEmail(rootPath) {
  const hasRepo = await hasGitRepository(rootPath);
  if (hasRepo) {
    const localResult = await runGit(rootPath, ["config", "--local", "--get", "user.email"]);
    const localEmail = localResult.code === 0 ? localResult.stdout.trim() : "";
    if (localEmail) return localEmail;
  }

  const globalResult = await runGit(rootPath, ["config", "--global", "--get", "user.email"]);
  const globalEmail = globalResult.code === 0 ? globalResult.stdout.trim() : "";
  return globalEmail || null;
}

async function checkSshAuth(rootPath, remoteUrl, output) {
  if (!remoteUrl || remoteUrl.startsWith("http://") || remoteUrl.startsWith("https://")) return;
  const hostMatch = remoteUrl.match(/[@/]([a-zA-Z0-9._-]+)[:/]/);
  if (!hostMatch) return;

  const host = hostMatch[1];
  const sshExecutable = await resolveSshExecutable();
  await new Promise((resolve) => {
    execFile(
      sshExecutable,
      ["-T", `git@${host}`, "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "-o", "StrictHostKeyChecking=accept-new"],
      { env: { SSH_AUTH_SOCK: process.env.SSH_AUTH_SOCK || "" } },
      (error, _stdout, stderr) => {
        const text = (stderr || "").toLowerCase();
        const authenticated = !error || text.includes("successfully authenticated") || text.includes("welcome to");
        if (!authenticated) {
          output.push(`Warning: SSH authentication to ${host} failed.\n${stderr.trim()}`.trim());
        }
        resolve();
      }
    );
  });
}

async function runGit(rootPath, args) {
  const gitExecutable = await resolveGitExecutable();
  return new Promise((resolve) => {
    const child = spawn(gitExecutable, args, {
      cwd: rootPath,
      env: {
        HOME: process.env.HOME || "",
        LANG: process.env.LANG || "en_US.UTF-8",
        LC_ALL: process.env.LC_ALL || "",
        SSH_AUTH_SOCK: process.env.SSH_AUTH_SOCK || "",
        GIT_TERMINAL_PROMPT: "0",
        PATH: gitSafePath
      }
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 120000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({
        code: 1,
        signal: null,
        stdout,
        stderr,
        error: error.message
      });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      resolve({
        code: timedOut ? 1 : (code || 0),
        signal: timedOut ? "timeout" : signal,
        stdout,
        stderr,
        error: timedOut ? "Command timed out." : ""
      });
    });
  });
}

async function resolveGitExecutable() {
  for (const candidate of gitExecutableCandidates) {
    if (await isSafeExecutable(candidate)) return candidate;
  }
  throw new Error("Git executable was not found in a trusted system location.");
}

async function resolveSshExecutable() {
  for (const candidate of sshExecutableCandidates) {
    if (await isSafeExecutable(candidate)) return candidate;
  }
  throw new Error("SSH executable was not found in a trusted system location.");
}

async function isSafeExecutable(candidate) {
  try {
    const stat = await fs.stat(candidate);
    if (!stat.isFile()) return false;
    await fs.access(candidate, fsSync.constants.X_OK);
    const parent = await fs.stat(path.dirname(candidate));
    return (parent.mode & 0o002) === 0;
  } catch {
    return false;
  }
}

function formatGitCommandOutput(command, result, emptyOutput = "") {
  const status = result.code === 0 ? "OK" : `FAILED (${result.signal || result.code})`;
  const parts = [`$ ${command}`, status];
  if (result.stdout.trim()) parts.push("", result.stdout.trim());
  else if (emptyOutput) parts.push("", emptyOutput);
  if (result.stderr.trim()) parts.push("", result.stderr.trim());
  if (result.error && result.code !== 0 && !result.stderr.trim()) parts.push("", result.error);
  return parts.join("\n");
}

function collectDates(actions) {
  if (!Array.isArray(actions)) return [];
  return actions.map((action) => action?.date).filter(Boolean);
}

function newestTimestamp(values) {
  const dates = values
    .map((value) => {
      const timestamp = new Date(value || 0).getTime();
      return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
    })
    .filter((value) => value !== null);

  return new Date((dates.length ? Math.max(...dates) : Date.now())).toISOString();
}

function normalizePos(value, index) {
  if (Number.isFinite(value)) return value;
  return (index + 1) * 16384;
}

function stringOrDefault(value, fallback) {
  return typeof value === "string" ? value : fallback;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function initialsFor(name) {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "U";
}

function slugify(value) {
  let result = "";
  let previousWasDash = true;
  for (const character of String(value).toLowerCase()) {
    const isAlphaNumeric = (character >= "a" && character <= "z") || (character >= "0" && character <= "9");
    if (isAlphaNumeric) {
      result += character;
      previousWasDash = false;
    } else if (!previousWasDash) {
      result += "-";
      previousWasDash = true;
    }
  }
  const trimmed = previousWasDash ? result.slice(0, -1) : result;
  return trimmed || "user";
}

function createHexId() {
  return crypto.randomBytes(12).toString("hex");
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
