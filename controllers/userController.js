"use strict";

function createUserController(userService) {
  async function getUsers(_request, response) {
    response.json({ users: await userService.listUsers() });
  }

  return {
    getUsers
  };
}

module.exports = {
  createUserController
};
