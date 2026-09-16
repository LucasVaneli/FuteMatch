const normalizeName = (name) =>
  name
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

const shuffle = (items, random = Math.random) => {
  const shuffledItems = [...items];

  for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [shuffledItems[index], shuffledItems[randomIndex]] = [
      shuffledItems[randomIndex],
      shuffledItems[index],
    ];
  }

  return shuffledItems;
};

export class DrawService {
  static createPairs(leftPlayers, rightPlayers, random = Math.random) {
    this.#validatePlayers(leftPlayers, rightPlayers);

    const shuffledLeftPlayers = shuffle(leftPlayers, random);
    const shuffledRightPlayers = shuffle(rightPlayers, random);

    return shuffledLeftPlayers.map((leftPlayer, index) => ({
      leftPlayer,
      rightPlayer: shuffledRightPlayers[index],
    }));
  }

  static #validatePlayers(leftPlayers, rightPlayers) {
    if (!Array.isArray(leftPlayers) || !Array.isArray(rightPlayers)) {
      throw new TypeError("As listas de jogadores devem ser válidas.");
    }

    const totalPlayers = leftPlayers.length + rightPlayers.length;

    if (totalPlayers < 4) {
      throw new Error("Selecione no mínimo 4 jogadores.");
    }

    if (totalPlayers % 2 !== 0) {
      throw new Error("A quantidade total de jogadores deve ser par.");
    }

    if (leftPlayers.length !== rightPlayers.length) {
      throw new Error("Selecione a mesma quantidade de jogadores de esquerda e de direita.");
    }

    const allPlayers = [...leftPlayers, ...rightPlayers];
    const normalizedNames = allPlayers.map((player) => normalizeName(player.name));
    const uniqueNames = new Set(normalizedNames);

    if (uniqueNames.size !== normalizedNames.length) {
      throw new Error("Os nomes dos jogadores não podem ser repetidos.");
    }
  }
}
