<script lang="ts">
	import { BookOpen, Clock, CalendarRange, ArrowLeft } from '@lucide/svelte';
	import { STUNDENPLAN, WOCHENTAGE, heutigerWochentag, type Wochentag } from '$lib/config/stundenplan';

	let ansicht = $state<'tag' | 'woche'>('tag');

	const heute = heutigerWochentag();

	function istAktuelleStunde(von: string, bis: string): boolean {
		const now = new Date();
		const [vh, vm] = von.split(':').map(Number);
		const [bh, bm] = bis.split(':').map(Number);
		const start = new Date(now);
		start.setHours(vh, vm, 0, 0);
		const ende = new Date(now);
		ende.setHours(bh, bm, 0, 0);
		return now >= start && now <= ende;
	}

	const heutigesLabel = WOCHENTAGE.find((w) => w.key === heute)?.label ?? 'Wochenende';
</script>

<div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-navy-800 bg-navy-900 shadow-lg">
	<!-- Header -->
	<div class="flex shrink-0 items-center justify-between px-5 pt-5 pb-2.5">
		<div class="flex items-center gap-2">
			{#if ansicht === 'tag'}
				<BookOpen class="h-3.5 w-3.5 text-cream-100/50" />
				<span class="text-base font-semibold text-cream-100/70">Stundenplan · {heutigesLabel}</span>
			{:else}
				<CalendarRange class="h-3.5 w-3.5 text-cream-100/50" />
				<span class="text-xs font-semibold text-cream-100/70">Wochenstundenplan</span>
			{/if}
		</div>

		<button
			type="button"
			onclick={() => (ansicht = ansicht === 'tag' ? 'woche' : 'tag')}
			class="flex items-center gap-1 rounded-full bg-navy-800 px-2.5 py-1.5 text-xs font-medium text-cream-100/70 hover:text-cream-100"
		>
			{#if ansicht === 'tag'}
				<CalendarRange class="h-4 w-4" />
				Woche
			{:else}
				<ArrowLeft class="h-4 w-4" />
				Heute
			{/if}
		</button>
	</div>

	<!-- Inhalt -->
	<div class="flex flex-1 flex-col overflow-y-auto px-3 pb-3">
		{#if ansicht === 'tag'}
			{#if heute}
				<div class="flex flex-1 flex-col justify-around gap-1">
					{#each STUNDENPLAN[heute] as stunde}
						{@const aktiv = istAktuelleStunde(stunde.von, stunde.bis)}
						<div
							class="flex shrink-0 items-center gap-3 rounded-2xl px-3 py-0 {aktiv
								? 'border border-teal-500/20 bg-teal-500/10'
								: ''}"
						>
							<div
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold {aktiv
									? 'bg-teal-500/20 text-teal-400'
									: 'bg-navy-950/50 text-cream-100/40'}"
							>
								{stunde.nummer}
							</div>
							<div class="flex w-16 shrink-0 flex-col">
								<span class="text-xs font-semibold text-cream-100">{stunde.von}</span>
								<span class="text-[10px] text-cream-100/40">{stunde.bis}</span>
							</div>
							<div class="flex flex-1 flex-col">
								<span class="text-base font-semibold text-cream-100">{stunde.fach}</span>
								{#if stunde.raum || stunde.lehrer}
									<span class="text-sm text-cream-100/40">
										{stunde.raum}{stunde.raum && stunde.lehrer ? ' · ' : ''}{stunde.lehrer}
									</span>
								{/if}
							</div>
							{#if aktiv}
								<Clock class="h-4 w-4 shrink-0 text-teal-400" />
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<div class="flex flex-1 items-center justify-center text-center text-sm text-cream-100/40">
					Heute kein Unterricht 🎉
				</div>
			{/if}
		{:else}
			<!-- Wochenübersicht: kompakte Tabelle -->
			<div class="flex flex-col gap-3">
				{#each WOCHENTAGE as tag}
					<div>
						<div
							class="mb-1.5 px-1 text-xs font-bold {tag.key === heute
								? 'text-teal-400'
								: 'text-cream-100/50'}"
						>
							{tag.label}
						</div>
						<div class="flex flex-col gap-1">
							{#each STUNDENPLAN[tag.key] as stunde}
								<div class="flex items-center gap-2 rounded-xl bg-navy-950/40 px-2.5 py-1.5">
									<span class="w-4 shrink-0 text-[10px] font-bold text-cream-100/30">
										{stunde.nummer}
									</span>
									<span class="w-9 shrink-0 text-[10px] text-cream-100/40">{stunde.von}</span>
									<span class="flex-1 truncate text-xs text-cream-100">{stunde.fach}</span>
									{#if stunde.raum}
										<span class="shrink-0 text-[10px] text-cream-100/30">{stunde.raum}</span>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>