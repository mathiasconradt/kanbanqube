"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
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

module.exports = {
  exists,
  readJsonFile,
  writeJsonIfChanged,
  writeTextAtomically
};
