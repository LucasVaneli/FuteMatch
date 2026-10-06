export class DrawView {
  constructor({
    resultsSection,
    pairsList,
    pairTemplate,
    errorElement,
    playerInputs = [],
  }) {
    this.resultsSection = resultsSection;
    this.pairsList = pairsList;
    this.pairTemplate = pairTemplate;
    this.errorElement = errorElement;
    this.playerInputs = playerInputs;
  }

  renderPairs(pairs, { scroll = true } = {}) {
    this.pairsList.replaceChildren();

    pairs.forEach((pair, index) => {
      const fragment = this.pairTemplate.content.cloneNode(true);
      fragment.querySelector(".pair-number").textContent = String(index + 1).padStart(2, "0");
      fragment.querySelector(".left-player-name").textContent = pair.leftPlayer.name;
      fragment.querySelector(".right-player-name").textContent = pair.rightPlayer.name;
      fragment.querySelector(".pair-player--left .player-role").textContent =
        pair.leftPlayer.isGuest ? "Esquerda • Convidado" : "Esquerda";
      fragment.querySelector(".pair-player--right .player-role").textContent =
        pair.rightPlayer.isGuest ? "Direita • Convidado" : "Direita";
      this.pairsList.append(fragment);
    });

    this.resultsSection.classList.remove("is-hidden");

    if (scroll) {
      this.resultsSection.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }

  showError(message) {
    this.errorElement.textContent = message;
  }

  clearError() {
    this.errorElement.textContent = "";
  }

  clearResults() {
    this.pairsList.replaceChildren();
    this.resultsSection.classList.add("is-hidden");
  }

  clearInputValidation() {
    this.playerInputs.forEach((input) => input.classList.remove("input--invalid"));
  }
}
