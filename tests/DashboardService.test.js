import test from "node:test";
import assert from "node:assert/strict";

import { DashboardService } from "../src/js/services/DashboardService.js";
import { PLAYER_SIDE } from "../src/js/domain/Player.js";

const players = [
  { id: "p-left", name: "Vaneli", side: PLAYER_SIDE.LEFT },
  { id: "p-right", name: "Duwe", side: PLAYER_SIDE.RIGHT },
  { id: "p-other", name: "Manto", side: PLAYER_SIDE.LEFT },
];

test("dashboard agrega vitórias, presença, churrasco e ranking por período", () => {
  const dashboard = DashboardService.calculate({
    players,
    guests: [],
    sessions: [
      { id: "s1", date: "2026-01-10" },
      { id: "s2", date: "2026-02-10" },
    ],
    pairResults: [
      {
        sessionId: "s1",
        leftPlayerId: "p-left",
        rightPlayerId: "p-right",
        leftGuestId: null,
        rightGuestId: null,
        wins: 3,
      },
      {
        sessionId: "s2",
        leftPlayerId: "p-other",
        rightPlayerId: "p-right",
        leftGuestId: null,
        rightGuestId: null,
        wins: 2,
      },
    ],
    attendances: [
      {
        playerId: "p-left",
        eventDate: "2026-01-10",
        status: "present",
      },
      {
        playerId: "p-right",
        eventDate: "2026-01-10",
        status: "present",
      },
    ],
    barbecueEvents: [
      { id: "b1", date: "2026-01-10", active: true },
    ],
    barbecueConfirmations: [
      { eventId: "b1", playerId: "p-left", status: "going" },
    ],
    startDate: "2026-01-01",
    endDate: "2026-01-31",
  });

  assert.equal(dashboard.summary.totalWins, 3);
  assert.equal(dashboard.summary.nights, 1);
  assert.equal(dashboard.mostVictoriousPlayer.name, "Duwe");
  assert.equal(dashboard.mostVictoriousPair.name, "Vaneli + Duwe");
  assert.equal(dashboard.mostPresent.attendances, 1);

  const vaneli = dashboard.periodRanking.find(
    (item) => item.player.id === "p-left",
  );

  assert.equal(vaneli.victoryPoints, 3);
  assert.equal(vaneli.attendancePoints, 2);
  assert.equal(vaneli.barbecuePoints, 4);
  assert.equal(vaneli.totalPoints, 9);
  assert.deepEqual(dashboard.monthlyTrend, [
    { month: "2026-01", wins: 3 },
  ]);
});

test("convidado entra nas estatísticas da dupla mas não nas individuais", () => {
  const dashboard = DashboardService.calculate({
    players: [players[0]],
    guests: [
      {
        id: "guest-1",
        name: "Convidado Pedro",
        side: PLAYER_SIDE.RIGHT,
        isGuest: true,
      },
    ],
    sessions: [{ id: "s1", date: "2026-03-20" }],
    pairResults: [
      {
        sessionId: "s1",
        leftPlayerId: "p-left",
        rightPlayerId: null,
        leftGuestId: null,
        rightGuestId: "guest-1",
        wins: 4,
      },
    ],
    startDate: "2026-03-01",
    endDate: "2026-03-31",
  });

  assert.equal(dashboard.mostVictoriousPair.name, "Vaneli + Convidado Pedro");
  assert.equal(dashboard.mostVictoriousPair.hasGuest, true);
  assert.equal(dashboard.mostVictoriousPair.wins, 4);
  assert.equal(dashboard.topPlayers.length, 1);
  assert.equal(dashboard.topPlayers[0].name, "Vaneli");
  assert.equal(dashboard.topPlayers[0].wins, 4);
  assert.equal(
    dashboard.periodRanking.some(
      (item) => item.name === "Convidado Pedro",
    ),
    false,
  );
});

test("mesma dupla acumula vitórias de noites diferentes", () => {
  const dashboard = DashboardService.calculate({
    players: [players[0], players[1]],
    sessions: [
      { id: "s1", date: "2026-04-01" },
      { id: "s2", date: "2026-04-08" },
    ],
    pairResults: [
      {
        sessionId: "s1",
        leftPlayerId: "p-left",
        rightPlayerId: "p-right",
        wins: 2,
      },
      {
        sessionId: "s2",
        leftPlayerId: "p-left",
        rightPlayerId: "p-right",
        wins: 5,
      },
    ],
    startDate: "2026-04-01",
    endDate: "2026-04-30",
  });

  assert.equal(dashboard.topPairs.length, 1);
  assert.equal(dashboard.topPairs[0].wins, 7);
  assert.equal(dashboard.topPairs[0].nights, 2);
  assert.equal(dashboard.summary.totalWins, 7);
  assert.equal(dashboard.summary.nights, 2);
});

test("filtro de período exclui resultados fora do intervalo", () => {
  const dashboard = DashboardService.calculate({
    players: [players[0], players[1]],
    sessions: [
      { id: "old", date: "2025-12-31" },
      { id: "current", date: "2026-01-05" },
    ],
    pairResults: [
      {
        sessionId: "old",
        leftPlayerId: "p-left",
        rightPlayerId: "p-right",
        wins: 10,
      },
      {
        sessionId: "current",
        leftPlayerId: "p-left",
        rightPlayerId: "p-right",
        wins: 2,
      },
    ],
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  });

  assert.equal(dashboard.summary.totalWins, 2);
  assert.equal(dashboard.mostVictoriousPlayer.wins, 2);
  assert.equal(dashboard.mostVictoriousPair.wins, 2);
});
