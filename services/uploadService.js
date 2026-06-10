"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const mimeTypes = require("../config/mimeTypes");
const { createHexId } = require("../utils/idUtils");
const { createStoredFileName, displayOriginalFileName } = require("../utils/fileNameUtils");
const { multipartBoundary, parseMultipartBody } = require("../utils/multipart");
const { readBody } = require("../utils/requestBody");
const { nonEmptyString } = require("../utils/stringUtils");

function createUploadService(config, boardService) {
  async function saveUploadedFiles(request) {
    const boundary = multipartBoundary(request.headers["content-type"]);
    if (!boundary) {
      throw new Error("Upload request must use multipart/form-data.");
    }

    const body = await readBody(request);
    const parts = parseMultipartBody(body, boundary);
    await fs.mkdir(config.uploadsDir, { recursive: true });

    const files = [];
    for (const part of parts) {
      if (!part.filename || part.data.length === 0) continue;
      const originalName = displayOriginalFileName(part.filename);
      const storedName = createStoredFileName(originalName);
      const filePath = path.join(config.uploadsDir, storedName);
      await fs.writeFile(filePath, part.data);
      files.push({
        id: createHexId(),
        name: originalName,
        fileName: storedName,
        url: `/${config.uploadsDirName}/${encodeURIComponent(storedName)}`,
        mimeType: part.contentType || mimeTypeForFileName(originalName),
        bytes: part.data.length,
        date: new Date().toISOString(),
        isUpload: true
      });
    }

    return files;
  }

  async function deleteUploadedFile(fileName) {
    const relativePath = safeUploadFileName(fileName);
    const board = await boardService.loadBoard();
    if (isUploadReferenced(board, relativePath)) {
      return { deleted: false, referenced: true };
    }

    const filePath = path.join(config.uploadsDir, relativePath);
    if (!filePath.startsWith(config.uploadsDir)) {
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

  function safeUploadFileName(value) {
    let relativePath = decodeURIComponent(String(value || ""));
    if (!relativePath || relativePath.includes("\0") || relativePath.includes("/") || relativePath.includes("\\")) {
      throw new Error("Invalid upload path.");
    }
    return path.basename(relativePath);
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

  return {
    saveUploadedFiles,
    deleteUploadedFile,
    safeUploadFileName
  };
}

function mimeTypeForFileName(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  return mimeTypes[ext] || "application/octet-stream";
}

module.exports = {
  createUploadService,
  mimeTypeForFileName
};
