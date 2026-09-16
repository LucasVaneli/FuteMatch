import test from "node:test";
import assert from "node:assert/strict";

import { FuteMatchRepository } from "../src/js/services/FuteMatchRepository.js";
import { PLAYER_SIDE } from "../src/js/domain/Player.js";

class MemoryStorage {
  constructor() {
    this.data = new Map();
  }

  getItem(key) {
    return this.data.has(key) ? this.data.get(key) : null;
  }

  setItem(key, value) {
    this.data.set(key, value);
  }
}

test("jogador pode pertencer a várias patotas", () => {
  const repository = new FuteMatchRepository(new MemoryStorage());
  const groupA = repository.createGroup("Terça");
  const groupB = repository.createGroup("Sexta");

  const player = repository.createPlayer({
    name: "Lucas",
    birthDate: "1999-03-31",
    side: PLAYER_SIDE.LEFT,
    groupIds: [groupA.id, groupB.id],
  });

  assert.equal(repository.getPlayersByGroup(groupA.id)[0].id, player.id);
  assert.equal(repository.getPlayersByGroup(groupB.id)[0].id, player.id);
  assert.equal(repository.getGroupsByPlayer(player.id).length, 2);
});

test("consulta da patota retorna somente seus jogadores", () => {
  const repository = new FuteMatchRepository(new MemoryStorage());
  const groupA = repository.createGroup("Terça");
  const groupB = repository.createGroup("Sexta");

  repository.createPlayer({
    name: "Lucas",
    birthDate: "1999-03-31",
    side: PLAYER_SIDE.LEFT,
    groupIds: [groupA.id],
  });

  repository.createPlayer({
    name: "Pedro",
    birthDate: "2000-01-01",
    side: PLAYER_SIDE.RIGHT,
    groupIds: [groupB.id],
  });

  assert.deepEqual(repository.getPlayersByGroup(groupA.id).map((player) => player.name), ["Lucas"]);
  assert.deepEqual(repository.getPlayersByGroup(groupB.id).map((player) => player.name), ["Pedro"]);
});
