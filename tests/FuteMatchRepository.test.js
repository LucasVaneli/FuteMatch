import test from "node:test";
import assert from "node:assert/strict";

import { GROUP_WEEKDAY } from "../src/js/domain/Group.js";
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

const addDaysToIso = (value, offsetDays) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offsetDays));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
};

const nextDateForWeekday = (weekday) => {
  const current = dateFromToday();
  const [year, month, day] = current.split("-").map(Number);
  const currentWeekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const diff = (weekday - currentWeekday + 7) % 7;
  return addDaysToIso(current, diff);
};

const createGroup = (repository, overrides = {}) =>
  repository.createGroup({
    name: overrides.name ?? "Terça",
    weekday: overrides.weekday ?? GROUP_WEEKDAY.MONDAY,
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
    () => repository.createGroup({ name: "Terça", weekday: GROUP_WEEKDAY.TUESDAY, startTime: "", endTime: "21:00" }),
    /horários/i,
  );
});

test("patota exige dia da semana entre segunda e sexta", () => {
  const repository = createRepository();

  assert.throws(
    () =>
      repository.createGroup({
        name: "Sem dia",
        weekday: "",
        startTime: "19:00",
        endTime: "21:00",
      }),
    /dia da semana/i,
  );

  assert.throws(
    () =>
      repository.createGroup({
        name: "Domingo",
        weekday: 0,
        startTime: "19:00",
        endTime: "21:00",
      }),
    /dia da semana/i,
  );
});

test("somente o organizador pode alterar dia e horário da patota", () => {
  const repository = createRepository();
  const group = createGroup(repository, {
    ownerUserId: "owner-user",
    weekday: GROUP_WEEKDAY.MONDAY,
  });

  assert.throws(
    () =>
      repository.updateGroupSchedule(
        group.id,
        {
          weekday: GROUP_WEEKDAY.FRIDAY,
          startTime: "20:00",
          endTime: "22:00",
        },
        "other-user",
      ),
    /somente o organizador/i,
  );

  const updated = repository.updateGroupSchedule(
    group.id,
    {
      weekday: GROUP_WEEKDAY.FRIDAY,
      startTime: "20:00",
      endTime: "22:00",
    },
    "owner-user",
  );

  assert.equal(updated.weekday, GROUP_WEEKDAY.FRIDAY);
  assert.equal(updated.startTime, "20:00");
  assert.equal(updated.endTime, "22:00");
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

test("presença abre dois dias antes e a próxima semana começa sem resposta", () => {
  const repository = createRepository();
  const group = createGroup(repository, {
    weekday: GROUP_WEEKDAY.MONDAY,
  });
  const player = createPlayer(repository, group.id, "Lucas", PLAYER_SIDE.LEFT);
  const eventDate = nextDateForWeekday(GROUP_WEEKDAY.MONDAY);
  const twoDaysBefore = addDaysToIso(eventDate, -2);
  const threeDaysBefore = addDaysToIso(eventDate, -3);
  const nextWeek = addDaysToIso(eventDate, 7);

  const closedWindow = repository.getAttendanceWindow(
    group.id,
    threeDaysBefore,
  );
  assert.equal(closedWindow.isOpen, false);
  assert.equal(closedWindow.targetDate, eventDate);

  assert.throws(
    () =>
      repository.setAttendance({
        groupId: group.id,
        playerId: player.id,
        date: eventDate,
        status: "present",
        currentDate: threeDaysBefore,
      }),
    /2 dias antes/i,
  );

  const openWindow = repository.getAttendanceWindow(
    group.id,
    twoDaysBefore,
  );
  assert.equal(openWindow.isOpen, true);
  assert.equal(openWindow.targetDate, eventDate);

  repository.setAttendance({
    groupId: group.id,
    playerId: player.id,
    date: eventDate,
    status: "present",
    currentDate: twoDaysBefore,
  });

  assert.equal(
    repository.getPlayerAttendance(group.id, player.id, eventDate).status,
    "present",
  );
  assert.equal(
    repository.getPlayerAttendance(group.id, player.id, nextWeek),
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
  const date = nextDateForWeekday(GROUP_WEEKDAY.MONDAY);
  const votingDate = addDaysToIso(date, -2);

  repository.setAttendance({
    groupId: group.id,
    playerId: left.id,
    date,
    status: "present",
    currentDate: votingDate,
  });
  repository.setAttendance({
    groupId: group.id,
    playerId: right.id,
    date,
    status: "present",
    currentDate: votingDate,
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


test("somente o organizador pode inativar e reativar a patota", () => {
  const repository = createRepository();
  const group = createGroup(repository, {
    ownerUserId: "owner-user",
  });

  assert.throws(
    () => repository.setGroupActive(group.id, false, "other-user"),
    /somente o organizador/i,
  );

  repository.setGroupActive(group.id, false, "owner-user");
  assert.equal(repository.getGroupById(group.id).active, false);
  assert.equal(repository.getGroups().length, 0);

  repository.setGroupActive(group.id, true, "owner-user");
  assert.equal(repository.getGroupById(group.id).active, true);
});

test("excluir patota remove registros relacionados e preserva atletas", () => {
  const repository = createRepository();
  const owner = repository.createPlayer({
    name: "Organizador",
    birthDate: "1990-01-01",
    side: PLAYER_SIDE.LEFT,
  });
  const partner = repository.createPlayer({
    name: "Parceiro",
    birthDate: "1991-01-01",
    side: PLAYER_SIDE.RIGHT,
  });
  const group = createGroup(repository, {
    ownerUserId: "owner-user",
    ownerPlayerId: owner.id,
    weekday: GROUP_WEEKDAY.MONDAY,
  });

  repository.addPlayerToGroup(partner.id, group.id, "owner-user");

  const eventDate = nextDateForWeekday(GROUP_WEEKDAY.MONDAY);
  const votingDate = addDaysToIso(eventDate, -2);

  repository.setAttendance({
    groupId: group.id,
    playerId: owner.id,
    date: eventDate,
    status: "present",
    currentDate: votingDate,
  });

  const barbecue = repository.scheduleBarbecue(
    group.id,
    eventDate,
    "owner-user",
  );

  repository.setBarbecueConfirmation({
    eventId: barbecue.id,
    playerId: owner.id,
    status: "going",
    currentDate: eventDate,
  });

  repository.addPairResult({
    groupId: group.id,
    date: eventDate,
    leftPlayerId: owner.id,
    rightPlayerId: partner.id,
    wins: 2,
  });

  assert.throws(
    () => repository.deleteGroup(group.id, "other-user"),
    /somente o organizador/i,
  );

  repository.deleteGroup(group.id, "owner-user");

  const state = repository.getState();
  assert.equal(repository.getGroupById(group.id), null);
  assert.equal(state.memberships.some((item) => item.groupId === group.id), false);
  assert.equal(state.attendances.length, 0);
  assert.equal(state.barbecueEvents.some((item) => item.groupId === group.id), false);
  assert.equal(
    state.barbecueConfirmations.some((item) => item.eventId === barbecue.id),
    false,
  );
  assert.equal(state.sessions.some((item) => item.groupId === group.id), false);
  assert.equal(state.pairResults.length, 0);
  assert.equal(repository.getPlayerById(owner.id)?.name, "Organizador");
  assert.equal(repository.getPlayerById(partner.id)?.name, "Parceiro");
});


test("organizador adicional recebe as mesmas permissões de gestão da patota", () => {
  const repository = createRepository();

  repository.createAccount({
    email: "owner-role@example.test",
    passwordHash: "hash-owner-role",
    name: "Criador",
    birthDate: "1990-01-01",
    side: PLAYER_SIDE.LEFT,
  });
  const ownerAccount = repository.getAccountByEmail("owner-role@example.test");

  repository.createAccount({
    email: "helper-role@example.test",
    passwordHash: "hash-helper-role",
    name: "Ajudante",
    birthDate: "1991-01-01",
    side: PLAYER_SIDE.RIGHT,
  });
  const helperAccount = repository.getAccountByEmail("helper-role@example.test");

  const candidate = repository.createPlayer({
    name: "Novo membro",
    birthDate: "1992-01-01",
    side: PLAYER_SIDE.LEFT,
  });

  const group = createGroup(repository, {
    ownerUserId: ownerAccount.id,
    ownerPlayerId: ownerAccount.playerId,
  });

  repository.addPlayerToGroup(
    helperAccount.playerId,
    group.id,
    ownerAccount.id,
  );

  repository.updateGroupMemberRole(
    group.id,
    helperAccount.playerId,
    "organizer",
    ownerAccount.id,
  );

  assert.equal(
    repository.isGroupOrganizer(group.id, helperAccount.id),
    true,
  );
  assert.equal(
    repository.getGroupsOrganizedByUser(helperAccount.id)[0].id,
    group.id,
  );

  const updated = repository.updateGroupSchedule(
    group.id,
    {
      weekday: GROUP_WEEKDAY.FRIDAY,
      startTime: "20:00",
      endTime: "22:00",
    },
    helperAccount.id,
  );
  assert.equal(updated.weekday, GROUP_WEEKDAY.FRIDAY);

  repository.addPlayerToGroup(
    candidate.id,
    group.id,
    helperAccount.id,
  );
  assert.equal(repository.isPlayerInGroup(candidate.id, group.id), true);

  repository.setGroupActive(group.id, false, helperAccount.id);
  assert.equal(repository.getGroupById(group.id).active, false);

  repository.setGroupActive(group.id, true, helperAccount.id);
  repository.deleteGroup(group.id, helperAccount.id);
  assert.equal(repository.getGroupById(group.id), null);
});

test("atleta comum não pode promover membros e criador não pode ser rebaixado", () => {
  const repository = createRepository();

  repository.createAccount({
    email: "creator-protected@example.test",
    passwordHash: "hash-creator",
    name: "Criador protegido",
    birthDate: "1990-01-01",
    side: PLAYER_SIDE.LEFT,
  });
  const ownerAccount = repository.getAccountByEmail(
    "creator-protected@example.test",
  );

  repository.createAccount({
    email: "member-role@example.test",
    passwordHash: "hash-member",
    name: "Membro",
    birthDate: "1991-01-01",
    side: PLAYER_SIDE.RIGHT,
  });
  const memberAccount = repository.getAccountByEmail(
    "member-role@example.test",
  );

  const group = createGroup(repository, {
    ownerUserId: ownerAccount.id,
    ownerPlayerId: ownerAccount.playerId,
  });

  repository.addPlayerToGroup(
    memberAccount.playerId,
    group.id,
    ownerAccount.id,
  );

  assert.throws(
    () =>
      repository.updateGroupMemberRole(
        group.id,
        memberAccount.playerId,
        "organizer",
        memberAccount.id,
      ),
    /somente o organizador/i,
  );

  repository.updateGroupMemberRole(
    group.id,
    memberAccount.playerId,
    "organizer",
    ownerAccount.id,
  );

  assert.throws(
    () =>
      repository.updateGroupMemberRole(
        group.id,
        ownerAccount.playerId,
        "member",
        memberAccount.id,
      ),
    /deve permanecer como organizador/i,
  );
});
