export const PLAYER_SIDE = Object.freeze({
  LEFT: "left",
  RIGHT: "right",
});

export class Player {
  constructor(name, side) {
    if (!name?.trim()) {
      throw new Error("O nome do jogador é obrigatório.");
    }

    if (!Object.values(PLAYER_SIDE).includes(side)) {
      throw new Error("O lado informado para o jogador é inválido.");
    }

    this.name = name.trim();
    this.side = side;

    Object.freeze(this);
  }
}
