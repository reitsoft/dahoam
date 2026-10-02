<script lang="ts">
	import Droplet from '@lucide/svelte/icons/droplet';
import Fan from '@lucide/svelte/icons/fan';
import Power from '@lucide/svelte/icons/power';
import Sparkles from '@lucide/svelte/icons/sparkles';
import Thermometer from '@lucide/svelte/icons/thermometer';

	type Modus = 'AUTO' | 'TIMER' | 'AUS';

	// Dummy-Daten
	const bad = { temp: 22.8, feuchtigkeit: 62 };

	// Konfiguration
	const HUMIDITY_THRESHOLD = 70; // Grenzwert z.B. 70% Feuchtigkeit
	const MAX_RUN_TIME_MS = 30 * 60 * 1000; // 30 Minuten - maximale Laufzeit des Lüfters
	const COOLDOWN_TIME_MS = 60 * 60 * 1000; // 1 Stunde Sperrzeit
	const TIMER_RUN_TIME_MS = 10 * 60 * 1000; // 10 Minuten Manuell

	// Aktueller Zustand (EINZIGE Quelle der Wahrheit für den Modus)
	let currentMode = $state<Modus>('AUTO');
	let isFanOn = $state(false);
	let lastAutoOffTime = $state(0); // Zeitstempel, wann der Lüfter zuletzt im AUTO-Modus ausging

	let restlaufzeitSekunden = $state(600);
	let restlaufzeitMinuten = $derived(Math.ceil(restlaufzeitSekunden / 60));

	let stopTimer: ReturnType<typeof setTimeout> | null = null;

	function handleHumidityUpdate(currentHumidity: number) {
		// Wenn AUS gewählt ist -> Gar nichts tun
		if (currentMode === 'AUS') return;

		// Im TIMER-Modus kümmert sich der 10-Minuten-Timer darum
		if (currentMode === 'TIMER') return;

		// AUTO-Modus Logik
		if (currentMode === 'AUTO') {
			const now = Date.now();
			const isInCooldown = now - lastAutoOffTime < COOLDOWN_TIME_MS;

			// 1. Einschaltschwelle: Feuchtigkeit hoch + Lüfter aus + Keine Sperrzeit aktiv
			if (currentHumidity >= HUMIDITY_THRESHOLD && !isFanOn && !isInCooldown) {
				turnFanOn();

				stopTimer = setTimeout(() => {
					turnFanOff();
					lastAutoOffTime = Date.now(); // 1 Stunde Sperrzeit startet JETZT
				}, MAX_RUN_TIME_MS);
			}

			// 2. Vorzeitiges Ausschalten: Feuchtigkeit sinkt vor Ablauf der 30 Min wieder ab
			if (currentHumidity < HUMIDITY_THRESHOLD - 5 && isFanOn) {
				turnFanOff();
				lastAutoOffTime = Date.now();
			}
		}
	}

	function setLuefterModus(newMode: Modus) {
		currentMode = newMode;

		if (stopTimer) clearTimeout(stopTimer);

		if (newMode === 'AUS') {
			turnFanOff();
		} else if (newMode === 'TIMER') {
			turnFanOn();
			restlaufzeitSekunden = TIMER_RUN_TIME_MS / 1000;

			stopTimer = setTimeout(() => {
				currentMode = 'AUTO';
				turnFanOff();
			}, TIMER_RUN_TIME_MS);
		} else if (newMode === 'AUTO') {
			if (isFanOn) turnFanOff();
		}
	}

	function turnFanOn() {
		isFanOn = true;
		// mqttClient.publish('shelly/bad_luefter/command', 'on');
	}

	function turnFanOff() {
		isFanOn = false;
		if (stopTimer) clearTimeout(stopTimer);
		// mqttClient.publish('shelly/bad_luefter/command', 'off');
	}
</script>

<!-- Bad -->
<div class="flex h-full flex-col justify-between gap-2 rounded-3xl border border-navy-800 bg-navy-900 p-3">
	<span class="pl-2 text-xs font-bold tracking-wide text-cream-100/50 uppercase">Bad</span>

	<div class="grid grid-cols-2 divide-x divide-cream-100/10">
		<div class="flex items-center gap-3">
			<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-500/10">
				<Thermometer class="h-5 w-5 stroke-3 text-teal-500" />
			</div>
			<div>
				<div class="text-2xl font-bold text-cream-100">{bad.temp.toFixed(1)}°</div>
				<div class="text-xs text-cream-100/50">Temperatur</div>
			</div>
		</div>
		<div class="flex items-center gap-3 pl-4">
			<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
				<Droplet class="h-5 w-5 stroke-3 text-blue-400" />
			</div>
			<div>
				<div class="text-2xl font-bold text-cream-100">{bad.feuchtigkeit}%</div>
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
			aria-checked={currentMode === 'AUTO'}
			onclick={() => setLuefterModus('AUTO')}
			class="flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 transition-colors {currentMode ===
			'AUTO'
				? 'bg-teal-500 font-bold text-navy-950'
				: 'text-cream-100/40 hover:text-cream-100/70'}"
		>
			<Sparkles class="h-5 w-5 stroke-2 {currentMode === 'AUTO' ? 'animate-pulse' : ''}" />
			<span class="text-[10px] tracking-wide uppercase">Auto</span>
		</button>

		<!-- Ein (10 Min) -->
		<button
			type="button"
			role="radio"
			aria-checked={currentMode === 'TIMER'}
			onclick={() => setLuefterModus('TIMER')}
			class="flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 transition-colors {currentMode ===
			'TIMER'
				? 'bg-teal-500 font-bold text-navy-950'
				: 'text-cream-100/40 hover:text-cream-100/70'}"
		>
			<Fan
				class="h-5 w-5 stroke-2 {currentMode === 'TIMER' ? 'animate-spin' : ''}"
				style={currentMode === 'TIMER' ? 'animation-duration: 1.4s;' : ''}
			/>
			<span class="text-[10px] tracking-wide uppercase">
				{currentMode === 'TIMER' ? `${restlaufzeitMinuten} Min` : '10 Min'}
			</span>
		</button>

		<!-- Aus -->
		<button
			type="button"
			role="radio"
			aria-checked={currentMode === 'AUS'}
			onclick={() => setLuefterModus('AUS')}
			class="flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 transition-colors {currentMode ===
			'AUS'
				? 'bg-cream-100/10 font-bold text-cream-100'
				: 'text-cream-100/40 hover:text-cream-100/70'}"
		>
			<Power class="h-5 w-5 stroke-2" />
			<span class="text-[10px] tracking-wide uppercase">Aus</span>
		</button>
	</div>
</div>