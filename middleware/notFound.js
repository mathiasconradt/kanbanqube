"use strict";

function notFound(_request, response) {
  response.status(405).json({ error: "Method not allowed." });
}

module.exports = {
  notFound
};
