<script lang="ts">
    import { RotateCcwClock, Calendar } from '@lucide/svelte';
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

    // Props aus Svelte 5 $props()
    let {
        verbrauchProTag,
        verbrauchVormonat
    }: {
        verbrauchProTag: { tag: number; value: number | null }[];
        verbrauchVormonat: number;
    } = $props();

	console.log({ verbrauchProTag, verbrauchVormonat });

    // Reaktive Ableitungen via $derived
    const dataPoints = $derived(verbrauchProTag.map((d) => d.value));
    const labels = $derived(verbrauchProTag.map((d) => String(d.tag)));

    const VERBRAUCH_MONAT = $derived(
        Math.round(dataPoints.reduce((sum: number, v) => sum + (v ?? 0), 0) * 10) / 10
    );
    const VERBRAUCH_LETZTER_MONAT = $derived(Math.round(verbrauchVormonat * 10) / 10);

    const validDataPoints = $derived(
        dataPoints.filter((val): val is number => val !== null)
    );
    const maxVerbrauch = $derived(
        validDataPoints.length > 0 ? Math.max(...validDataPoints) : 0
    );

    // Reaktives Chart-Data Objekt
    const chartData = $derived<ChartData<'bar'>>({
        labels,
        datasets: [
            {
                label: 'Tagesverbrauch (kWh)',
                data: dataPoints,
                hoverBackgroundColor: '#f97316',
                borderRadius: 4,
                borderSkipped: false,
                backgroundColor: (context) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return '#e8632c';
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, 'rgba(232, 99, 44, 1.0)');
                    gradient.addColorStop(1, 'rgba(232, 99, 44, 0.35)');
                    return gradient;
                }
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
                displayColors: false,
                callbacks: {
                    title: (items) => `Tag ${items[0].label}`,
                    label: (context) =>
                        context.parsed.y !== null ? `${context.parsed.y.toFixed(1)} kWh` : 'Keine Daten'
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

    <div class="relative h-28 w-full flex-1 overflow-hidden">
        <Bar data={chartData} options={chartOptions} />
    </div>
</div>