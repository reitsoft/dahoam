<!-- routes/shutters/+page.svelte -->
<script lang="ts">
	import Viewport from '$lib/components/Viewport.svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import ShutterRow from '$lib/components/shutters/ShutterRow.svelte';
	import { shutterStore } from '$lib/stores/shutters.sse.svelte';
	import { SHUTTER_LIST } from '$lib/config/shutters';
	import { ArrowUp, ArrowDown, Octagon, LoaderCircle } from '@lucide/svelte';

	$effect(() => {
		const disconnect = shutterStore.connect();
		return () => disconnect?.();
	});

	const isConnecting = $derived(Object.keys(shutterStore.states).length === 0);

	let isOpeningAll = $state(false);
	let isClosingAll = $state(false);
	let isStoppingAll = $state(false);

	function anyBusy() {
		return isConnecting || isOpeningAll || isClosingAll || isStoppingAll;
	}

	async function allTo(pos: number, busyFlag: 'open' | 'close') {
		if (anyBusy()) return;

		if (busyFlag === 'open') isOpeningAll = true;
		else isClosingAll = true;

		try {
			await Promise.all(SHUTTER_LIST.map((s) => shutterStore.sendCommand(s.id, pos)));
		} finally {
			isOpeningAll = false;
			isClosingAll = false;
		}
	}

	async function stopAll() {
		if (anyBusy()) return;

		isStoppingAll = true;
		try {
			await Promise.all(SHUTTER_LIST.map((s) => shutterStore.sendCommand(s.id, 'stop')));
		} finally {
			isStoppingAll = false;
		}
	}
</script>

<svelte:head>
	<title>Rolläden</title>
</svelte:head>
<Viewport>
	<AppHeader title="Rollos" />

	<main class="flex w-full min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-2 no-scrollbar">
		{#if isConnecting}
			<div class="flex flex-1 flex-col items-center justify-center gap-3 text-cream-100/50">
				<LoaderCircle class="h-6 w-6 animate-spin text-teal-500" />
				<span class="text-xs font-bold tracking-wider uppercase">Verbinde…</span>
			</div>
		{:else}
			{#each SHUTTER_LIST as shutter (shutter.id)}
				<ShutterRow {shutter} />
			{/each}
		{/if}
	</main>

	{#snippet footer()}
		<footer class="shrink-0 bg-navy-950 p-4">
			<div class="mx-auto grid w-full grid-cols-3 gap-3">
				<button
					type="button"
					onclick={() => allTo(10, 'close')}
					disabled={anyBusy()}
					class="flex flex-col items-center justify-center rounded-full bg-navy-800 py-2.5 text-cream-100 transition-all active:scale-95 active:bg-teal-700 disabled:opacity-60"
				>
					{#if isClosingAll}
						<LoaderCircle class="mb-1 h-5 w-5 animate-spin text-teal-500" />
					{:else}
						<ArrowDown class="mb-1 h-5 w-5 stroke-3 text-teal-500" />
					{/if}
					<span class="text-[9px] font-bold tracking-wider uppercase">Alle Runter</span>
				</button>

				<button
					type="button"
					onclick={stopAll}
					disabled={anyBusy()}
					class="flex flex-col items-center justify-center rounded-full bg-navy-800 py-2.5 text-cream-100 transition-all active:scale-95 active:bg-orange-500/30 disabled:opacity-60"
				>
					{#if isStoppingAll}
						<LoaderCircle class="mb-1 h-5 w-5 animate-spin text-orange-500" />
					{:else}
						<Octagon class="mb-1 h-5 w-5 stroke-3 text-orange-500" />
					{/if}
					<span class="text-[9px] font-bold tracking-wider uppercase">Stop</span>
				</button>

				<button
					type="button"
					onclick={() => allTo(100, 'open')}
					disabled={anyBusy()}
					class="flex flex-col items-center justify-center rounded-full bg-navy-800 py-2.5 text-cream-100 transition-all active:scale-95 active:bg-teal-700 disabled:opacity-60"
				>
					{#if isOpeningAll}
						<LoaderCircle class="mb-1 h-5 w-5 animate-spin text-teal-500" />
					{:else}
						<ArrowUp class="mb-1 h-5 w-5 stroke-3 text-teal-500" />
					{/if}
					<span class="text-[9px] font-bold tracking-wider uppercase">Alle Hoch</span>
				</button>
			</div>
		</footer>
	{/snippet}
</Viewport>