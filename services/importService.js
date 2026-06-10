"use strict";

const fs = require("node:fs/promises");
const { multipartBoundary, parseMultipartBody } = require("../utils/multipart");
const { readBody } = require("../utils/requestBody");

function createImportService(config = {}) {
  return {
    readImportedBoard,
    readDemoBoard: () => readDemoBoard(config)
  };
}

async function readImportedBoard(request) {
  const contentType = request.headers["content-type"] || "";
  if (contentType.includes("multipart/form-data")) {
    const boundary = multipartBoundary(contentType);
    if (!boundary) throw new Error("Import request must include a file.");
    const body = await readBody(request, 50 * 1024 * 1024);
    const filePart = parseMultipartBody(body, boundary).find((part) => part.filename && part.data.length > 0);
    if (!filePart) throw new Error("Import request must include a JSON file.");
    return JSON.parse(filePart.data.toString("utf8"));
  }

  return request.body && typeof request.body === "object" ? request.body : {};
}

async function readDemoBoard(config) {
  if (!config.demoBoardFilePath) {
    throw new Error("Demo board is not available.");
  }
  return JSON.parse(await fs.readFile(config.demoBoardFilePath, "utf8"));
}

module.exports = {
  createImportService,
  readImportedBoard,
  readDemoBoard
};
