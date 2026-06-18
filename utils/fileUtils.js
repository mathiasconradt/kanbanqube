"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { safePathInsideRoot } = require("./pathUtils");

async function exists(filePath, rootPath) {
  try {
    await fs.access(safePathInsideRoot(filePath, rootPath));
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile(filePath, fallback, rootPath) {
  try {
    return JSON.parse(await fs.readFile(safePathInsideRoot(filePath, rootPath), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJsonIfChanged(filePath, value, rootPath) {
  const safePath = safePathInsideRoot(filePath, rootPath);
  const next = `${JSON.stringify(value, null, 2)}\n`;
  try {
    const current = await fs.readFile(safePath, "utf8");
    if (current === next) return;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await writeTextAtomically(safePath, next, rootPath);
}

async function writeTextAtomically(filePath, text, rootPath) {
  const safePath = safePathInsideRoot(filePath, rootPath);
  const directory = path.dirname(safePath);
  const tmpPath = safePathInsideRoot(`${safePath}.${process.pid}.${Date.now()}.tmp`, rootPath);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(tmpPath, text, "utf8");
  await fs.rename(tmpPath, safePath);
}

module.exports = {
  exists,
  readJsonFile,
  writeJsonIfChanged,
  writeTextAtomically
};
