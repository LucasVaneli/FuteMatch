import { PLAYER_SIDE } from "../domain/Player.js";

export class RankingService {
  static calculate({ players, attendances, pairResults }) {
    const ranking = new Map(
      players.map((player) => [
        player.id,
        {
          player,
          attendancePoints: 0,
          barbecuePoints: 0,
          victoryPoints: 0,
          totalPoints: 0,
          nights: 0,
          wins: 0,
          barbecues: 0,
        },
      ]),
    );

    attendances.forEach((attendance) => {
      const item = ranking.get(attendance.playerId);
      if (!item || attendance.status !== "present") return;

      item.nights += 1;
      item.attendancePoints += 1;

      if (attendance.barbecue) {
        item.barbecues += 1;
        item.barbecuePoints += 5;
      }
    });

    pairResults.forEach((result) => {
      const wins = Math.max(0, Number(result.wins) || 0);
      [result.leftPlayerId, result.rightPlayerId].forEach((playerId) => {
        const item = ranking.get(playerId);
        if (!item) return;
        item.wins += wins;
        item.victoryPoints += wins;
      });
    });

    ranking.forEach((item) => {
      item.totalPoints =
        item.attendancePoints + item.barbecuePoints + item.victoryPoints;
    });

    const sortRanking = (items) =>
      items.sort(
        (a, b) =>
          b.totalPoints - a.totalPoints ||
          b.wins - a.wins ||
          a.player.name.localeCompare(b.player.name, "pt-BR"),
      );

    return {
      left: sortRanking(
        [...ranking.values()].filter((item) => item.player.side === PLAYER_SIDE.LEFT),
      ),
      right: sortRanking(
        [...ranking.values()].filter((item) => item.player.side === PLAYER_SIDE.RIGHT),
      ),
    };
  }
}
