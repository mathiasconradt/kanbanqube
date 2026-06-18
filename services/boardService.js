"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { exists } = require("../utils/fileUtils");
const { safePathInsideRoot } = require("../utils/pathUtils");
const { createBoardNormalizer } = require("./boardNormalizer");
const { createBoardRepository } = require("../models/boardRepository");

function createBoardService(config) {
  const normalizer = createBoardNormalizer({ boardFileName: config.boardFileName });
  const repository = createBoardRepository(config);

  async function ensureBoardStorage() {
    if (await exists(config.boardMetaFilePath, config.workspaceDir)) return;
    const board = await seedBoard();
    await repository.writeSplitBoard(board);
  }

  async function seedBoard() {
    try {
      if (await exists(config.boardFilePath, config.workspaceDir)) {
        const raw = await fs.readFile(safePathInsideRoot(config.boardFilePath, config.workspaceDir), "utf8"); // NOSONAR: board file is constrained to the vault root.
        return normalizer.normalizeBoard(JSON.parse(raw));
      }
    } catch {
      // Fall back to bundled sample or a clean starter board.
    }

    try {
      const sampleExportDir = safePathInsideRoot(config.sampleExportDir, config.workspaceDir);
      const entries = await fs.readdir(sampleExportDir, { withFileTypes: true }); // NOSONAR: sample directory is constrained to the vault root.
      const sample = entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
        .sort((left, right) => left.name.localeCompare(right.name))[0];

      if (sample) {
        const samplePath = safePathInsideRoot(path.join(sampleExportDir, sample.name), sampleExportDir);
        const raw = await fs.readFile(samplePath, "utf8"); // NOSONAR: sample file is constrained to the sample export directory.
        return normalizer.normalizeBoard(JSON.parse(raw));
      }
    } catch {
      // Fall back to a clean starter board.
    }

    return normalizer.normalizeBoard(normalizer.defaultBoardSkeleton());
  }

  async function loadBoard() {
    await ensureBoardStorage();
    const board = await repository.readSplitBoard();
    return normalizer.normalizeBoard(board);
  }

  async function saveBoard(candidateBoard) {
    const board = normalizer.normalizeBoard(candidateBoard);
    await repository.writeSplitBoard(board);
    return board;
  }

  return {
    ensureBoardStorage,
    loadBoard,
    saveBoard
  };
}

module.exports = {
  createBoardService
};
