import test from "node:test";
import assert from "node:assert/strict";

import { FuteMatchRepository } from "../src/js/services/FuteMatchRepository.js";
import { RankingService } from "../src/js/services/RankingService.js";
import { PLAYER_SIDE } from "../src/js/domain/Player.js";

class MemoryStorage {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, value); }
}

const createRepository = () => new FuteMatchRepository(new MemoryStorage());

const createGroup = (repository, overrides = {}) =>
  repository.createGroup({
    name: overrides.name ?? "Terça",
    startTime: overrides.startTime ?? "19:00",
    endTime: overrides.endTime ?? "21:00",
    ownerUserId: overrides.ownerUserId ?? "user-1",
    ownerPlayerId: overrides.ownerPlayerId,
  });

const createPlayer = (repository, groupId, name, side) =>
  repository.createPlayer({
    name,
    birthDate: "1999-03-31",
    side,
    groupIds: [groupId],
  });

test("patota exige horário de início e fim", () => {
  const repository = createRepository();
  assert.throws(
    () => repository.createGroup({ name: "Terça", startTime: "", endTime: "21:00" }),
    /horários/i,
  );
});

test("criador entra automaticamente na patota", () => {
  const repository = createRepository();
  const owner = repository.createPlayer({
    name: "Lucas",
    birthDate: "1999-03-31",
    side: PLAYER_SIDE.LEFT,
  });
  const group = createGroup(repository, { ownerPlayerId: owner.id });
  assert.equal(repository.getPlayersByGroup(group.id)[0].id, owner.id);
});

test("presença e churrasco ficam registrados por noite", () => {
  const repository = createRepository();
  const group = createGroup(repository);
  const player = createPlayer(repository, group.id, "Lucas", PLAYER_SIDE.LEFT);

  repository.setAttendance({
    groupId: group.id,
    playerId: player.id,
    date: "2026-09-28",
    status: "present",
    barbecue: true,
  });

  const attendance = repository.getPlayerAttendance(group.id, player.id, "2026-09-28");
  assert.equal(attendance.status, "present");
  assert.equal(attendance.barbecue, true);
});

test("ausência remove indicação de churrasco", () => {
  const repository = createRepository();
  const group = createGroup(repository);
  const player = createPlayer(repository, group.id, "Lucas", PLAYER_SIDE.LEFT);

  repository.setAttendance({
    groupId: group.id,
    playerId: player.id,
    date: "2026-09-28",
    status: "absent",
    barbecue: true,
  });

  assert.equal(repository.getPlayerAttendance(group.id, player.id, "2026-09-28").barbecue, false);
});

test("ranking soma presença, churrasco e vitórias para cada atleta da dupla", () => {
  const repository = createRepository();
  const group = createGroup(repository);
  const left = createPlayer(repository, group.id, "Lucas", PLAYER_SIDE.LEFT);
  const right = createPlayer(repository, group.id, "Pedro", PLAYER_SIDE.RIGHT);

  repository.setAttendance({
    groupId: group.id,
    playerId: left.id,
    date: "2026-09-28",
    status: "present",
    barbecue: true,
  });
  repository.setAttendance({
    groupId: group.id,
    playerId: right.id,
    date: "2026-09-28",
    status: "present",
    barbecue: false,
  });
  repository.addPairResult({
    groupId: group.id,
    date: "2026-09-28",
    leftPlayerId: left.id,
    rightPlayerId: right.id,
    wins: 3,
  });

  const ranking = RankingService.calculate(repository.getRankingData(group.id));
  assert.equal(ranking.left[0].totalPoints, 9);
  assert.equal(ranking.right[0].totalPoints, 4);
});
