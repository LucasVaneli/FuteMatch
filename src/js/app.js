import {
  Player,
  PLAYER_SIDE,
} from "./domain/Player.js";

import {
  DrawService,
} from "./services/DrawService.js";

import {
  DrawView,
} from "./ui/DrawView.js";


const drawForm =
  document.querySelector("#draw-form");

const drawButton =
  document.querySelector("#draw-button");

const clearButton =
  document.querySelector("#clear-button");

const redrawButton =
  document.querySelector("#redraw-button");

const resultsSection =
  document.querySelector("#results-section");

const pairsList =
  document.querySelector("#pairs-list");

const pairTemplate =
  document.querySelector("#pair-template");

const errorElement =
  document.querySelector("#form-error");

const playerInputs = [
  ...document.querySelectorAll("[data-side]"),
];


const view = new DrawView({
  resultsSection,
  pairsList,
  pairTemplate,
  errorElement,
  playerInputs,
});


const getPlayersBySide = (side) =>
  playerInputs
    .filter(
      (input) =>
        input.dataset.side === side &&
        input.value.trim(),
    )
    .map(
      (input) =>
        new Player(
          input.value,
          side,
        ),
    );


const handleDraw = () => {
  view.clearError();
  view.clearInputValidation();

  try {

    const leftPlayers =
      getPlayersBySide(
        PLAYER_SIDE.LEFT,
      );

    const rightPlayers =
      getPlayersBySide(
        PLAYER_SIDE.RIGHT,
      );

    const pairs =
      DrawService.createPairs(
        leftPlayers,
        rightPlayers,
      );

    view.renderPairs(pairs);

  } catch (error) {

    view.showError(
      error.message,
    );

  }
};


drawForm.addEventListener(
  "submit",
  (event) => {

    event.preventDefault();

    handleDraw();

  },
);


redrawButton.addEventListener(
  "click",
  handleDraw,
);


clearButton.addEventListener(
  "click",
  () => {

    drawForm.reset();

    view.clearError();

    view.clearResults();

    view.clearInputValidation();

    playerInputs[0]?.focus();

  },
);


playerInputs.forEach(
  (input) => {

    input.addEventListener(
      "input",
      () => {

        input.classList.remove(
          "input--invalid",
        );

        if (
          errorElement.textContent
        ) {
          view.clearError();
        }

      },
    );

  },
);


drawButton.addEventListener(
  "pointerdown",
  () => {

    drawButton.classList.add(
      "is-pressing",
    );

  },
);


drawButton.addEventListener(
  "pointerup",
  () => {

    drawButton.classList.remove(
      "is-pressing",
    );

  },
);