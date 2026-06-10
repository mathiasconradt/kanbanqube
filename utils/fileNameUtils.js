"use strict";

const path = require("node:path");
const { createHexId } = require("./idUtils");

function displayOriginalFileName(value) {
  const baseName = path.basename(String(value || "attachment"));
  return baseName.replace(/[\0\r\n]/g, "").trim() || "attachment";
}

function createStoredFileName(originalName) {
  const ext = path.extname(originalName);
  const base = sanitizeStoredFileName(path.basename(originalName, ext) || "attachment");
  const stamp = new Date().toISOString().replace(/[^0-9A-Za-z]/g, "");
  const suffix = createHexId().slice(0, 6);
  return `${base}.kbq_${stamp}${suffix}${ext}`;
}

function sanitizeStoredFileName(value) {
  let result = "";
  let previousWasUnderscore = true;
  for (const character of String(value)) {
    const isAlphaNumeric = (character >= "a" && character <= "z")
      || (character >= "A" && character <= "Z")
      || (character >= "0" && character <= "9");
    const isAllowedSymbol = character === "(" || character === ")" || character === "[" || character === "]" || character === "-";
    if (isAlphaNumeric || character === "_" || isAllowedSymbol) {
      result += character;
      previousWasUnderscore = false;
    } else if (!previousWasUnderscore) {
      result += "_";
      previousWasUnderscore = true;
    }
  }
  const trimmed = previousWasUnderscore ? result.slice(0, -1) : result;
  return trimmed || "attachment";
}

module.exports = {
  displayOriginalFileName,
  createStoredFileName,
  sanitizeStoredFileName
};
