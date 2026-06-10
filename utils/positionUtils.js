"use strict";

function normalizePos(value, index) {
  if (Number.isFinite(value)) return value;
  return (index + 1) * 16384;
}

module.exports = {
  normalizePos
};
