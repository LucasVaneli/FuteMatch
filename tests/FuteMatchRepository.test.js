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

const createRepository = () => new FuteMatchRepository(new MemoryStorage());

const createPlayer = (repository, groupId, name = "Lucas") =>
  repository.createPlayer({
    name,
    birthDate: "1999-03-31",
    side: PLAYER_SIDE.LEFT,
    groupIds: [groupId],
  });

test("jogador pode pertencer a várias patotas", () => {
  const repository = createRepository();
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
  const repository = createRepository();
  const groupA = repository.createGroup("Terça");
  const groupB = repository.createGroup("Sexta");

  createPlayer(repository, groupA.id, "Lucas");

  repository.createPlayer({
    name: "Pedro",
    birthDate: "2000-01-01",
    side: PLAYER_SIDE.RIGHT,
    groupIds: [groupB.id],
  });

  assert.deepEqual(repository.getPlayersByGroup(groupA.id).map((player) => player.name), ["Lucas"]);
  assert.deepEqual(repository.getPlayersByGroup(groupB.id).map((player) => player.name), ["Pedro"]);
});

test("jogador existente pode ser adicionado a outra patota sem novo cadastro", () => {
  const repository = createRepository();
  const groupA = repository.createGroup("Terça");
  const groupB = repository.createGroup("Sexta");

  const player = createPlayer(repository, groupA.id);

  repository.addPlayerToGroup(player.id, groupB.id);

  assert.equal(repository.getPlayers({ active: null }).length, 1);
  assert.equal(repository.getPlayersByGroup(groupB.id)[0].id, player.id);
  assert.equal(repository.getGroupsByPlayer(player.id).length, 2);
});

test("lista jogadores ainda disponíveis para uma patota", () => {
  const repository = createRepository();
  const groupA = repository.createGroup("Terça");
  const groupB = repository.createGroup("Sexta");

  createPlayer(repository, groupA.id, "Lucas");

  repository.createPlayer({
    name: "Pedro",
    birthDate: "2000-01-01",
    side: PLAYER_SIDE.RIGHT,
    groupIds: [groupB.id],
  });

  assert.deepEqual(repository.getPlayersNotInGroup(groupA.id).map((player) => player.name), ["Pedro"]);
});

test("inativar jogador preserva cadastro e remove dos sorteios", () => {
  const repository = createRepository();
  const group = repository.createGroup("Terça");
  const player = createPlayer(repository, group.id);

  repository.setPlayerActive(player.id, false);

  assert.equal(repository.getPlayersByGroup(group.id).length, 0);
  assert.equal(repository.getPlayersByGroup(group.id, { includeInactive: true }).length, 1);
  assert.equal(repository.getPlayers({ active: false })[0].id, player.id);
});

test("jogador inativo pode ser reativado", () => {
  const repository = createRepository();
  const group = repository.createGroup("Terça");
  const player = createPlayer(repository, group.id);

  repository.setPlayerActive(player.id, false);
  repository.setPlayerActive(player.id, true);

  assert.equal(repository.getPlayersByGroup(group.id)[0].id, player.id);
});

test("remover jogador de uma patota preserva o jogador e outras patotas", () => {
  const repository = createRepository();
  const groupA = repository.createGroup("Terça");
  const groupB = repository.createGroup("Sexta");
  const player = repository.createPlayer({
    name: "Lucas",
    birthDate: "1999-03-31",
    side: PLAYER_SIDE.LEFT,
    groupIds: [groupA.id, groupB.id],
  });

  repository.removePlayerFromGroup(player.id, groupA.id);

  assert.equal(repository.getPlayersByGroup(groupA.id).length, 0);
  assert.equal(repository.getPlayersByGroup(groupB.id)[0].id, player.id);
  assert.equal(repository.getPlayers({ active: null })[0].id, player.id);
  assert.equal(repository.getPlayersNotInGroup(groupA.id)[0].id, player.id);
});

test("inativar patota preserva cadastro e troca a patota atual", () => {
  const repository = createRepository();
  const groupA = repository.createGroup("Terça");
  const groupB = repository.createGroup("Sexta");
  repository.setCurrentGroup(groupA.id);

  repository.setGroupActive(groupA.id, false);

  assert.deepEqual(repository.getGroups().map((group) => group.name), ["Sexta"]);
  assert.deepEqual(repository.getGroups({ active: false }).map((group) => group.name), ["Terça"]);
  assert.equal(repository.getCurrentGroupId(), groupB.id);
});

test("patota inativa pode ser reativada", () => {
  const repository = createRepository();
  const group = repository.createGroup("Terça");

  repository.setGroupActive(group.id, false);
  repository.setGroupActive(group.id, true);

  assert.equal(repository.getGroups()[0].id, group.id);
  assert.equal(repository.getCurrentGroupId(), group.id);
});
