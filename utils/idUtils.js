"use strict";

const crypto = require("node:crypto");

function createHexId() {
  return crypto.randomBytes(12).toString("hex");
}

module.exports = {
  createHexId
};
