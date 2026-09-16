import test from "node:test";
import assert from "node:assert/strict";

import { Player, PLAYER_SIDE } from "../src/js/domain/Player.js";
import { DrawService } from "../src/js/services/DrawService.js";

const createPlayers = (prefix, side, quantity = 4) =>
  Array.from({ length: quantity }, (_, index) => new Player(`${prefix} ${index + 1}`, side));

test("deve formar duas duplas com 4 jogadores", () => {
  const leftPlayers = createPlayers("Esquerda", PLAYER_SIDE.LEFT, 2);
  const rightPlayers = createPlayers("Direita", PLAYER_SIDE.RIGHT, 2);
  const pairs = DrawService.createPairs(leftPlayers, rightPlayers, () => 0.5);
  assert.equal(pairs.length, 2);
});

test("deve formar três duplas com 6 jogadores", () => {
  const leftPlayers = createPlayers("Esquerda", PLAYER_SIDE.LEFT, 3);
  const rightPlayers = createPlayers("Direita", PLAYER_SIDE.RIGHT, 3);
  const pairs = DrawService.createPairs(leftPlayers, rightPlayers, () => 0.5);
  assert.equal(pairs.length, 3);
});

test("cada dupla deve conter um jogador de esquerda e um de direita", () => {
  const leftPlayers = createPlayers("Esquerda", PLAYER_SIDE.LEFT, 4);
  const rightPlayers = createPlayers("Direita", PLAYER_SIDE.RIGHT, 4);
  const pairs = DrawService.createPairs(leftPlayers, rightPlayers, () => 0.5);

  pairs.forEach((pair) => {
    assert.equal(pair.leftPlayer.side, PLAYER_SIDE.LEFT);
    assert.equal(pair.rightPlayer.side, PLAYER_SIDE.RIGHT);
  });
});

test("não deve aceitar menos de quatro jogadores", () => {
  const leftPlayers = createPlayers("Esquerda", PLAYER_SIDE.LEFT, 1);
  const rightPlayers = createPlayers("Direita", PLAYER_SIDE.RIGHT, 1);
  assert.throws(() => DrawService.createPairs(leftPlayers, rightPlayers), /no mínimo 4 jogadores/i);
});

test("deve exigir a mesma quantidade de jogadores por lado", () => {
  const leftPlayers = createPlayers("Esquerda", PLAYER_SIDE.LEFT, 4);
  const rightPlayers = createPlayers("Direita", PLAYER_SIDE.RIGHT, 2);
  assert.throws(() => DrawService.createPairs(leftPlayers, rightPlayers), /mesma quantidade/i);
});

test("não deve aceitar nomes repetidos", () => {
  const leftPlayers = createPlayers("Jogador", PLAYER_SIDE.LEFT, 2);
  const rightPlayers = createPlayers("Direita", PLAYER_SIDE.RIGHT, 2);
  rightPlayers[0] = new Player("Jogador 1", PLAYER_SIDE.RIGHT);
  assert.throws(() => DrawService.createPairs(leftPlayers, rightPlayers), /não podem ser repetidos/i);
});
