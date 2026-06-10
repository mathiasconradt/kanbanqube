"use strict";

function errorHandler(error, _request, response, _next) {
  if (response.headersSent) return;
  response.status(error.statusCode || 500).json({
    error: error.message || "Unexpected server error."
  });
}

module.exports = {
  errorHandler
};
