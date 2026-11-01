<script lang="ts">
	import { untrack } from 'svelte';
	import Droplet from '@lucide/svelte/icons/droplet';
	import Fan from '@lucide/svelte/icons/fan';
	import Power from '@lucide/svelte/icons/power';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Thermometer from '@lucide/svelte/icons/thermometer';
	import BatteryFull from '@lucide/svelte/icons/battery-full';
	import BatteryLow from '@lucide/svelte/icons/battery-low';

	type Modus = 'AUTO' | 'TIMER' | 'AUS';

	type LuefterStatus = {
		modus: Modus;
		laeuft: boolean;
		timerEndsAt: number | null;
		temperatur: number | null;
		feuchtigkeit: number | null;
		aktualisiert: number | null;
		batterie: number | null;
	};

	let { initial }: { initial: LuefterStatus } = $props();

	// Der Server ist die einzige Quelle der Wahrheit, die Card zeigt nur seinen Zustand
	let status = $state<LuefterStatus>(untrack(() => initial));
	let busy = $state(false);
	let fehler = $state('');
	let jetzt = $state(Date.now());

	let restMinuten = $derived(
		status.timerEndsAt ? Math.max(Math.ceil((status.timerEndsAt - jetzt) / 60000), 0) : 0
	);

	// Batterie
	let batteryLow = $derived(typeof status.batterie === 'number' && status.batterie < 15);

	let showBatteryTooltip = $state(false);
	let hideTimeout: ReturnType<typeof setTimeout> | undefined;

	function showTooltip() {
		showBatteryTooltip = true;
		clearTimeout(hideTimeout);
		hideTimeout = setTimeout(() => {
			showBatteryTooltip = false;
		}, 5000);
	}

	function hideTooltip() {
		showBatteryTooltip = false;
		clearTimeout(hideTimeout);
	}

	async function sync() {
		if (busy) return;
		try {
			const res = await fetch('/api/luefter', { cache: 'no-store' });
			if (!res.ok) return;
			status = await res.json();
		} catch {
			// offline: letzten Zustand behalten
		}
	}

	async function setLuefterModus(modus: Modus) {
		// Erneutes Tippen auf "10 Min" startet den Timer neu, bei AUTO/AUS ist es ein No-op
		if (busy || (status.modus === modus && modus !== 'TIMER')) return;
		busy = true;
		fehler = '';
		try {
			const res = await fetch('/api/luefter', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ modus })
			});
			if (!res.ok) throw new Error(String(res.status));
			status = await res.json();
			// Der Shelly meldet den neuen Schaltzustand kurz danach
			setTimeout(sync, 1500);
		} catch {
			fehler = 'Lüfter konnte nicht umgestellt werden.';
		} finally {
			busy = false;
		}
	}

	// Uhr für die Restlaufzeit
	$effect(() => {
		const id = setInterval(() => {
			jetzt = Date.now();
		}, 5000);
		return () => clearInterval(id);
	});

	// Zustand regelmäßig und beim Zurückkehren in die App abgleichen
	$effect(() => {
		const id = setInterval(() => {
			if (!document.hidden) sync();
		}, 20_000);
		const onVisible = () => {
			if (!document.hidden) sync();
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			clearInterval(id);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});

	// Timer abgelaufen: Server fragen, der inzwischen wieder auf AUTO steht
	$effect(() => {
		if (status.modus === 'TIMER' && status.timerEndsAt && jetzt > status.timerEndsAt + 1000) {
			sync();
		}
	});
</script>

<!-- Bad -->
<div
	class="flex h-full flex-col justify-between gap-2 rounded-3xl border border-navy-800 bg-navy-900 p-3"
>
	<div class="flex items-center justify-between">
		<span class="pl-2 text-xs font-bold tracking-wide text-cream-100/50 uppercase">Bad</span>

		<div class="flex items-center gap-2">
			{#if status.laeuft}
				<Fan
					class="h-4 w-4 animate-spin text-teal-500"
					style="animation-duration: 1.4s;"
					aria-label="Lüfter läuft"
				/>
			{/if}

			{#if typeof status.batterie === 'number'}
				<div class="relative">
					<button
						type="button"
						onclick={showTooltip}
						onmouseenter={showTooltip}
						onmouseleave={hideTooltip}
						class="flex items-center justify-center"
						aria-label="Batteriestand {status.batterie}%"
					>
						{#if batteryLow}
							<BatteryLow class="h-5.5 w-8 stroke-2 text-orange-500" />
						{:else}
							<BatteryFull class="h-5.5 w-8 stroke-2 text-cream-100/30" />
						{/if}
					</button>

					{#if showBatteryTooltip}
						<div
							class="absolute top-full right-0 z-10 mt-1.5 rounded-lg bg-navy-950 px-2 py-1 text-[11px] font-medium whitespace-nowrap text-cream-100 shadow-lg"
						>
							{status.batterie}%
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-2 divide-x divide-cream-100/10">
		<div class="flex items-center gap-3">
			<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-500/10">
				<Thermometer class="h-5 w-5 stroke-3 text-teal-500" />
			</div>
			<div>
				<div class="text-2xl font-bold text-cream-100">
					{typeof status.temperatur === 'number' ? `${status.temperatur.toFixed(1)}°` : '–'}
				</div>
				<div class="text-xs text-cream-100/50">Temperatur</div>
			</div>
		</div>
		<div class="flex items-center gap-3 pl-4">
			<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
				<Droplet class="h-5 w-5 stroke-3 text-blue-400" />
			</div>
			<div>
				<div class="text-2xl font-bold text-cream-100">
					{typeof status.feuchtigkeit === 'number' ? `${Math.round(status.feuchtigkeit)}%` : '–'}
				</div>
				<div class="text-xs text-cream-100/50">Feuchtigkeit</div>
			</div>
		</div>
	</div>

	<!-- Lüfter Segmented Control -->
	<div
		role="radiogroup"
		aria-label="Lüfter-Modus auswählen"
		class="flex h-10 w-full max-w-xs items-center justify-between self-center rounded-full border border-cream-100/10 bg-navy-950 p-1"
	>
		<!-- Auto -->
		<button
			type="button"
			role="radio"
			aria-checked={status.modus === 'AUTO'}
			disabled={busy}
			onclick={() => setLuefterModus('AUTO')}
			class="flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 transition-colors disabled:opacity-60 {status.modus ===
			'AUTO'
				? 'bg-teal-500 font-bold text-navy-950'
				: 'text-cream-100/40 hover:text-cream-100/70'}"
		>
			<Sparkles class="h-5 w-5 stroke-2 {status.modus === 'AUTO' ? 'animate-pulse' : ''}" />
			<span class="text-[10px] tracking-wide uppercase">Auto</span>
		</button>

		<!-- Ein (10 Min) -->
		<button
			type="button"
			role="radio"
			aria-checked={status.modus === 'TIMER'}
			disabled={busy}
			onclick={() => setLuefterModus('TIMER')}
			class="flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 transition-colors disabled:opacity-60 {status.modus ===
			'TIMER'
				? 'bg-teal-500 font-bold text-navy-950'
				: 'text-cream-100/40 hover:text-cream-100/70'}"
		>
			<Fan
				class="h-5 w-5 stroke-2 {status.modus === 'TIMER' ? 'animate-spin' : ''}"
				style={status.modus === 'TIMER' ? 'animation-duration: 1.4s;' : ''}
			/>
			<span class="text-[10px] tracking-wide uppercase">
				{status.modus === 'TIMER' ? `${restMinuten} Min` : '10 Min'}
			</span>
		</button>

		<!-- Aus -->
		<button
			type="button"
			role="radio"
			aria-checked={status.modus === 'AUS'}
			disabled={busy}
			onclick={() => setLuefterModus('AUS')}
			class="flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 transition-colors disabled:opacity-60 {status.modus ===
			'AUS'
				? 'bg-cream-100/10 font-bold text-cream-100'
				: 'text-cream-100/40 hover:text-cream-100/70'}"
		>
			<Power class="h-5 w-5 stroke-2" />
			<span class="text-[10px] tracking-wide uppercase">Aus</span>
		</button>
	</div>

	{#if fehler}
		<p class="px-2 text-xs text-orange-400">{fehler}</p>
	{/if}
</div>