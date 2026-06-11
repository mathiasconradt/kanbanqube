"use strict";

const crypto = require("node:crypto");

function gravatarUrlForEmail(email) {
  if (typeof email !== "string" || !email.trim()) return "";
  const hash = crypto.createHash("md5").update(email.trim().toLowerCase()).digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?s=64&d=404`;
}

function initialsForUser(name, email) {
  const source = String(name || email || "User").trim();
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "U";
}

function userIdForIdentity(name, email) {
  const source = email ? `email:${email.trim().toLowerCase()}` : `name:${String(name || "user").trim().toLowerCase()}`;
  return crypto.createHash("sha1").update(source).digest("hex").slice(0, 16);
}

module.exports = {
  gravatarUrlForEmail,
  initialsForUser,
  userIdForIdentity
};
