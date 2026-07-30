import { readFile, writeFile } from "node:fs/promises";

const logoFiles = [
  new URL("../data/haifa-logo-points.json", import.meta.url),
  new URL("../data/second-logo-points.json", import.meta.url),
];

function round(value, digits = 5) {
  return Number(value.toFixed(digits));
}

function addLogoDepth(points) {
  if (points.every((point) => point.length === 6)) return points;
  if (!points.every((point) => point.length === 5)) {
    throw new Error("Logo source points must consistently use either 2D or 3D point tuples.");
  }

  const quantized = new Set(points.map(([x, y]) => `${Math.round(x / 0.16)},${Math.round(y / 0.16)}`));
  const result = [];

  for (const [index, [x, y, r, g, b]] of points.entries()) {
    const qx = Math.round(x / 0.16);
    const qy = Math.round(y / 0.16);
    const surface = 0.12 * Math.sin(x * 1.15) + 0.06 * Math.cos(y * 2);
    const addPoint = (z) => result.push([x, y, round(z), r, g, b]);

    addPoint(surface + 0.42);
    if (index % 3 === 0) addPoint(surface - 0.42);

    const isRim =
      !quantized.has(`${qx - 1},${qy}`) ||
      !quantized.has(`${qx + 1},${qy}`) ||
      !quantized.has(`${qx},${qy - 1}`) ||
      !quantized.has(`${qx},${qy + 1}`);

    if (isRim) {
      for (const depth of [-0.28, 0, 0.28]) addPoint(surface + depth);
    }
  }

  return result;
}

function createSpherePoints() {
  const points = [];
  const radius = 2.05;

  for (let latitude = -84; latitude <= 84; latitude += 6) {
    const phi = latitude * Math.PI / 180;
    const ringRadius = Math.cos(phi);
    for (let longitude = 0; longitude < 360; longitude += 6) {
      const theta = longitude * Math.PI / 180;
      const normalX = ringRadius * Math.cos(theta);
      const normalY = Math.sin(phi);
      const normalZ = ringRadius * Math.sin(theta);
      const r = Math.round(70 + 75 * (normalY + 1));
      const g = Math.round(135 + 55 * (normalZ + 1));
      const b = Math.round(185 + 35 * (normalX + 1));
      points.push([
        round(radius * normalX),
        round(radius * normalY),
        round(radius * normalZ),
        r,
        g,
        b,
      ]);
    }
  }

  return points;
}

for (const file of logoFiles) {
  const points = JSON.parse(await readFile(file, "utf8"));
  await writeFile(file, JSON.stringify(addLogoDepth(points)));
}

const sphereFile = new URL("../data/sphere-points.json", import.meta.url);
await writeFile(sphereFile, JSON.stringify(createSpherePoints()));
