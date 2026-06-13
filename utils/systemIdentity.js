"use strict";

const { execFile } = require("node:child_process");

function systemUserName() {
  return new Promise((resolve) => {
    execFile("/usr/bin/whoami", [], (error, stdout) => {
      if (error) {
        resolve(null);
        return;
      }
      resolve(stdout.replace(/\r?\n$/, "") || null);
    });
  });
}

module.exports = {
  systemUserName
};
