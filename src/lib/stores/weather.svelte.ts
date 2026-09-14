import { onMount } from 'svelte';

export interface WeatherData {
	temperature: number;
	temperatureUnit: string;
	humidity: number;
	humidityUnit: string;
	
	// Wetterzustand & WMO
	weatherCode: number;
	condition: string;
	icon: string;

	// Regen
	isRaining: boolean;
	rainAmount: number;

	// Wind
	windSpeed: number;
	windSpeedUnit: string;
	windDirectionDeg: number;
	windDirectionText: string;

	time: string;
}

export function createWeatherStore(intervalMs: number = 60 * 60 * 1000) {
	let data = $state<WeatherData | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	async function fetchWeather() {
		try {
			const res = await fetch('/api/weather');
			if (!res.ok) throw new Error('Fehler beim Abrufen der Wetterdaten');

			const result = await res.json();
			if (result.error) throw new Error(result.error);

			data = result;
			error = null;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unbekannter Fehler';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		fetchWeather();
		const timer = setInterval(fetchWeather, intervalMs);
		return () => clearInterval(timer);
	});

	return {
		get data() {
			return data;
		},
		get loading() {
			return loading;
		},
		get error() {
			return error;
		},
		refresh: fetchWeather
	};
}
