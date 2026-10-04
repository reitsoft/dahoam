<!-- src/lib/components/energy/CardJahrHaushalt.svelte -->
<script lang="ts">
    import ChartNoAxesColumnIncreasing from '@lucide/svelte/icons/chart-no-axes-column-increasing';
    import { Bar } from 'svelte-chartjs';
    import {
        Chart as ChartJS,
        Title,
        Tooltip,
        Legend,
        BarElement,
        LinearScale,
        CategoryScale,
        type ChartData,
        type ChartOptions
    } from 'chart.js';

    ChartJS.register(
        Title,
        Tooltip,
        Legend,
        BarElement,
        LinearScale,
        CategoryScale
    );

    // Erlaubt auch `null` für zukünftige/unvollständige Monate
    interface Props {
        data?: (number | null)[];
    }

    let { data = [] }: Props = $props();

    const monateLabels = [
        'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'
    ];

    // Gesamtsumme berechnen
    let verbrauchGesamt = $derived<number>(
        data.reduce((acc: number, val) => acc + (val ?? 0), 0)
    );

    // Monatsdurchschnitt nur anhand von bereits vergangenen Monaten berechnen
    let avgHaushalt = $derived.by<number>(() => {
        const aktiveMonate = data.filter((v): v is number => v !== null && v !== undefined && v > 0);
        if (aktiveMonate.length === 0) return 0;
        return Math.round(verbrauchGesamt / aktiveMonate.length);
    });

    // Chart-Daten reaktiv aufbereiten (null zu 0 konvertieren für Chart.js)
    let jahrChartData = $derived<ChartData<'bar'>>({
        labels: monateLabels,
        datasets: [
            {
                label: 'Haushalt',
                data: data.map((v) => v ?? 0),
                hoverBackgroundColor: '#60a5fa',
                borderRadius: 4,
                borderSkipped: false,
                backgroundColor: (context) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return '#3b82f6';
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, 'rgba(59, 130, 246, 1.0)');
                    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.25)');
                    return gradient;
                }
            }
        ]
    });

    const jahrChartOptions: ChartOptions<'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                enabled: true,
                mode: 'index',
                intersect: false,
                displayColors: false,
                callbacks: {
                    title: (items) => items[0].label,
                    label: (context) =>
                        context.parsed.y !== null ? `${context.parsed.y.toFixed(1)} kWh` : 'Keine Daten'
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                border: { display: false },
                ticks: {
                    color: 'rgba(255, 248, 240, 0.3)',
                    font: { size: 10 },
                    maxRotation: 0
                }
            },
            y: {
                display: false,
                grid: { display: false },
                beginAtZero: true
            }
        }
    };
</script>

<div class="flex h-full flex-col overflow-hidden rounded-2xl bg-navy-900 p-3">
    <div class="flex shrink-0 items-center justify-between px-1 pb-1">
        <!-- Linker Block (Jahresverbrauch) -->
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
                        {verbrauchGesamt.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                    </span>
                    <span class="text-cream-200/60 text-xs font-medium">kWh</span>
                </div>
            </div>
        </div>

        <!-- Rechter Block: Monatsdurchschnitt -->
        <div class="flex flex-col items-end text-xs font-medium text-cream-100/60">
            <span class="text-cream-100/40 text-[10px] uppercase tracking-wider">Ø / Monat</span>
            <span class="text-cream-100/80 font-semibold">{avgHaushalt} kWh</span>
        </div>
    </div>

    <!-- svelte-chartjs Component -->
    <div class="relative w-full flex-1 overflow-hidden">
        <Bar data={jahrChartData} options={jahrChartOptions} />
    </div>
</div>