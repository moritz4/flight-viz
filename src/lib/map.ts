import {
  Map,
  type CustomLayerInterface,
  type LngLatBoundsLike,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as THREE from "three";
import { renderLoop, Timer } from "./scene.svelte";

interface CustomLayer extends CustomLayerInterface {
  camera?: THREE.Camera;
  scene?: THREE.Scene;
  map?: Map;
  renderer?: THREE.WebGLRenderer;
}

const MAPBOUNDS: LngLatBoundsLike = [
  [-7, 49],
  [5, 60],
]; // sw, ne

export function createMap(
  scene: THREE.Scene,
  timer: Timer,
  resolveFunction: (value?: any) => void,
  mapContainer: HTMLElement,
) {
  // create map
  const map = new Map({
    container: mapContainer, // container id
    style:
      "https://api.maptiler.com/maps/ebc4cdf4-843c-4348-b1d6-6900624f2513/style.json?key=QHR3cDWrfl0JisqI70ry", // style URL
    zoom: 7,
    center: [-1, 52],
    pitch: 60,
    bearing: -10,
    maxZoom: 10,
    maxBounds: MAPBOUNDS,
    minZoom: 6,
    attributionControl: false,
  });

  // Listen for when initial tiles are loaded
  map.on("load", () => {
    resolveFunction(); // Resolve the promise when the map is loaded
  });

  // configuration of the custom layer for a 3D model per the CustomLayerInterface
  const customLayer = {
    id: "3d-model",
    type: "custom",
    renderingMode: "3d", // The layer MUST be marked as 3D in order to get the proper depth buffer with globe depths in it.

    onAdd(map: Map, gl: WebGLRenderingContext) {
      this.camera = new THREE.Camera();
      this.scene = scene;

      this.map = map;

      // use the MapLibre GL JS map canvas for three.js
      this.renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });

      this.renderer.autoClear = false;
    },
    render(gl, args) {
      // parameters to ensure the model is georeferenced correctly on the map
      const modelOrigin = [0, 0];
      const modelAltitude = 0;

      // Make the object ~10s of km tall to make it visible at planetary scale.
      const scaling = 10_000.0;

      // We can use this API to get the correct model matrix.
      // It will work regardless of current projection.
      // See MapLibre source code, file "mercator_transform.ts" or "vertical_perspective_transform.ts".
      const modelMatrix = map.transform.getMatrixForModel(
        modelOrigin,
        modelAltitude,
      );
      const m = new THREE.Matrix4().fromArray(
        args.defaultProjectionData.mainMatrix,
      );
      const l = new THREE.Matrix4()
        .fromArray(modelMatrix)
        .scale(new THREE.Vector3(scaling, scaling, scaling));

      renderLoop(this.scene!, timer);
      this.camera.projectionMatrix = m.multiply(l);
      this.renderer.resetState();
      this.renderer.render(this.scene, this.camera);
      this.map.triggerRepaint();
    },
  };

  map.on("style.load", () => {
    map.addLayer(customLayer);
  });

  return map;
}
