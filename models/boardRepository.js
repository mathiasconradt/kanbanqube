"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { createHexId } = require("../utils/idUtils");
const { readJsonFile, writeJsonIfChanged } = require("../utils/fileUtils");
const { nonEmptyString } = require("../utils/stringUtils");

function createBoardRepository(config) {
  async function readSplitBoard() {
    const meta = await readJsonFile(config.boardMetaFilePath, {});
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
    await fs.mkdir(config.boardDir, { recursive: true });
    const {
      lists,
      labels,
      members,
      cards,
      checklists,
      actions,
      ...meta
    } = board;

    await writeJsonIfChanged(config.boardMetaFilePath, meta);
    await writeJsonCollection("lists", lists || []);
    await writeJsonCollection("labels", labels || []);
    await writeJsonCollection("members", members || []);
    await writeJsonCollection("cards", cards || []);
    await writeJsonCollection("checklists", checklists || []);
    await writeJsonCollection("actions", actions || []);
  }

  async function readJsonCollection(name) {
    const directory = path.join(config.boardDir, name);
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
    const directory = path.join(config.boardDir, name);
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

  return {
    readSplitBoard,
    writeSplitBoard
  };
}

module.exports = {
  createBoardRepository
};
