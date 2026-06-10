"use strict";

function createUploadController(uploadService) {
  async function uploadFiles(request, response) {
    const files = await uploadService.saveUploadedFiles(request);
    response.json({ files });
  }

  async function deleteUpload(request, response) {
    response.json(await uploadService.deleteUploadedFile(request.params.fileName));
  }

  return {
    uploadFiles,
    deleteUpload
  };
}

module.exports = {
  createUploadController
};
