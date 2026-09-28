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

const dateFromToday = (offsetDays = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

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

test("presença é registrada por data e começa vazia em outro dia", () => {
  const repository = createRepository();
  const group = createGroup(repository);
  const player = createPlayer(repository, group.id, "Lucas", PLAYER_SIDE.LEFT);
  const firstDate = dateFromToday();
  const nextDate = dateFromToday(1);

  repository.setAttendance({
    groupId: group.id,
    playerId: player.id,
    date: firstDate,
    status: "present",
  });

  assert.equal(
    repository.getPlayerAttendance(group.id, player.id, firstDate).status,
    "present",
  );
  assert.equal(
    repository.getPlayerAttendance(group.id, player.id, nextDate),
    null,
  );
});

test("organizador agenda churrasco e atleta confirma somente nos 7 dias anteriores", () => {
  const repository = createRepository();
  const group = createGroup(repository);
  const player = createPlayer(repository, group.id, "Lucas", PLAYER_SIDE.LEFT);
  const eventDate = dateFromToday(7);

  const barbecue = repository.scheduleBarbecue(
    group.id,
    eventDate,
    "user-1",
  );

  const confirmation = repository.setBarbecueConfirmation({
    eventId: barbecue.id,
    playerId: player.id,
    status: "going",
    currentDate: dateFromToday(),
  });

  assert.equal(confirmation.status, "going");
  assert.equal(
    repository.getPlayerBarbecueConfirmation(barbecue.id, player.id).status,
    "going",
  );

  const laterBarbecue = repository.scheduleBarbecue(
    group.id,
    dateFromToday(10),
    "user-1",
  );

  assert.throws(
    () =>
      repository.setBarbecueConfirmation({
        eventId: laterBarbecue.id,
        playerId: player.id,
        status: "going",
        currentDate: dateFromToday(),
      }),
    /7 dias antes/i,
  );
});

test("ranking soma 2 por presença, 1 por vitória e 4 por churrasco", () => {
  const repository = createRepository();
  const group = createGroup(repository);
  const left = createPlayer(repository, group.id, "Lucas", PLAYER_SIDE.LEFT);
  const right = createPlayer(repository, group.id, "Pedro", PLAYER_SIDE.RIGHT);
  const date = dateFromToday();

  repository.setAttendance({
    groupId: group.id,
    playerId: left.id,
    date,
    status: "present",
  });
  repository.setAttendance({
    groupId: group.id,
    playerId: right.id,
    date,
    status: "present",
  });

  const barbecue = repository.scheduleBarbecue(group.id, date, "user-1");
  repository.setBarbecueConfirmation({
    eventId: barbecue.id,
    playerId: left.id,
    status: "going",
    currentDate: date,
  });

  repository.addPairResult({
    groupId: group.id,
    date,
    leftPlayerId: left.id,
    rightPlayerId: right.id,
    wins: 3,
  });

  const ranking = RankingService.calculate(
    repository.getRankingData(group.id, { asOfDate: date }),
  );

  assert.equal(ranking.left[0].attendancePoints, 2);
  assert.equal(ranking.left[0].victoryPoints, 3);
  assert.equal(ranking.left[0].barbecuePoints, 4);
  assert.equal(ranking.left[0].totalPoints, 9);

  assert.equal(ranking.right[0].attendancePoints, 2);
  assert.equal(ranking.right[0].victoryPoints, 3);
  assert.equal(ranking.right[0].barbecuePoints, 0);
  assert.equal(ranking.right[0].totalPoints, 5);
});


test("somente o organizador pode adicionar atletas à patota", () => {
  const repository = createRepository();
  const owner = repository.createPlayer({
    name: "Organizador",
    birthDate: "1990-01-01",
    side: PLAYER_SIDE.LEFT,
  });
  const guest = repository.createPlayer({
    name: "Convidado",
    birthDate: "1991-01-01",
    side: PLAYER_SIDE.RIGHT,
  });
  const candidate = repository.createPlayer({
    name: "Novo atleta",
    birthDate: "1992-01-01",
    side: PLAYER_SIDE.RIGHT,
  });
  const group = createGroup(repository, {
    ownerUserId: "owner-user",
    ownerPlayerId: owner.id,
  });

  repository.addPlayerToGroup(guest.id, group.id, "owner-user");

  assert.throws(
    () => repository.addPlayerToGroup(candidate.id, group.id, "guest-user"),
    /somente o organizador/i,
  );

  repository.addPlayerToGroup(candidate.id, group.id, "owner-user");
  assert.equal(repository.isPlayerInGroup(candidate.id, group.id), true);
});

test("somente o organizador pode remover atletas e ele não pode remover a si mesmo", () => {
  const repository = createRepository();
  const owner = repository.createPlayer({
    name: "Organizador",
    birthDate: "1990-01-01",
    side: PLAYER_SIDE.LEFT,
  });
  const guest = repository.createPlayer({
    name: "Convidado",
    birthDate: "1991-01-01",
    side: PLAYER_SIDE.RIGHT,
  });

  repository.createAccount({
    email: "owner@example.test",
    passwordHash: "hash-owner",
    name: "Organizador",
    birthDate: "1990-01-01",
    side: PLAYER_SIDE.LEFT,
  });

  const ownerAccount = repository.getAccountByEmail("owner@example.test");
  const group = createGroup(repository, {
    ownerUserId: ownerAccount.id,
    ownerPlayerId: ownerAccount.playerId,
  });

  repository.addPlayerToGroup(guest.id, group.id, ownerAccount.id);

  assert.throws(
    () => repository.removePlayerFromGroup(guest.id, group.id, "guest-user"),
    /somente o organizador/i,
  );

  assert.throws(
    () => repository.removePlayerFromGroup(ownerAccount.playerId, group.id, ownerAccount.id),
    /não pode remover a si mesmo/i,
  );

  repository.removePlayerFromGroup(guest.id, group.id, ownerAccount.id);
  assert.equal(repository.isPlayerInGroup(guest.id, group.id), false);
});

test("consulta por usuário retorna somente patotas ligadas ao atleta da conta", () => {
  const repository = createRepository();

  repository.createAccount({
    email: "lucas@example.test",
    passwordHash: "hash",
    name: "Lucas",
    birthDate: "1999-03-31",
    side: PLAYER_SIDE.LEFT,
  });

  const account = repository.getAccountByEmail("lucas@example.test");
  const linked = createGroup(repository, {
    name: "Patota ligada",
    ownerUserId: account.id,
    ownerPlayerId: account.playerId,
  });
  createGroup(repository, {
    name: "Outra patota",
    ownerUserId: "other-user",
  });

  assert.deepEqual(
    repository.getGroupsForUser(account.id).map((group) => group.id),
    [linked.id],
  );
});


test("somente o organizador agenda churrasco e os pontos entram na data do evento", () => {
  const repository = createRepository();
  const group = createGroup(repository);
  const player = createPlayer(repository, group.id, "Lucas", PLAYER_SIDE.LEFT);
  const eventDate = dateFromToday(5);

  assert.throws(
    () => repository.scheduleBarbecue(group.id, eventDate, "outro-user"),
    /somente o organizador/i,
  );

  const barbecue = repository.scheduleBarbecue(
    group.id,
    eventDate,
    "user-1",
  );

  repository.setBarbecueConfirmation({
    eventId: barbecue.id,
    playerId: player.id,
    status: "going",
    currentDate: dateFromToday(),
  });

  const beforeEvent = RankingService.calculate(
    repository.getRankingData(group.id, { asOfDate: dateFromToday() }),
  );
  assert.equal(beforeEvent.left[0].barbecuePoints, 0);

  const onEventDate = RankingService.calculate(
    repository.getRankingData(group.id, { asOfDate: eventDate }),
  );
  assert.equal(onEventDate.left[0].barbecuePoints, 4);
});
