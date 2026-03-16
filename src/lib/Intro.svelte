<script lang="ts">
  let {
    enabled = $bindable(false),
    closeWindow,
  }: {
    enabled: boolean;
    closeWindow: () => void;
  } = $props();
</script>

<div
  class="flex flex-col items-center gap-10 bg-[#16486A] p-5 md:p-20 text-white rounded-3xl font-mono"
>
  <h1 class="text-2xl md:text-4xl font-bold">UK flights</h1>
  <div>
    <p>
      Every day, more than 6,500 flights cross UK airspace — enough to carry
      over a million passengers.
    </p>
    <p class="md:mt-5">
      Each follows a precise corridor: fixed airways, stacked holding patterns,
      and tightly sequenced runways.
    </p>
    <p class="md:mt-5">Here's what that looked like over the last 24 hours.</p>
  </div>
  <button
    class="rounded-2xl border px-4 text-xl w-52 {enabled
      ? 'bg-[#688598] text-white hover:bg-[#688598]/80 hover:cursor-pointer'
      : 'text-[#688598]'}"
    disabled={!enabled}
    onclick={closeWindow}>{enabled ? "Start" : "Loading data"}</button
  >
</div>
