<!-- $lib/components/energy/CardStromflussV2.svelte -->
<script lang="ts">
    import type { ChartData, ChartOptions } from 'chart.js';
    import Waypoints from '@lucide/svelte/icons/waypoints';
    import { Chart as SvelteChart } from 'svelte-chartjs';
    import { Chart as ChartJS, Tooltip } from 'chart.js';
    import { SankeyController, Flow } from 'chartjs-chart-sankey';

    ChartJS.register(SankeyController, Flow, Tooltip);

    // Baseline-Werte
    const PV_ERZEUGT = 3200;
    const NETZBEZUG = 1110;
    const EINSPEISUNG = 900;
    const BATTERIE_LADUNG = 635;
    const BATTERIE_VERLUST = 35; // Umwandlungsverluste beim Laden/Entladen
    const BATTERIE_ENTLADUNG = BATTERIE_LADUNG - BATTERIE_VERLUST; // 600

    // 1. Reiner Direktverbrauch aus PV im Haus (ohne Speicher & ohne Einspeisung)
    const PV_AN_GEBAEUDE = PV_ERZEUGT - BATTERIE_LADUNG - EINSPEISUNG; //1665

    // 2. Gesamter Zufluss und Verbrauch im Gebäude
    const VERBRAUCH_HAUS = PV_AN_GEBAEUDE + NETZBEZUG + BATTERIE_ENTLADUNG; // 3375

    // 3. Verteilung der Haus-Verbraucher basierend auf dem echten Hausverbrauch
    const HAUSHALT = Math.round(VERBRAUCH_HAUS * 0.385); // 1299
    const HEIZUNG = Math.round(VERBRAUCH_HAUS * 0.415);  // 1401
    const WARMWASSER = VERBRAUCH_HAUS - HAUSHALT - HEIZUNG; // 675 (exakt ausgleichend)

    // Autarkiegrad: Anteil des Hausverbrauchs, der nicht aus dem Netz bezogen wurde
    const AUTARKIEGRAD = Math.round(((VERBRAUCH_HAUS - NETZBEZUG) / VERBRAUCH_HAUS) * 100); // 67%

    const sankeyDataV2: ChartData<'sankey', { from: string; to: string; flow: number }[]> = {
        datasets: [
            {
                data: [
                    { from: 'PV', to: 'Gebäude', flow: PV_AN_GEBAEUDE },
                    { from: 'PV', to: 'Speicher', flow: BATTERIE_LADUNG },
                    { from: 'Speicher', to: 'Gebäude', flow: BATTERIE_ENTLADUNG },
                    { from: 'Netzbezug', to: 'Gebäude', flow: NETZBEZUG },
                    { from: 'Gebäude', to: 'Haushalt', flow: HAUSHALT },
                    { from: 'Gebäude', to: 'Heizung', flow: HEIZUNG },
                    { from: 'Gebäude', to: 'Warmwasser', flow: WARMWASSER },
                    { from: 'PV', to: 'Einspeisung', flow: EINSPEISUNG }
                ],
                // Vertikale Reihenfolge innerhalb jeder Spalte (kleiner = weiter oben)
                priority: {
                    PV: 0,
                    Netzbezug: 1,
                    Speicher: 0,
                    Einspeisung: 0,
                    Gebäude: 1,
                    Heizung: 0,
                    Warmwasser: 1,
                    Haushalt: 2,
                },
                // Horizontale Spaltenebenen
                column: {
                    PV: 0,
                    Netzbezug: 0,
                    Einspeisung: 2,
                    Speicher: 1,
                    Gebäude: 2,
                    Haushalt: 3,
                    Heizung: 3,
                    Warmwasser: 3,
                },
                nodeWidth: 8,
                nodePadding: 12,
                colorFrom: (ctx) => {
                    const key = ctx.dataset.data[ctx.dataIndex].from;
                    if (key === 'PV') return '#e8632c';
                    if (key === 'Netzbezug') return '#64748b';
                    if (key === 'Speicher') return '#22c55e';
                    return '#3b82f6'; // Gebäude → Verbraucher / Einspeisung
                },
                colorTo: (ctx) => {
                    const key = ctx.dataset.data[ctx.dataIndex].to;
                    if (key === 'Speicher') return '#22c55e';
                    if (key === 'Einspeisung') return '#64748b';
                    if (key === 'Gebäude') return '#3b82f6';
                    if (key === 'Heizung') return '#e8632c';
                    if (key === 'Warmwasser') return '#06b6d4';
                    return '#3b82f6'; // Haushalt
                },
                colorMode: 'gradient',
                labels: {
                    PV: 'PV',
                    Netzbezug: 'Netzbezug',
                    Speicher: 'Speicher',
                    Gebäude: 'Gebäude',
                    Einspeisung: 'Einspeisung',
                    Haushalt: 'Haushalt',
                    Heizung: 'Heizung',
                    Warmwasser: 'Warmwasser'
                },
                color: '#fff8f0',
                font: { size: 11 }
            }
        ]
    };

    const sankeyOptionsV2: ChartOptions<'sankey'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            tooltip: {
                callbacks: {
                    label: (ctx) => {
                        const d = ctx.dataset.data[ctx.dataIndex];
                        return `${d.from} → ${d.to}: ${d.flow.toLocaleString('de-DE')} kWh`;
                    }
                }
            }
        }
    };
</script>

<div class="flex h-full flex-col overflow-hidden rounded-2xl bg-navy-900 p-3">
    <div class="flex shrink-0 items-center justify-between px-1 pb-3">
        <div class="flex items-center gap-3">
            <div
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cream-100/10 text-cream-100/70"
            >
                <Waypoints class="h-5 w-5" />
            </div>
            <div class="flex flex-col">
                <span class="text-xs font-medium tracking-wide text-cream-100/40 uppercase">
                    Stromfluss (V2)
                </span>
                <div class="flex items-baseline gap-1">
                    <span class="text-2xl font-semibold tracking-tight text-cream-100">
                        {PV_ERZEUGT.toLocaleString('de-DE')}
                    </span>
                    <span class="text-cream-200/60 text-xs font-medium">kWh erzeugt</span>
                </div>
            </div>
        </div>

        <div class="flex flex-col gap-0.5 self-end pb-0.5 text-xs font-medium text-cream-100/60">
            <div class="flex items-center gap-1.5 whitespace-nowrap">
                <span class="h-2 w-2 rounded-full bg-[#22c55e]"></span>
                <span>Autarkiegrad: <span class="text-white/40">{AUTARKIEGRAD}%</span></span>
            </div>
            <div class="flex items-center gap-1.5 whitespace-nowrap">
                <span class="h-2 w-2 rounded-full bg-[#06b6d4]"></span>
                <span>Eingespeist: <span class="text-white/40">{EINSPEISUNG} kWh</span></span>
            </div>
            <div class="flex items-center gap-1.5 whitespace-nowrap">
                <span class="h-2 w-2 rounded-full bg-[#64748b]"></span>
                <span>Bezogen: <span class="text-white/40">{NETZBEZUG} kWh</span></span>
            </div>
        </div>
    </div>

    <div class="relative w-full flex-1 overflow-hidden pt-1">
        <SvelteChart type="sankey" data={sankeyDataV2} options={sankeyOptionsV2} />
    </div>
</div>