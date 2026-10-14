<script lang="ts">
	import RotateCcwClock from '@lucide/svelte/icons/rotate-ccw-clock';
	import Calendar from '@lucide/svelte/icons/calendar';
	import { Bar } from 'svelte-chartjs';
	import {
		Chart as ChartJS,
		Title,
		Tooltip,
		Legend,
		Filler,
		BarElement,
		LineElement,
		PointElement,
		LinearScale,
		CategoryScale,
		type ChartData,
		type ChartOptions,
		type ScriptableContext
	} from 'chart.js';
	import annotationPlugin from 'chartjs-plugin-annotation';

	ChartJS.register(
		Title,
		Tooltip,
		Legend,
		Filler,
		BarElement,
		LineElement,
		PointElement,
		LinearScale,
		CategoryScale,
		annotationPlugin
	);

	// Props aus Svelte 5 $props()
	// netzbezug: kWh aus dem Netz, pv: kWh Eigenverbrauch aus der PV (null = noch keine Daten)
	let {
		verbrauchProTag,
		verbrauchVormonat
	}: {
		verbrauchProTag: { tag: number; netzbezug: number | null; pv: number | null }[];
		verbrauchVormonat: number;
	} = $props();

	// Farben als RGB-Tripel (passend zum Sankey: PV orange, Netz blaugrau)
	const NETZ_RGB = '110, 140, 190';
	const PV_RGB = '232, 99, 44';

	// Reaktive Ableitungen via $derived
	const labels = $derived(verbrauchProTag.map((d) => String(d.tag)));
	const netzPunkte = $derived(verbrauchProTag.map((d) => d.netzbezug));
	const pvPunkte = $derived(verbrauchProTag.map((d) => d.pv));
	const hatPv = $derived(verbrauchProTag.some((d) => d.pv !== null));

	// Gesamtverbrauch je Tag = Netzbezug + PV-Anteil (null, wenn für den Tag nichts vorliegt)
	const tagesSummen = $derived(
		verbrauchProTag.map((d) =>
			d.netzbezug === null && d.pv === null ? null : (d.netzbezug ?? 0) + (d.pv ?? 0)
		)
	);

	const VERBRAUCH_MONAT = $derived(
		Math.round(tagesSummen.reduce((sum: number, v) => sum + (v ?? 0), 0) * 10) / 10
	);
	const VERBRAUCH_LETZTER_MONAT = $derived(Math.round(verbrauchVormonat * 10) / 10);

	const maxVerbrauch = $derived(Math.max(0, ...tagesSummen.filter((v): v is number => v !== null)));

	// Verlauf je Balkensegment: oben volle Deckkraft, unten 35 %
	function verlauf(rgb: string) {
		return (context: ScriptableContext<'bar'>) => {
			const { ctx, chartArea } = context.chart;
			const bar = context.chart.getDatasetMeta(context.datasetIndex).data[context.dataIndex] as
				BarElement | undefined;
			if (!chartArea || !bar) return `rgb(${rgb})`;
			const { y, base } = bar.getProps(['y', 'base'], true);
			if (
				typeof y !== 'number' ||
				typeof base !== 'number' ||
				!Number.isFinite(y) ||
				!Number.isFinite(base)
			)
				return `rgb(${rgb})`;
			const gradient = ctx.createLinearGradient(0, y, 0, base);
			gradient.addColorStop(0, `rgba(${rgb}, 1.0)`);
			gradient.addColorStop(1, `rgba(${rgb}, 0.25)`);
			return gradient;
		};
	}

	// Reaktives Chart-Data Objekt
	const chartData = $derived<ChartData<'bar'>>({
		labels,
		datasets: [
			{
				label: 'Netzbezug',
				data: netzPunkte,
				backgroundColor: verlauf(NETZ_RGB),
				hoverBackgroundColor: `rgb(${NETZ_RGB})`,
				borderSkipped: false,
				// Liegt PV darüber, bleibt die Oberkante des Netz-Segments gerade
				borderRadius: (ctx) =>
					pvPunkte[ctx.dataIndex] ? { topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4 } : 4
			},
			{
				label: 'Eigenerzeugung',
				data: pvPunkte,
				backgroundColor: verlauf(PV_RGB),
				hoverBackgroundColor: '#f97316',
				borderSkipped: false,
				borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 }
			}
		]
	});

	// Reaktives Chart-Options Objekt
	const chartOptions = $derived<ChartOptions<'bar'>>({
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: { display: false },
			tooltip: {
				enabled: true,
				mode: 'index',
				intersect: false,
				displayColors: true,
				boxWidth: 8,
				boxHeight: 8,
				filter: (item) => item.parsed.y !== null && item.parsed.y !== undefined,
				callbacks: {
					title: (items) => `Tag ${items[0].label}`,
					label: (context) => `${context.dataset.label}: ${(context.parsed.y ?? 0).toFixed(1)} kWh`,
					footer: (items) =>
						hatPv
							? `Gesamt: ${items.reduce((s, i) => s + (i.parsed.y ?? 0), 0).toFixed(1)} kWh`
							: ''
				}
			},
			annotation: {
				annotations: {
					maxLine: {
						type: 'line',
						yMin: maxVerbrauch,
						yMax: maxVerbrauch,
						borderColor: 'rgba(232, 99, 44, 0.6)',
						borderWidth: 1,
						borderDash: [3, 6],
						label: {
							display: true,
							content: `${maxVerbrauch.toFixed(1)} kWh`,
							position: 'end',
							backgroundColor: 'rgba(232, 99, 44, 0.85)',
							color: '#fff',
							font: { size: 9, weight: 'bolder' },
							padding: { top: 2, bottom: 2, left: 4, right: 4 },
							borderRadius: 4,
							yAdjust: -10
						}
					}
				}
			}
		},
		scales: {
			x: {
				stacked: true,
				grid: { display: false },
				border: { display: false },
				ticks: {
					color: 'rgba(255, 248, 240, 0.3)',
					font: { size: 10 },
					maxRotation: 0,
					callback: (_, index) => {
						const day = index + 1;
						return [5, 15, 25].includes(day) ? day : '';
					}
				}
			},
			y: {
				stacked: true,
				display: false,
				grid: { display: false },
				beginAtZero: true,
				suggestedMax: maxVerbrauch * 1.3
			}
		}
	});
</script>

<div class="flex h-full flex-col overflow-hidden rounded-2xl bg-navy-900 p-3">
	<div class="flex shrink-0 items-center justify-between px-1 pb-1">
		<div class="flex items-center gap-3">
			<div
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cream-100/10 text-cream-100/70"
			>
				<Calendar class="h-5 w-5" />
			</div>
			<div class="flex flex-col">
				<span class="text-xs font-medium tracking-wide text-cream-100/40 uppercase">
					Aktueller Monat
				</span>
				<div class="flex items-baseline gap-1">
					<span class="text-2xl font-semibold tracking-tight text-cream-100">
						{VERBRAUCH_MONAT.toFixed(1)}
					</span>
					<span class="text-cream-200/60 text-xs font-medium">kWh</span>
				</div>
			</div>
		</div>

		<div class="flex items-center gap-3">
			<div
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cream-100/5 text-cream-100/40"
			>
				<RotateCcwClock class="h-5 w-5" />
			</div>
			<div class="flex flex-col items-start">
				<span class="text-xs font-medium tracking-wide text-cream-100/40 uppercase">
					Vormonat
				</span>
				<div class="flex items-baseline gap-1">
					<span class="text-2xl font-semibold tracking-tight text-cream-100/60">
						{VERBRAUCH_LETZTER_MONAT.toFixed(1)}
					</span>
					<span class="text-xs font-medium text-cream-100/30">kWh</span>
				</div>
			</div>
		</div>
	</div>

	<div class="flex shrink-0 items-center gap-3 px-1 pb-1 text-[10px] text-cream-100/40">
		<span class="flex items-center gap-1.5">
			<span class="h-2 w-2 rounded-full" style="background: rgb({NETZ_RGB})"></span>
			Netzbezug
		</span>
		{#if hatPv}
			<span class="flex items-center gap-1.5">
				<span class="h-2 w-2 rounded-full" style="background: rgb({PV_RGB})"></span>
				Eigenerzeugung
			</span>
		{:else}
			<span class="text-cream-100/30">PV-Anteil folgt mit den Wechselrichterdaten</span>
		{/if}
	</div>

	<div class="relative h-28 w-full flex-1 overflow-hidden">
		<Bar data={chartData} options={chartOptions} />
	</div>
</div>
