<script lang="ts">
  import Intro from "./lib/Intro.svelte";
  import * as THREE from "three";
  import { createMap } from "./lib/map";
  import { onMount } from "svelte";
  import { fetchData } from "./lib/data";
  import { initScene, Timer } from "./lib/scene.svelte";
  import Scrubber from "./lib/Scrubber.svelte";
  import type { Map } from "maplibre-gl";

  let mapContainer: HTMLElement;
  let mapReady = $state(false);
  let showIntro = $state(true);

  const scene = new THREE.Scene();

  const timer = new Timer(0, 0);

  // Create a variable to hold the resolve function
  let resolveFunction: (value?: any) => void;

  let map: Map;

  // Create the promise and capture the resolve function
  const mapLoaded = new Promise((resolve) => {
    resolveFunction = resolve;
  });

  onMount(() => {
    data.then((data) => {
      const startTime = Math.min(
        ...Object.values(data).map((flight) => flight.positions[0][0]),
      );
      const endTime = Math.max(
        ...Object.values(data).map(
          (flight) => flight.positions[flight.positions.length - 1][0],
        ),
      );

      timer.startTime = startTime + 60;
      timer.endTime = endTime;
      timer.currentTime = startTime + 60 * 20;

      initScene(scene, data);

      // Create map and attach the scene to the map's custom layer
      map = createMap(scene, timer, resolveFunction, mapContainer);
    });
  });

  // Fetch flight data
  const data = fetchData();

  // Change button to make it clickable
  Promise.all([data, mapLoaded]).then(() => {
    mapReady = true;
  });

  // Close the intro window
  function closeWindow() {
    showIntro = false;
    // Start the timer
    timer.playing = true;
    map.easeTo({
      center: [-0.5, 51.5],
      zoom: 7.4,
      pitch: 60,
      bearing: -30,
      duration: 200000,
      essential: true,
    });
  }
</script>

<div
  class="min-h-screen min-w-screen {showIntro ? 'blur-xs scale-[1.03]' : ''}"
  bind:this={mapContainer}
></div>

<div
  class="mx-auto fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5/6 md:w-lg"
>
  {#if showIntro}
    <Intro bind:enabled={mapReady} {closeWindow} />
  {/if}
</div>

{#if !showIntro}
  <div class="absolute bottom-10 left-1/2 -translate-x-1/2 w-7/8">
    <Scrubber {timer} />
  </div>
{/if}
