"use strict";

const express = require("express");
const path = require("node:path");
const mimeTypes = require("./config/mimeTypes");
const { errorHandler } = require("./middleware/errorHandler");
const { notFound } = require("./middleware/notFound");
const { createApiRoutes } = require("./routes/apiRoutes");
const { createBoardService } = require("./services/boardService");
const { createGitSyncService } = require("./services/gitSyncService");
const { createImportService } = require("./services/importService");
const { createUploadService } = require("./services/uploadService");

function createApp(config) {
  const app = express();
  const boardService = createBoardService(config);
  const gitSyncService = createGitSyncService(config);
  const importService = createImportService(config);
  const uploadService = createUploadService(config, boardService);

  app.disable("x-powered-by");
  app.use(express.json({ limit: "5mb", type: "application/json" }));
  app.use(noStore);

  app.use("/api", createApiRoutes({
    config,
    boardService,
    gitSyncService,
    importService,
    uploadService
  }));

  app.get(`/${config.demoBoardFileName}`, (_request, response) => {
    response.type("json").sendFile(config.demoBoardFilePath);
  });
  app.get(`/${config.uploadsDirName}/:fileName`, (request, response, next) => {
    let fileName = "";
    try {
      fileName = uploadService.safeUploadFileName(request.params.fileName);
    } catch (error) {
      error.statusCode = 400;
      next(error);
      return;
    }
    const filePath = path.join(config.uploadsDir, fileName);
    response.type(mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream");
    response.sendFile(filePath, (error) => {
      if (error) next(error);
    });
  });
  app.use(express.static(config.publicDir, {
    etag: false,
    lastModified: false,
    setHeaders: noStoreHeaders
  }));
  app.use(notFound);
  app.use(errorHandler);

  return {
    app,
    services: {
      boardService,
      gitSyncService,
      importService,
      uploadService
    }
  };
}

function noStore(_request, response, next) {
  noStoreHeaders(response);
  next();
}

function noStoreHeaders(response) {
  response.setHeader("Cache-Control", "no-store");
}

module.exports = {
  createApp
};
