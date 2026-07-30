const numberFormatter = new Intl.NumberFormat();

for (const demo of document.querySelectorAll("[data-logo-demo]")) {
  const renderer = demo.querySelector("haifa-logo-ascii");
  const playButton = demo.querySelector('[data-action="toggle-play"]');
  const speedInput = demo.querySelector('[data-control="speed"]');
  const speedOutput = demo.querySelector('[data-output="speed"]');
  const fpsOutput = demo.querySelector('[data-stat="fps"]');
  const frameTimeOutput = demo.querySelector('[data-stat="frame-time"]');
  const pointsOutput = demo.querySelector('[data-stat="points"]');
  const visibleCellsOutput = demo.querySelector('[data-stat="visible-cells"]');

  function updatePlaybackLabel() {
    const paused = renderer.hasAttribute("paused");
    playButton.textContent = paused ? "Play" : "Pause";
    playButton.setAttribute("aria-label", paused ? "Play animation" : "Pause animation");
  }

  playButton.addEventListener("click", () => {
    renderer.toggleAttribute("paused");
    updatePlaybackLabel();
  });

  speedInput.addEventListener("input", () => {
    const speed = Number(speedInput.value);
    renderer.setAttribute("speed", String(speed));
    speedOutput.value = `${speed.toFixed(1)}×`;
  });

  renderer.addEventListener("renderstats", (event) => {
    const { fps, frameTime, pointCount, visibleCells } = event.detail;
    fpsOutput.textContent = fps.toFixed(1);
    frameTimeOutput.textContent = `${frameTime.toFixed(1)} ms`;
    pointsOutput.textContent = numberFormatter.format(pointCount);
    visibleCellsOutput.textContent = numberFormatter.format(visibleCells);
  });

  updatePlaybackLabel();
}
