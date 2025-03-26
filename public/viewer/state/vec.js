import { Vec3 } from "playcanvas";

function getAverageCenter(centerPoints) {
  if (!centerPoints.length) return new Vec3(0, 0, 0); // Default if empty

  let sum = new Vec3(0, 0, 0);

  centerPoints.forEach((center) => {
    sum.add(center);
  });

  return sum.scale(1 / centerPoints.length); // Divide by the number of points
}

function getCombinedSize(centers, halfExtents) {
  if (centers.length === 0 || halfExtents.length === 0) {
    return new Vec3(1, 1, 1);
  }

  let min = new Vec3(Infinity, Infinity, Infinity);
  let max = new Vec3(-Infinity, -Infinity, -Infinity);

  centers.forEach((center, index) => {
    const halfExtent = halfExtents[index];

    min.x = Math.min(min.x, center.x - halfExtent.x);
    min.y = Math.min(min.y, center.y - halfExtent.y);
    min.z = Math.min(min.z, center.z - halfExtent.z);

    max.x = Math.max(max.x, center.x + halfExtent.x);
    max.y = Math.max(max.y, center.y + halfExtent.y);
    max.z = Math.max(max.z, center.z + halfExtent.z);
  });

  return new Vec3(max.x - min.x, max.y - min.y, max.z - min.z);
}

export { getCombinedSize, getAverageCenter };
