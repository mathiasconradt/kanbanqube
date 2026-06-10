"use strict";

function createImportController(boardService, importService) {
  async function importBoard(request, response) {
    const currentBoard = await boardService.loadBoard();
    if ((currentBoard.cards || []).length > 0) {
      response.status(409).json({ error: "Import is only available when the board has no cards." });
      return;
    }

    const importedBoard = await importService.readImportedBoard(request);
    response.json(await boardService.saveBoard(importedBoard));
  }

  async function importDemoBoard(_request, response) {
    const currentBoard = await boardService.loadBoard();
    if ((currentBoard.cards || []).length > 0) {
      response.status(409).json({ error: "Demo board can only be loaded when the board has no cards." });
      return;
    }

    const demoBoard = await importService.readDemoBoard();
    response.json(await boardService.saveBoard(demoBoard));
  }

  return {
    importBoard,
    importDemoBoard
  };
}

module.exports = {
  createImportController
};
