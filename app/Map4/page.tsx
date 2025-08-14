'use client';

import { useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';

function BabylonMapLayer({
  map,
  worldPosition,
  worldRotate,
  worldScale
}: {
  map: maplibregl.Map;
  worldPosition: BABYLON.Vector3;
  worldRotate: BABYLON.Quaternion;
  worldScale: number;
}) {
  useEffect(() => {
    const customLayer: maplibregl.CustomLayerInterface & {
      engine?: BABYLON.Engine;
      scene?: BABYLON.Scene;
      camera?: BABYLON.Camera;
    } = {
      id: '3d-model',
      type: 'custom',
      renderingMode: '3d',
      onAdd(map, gl) {
        this.engine = new BABYLON.Engine(gl, true, {
          useHighPrecisionMatrix: true
        }, true);

        this.scene = new BABYLON.Scene(this.engine);
        this.scene.autoClear = false;
        this.scene.detachControl();

        this.camera = new BABYLON.Camera('Camera', new BABYLON.Vector3(0, 0, 0), this.scene);
        this.camera.minZ = 0.001;

        const light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 0, 100), this.scene);
        light.intensity = 0.7;

        new BABYLON.AxesViewer(this.scene, 5);

        BABYLON.SceneLoader.LoadAssetContainerAsync(
          'https://maplibre.org/maplibre-gl-js/docs/assets/34M_17/',
          '34M_17.gltf',
          this.scene
        ).then((container) => {
          container.addAllToScene();

          const rootMesh = container.createRootMesh();

          const material = new BABYLON.StandardMaterial("mat", this.scene);
          material.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.8);
          rootMesh.material = material;

          rootMesh.setAbsolutePosition(worldPosition);
          rootMesh.rotationQuaternion = worldRotate;
          rootMesh.scaling = new BABYLON.Vector3(worldScale, worldScale, worldScale);
        }).catch((error) => {
          console.error("モデル読み込み失敗:", error);
        });
      },
      render(gl, args) {
        const cameraMatrix = BABYLON.Matrix.FromArray(args.defaultProjectionData.mainMatrix);
        this.camera?.freezeProjectionMatrix(cameraMatrix);
        this.scene?.render(false);
        map.triggerRepaint();
      }
    };

    map.on('style.load', () => {
      map.addLayer(customLayer);
    });
  }, [map, worldPosition, worldRotate, worldScale]);

  return null;
}

// ページコンポーネントとしてラップ
export default function MapPage() {
  // 仮のダミーデータ（実際は props や context から取得）
  const dummyMap = {} as maplibregl.Map;
  const dummyPosition = new BABYLON.Vector3(0, 0, 0);
  const dummyRotate = BABYLON.Quaternion.Identity();
  const dummyScale = 1;

  return (
    <BabylonMapLayer
      map={dummyMap}
      worldPosition={dummyPosition}
      worldRotate={dummyRotate}
      worldScale={dummyScale}
    />
  );
}





