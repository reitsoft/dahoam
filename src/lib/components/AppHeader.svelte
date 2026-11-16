<!-- $lib/components/home/AppHeader.svelte -->
<script lang="ts">
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleHelp from '@lucide/svelte/icons/circle-help';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	import BottomDrawer from '$lib/components/BottomDrawer.svelte';

	let { title }: { title: string } = $props();

	// Antwort von /api/mqtt/status (siehe mqtt-stats.ts)
	interface MqttStatus {
		connected: boolean;
		host: string | null;
		clientId: string | null;
		connectedSinceS: number | null;
		reconnects: number;
		lastError: { message: string; ageS: number } | null;
		messages: { in: number; out: number; inPerSec: number; outPerSec: number };
		bytes: { in: number; out: number; inPerSec: number; outPerSec: number };
		topics: { seen: number; seenCapped: boolean; subscriptions: number };
		lastMessageAgeS: number | null;
		keepalive: { intervalS: number | null; pingMs: number | null; pingAgeS: number | null };
		collectingSinceS: number;
		// nur mit ?ping=1 bzw. ?detail=1
		roundtripMs?: number | null;
		subscriptionList?: string[];
		topTopics?: { topic: string; count: number; bytes: number; lastAgeS: number }[];
	}

	// null = noch unbekannt (erste Abfrage läuft), true = verbunden, false = getrennt
	let mqttVerbunden = $state<boolean | null>(null);
	let serverErreichbar = $state(true);
	let status = $state<MqttStatus | null>(null);
	let offen = $state(false);

	// Nur die jeweils neueste Antwort übernehmen
	let anfrageNr = 0;

	async function pruefeMqtt(detail: boolean) {
		const nr = ++anfrageNr;
		try {
			const res = await fetch(
				detail ? '/api/mqtt/status?ping=1&detail=1' : '/api/mqtt/status',
				{ cache: 'no-store' }
			);
			if (!res.ok) throw new Error(String(res.status));
			const data: MqttStatus = await res.json();
			if (nr !== anfrageNr) return;
			status = data;
			serverErreichbar = true;
			mqttVerbunden = data.connected === true;
		} catch {
			if (nr !== anfrageNr) return;
			// Server nicht erreichbar -> es besteht auch keine nutzbare MQTT-Verbindung
			status = null;
			serverErreichbar = false;
			mqttVerbunden = false;
		}
	}

	// Geschlossen: alle 10 s nur der Basisstatus.
	// Offen: alle 3 s inkl. Roundtrip-Ping und Topic-Details.
	$effect(() => {
		const detail = offen;
		const intervalMs = detail ? 3_000 : 10_000;

		pruefeMqtt(detail);

		const id = setInterval(() => {
			if (!document.hidden) pruefeMqtt(detail);
		}, intervalMs);
		const onVisible = () => {
			if (!document.hidden) pruefeMqtt(detail);
		};
		document.addEventListener('visibilitychange', onVisible);

		return () => {
			clearInterval(id);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});

	let statusText = $derived(
		mqttVerbunden === null
			? 'MQTT: Status wird geprüft'
			: mqttVerbunden
				? 'MQTT verbunden'
				: 'MQTT nicht verbunden'
	);

	// ---------------------------------------------------------------------
	// Formatierung
	// ---------------------------------------------------------------------

	function zahl(n: number | null | undefined, stellen = 0): string {
		if (n == null || !Number.isFinite(n)) return '–';
		return n.toLocaleString('de-DE', {
			minimumFractionDigits: stellen,
			maximumFractionDigits: stellen
		});
	}

	function bytes(n: number | null | undefined): string {
		if (n == null || !Number.isFinite(n)) return '–';
		if (n < 1024) return `${zahl(n)} B`;
		if (n < 1024 ** 2) return `${zahl(n / 1024, 1)} kB`;
		if (n < 1024 ** 3) return `${zahl(n / 1024 ** 2, 1)} MB`;
		return `${zahl(n / 1024 ** 3, 2)} GB`;
	}

	function dauer(s: number | null | undefined): string {
		if (s == null || !Number.isFinite(s)) return '–';
		if (s < 60) return `${Math.round(s)} s`;
		const m = Math.floor(s / 60);
		if (m < 60) return `${m} min`;
		const h = Math.floor(m / 60);
		if (h < 24) return `${h} h ${m % 60} min`;
		return `${Math.floor(h / 24)} d ${h % 24} h`;
	}

	function vor(s: number | null | undefined): string {
		if (s == null) return '–';
		return s < 2 ? 'gerade eben' : `vor ${dauer(s)}`;
	}

	const ms = (v: number | null | undefined) => (v == null ? '–' : `${zahl(v, 1)} ms`);

	// ---------------------------------------------------------------------
	// Inhalt des Drawers
	// ---------------------------------------------------------------------

	const uebersicht = $derived.by(() => {
		if (mqttVerbunden === null) {
			return {
				titel: 'Status wird geprüft',
				text: 'Die erste Abfrage läuft noch.',
				klasse: 'bg-cream-100/5 text-cream-100/40',
				icon: CircleHelp
			};
		}
		if (!serverErreichbar) {
			return {
				titel: 'Server nicht erreichbar',
				text: 'Die Statusabfrage schlägt fehl. Damit besteht auch keine nutzbare MQTT-Verbindung.',
				klasse: 'bg-orange-500/10 text-orange-400',
				icon: TriangleAlert
			};
		}
		if (mqttVerbunden) {
			return {
				titel: 'Verbunden',
				text: status?.host
					? `Die Verbindung zum Broker ${status.host} steht.`
					: 'Die Verbindung zum Broker steht.',
				klasse: 'bg-teal-500/10 text-teal-500',
				icon: CircleCheck
			};
		}
		return {
			titel: 'Nicht verbunden',
			text: status?.lastError
				? `Letzter Fehler (${vor(status.lastError.ageS)}): ${status.lastError.message}`
				: 'Der Server hat aktuell keine Verbindung zum Broker.',
			klasse: 'bg-orange-500/10 text-orange-400',
			icon: TriangleAlert
		};
	});

	interface Wert {
		label: string;
		wert: string;
		hinweis?: string;
		warn?: boolean;
	}

	interface Gruppe {
		titel: string;
		spalten: 'grid-cols-2' | 'grid-cols-3';
		werte: Wert[];
	}

	let gruppen = $derived<Gruppe[]>([
		{
			titel: 'Verbindung',
			spalten: 'grid-cols-2',
			werte: [
				{
					label: 'Verbunden seit',
					wert: dauer(status?.connectedSinceS),
					hinweis: status?.clientId ? `Client ${status.clientId}` : undefined
				},
				{
					label: 'Reconnects',
					wert: zahl(status?.reconnects),
					hinweis: 'seit Serverstart',
					warn: (status?.reconnects ?? 0) > 0
				}
			]
		},
		{
			titel: 'Latenz',
			spalten: 'grid-cols-2',
			werte: [
				{
					label: 'Roundtrip',
					wert: ms(status?.roundtripMs),
					hinweis:
						status?.roundtripMs === null && mqttVerbunden
							? 'Keine Antwort vom Broker'
							: 'Client → Broker → Client',
					warn: status?.roundtripMs === null && mqttVerbunden === true
				},
				{
					label: 'Keepalive-Ping',
					wert: ms(status?.keepalive.pingMs),
					hinweis: status?.keepalive.pingAgeS != null
						? `${vor(status.keepalive.pingAgeS)}, alle ${dauer(status.keepalive.intervalS)}`
						: 'noch kein Ping gemessen'
				}
			]
		},
		{
			titel: 'Traffic',
			spalten: 'grid-cols-2',
			werte: [
				{
					label: 'Nachrichten ein',
					wert: zahl(status?.messages.in),
					hinweis: `${zahl(status?.messages.inPerSec, 1)} / s`
				},
				{
					label: 'Nachrichten aus',
					wert: zahl(status?.messages.out),
					hinweis: `${zahl(status?.messages.outPerSec, 1)} / s`
				},
				{
					label: 'Daten ein',
					wert: bytes(status?.bytes.in),
					hinweis: `${bytes(status?.bytes.inPerSec)} / s`
				},
				{
					label: 'Daten aus',
					wert: bytes(status?.bytes.out),
					hinweis: `${bytes(status?.bytes.outPerSec)} / s`
				}
			]
		},
		{
			titel: 'Topics',
			spalten: 'grid-cols-3',
			werte: [
				{
					label: 'Gesehen',
					wert: zahl(status?.topics.seen),
					hinweis: status?.topics.seenCapped ? 'Limit erreicht' : undefined
				},
				{ label: 'Abonniert', wert: zahl(status?.topics.subscriptions) },
				{ label: 'Letzte Nachricht', wert: vor(status?.lastMessageAgeS) }
			]
		}
	]);
</script>

<header
	style="padding-top: calc(0.5rem + env(safe-area-inset-top));"
	class="flex w-full shrink-0 items-center justify-between px-6 pb-2"
>
	<div>
		<h1
			class="font-handwriting font-bold tracking-wide whitespace-nowrap text-cream-100"
			style="font-size: clamp(1.25rem, 7vw, 2.25rem);"
		>
			{title}
		</h1>
	</div>

	<!-- Negatives Margin + Padding vergrößern die Tippfläche, ohne das Layout zu verschieben -->
	<button
		type="button"
		onclick={() => (offen = true)}
		aria-haspopup="dialog"
		aria-expanded={offen}
		aria-label={statusText}
		title={statusText}
		class="-m-2 flex shrink-0 cursor-pointer items-center justify-center p-2 transition-opacity active:opacity-70"
	>
		<span
			aria-hidden="true"
			class="block h-6 w-6 rounded-lg transition-colors duration-300 {mqttVerbunden === null
				? 'text-cream-100/30'
				: mqttVerbunden
					? 'text-teal-500'
					: 'text-orange-500'}"
			style="background-color: currentColor;
				-webkit-mask: url('/mqtt-icon-transparent.svg') center / contain no-repeat;
				mask: url('/mqtt-icon-transparent.svg') center / contain no-repeat;"
		></span>
	</button>
</header>

<BottomDrawer bind:open={offen} title="MQTT" label="MQTT-Status">
	<!-- Übersicht -->
	<div class="flex items-start gap-3 rounded-2xl px-3 py-3 {uebersicht.klasse}">
		<uebersicht.icon class="mt-0.5 h-5 w-5 shrink-0 stroke-2" />
		<div class="min-w-0">
			<div class="text-sm font-bold">{uebersicht.titel}</div>
			<p class="mt-0.5 text-xs leading-snug break-words text-cream-100/60">{uebersicht.text}</p>
		</div>
	</div>

	{#each gruppen as gruppe (gruppe.titel)}
		<section>
			<h3 class="mb-2 text-[10px] font-bold tracking-wide text-cream-100/40 uppercase">
				{gruppe.titel}
			</h3>
			<dl class="grid gap-2 {gruppe.spalten}">
				{#each gruppe.werte as { label, wert, hinweis, warn } (label)}
					<div class="min-w-0 rounded-2xl bg-cream-100/5 px-3 py-2">
						<dt class="text-xs text-cream-100/50">{label}</dt>
						<dd
							class="truncate text-lg font-bold tabular-nums {warn
								? 'text-orange-400'
								: 'text-cream-100'}"
						>
							{wert}
						</dd>
						{#if hinweis}
							<div class="mt-0.5 truncate text-[10px] leading-snug text-cream-100/40">
								{hinweis}
							</div>
						{/if}
					</div>
				{/each}
			</dl>
		</section>
	{/each}

	{#if status?.topTopics?.length}
		<section>
			<h3 class="mb-2 text-[10px] font-bold tracking-wide text-cream-100/40 uppercase">
				Aktivste Topics
			</h3>
			<ul class="flex flex-col gap-1.5">
				{#each status.topTopics as t (t.topic)}
					<li class="flex items-center justify-between gap-3 rounded-2xl bg-cream-100/5 px-3 py-2">
						<span class="min-w-0 truncate font-mono text-xs text-cream-100/80" title={t.topic}>
							{t.topic}
						</span>
						<span class="shrink-0 text-right text-xs text-cream-100/50 tabular-nums">
							<span class="font-bold text-cream-100">{zahl(t.count)}</span>
							· {vor(t.lastAgeS)}
						</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if status?.subscriptionList?.length}
		<section>
			<h3 class="mb-2 text-[10px] font-bold tracking-wide text-cream-100/40 uppercase">
				Abonnements
			</h3>
			<div class="flex flex-wrap gap-1.5">
				{#each status.subscriptionList as s (s)}
					<span class="rounded-full bg-cream-100/5 px-2.5 py-1 font-mono text-[11px] text-cream-100/70">
						{s}
					</span>
				{/each}
			</div>
		</section>
	{/if}

	<!-- <p class="text-[10px] leading-snug text-cream-100/30">
		Zähler seit dem letzten Serverstart ({dauer(status?.collectingSinceS)}). Datenmengen sind
		reine Nutzdaten ohne MQTT-/TCP-Header. Roundtrip und Topic-Details werden nur bei geöffnetem
		Fenster alle paar Sekunden aktualisiert.
	</p> -->
</BottomDrawer>