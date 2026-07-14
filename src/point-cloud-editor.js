const canvas = document.querySelector("#editor");
const context = canvas.getContext("2d");
const presetSelect = document.querySelector("#preset");
const fileInput = document.querySelector("#json-file");
const viewSelect = document.querySelector("#view-mode");
const backgroundSelect = document.querySelector("#background");
const colorInput = document.querySelector("#color");
const brushSelect = document.querySelector("#brush-size");
const countOutput = document.querySelector("#count");
const statusOutput = document.querySelector("#status");
const fitButton = document.querySelector("#fit");
const undoButton = document.querySelector("#undo");
const redoButton = document.querySelector("#redo");
const resetButton = document.querySelector("#reset");
const downloadButton = document.querySelector("#download");

const RAMP = " .,:;irsXA253hMHGS#9B&@";
let points = [];
let originalPoints = [];
let undoStack = [];
let redoStack = [];
let drawing = false;
let strokeBefore = null;
let transform = { scale: 1, centerX: 0, centerY: 0, modelCenterX: 0, modelCenterY: 0 };
let activeFilename = "points.json";
let asciiGrid = null;

const clonePoints = (value) => value.map((point) => [...point]);

function selectedTool(event) {
  if (event?.button === 2) return "remove";
  return document.querySelector('input[name="tool"]:checked').value;
}

function selectedColor() {
  const value = colorInput.value;
  return [1, 3, 5].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
}

function updateHistoryButtons() {
  undoButton.disabled = undoStack.length === 0;
  redoButton.disabled = redoStack.length === 0;
}

function setStatus(message) {
  statusOutput.textContent = message;
  countOutput.textContent = points.length.toLocaleString();
}

function filenameFromPath(value) {
  return value.split("?")[0].split("/").pop() || "points.json";
}

function pointBounds(values = points) {
  if (!values.length) return { minX: -1, maxX: 1, minY: -1, maxY: 1, centerX: 0, centerY: 0, spanX: 2, spanY: 2 };
  const xs = values.map((point) => point[0]);
  const ys = values.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX,
    maxX,
    minY,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    spanX: Math.max(maxX - minX, 0.1),
    spanY: Math.max(maxY - minY, 0.1),
  };
}

function fitTransform() {
  const padding = 48 * Math.min(devicePixelRatio || 1, 2);
  const bounds = pointBounds();
  transform = {
    scale: Math.max(1, Math.min((canvas.width - padding * 2) / bounds.spanX, (canvas.height - padding * 2) / bounds.spanY)),
    centerX: canvas.width / 2,
    centerY: canvas.height / 2,
    modelCenterX: bounds.centerX,
    modelCenterY: bounds.centerY,
  };
}

function modelToCanvas(x, y) {
  return [
    transform.centerX + (x - transform.modelCenterX) * transform.scale,
    transform.centerY - (y - transform.modelCenterY) * transform.scale,
  ];
}

function canvasToModel(x, y) {
  return [
    transform.modelCenterX + (x - transform.centerX) / transform.scale,
    transform.modelCenterY + (transform.centerY - y) / transform.scale,
  ];
}

function backgroundColor() {
  return backgroundSelect.value === "light" ? "#ffffff" : "#07111f";
}

function render() {
  if (viewSelect.value === "ascii") {
    renderAscii();
    return;
  }

  context.fillStyle = backgroundColor();
  context.fillRect(0, 0, canvas.width, canvas.height);
  const radius = Math.max(1.2, Math.min(3, transform.scale * 0.012));
  for (const [x, y, r, g, b] of points) {
    const [screenX, screenY] = modelToCanvas(x, y);
    context.fillStyle = `rgb(${r}, ${g}, ${b})`;
    context.beginPath();
    context.arc(screenX, screenY, radius, 0, Math.PI * 2);
    context.fill();
  }
  countOutput.textContent = points.length.toLocaleString();
}

function buildAsciiGrid() {
  const columns = Math.max(60, Math.min(132, Math.floor(canvas.width / 10)));
  const rows = Math.max(24, Math.min(48, Math.floor(canvas.height / 14)));
  const bounds = pointBounds();
  const scale = Math.min(columns * 0.86 / bounds.spanX, rows * 0.82 / bounds.spanY);
  const count = columns * rows;
  const chars = new Uint8Array(count);
  const colors = new Uint32Array(count);
  const zBuffer = new Float32Array(count);
  zBuffer.fill(-1e9);
  const normalizer = Math.max(bounds.spanX, bounds.spanY, 0.1);

  for (const [x, y, r, g, b] of points) {
    const nx = (x - bounds.centerX) / normalizer;
    const ny = (y - bounds.centerY) / normalizer;
    const baseZ = 0.18 * Math.sin(nx * 7) + 0.08 * Math.cos(ny * 8);
    for (const dz of [-0.12, 0, 0.12]) {
      const z = baseZ + dz;
      const sx = Math.trunc(columns / 2 + (x - bounds.centerX) * scale);
      const sy = Math.trunc(rows / 2 - (y - bounds.centerY) * scale);
      if (sx < 0 || sx >= columns || sy < 0 || sy >= rows) continue;
      const index = sy * columns + sx;
      if (z <= zBuffer[index]) continue;
      zBuffer[index] = z;
      const light = Math.max(0, Math.min(1, 0.55 + 0.3 * z + 0.15 * Math.sin(nx * 5)));
      chars[index] = Math.max(1, Math.min(RAMP.length - 1, Math.trunc(light * (RAMP.length - 1))));
      const shade = 0.72 + 0.34 * light;
      colors[index] = (
        Math.max(0, Math.min(255, Math.trunc(r * shade))) << 16
        | Math.max(0, Math.min(255, Math.trunc(g * shade))) << 8
        | Math.max(0, Math.min(255, Math.trunc(b * shade)))
      );
    }
  }
  return { columns, rows, scale, centerX: bounds.centerX, centerY: bounds.centerY, chars, colors };
}

function renderAscii() {
  asciiGrid = buildAsciiGrid();
  const { columns, rows, chars, colors } = asciiGrid;
  const cellWidth = canvas.width / columns;
  const cellHeight = canvas.height / rows;
  context.fillStyle = backgroundColor();
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `${Math.max(8, cellHeight * 0.88)}px ui-monospace, SFMono-Regular, Consolas, monospace`;

  for (let index = 0; index < chars.length; index += 1) {
    if (!chars[index]) continue;
    const color = colors[index];
    context.fillStyle = `rgb(${color >> 16}, ${(color >> 8) & 255}, ${color & 255})`;
    context.fillText(
      RAMP[chars[index]],
      (index % columns + 0.5) * cellWidth,
      (Math.floor(index / columns) + 0.5) * cellHeight,
    );
  }
}

function resize() {
  const bounds = canvas.getBoundingClientRect();
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(bounds.width * ratio));
  canvas.height = Math.max(1, Math.round(bounds.height * ratio));
  fitTransform();
  render();
}

function validatePointData(value) {
  if (!Array.isArray(value) || value.length === 0) throw new Error("The JSON root must be a non-empty array.");
  return value.map((point, index) => {
    if (!Array.isArray(point) || point.length !== 5 || !point.every(Number.isFinite)) {
      throw new Error(`Point ${index + 1} must contain exactly five numbers: [x, y, r, g, b].`);
    }
    const [x, y, r, g, b] = point;
    if ([r, g, b].some((channel) => channel < 0 || channel > 255)) {
      throw new Error(`Point ${index + 1} contains an RGB value outside 0-255.`);
    }
    return [x, y, Math.round(r), Math.round(g), Math.round(b)];
  });
}

function loadPointSet(value, filename, message) {
  points = validatePointData(value);
  originalPoints = clonePoints(points);
  activeFilename = filename;
  undoStack = [];
  redoStack = [];
  asciiGrid = null;
  updateHistoryButtons();
  fitTransform();
  setStatus(message);
  render();
}

async function loadPreset() {
  setStatus("Loading example data...");
  try {
    const response = await fetch(presetSelect.value);
    if (!response.ok) throw new Error(`Request failed (${response.status}).`);
    const option = presetSelect.selectedOptions[0];
    backgroundSelect.value = option.dataset.background || "dark";
    loadPointSet(await response.json(), filenameFromPath(presetSelect.value), "Ready - drag on the canvas to edit");
  } catch (error) {
    setStatus("Could not load the selected example");
    console.error(error);
  }
}

async function loadLocalFile() {
  const file = fileInput.files?.[0];
  if (!file) return;
  setStatus(`Loading ${file.name}...`);
  try {
    presetSelect.value = "";
    loadPointSet(JSON.parse(await file.text()), file.name.endsWith(".json") ? file.name : `${file.name}.json`, `Loaded ${file.name}`);
  } catch (error) {
    setStatus(`Invalid JSON: ${error.message}`);
  }
}

function eventPosition(event) {
  const bounds = canvas.getBoundingClientRect();
  return [
    (event.clientX - bounds.left) * canvas.width / bounds.width,
    (event.clientY - bounds.top) * canvas.height / bounds.height,
  ];
}

function editAt(event) {
  const [canvasX, canvasY] = eventPosition(event);
  const brush = Number(brushSelect.value);
  const tool = selectedTool(event);
  let x;
  let y;
  let spacing;

  if (viewSelect.value === "ascii") {
    asciiGrid ||= buildAsciiGrid();
    const sx = Math.max(0, Math.min(asciiGrid.columns - 1, Math.floor(canvasX / canvas.width * asciiGrid.columns)));
    const sy = Math.max(0, Math.min(asciiGrid.rows - 1, Math.floor(canvasY / canvas.height * asciiGrid.rows)));
    x = asciiGrid.centerX + (sx + 0.5 - asciiGrid.columns / 2) / asciiGrid.scale;
    y = asciiGrid.centerY + (asciiGrid.rows / 2 - sy - 0.5) / asciiGrid.scale;
    spacing = 1 / asciiGrid.scale;
  } else {
    [x, y] = canvasToModel(canvasX, canvasY);
    spacing = Math.max(0.006, 3 / transform.scale);
  }

  if (tool === "add") {
    const [r, g, b] = selectedColor();
    const half = Math.floor(brush / 2);
    for (let row = -half; row <= half; row += 1) {
      for (let column = -half; column <= half; column += 1) {
        const px = x + column * spacing;
        const py = y + row * spacing;
        const threshold = Math.max(0.000001, (spacing * 0.38) ** 2);
        const duplicate = points.some((point) => (point[0] - px) ** 2 + (point[1] - py) ** 2 < threshold);
        if (!duplicate) points.push([Number(px.toFixed(4)), Number(py.toFixed(4)), r, g, b]);
      }
    }
    setStatus("Point added");
  } else {
    const radius = spacing * Math.max(0.7, brush * 0.6);
    const before = points.length;
    points = points.filter((point) => (point[0] - x) ** 2 + (point[1] - y) ** 2 > radius ** 2);
    setStatus(before === points.length ? "No point under the brush" : `${before - points.length} point(s) removed`);
  }
  asciiGrid = null;
  render();
}

function beginStroke(event) {
  if (event.button !== 0 && event.button !== 2) return;
  event.preventDefault();
  drawing = true;
  strokeBefore = clonePoints(points);
  canvas.setPointerCapture(event.pointerId);
  editAt(event);
}

function continueStroke(event) {
  if (drawing) editAt(event);
}

function endStroke(event) {
  if (!drawing) return;
  drawing = false;
  canvas.releasePointerCapture(event.pointerId);
  if (JSON.stringify(strokeBefore) !== JSON.stringify(points)) {
    undoStack.push(strokeBefore);
    redoStack = [];
    updateHistoryButtons();
  }
  strokeBefore = null;
}

function restoreFrom(source, destination, message) {
  if (!source.length) return;
  destination.push(clonePoints(points));
  points = source.pop();
  asciiGrid = null;
  updateHistoryButtons();
  setStatus(message);
  render();
}

presetSelect.addEventListener("change", loadPreset);
fileInput.addEventListener("change", loadLocalFile);
viewSelect.addEventListener("change", () => {
  asciiGrid = null;
  setStatus(viewSelect.value === "ascii" ? "ASCII cells are editable" : "Cloud points are editable");
  render();
});
backgroundSelect.addEventListener("change", render);
fitButton.addEventListener("click", () => {
  fitTransform();
  asciiGrid = null;
  setStatus("View fitted to point data");
  render();
});
canvas.addEventListener("pointerdown", beginStroke);
canvas.addEventListener("pointermove", continueStroke);
canvas.addEventListener("pointerup", endStroke);
canvas.addEventListener("pointercancel", endStroke);
canvas.addEventListener("contextmenu", (event) => event.preventDefault());
undoButton.addEventListener("click", () => restoreFrom(undoStack, redoStack, "Undid last edit"));
redoButton.addEventListener("click", () => restoreFrom(redoStack, undoStack, "Redid last edit"));
resetButton.addEventListener("click", () => {
  undoStack.push(clonePoints(points));
  points = clonePoints(originalPoints);
  redoStack = [];
  asciiGrid = null;
  updateHistoryButtons();
  fitTransform();
  setStatus("Reset to loaded data");
  render();
});
downloadButton.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(points)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = activeFilename;
  link.click();
  URL.revokeObjectURL(url);
  setStatus(`Exported ${activeFilename}`);
});

new ResizeObserver(resize).observe(canvas);
loadPreset();
