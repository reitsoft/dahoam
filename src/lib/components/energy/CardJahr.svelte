<!-- src/lib/components/energy/CardJahr.svelte -->
<script lang="ts">
	import ChartNoAxesColumnIncreasing from '@lucide/svelte/icons/chart-no-axes-column-increasing';
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
		type ChartOptions
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

	const monateLabels = [
		'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'
	];

	const heizungData = [320, 280, 190, 70, 10, 0, 0, 0, 15];
	const warmwasserData = [85, 80, 85, 80, 75, 70, 70, 70, 85];
	const haushaltData = [145, 140, 145, 135, 130, 125, 130, 135, 140];

	const sumHeizung = heizungData.reduce((acc, v) => acc + v, 0);
	const sumWarmwasser = warmwasserData.reduce((acc, v) => acc + v, 0);
	const sumHaushalt = haushaltData.reduce((acc, v) => acc + v, 0);

	const VERBRAUCH_JAHR = [...heizungData, ...warmwasserData, ...haushaltData].reduce(
		(acc, val) => acc + val,
		0
	);

	const jahrChartData: ChartData<'bar'> = {
		labels: monateLabels,
		datasets: [
			{
				label: 'Haushalt',
				data: haushaltData,
				backgroundColor: '#3b82f6',
				borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4 }
			},
			{
				label: 'Warmwasser',
				data: warmwasserData,
				backgroundColor: '#06b6d4'
			},
			{
				label: 'Heizung',
				data: heizungData,
				backgroundColor: '#e8632c',
				borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 }
			}
		]
	};

	const jahrChartOptions: ChartOptions<'bar'> = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: { display: false },
			tooltip: {
				enabled: true,
				mode: 'index',
				intersect: false,
				displayColors: true,
				callbacks: {
					title: (items) => items[0].label,
					label: (context) => ` ${context.dataset.label}: ${context.parsed.y} kWh`,
					footer: (items) => {
						const total = items.reduce((sum, item) => sum + (item.parsed.y ?? 0), 0);
						return `Gesamt: ${total} kWh`;
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
					maxRotation: 0
				}
			},
			y: {
				stacked: true,
				display: false,
				grid: { display: false },
				beginAtZero: true
			}
		}
	};
</script>

<div class="flex h-full flex-col overflow-hidden rounded-2xl bg-navy-900 p-3">
	<div class="flex shrink-0 items-center justify-between px-1 pb-1">
		<!-- Linker Block (Verbrauch) -->
		<div class="flex items-center gap-3">
			<div
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cream-100/10 text-cream-100/70"
			>
				<ChartNoAxesColumnIncreasing class="h-5 w-5" />
			</div>
			<div class="flex flex-col">
				<span class="text-xs font-medium tracking-wide text-cream-100/40 uppercase">
					Jahresverbrauch
				</span>
				<div class="flex items-baseline gap-1">
					<span class="text-2xl font-semibold tracking-tight text-cream-100">
						{VERBRAUCH_JAHR.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
					</span>
					<span class="text-cream-200/60 text-xs font-medium">kWh</span>
				</div>
			</div>
		</div>

		<!-- Rechter Block: self-end schiebt es ganz nach unten -->
		<div class="flex flex-col gap-0.5 self-end pb-0.5 text-xs font-medium text-cream-100/60">
			<div class="flex items-center gap-1.5 whitespace-nowrap">
				<span class="h-2 w-2 rounded-full bg-orange-500"></span>
				<span>Heizung: <span class="text-white/40">{sumHeizung} kWh</span></span>
			</div>
			<div class="flex items-center gap-1.5 whitespace-nowrap">
				<span class="h-2 w-2 rounded-full bg-[#06b6d4]"></span>
				<span>Warmwasser: <span class="text-white/40">{sumWarmwasser} kWh</span></span>
			</div>
			<div class="flex items-center gap-1.5 whitespace-nowrap">
				<span class="h-2 w-2 rounded-full bg-[#3b82f6]"></span>
				<span>Haushalt: <span class="text-white/40">{sumHaushalt} kWh</span></span>
			</div>
		</div>
	</div>

	<!-- svelte-chartjs Stacked Bar Component -->
	<div class="relative w-full flex-1 overflow-hidden">
		<Bar data={jahrChartData} options={jahrChartOptions} />
	</div>
</div>