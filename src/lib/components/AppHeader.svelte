<!-- $lib/components/home/AppHeader.svelte -->
<script lang="ts">
	let { title }: { title: string } = $props();

	// null = noch unbekannt (erste Abfrage läuft), true = verbunden, false = getrennt
	let mqttVerbunden = $state<boolean | null>(null);

	async function pruefeMqtt() {
		try {
			const res = await fetch('/api/mqtt/status', { cache: 'no-store' });
			if (!res.ok) throw new Error(String(res.status));
			mqttVerbunden = (await res.json()).connected === true;
		} catch {
			// Server nicht erreichbar -> es besteht auch keine nutzbare MQTT-Verbindung
			mqttVerbunden = false;
		}
	}

	$effect(() => {
		pruefeMqtt();

		const id = setInterval(() => {
			if (!document.hidden) pruefeMqtt();
		}, 10_000);
		const onVisible = () => {
			if (!document.hidden) pruefeMqtt();
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
</script>

<header
	style="padding-top: calc(0.5rem + env(safe-area-inset-top));"
	class="flex w-full shrink-0 items-center justify-between px-6 pb-2"
>
	<div>
		<h1
			class="font-handwriting whitespace-nowrap font-bold tracking-wide text-cream-100"
			style="font-size: clamp(1.25rem, 7vw, 2.25rem);"
		>
			{title}
		</h1>
	</div>

	<!-- MQTT-Status: grün = verbunden, orange = getrennt -->
	<span
		role="img"
		aria-label={statusText}
		title={statusText}
		class="block h-7 w-7 shrink-0 transition-colors duration-300 {mqttVerbunden === null
			? 'text-cream-100/30'
			: mqttVerbunden
				? 'text-green-500'
				: 'text-orange-500'}"
		style="background-color: currentColor;
			-webkit-mask: url('/mqtt-icon-transparent.svg') center / contain no-repeat;
			mask: url('/mqtt-icon-transparent.svg') center / contain no-repeat;"
	></span>
</header>