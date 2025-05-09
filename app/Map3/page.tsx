"use client";

import React, { useEffect, useRef } from 'react';
import { Engine, Scene } from '@babylonjs/core';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF';

const BabylonScene = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine(canvas, true);
    const scene = new Scene(engine);

    const camera = new ArcRotateCamera("camera1", Math.PI / 2, Math.PI / 2, 2, Vector3.Zero(), scene);
    camera.attachControl(canvas, true);

    const light = new HemisphericLight("light1", new Vector3(1, 1, 0), scene);

    const s3Url = "https://your-bucket-name.s3.amazonaws.com/your-model.gltf";
    //const s3Url = "https://pckk-device.s3.ap-northeast-1.amazonaws.com/34M_17.gltf";


    SceneLoader.Append("", s3Url, scene, (scene) => {
      console.log("モデルが正常に読み込まれました！");

      if (scene.activeCamera && scene.activeCamera instanceof ArcRotateCamera) {
        scene.activeCamera.alpha += Math.PI;
      } else {
        console.error("Active camera is null or not an ArcRotateCamera");
      }
    });

    engine.runRenderLoop(() => {
      scene.render();
    });

    window.addEventListener("resize", () => {
      engine.resize();
    });

    return () => {
      engine.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />;
};

export default BabylonScene;
