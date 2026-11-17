<script lang="ts">
	import { untrack } from 'svelte';
	import type { Component } from 'svelte';
	import CircleCheck from '@lucide/svelte/icons/circle-check';

	type Status = {
		status: 'BEREIT' | 'LAEUFT' | 'FERTIG';
		startedAt: number | null;
		fertigAm: number | null;
	};

	let {
		id,
		name,
		icon: Icon,
		initial
	}: { id: string; name: string; icon: Component<any>; initial: Status } = $props();

	let s = $state<Status>(untrack(() => initial));
	let jetzt = $state(Date.now());

	let laeuft = $derived(s.status === 'LAEUFT');
	let fertig = $derived(s.status === 'FERTIG');

	const zeit = (ms: number) =>
		new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

	let laufzeit = $derived.by(() => {
		if (!laeuft || !s.startedAt) return '';
		const min = Math.max(Math.floor((jetzt - s.startedAt) / 60000), 0);
		const h = Math.floor(min / 60);
		return h > 0 ? `${h} Std ${min % 60} Min` : `${min} Min`;
	});

	let statusText = $derived(
		laeuft ? 'Läuft' : fertig ? 'Fertig' : 'Bereit'
	);
	let detail = $derived(
		laeuft ? laufzeit : fertig && s.fertigAm ? `seit ${zeit(s.fertigAm)}` : ''
	);

	async function sync() {
		try {
			const res = await fetch('/api/waesche', { cache: 'no-store' });
			if (!res.ok) return;
			const all = await res.json();
			if (all[id]) s = all[id];
		} catch {
			// offline: letzten Zustand behalten
		}
	}

	$effect(() => {
		const tick = setInterval(() => (jetzt = Date.now()), 30_000);
		const poll = setInterval(() => {
			if (!document.hidden) sync();
		}, 15_000);
		const onVisible = () => {
			if (!document.hidden) {
				jetzt = Date.now();
				sync();
			}
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			clearInterval(tick);
			clearInterval(poll);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});
</script>

<div
	class="flex h-full flex-col justify-between gap-3 rounded-3xl border border-navy-800 bg-navy-900 p-3"
>
	<div class="flex items-center justify-between">
		<div
			class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full {laeuft
				? 'bg-teal-500/10'
				: 'bg-cream-100/5'}"
		>
			<Icon
				class="h-5 w-5 stroke-3 {laeuft ? 'animate-pulse text-teal-500' : 'text-cream-100/40'}"
			/>
		</div>
		{#if fertig}
			<CircleCheck class="h-6 w-6 stroke-2 text-teal-500" aria-label="Fertig" />
		{/if}
	</div>

	<div class="px-1">
		<div class="text-xs font-bold tracking-wide text-cream-100/50 uppercase">{name}</div>
		<div
			class="text-lg font-bold {laeuft || fertig ? 'text-cream-100' : 'text-cream-100/40'}"
		>
			{statusText}
		</div>
		<div class="h-4 text-xs text-cream-100/50">{detail}</div>
	</div>
</div>
