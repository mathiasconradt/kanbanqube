"use strict";

const express = require("express");
const { createBoardController } = require("../controllers/boardController");
const { createConfigController } = require("../controllers/configController");
const { createImportController } = require("../controllers/importController");
const { createSyncController } = require("../controllers/syncController");
const { createUploadController } = require("../controllers/uploadController");
const { asyncHandler } = require("../middleware/asyncHandler");

function createApiRoutes(services) {
  const router = express.Router();
  const boardController = createBoardController(services.boardService);
  const configController = createConfigController(services.config, services.gitSyncService.gitService);
  const importController = createImportController(services.boardService, services.importService);
  const syncController = createSyncController(services.gitSyncService);
  const uploadController = createUploadController(services.uploadService);

  router.get("/board", asyncHandler(boardController.getBoard));
  router.put("/board", asyncHandler(boardController.saveBoard));
  router.get("/config", asyncHandler(configController.getConfig));
  router.post("/uploads", asyncHandler(uploadController.uploadFiles));
  router.delete("/uploads/:fileName", asyncHandler(uploadController.deleteUpload));
  router.post("/import", asyncHandler(importController.importBoard));
  router.post("/demo-board", asyncHandler(importController.importDemoBoard));
  router.post("/sync", asyncHandler(syncController.syncBoard));
  router.get("/sync-status", syncController.syncStatus);

  return router;
}

module.exports = {
  createApiRoutes
};
