import test from "node:test";
import assert from "node:assert/strict";

import { Player, PLAYER_SIDE } from "../src/js/domain/Player.js";
import { DrawService } from "../src/js/services/DrawService.js";

const createPlayers = (prefix, side) =>
  Array.from(
    { length: 4 },
    (_, index) => new Player(`${prefix} ${index + 1}`, side),
  );

test("deve formar quatro duplas", () => {
  const leftPlayers = createPlayers("Esquerda", PLAYER_SIDE.LEFT);
  const rightPlayers = createPlayers("Direita", PLAYER_SIDE.RIGHT);

  const pairs = DrawService.createPairs(leftPlayers, rightPlayers, () => 0.5);

  assert.equal(pairs.length, 4);
});

test("cada dupla deve conter um jogador de esquerda e um de direita", () => {
  const leftPlayers = createPlayers("Esquerda", PLAYER_SIDE.LEFT);
  const rightPlayers = createPlayers("Direita", PLAYER_SIDE.RIGHT);

  const pairs = DrawService.createPairs(leftPlayers, rightPlayers, () => 0.5);

  pairs.forEach((pair) => {
    assert.equal(pair.leftPlayer.side, PLAYER_SIDE.LEFT);
    assert.equal(pair.rightPlayer.side, PLAYER_SIDE.RIGHT);
  });
});

test("não deve aceitar nomes repetidos", () => {
  const leftPlayers = createPlayers("Jogador", PLAYER_SIDE.LEFT);
  const rightPlayers = createPlayers("Direita", PLAYER_SIDE.RIGHT);

  rightPlayers[0] = new Player("Jogador 1", PLAYER_SIDE.RIGHT);

  assert.throws(
    () => DrawService.createPairs(leftPlayers, rightPlayers),
    /não podem ser repetidos/i,
  );
});

test("deve exigir exatamente quatro jogadores por lado", () => {
  const leftPlayers = createPlayers("Esquerda", PLAYER_SIDE.LEFT).slice(0, 3);
  const rightPlayers = createPlayers("Direita", PLAYER_SIDE.RIGHT);

  assert.throws(
    () => DrawService.createPairs(leftPlayers, rightPlayers),
    /exatamente 4 jogadores/i,
  );
});
