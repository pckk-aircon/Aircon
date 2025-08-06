declare module 'three/examples/jsm/loaders/GLTFLoader' {
  import { Loader } from 'three';
  import { LoadingManager } from 'three';
  import { Group } from 'three';

  export class GLTFLoader extends Loader {
    constructor(manager?: LoadingManager);
    load(
      url: string,
      onLoad: (gltf: { scene: Group }) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (event: ErrorEvent) => void
    ): void;
  }
}
