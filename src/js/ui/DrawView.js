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

  renderPairs(pairs) {
    this.pairsList.replaceChildren();

    pairs.forEach((pair, index) => {
      const fragment = this.pairTemplate.content.cloneNode(true);
      fragment.querySelector(".pair-number").textContent = String(index + 1).padStart(2, "0");
      fragment.querySelector(".left-player-name").textContent = pair.leftPlayer.name;
      fragment.querySelector(".right-player-name").textContent = pair.rightPlayer.name;
      this.pairsList.append(fragment);
    });

    this.resultsSection.classList.remove("is-hidden");
    this.resultsSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
