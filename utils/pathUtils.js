"use strict";

const fsSync = require("node:fs");
const path = require("node:path");

function canonicalWorkspacePath(candidatePath, allowedRoots) {
  const resolvedPath = path.resolve(String(candidatePath || ""));
  if (!resolvedPath || resolvedPath.includes("\0")) {
    throw new Error("Invalid workspace path.");
  }

  const allowed = allowedRoots.flatMap(canonicalDirectoryIfExists);
  const canonicalCandidatePath = canonicalExistingPath(resolvedPath);
  if (!allowed.some((rootPath) => isPathInside(canonicalCandidatePath, rootPath))) {
    throw new Error("Workspace path must be inside your home directory, current directory, or temporary directory.");
  }
  fsSync.mkdirSync(resolvedPath, { recursive: true }); // NOSONAR: resolvedPath is validated against allowed roots above.
  const canonicalPath = fsSync.realpathSync(resolvedPath); // NOSONAR: resolvedPath is validated against allowed roots above.
  if (!allowed.some((rootPath) => isPathInside(canonicalPath, rootPath))) {
    throw new Error("Workspace path must be inside your home directory, current directory, or temporary directory.");
  }
  return canonicalPath;
}

function safePathInsideRoot(candidatePath, rootPath) {
  const resolvedPath = path.resolve(String(candidatePath || ""));
  if (!resolvedPath || resolvedPath.includes("\0")) {
    throw new Error("Invalid file path.");
  }

  const canonicalRoot = canonicalDirectory(rootPath);
  const canonicalPath = canonicalExistingPath(resolvedPath);
  if (!isPathInside(canonicalPath, canonicalRoot)) {
    throw new Error("File path escapes the allowed directory.");
  }
  return canonicalPath;
}

function canonicalDirectory(directoryPath) {
  const canonicalPath = fsSync.realpathSync(path.resolve(directoryPath));
  return canonicalPath.endsWith(path.sep) ? canonicalPath : `${canonicalPath}${path.sep}`;
}

function canonicalDirectoryIfExists(directoryPath) {
  try {
    return [canonicalDirectory(directoryPath)];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function canonicalExistingPath(targetPath) {
  try {
    return fsSync.realpathSync(targetPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const missingParts = [];
    let parentPath = targetPath;
    while (!fsSync.existsSync(parentPath)) {
      missingParts.unshift(path.basename(parentPath));
      const nextParent = path.dirname(parentPath);
      if (nextParent === parentPath) throw error;
      parentPath = nextParent;
    }
    return path.join(fsSync.realpathSync(parentPath), ...missingParts);
  }
}

function isPathInside(candidatePath, rootPath) {
  const candidate = candidatePath.endsWith(path.sep) ? candidatePath : `${candidatePath}${path.sep}`;
  return candidate === rootPath || candidate.startsWith(rootPath);
}

module.exports = {
  canonicalWorkspacePath,
  safePathInsideRoot
};
