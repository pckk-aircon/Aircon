function createCombinedQuaternionFromDirection(direction: [number, number, number]): BABYLON.Quaternion {
  const [x, y, z] = direction;

  const xRot = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, x);
  const yRot = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, y);
  const zRot = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, z);

  return xRot.multiply(yRot).multiply(zRot); // X → Y → Z の順で合成
}
