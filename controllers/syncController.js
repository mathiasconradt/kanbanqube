"use strict";

const { getSyncStatus } = require("../models/syncStatusStore");

function createSyncController(gitSyncService) {
  return {
    syncStatus,
    syncBoard: (request, response) => syncBoard(request, response, gitSyncService)
  };
}

function syncStatus(_request, response) {
  response.json(getSyncStatus());
}

async function syncBoard(_request, response, gitSyncService) {
  const status = getSyncStatus();
  if (status.running) {
    response.status(409).json({
      ok: false,
      output: status.output || "A git sync is already in progress.",
      startedAt: status.startedAt,
      finishedAt: status.finishedAt
    });
    return;
  }

  const result = await gitSyncService.syncBoardRepository();
  response.status(result.ok ? 200 : 500).json(result);
}

module.exports = {
  createSyncController,
  syncStatus
};
