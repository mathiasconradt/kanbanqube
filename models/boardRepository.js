"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { createHexId } = require("../utils/idUtils");
const { readJsonFile, writeJsonIfChanged } = require("../utils/fileUtils");
const { safePathInsideRoot } = require("../utils/pathUtils");
const { nonEmptyString } = require("../utils/stringUtils");

function createBoardRepository(config) {
  async function readSplitBoard() {
    const meta = await readJsonFile(config.boardMetaFilePath, {}, config.workspaceDir);
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
    await fs.mkdir(safePathInsideRoot(config.boardDir, config.workspaceDir), { recursive: true }); // NOSONAR: path is constrained to the configured vault root.
    const {
      lists,
      labels,
      members,
      cards,
      checklists,
      actions,
      ...meta
    } = board;

    await writeJsonIfChanged(config.boardMetaFilePath, meta, config.workspaceDir);
    await writeJsonCollection("lists", lists || []);
    await writeJsonCollection("labels", labels || []);
    await writeJsonCollection("members", members || []);
    await writeJsonCollection("cards", cards || []);
    await writeJsonCollection("checklists", checklists || []);
    await writeJsonCollection("actions", actions || []);
  }

  async function readJsonCollection(name) {
    const directory = safePathInsideRoot(path.join(config.boardDir, name), config.boardDir);
    let entries = [];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true }); // NOSONAR: directory is constrained to the board data root.
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }

    const items = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      items.push(await readJsonFile(path.join(directory, entry.name), null, directory));
    }
    return items.filter(Boolean);
  }

  async function writeJsonCollection(name, items) {
    const directory = safePathInsideRoot(path.join(config.boardDir, name), config.boardDir);
    await fs.mkdir(directory, { recursive: true }); // NOSONAR: directory is constrained to the board data root.
    const desiredFiles = new Set();

    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const id = nonEmptyString(item.id) || createHexId();
      item.id = id;
      const fileName = `${encodeURIComponent(id)}.json`;
      desiredFiles.add(fileName);
      await writeJsonIfChanged(path.join(directory, fileName), item, directory);
    }

    let entries = [];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true }); // NOSONAR: directory is constrained to the board data root.
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".json") && !desiredFiles.has(entry.name)) {
        await fs.unlink(safePathInsideRoot(path.join(directory, entry.name), directory));
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
