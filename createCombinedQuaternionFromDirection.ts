/*

function createCombinedQuaternionFromDirection(directionRaw: string): BABYLON.Quaternion {
  let direction: [number, number, number] = [0, 0, 0];

  try {
    const parsed = JSON.parse(directionRaw);
    if (Array.isArray(parsed) && parsed.length === 3) {
      direction = parsed;
    } else {
      console.warn("Invalid direction format, using default [0,0,0]");
    }
  } catch (error) {
    console.error("Failed to parse direction:", error);
  }

  const [x, y, z] = direction;

  const xRot = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, x);
  const yRot = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, y);
  const zRot = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, z);

  return xRot.multiply(yRot).multiply(zRot);
}

*/

function createCombinedQuaternionFromDirection(directionRaw: string): BABYLON.Quaternion {
  let direction: [number, number, number] = [0, 0, 0];

  try {
    const parsed = JSON.parse(directionRaw);
    if (
      Array.isArray(parsed) &&
      parsed.length === 3 &&
      typeof parsed[0] === 'number' &&
      typeof parsed[1] === 'number' &&
      typeof parsed[2] === 'number'
    ) {
      direction = [parsed[0], parsed[1], parsed[2]];
    } else {
      console.warn("Invalid direction format, using default [0,0,0]");
    }
  } catch (error) {
    console.error("Failed to parse direction:", error);
  }

  const [x, y, z] = direction;

  const xRot = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, x);
  const yRot = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, y);
  const zRot = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, z);

  return xRot.multiply(yRot).multiply(zRot);
}
