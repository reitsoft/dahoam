<!-- src/lib/components/home/CardTermine.svelte -->
<script lang="ts">
	import { CalendarClock, Plus, TrashIcon, X } from '@lucide/svelte';
	import { createTermineStore } from '$lib/stores/termine.svelte';

	const store = createTermineStore();

	let formularOffen = $state(false);
	let neuDatum = $state('');
	let neuUhrzeit = $state('');
	let neuTitel = $state('');
	let neuNotizen = $state('');
	let speichernFehler = $state<string | null>(null);
	let speichernLaeuft = $state(false);

	function formularZuruecksetzen() {
		neuDatum = '';
		neuUhrzeit = '';
		neuTitel = '';
		neuNotizen = '';
		speichernFehler = null;
	}

	async function terminHinzufuegen() {
		if (!neuDatum || !neuUhrzeit || !neuTitel.trim()) {
			speichernFehler = 'Datum, Uhrzeit und Titel sind erforderlich';
			return;
		}
		speichernLaeuft = true;
		speichernFehler = null;
		try {
			await store.add({
				datum: neuDatum,
				uhrzeit: neuUhrzeit,
				titel: neuTitel.trim(),
				notizen: neuNotizen.trim() || undefined
			});
			formularZuruecksetzen();
			formularOffen = false;
		} catch (err) {
			speichernFehler = err instanceof Error ? err.message : 'Fehler beim Speichern';
		} finally {
			speichernLaeuft = false;
		}
	}

	function formatDatum(iso: string) {
		return new Date(iso).toLocaleDateString('de-DE', {
			weekday: 'short',
			day: '2-digit',
			month: '2-digit'
		});
	}

	function istVergangen(datum: string, uhrzeit: string) {
		const [h, m] = uhrzeit.split(':').map(Number);
		const zeitpunkt = new Date(datum);
		zeitpunkt.setHours(h, m, 0, 0);
		return zeitpunkt < new Date();
	}
</script>

<div
	class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-navy-800 bg-navy-900 shadow-lg"
>
	<!-- Header -->
	<div class="flex shrink-0 items-center justify-between px-5 pt-5 pb-1">
		<div class="flex items-center gap-2">
			<CalendarClock class="h-3.5 w-3.5 text-cream-100/50" />
			<span class="text-base font-semibold text-cream-100/70">Termine</span>
		</div>
		<button
			type="button"
			onclick={() => {
				formularOffen = !formularOffen;
				if (!formularOffen) formularZuruecksetzen();
			}}
			class="flex items-center gap-1 rounded-full bg-navy-800 px-2.5 py-1.5 text-xs font-medium text-cream-100/70 hover:text-cream-100"
		>
			{#if formularOffen}
				<X class="h-4 w-4" />
				Abbrechen
			{:else}
				<Plus class="h-4 w-4" />
				Neu
			{/if}
		</button>
	</div>

	<!-- Formular -->
	{#if formularOffen}
		<div
			class="mx-3 mt-2 flex shrink-0 flex-col gap-2 rounded-2xl border border-cream-100/10 bg-navy-950/50 p-3"
		>
			<div class="flex gap-2">
				<input
					type="date"
					bind:value={neuDatum}
					class="flex-1 rounded-xl bg-navy-800 px-2.5 py-1.5 text-xs text-cream-100 outline-none focus:ring-1 focus:ring-teal-500"
				/>
				<input
					type="time"
					bind:value={neuUhrzeit}
					class="w-24 rounded-xl bg-navy-800 px-2.5 py-1.5 text-xs text-cream-100 outline-none focus:ring-1 focus:ring-teal-500"
				/>
			</div>
			<input
				type="text"
				placeholder="Titel"
				bind:value={neuTitel}
				class="rounded-xl bg-navy-800 px-2.5 py-1.5 text-xs text-cream-100 placeholder-cream-100/30 outline-none focus:ring-1 focus:ring-teal-500"
			/>
			<textarea
				placeholder="Notizen (optional)"
				bind:value={neuNotizen}
				rows="2"
				class="resize-none rounded-xl bg-navy-800 px-2.5 py-1.5 text-xs text-cream-100 placeholder-cream-100/30 outline-none focus:ring-1 focus:ring-teal-500"
			></textarea>

			{#if speichernFehler}
				<p class="text-[11px] text-rose-400">{speichernFehler}</p>
			{/if}

			<button
				type="button"
				onclick={terminHinzufuegen}
				disabled={speichernLaeuft}
				class="mt-1 rounded-xl bg-teal-500/20 py-1.5 text-xs font-semibold text-teal-400 hover:bg-teal-500/30 disabled:opacity-50"
			>
				{speichernLaeuft ? 'Speichert...' : 'Termin speichern'}
			</button>
		</div>
	{/if}

	<!-- Terminliste -->
	<div class="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
		{#if store.loading}
			<div class="flex flex-1 items-center justify-center">
				<div
					class="h-5 w-5 animate-spin rounded-full border-2 border-teal-500 border-t-transparent"
				></div>
			</div>
		{:else if store.error}
			<p class="text-center text-xs text-rose-400">{store.error}</p>
		{:else if store.termine.length === 0}
			<div class="flex flex-1 items-center justify-center text-center text-sm text-cream-100/40">
				Keine Termine vorhanden
			</div>
		{:else}
			{#each store.termine as termin (termin.id)}
				{@const vergangen = istVergangen(termin.datum, termin.uhrzeit)}
				<div class="flex items-center gap-2 rounded-2xl bg-navy-950/30 px-3 py-2 {vergangen ? 'opacity-40' : ''}">
					<!-- Datum: Monat, Tag, Uhrzeit – zentriert -->
					<div class="flex w-12 shrink-0 flex-col items-center">
						<span
							class="w-full text-center text-[10px] font-semibold tracking-wide text-cream-100/40 uppercase"
						>
							{new Date(termin.datum).toLocaleDateString('de-DE', { month: 'short' })}
						</span>
						<span class="w-full text-center text-2xl leading-none font-bold text-cream-100">
							{new Date(termin.datum).getDate()}
						</span>
						<div class="w-full text-center text-xs text-cream-100/50">
							{termin.uhrzeit}
						</div>
					</div>

					<!-- Inhalt: Titel, dann Notizen -->
					<div class="min-w-0 flex-1">
						<div class="truncate text-base font-semibold text-cream-100">
							{termin.titel}
						</div>
						{#if termin.notizen}
							<div class="mt-0.5 truncate text-sm text-cream-100/40">{termin.notizen}</div>
						{/if}
					</div>

					<button
						type="button"
						onclick={() => store.remove(termin.id)}
						class="shrink-0 rounded-full p-1.5 text-cream-100/30 hover:bg-rose-500/10 hover:text-rose-400"
						aria-label="Termin löschen"
					>
						<TrashIcon class="h-4.5 w-4.5" />
					</button>
				</div>
			{/each}
		{/if}
	</div>
</div>
