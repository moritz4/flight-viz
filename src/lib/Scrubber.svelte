<script lang="ts">
  import { Timer } from "./scene.svelte";
  import { format } from "date-fns";
  import { Pause, Play } from "@lucide/svelte";

  let { timer }: { timer: Timer } = $props();

  let scrubberElement = $state<HTMLElement | null>(null);

  function scrubTo(e: Event) {
    // e.offsetX tells us how far along the scrubber the click was, relative to the total width of the scrubber
    const scrubberWidth = scrubberElement.offsetWidth;
    const percentage = e.offsetX / scrubberWidth;

    // Set timer
    timer.currentTime =
      timer.startTime + percentage * (timer.endTime - timer.startTime);
  }

  // Set the playhead position in pixels based on the progress
  let playheadPositionX = $derived.by(() => {
    if (!scrubberElement) return 0; // If the element isn't ready yet, return 0
    const progress =
      (timer.currentTime - timer.startTime) / (timer.endTime - timer.startTime);
    return progress * scrubberElement.offsetWidth - 8; // Subtract half the playhead width to center it
  });
</script>

<div
  class="bg-blue-900/50 w-full h-12 flex justify-between items-center px-5 font-mono gap-5 text-amber-100 rounded-lg"
>
  <div
    class="text-2xl hover:cursor-pointer hover:text-3xl transition-all duration-75 w-6 text-center"
    onclick={() => (timer.playing = !timer.playing)}
  >
    {#if timer.playing}
      <Pause />
    {:else}
      <Play />
    {/if}
  </div>

  <div class="w-full" bind:this={scrubberElement}>
    <div class="w-full py-3 flex items-center cursor-pointer" onclick={scrubTo}>
      <div class="w-full h-1 bg-amber-100 relative">
        <div
          class="rounded-full w-4 h-4 absolute bg-amber-100 -top-1.5 transition-all duration-75"
          style="left: {playheadPositionX}px;"
        ></div>
      </div>
    </div>
  </div>

  <div class="flex flex-col items-center">
    <p>{format(new Date(timer.currentTime * 1000), "HH:mm")}</p>
    <p class="text-xs whitespace-nowrap">
      {format(new Date(timer.currentTime * 1000), "E dd/MM")}
    </p>
  </div>
</div>
