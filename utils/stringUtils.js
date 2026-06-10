"use strict";

function stringOrDefault(value, fallback) {
  return typeof value === "string" ? value : fallback;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function initialsFor(name) {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "U";
}

function slugify(value) {
  let result = "";
  let previousWasDash = true;
  for (const character of String(value).toLowerCase()) {
    const isAlphaNumeric = (character >= "a" && character <= "z") || (character >= "0" && character <= "9");
    if (isAlphaNumeric) {
      result += character;
      previousWasDash = false;
    } else if (!previousWasDash) {
      result += "-";
      previousWasDash = true;
    }
  }
  const trimmed = previousWasDash ? result.slice(0, -1) : result;
  return trimmed || "user";
}

module.exports = {
  stringOrDefault,
  nonEmptyString,
  initialsFor,
  slugify
};
