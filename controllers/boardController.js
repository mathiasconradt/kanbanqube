"use strict";

function createBoardController(boardService) {
  async function getBoard(_request, response) {
    response.json(await boardService.loadBoard());
  }

  async function saveBoard(request, response) {
    response.json(await boardService.saveBoard(request.body || {}));
  }

  return {
    getBoard,
    saveBoard
  };
}

module.exports = {
  createBoardController
};
