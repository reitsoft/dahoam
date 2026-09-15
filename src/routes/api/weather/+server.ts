import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const LATITUDE = 47.85639756600935;
const LONGITUDE = 8.781613169200257;
const FETCH_TIMEOUT_MS = 5000;
const HOURLY_STUNDEN = 12;

// --- WMO Weather Code → Bedingung (Text) & Icon ---
const WMO_MAP: Record<number, { text: string; iconDay: string; iconNight: string }> = {
	0: { text: 'Klarer Himmel', iconDay: '☀️', iconNight: '🌙' },
	1: { text: 'Überwiegend klar', iconDay: '🌤️', iconNight: '🌙' },
	2: { text: 'Teilweise bewölkt', iconDay: '⛅', iconNight: '☁️' },
	3: { text: 'Bedeckt', iconDay: '☁️', iconNight: '☁️' },
	45: { text: 'Nebel', iconDay: '🌫️', iconNight: '🌫️' },
	48: { text: 'Reifnebel', iconDay: '🌫️', iconNight: '🌫️' },
	51: { text: 'Leichter Nieselregen', iconDay: '🌦️', iconNight: '🌦️' },
	53: { text: 'Nieselregen', iconDay: '🌦️', iconNight: '🌦️' },
	55: { text: 'Starker Nieselregen', iconDay: '🌧️', iconNight: '🌧️' },
	61: { text: 'Leichter Regen', iconDay: '🌧️', iconNight: '🌧️' },
	63: { text: 'Regen', iconDay: '🌧️', iconNight: '🌧️' },
	65: { text: 'Starker Regen', iconDay: '🌧️', iconNight: '🌧️' },
	71: { text: 'Leichter Schneefall', iconDay: '🌨️', iconNight: '🌨️' },
	73: { text: 'Schneefall', iconDay: '🌨️', iconNight: '🌨️' },
	75: { text: 'Starker Schneefall', iconDay: '❄️', iconNight: '❄️' },
	80: { text: 'Leichte Regenschauer', iconDay: '🌦️', iconNight: '🌦️' },
	81: { text: 'Regenschauer', iconDay: '🌧️', iconNight: '🌧️' },
	82: { text: 'Starke Regenschauer', iconDay: '⛈️', iconNight: '⛈️' },
	95: { text: 'Gewitter', iconDay: '⛈️', iconNight: '⛈️' },
	96: { text: 'Gewitter mit Hagel', iconDay: '⛈️', iconNight: '⛈️' },
	99: { text: 'Starkes Gewitter mit Hagel', iconDay: '⛈️', iconNight: '⛈️' }
};

function getWeatherInfo(code: number, isDay: boolean) {
	const entry = WMO_MAP[code] ?? WMO_MAP[3];
	return { text: entry.text, icon: isDay ? entry.iconDay : entry.iconNight };
}

function degToCompass(deg: number): string {
	const richtungen = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
	const index = Math.round(deg / 45) % 8;
	return richtungen[index];
}

export const GET: RequestHandler = async ({ fetch }) => {
	// is_day + hourly-Parameter ergänzt, forecast_days auf 2 erhöht
	// (damit die Hourly-Leiste über Mitternacht hinaus nicht leer läuft)
	// forecast_days von 2 auf 6 erhöhen (heute + 5 Folgetage)
	const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&current=temperature_2m,relative_humidity_2m,rain,precipitation,wind_speed_10m,wind_direction_10m,weather_code,is_day&hourly=temperature_2m,weather_code,precipitation_probability,is_day&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code&forecast_days=6&timezone=Europe/Berlin`;
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

	try {
		const response = await fetch(apiUrl, { signal: controller.signal });

		if (!response.ok) {
			return json({ error: 'Fehler beim Laden der Wetterdaten' }, { status: response.status });
		}

		const data = await response.json();

		const isDay = data.current.is_day === 1;
		const weatherInfo = getWeatherInfo(data.current.weather_code, isDay);

		// --- Stündliche Vorhersage ab aktueller Stunde ---
		const now = new Date();
		const hourlyTimes: string[] = data.hourly.time;
		const startIndex = hourlyTimes.findIndex((t) => new Date(t) >= now);
		const from = startIndex === -1 ? 0 : startIndex;

		const hourly = hourlyTimes.slice(from, from + HOURLY_STUNDEN).map((time, i) => {
			const idx = from + i;
			const info = getWeatherInfo(data.hourly.weather_code[idx], data.hourly.is_day[idx] === 1);
			return {
				time,
				temperature: data.hourly.temperature_2m[idx],
				icon: info.icon,
				rainProbability: data.hourly.precipitation_probability[idx] ?? 0
			};
		});
		// --- 5-Tage-Vorhersage (Index 0 = heute, wird übersprungen) ---
		const daily = (data.daily.time as string[]).slice(1, 6).map((dateStr: string, i: number) => {
			const idx = i + 1;
			const info = getWeatherInfo(data.daily.weather_code[idx], true); // Tages-Icon für Übersicht
			return {
				date: dateStr,
				tempMax: data.daily.temperature_2m_max[idx],
				tempMin: data.daily.temperature_2m_min[idx],
				icon: info.icon,
				condition: info.text,
				rainProbability: data.daily.precipitation_probability_max[idx] ?? 0
			};
		});

		return json({
			// Aktuelle Werte
			temperature: data.current.temperature_2m,
			temperatureUnit: data.current_units.temperature_2m,
			humidity: data.current.relative_humidity_2m,
			humidityUnit: data.current_units.relative_humidity_2m,

			weatherCode: data.current.weather_code,
			condition: weatherInfo.text,
			icon: weatherInfo.icon,

			isRaining: (data.current.precipitation ?? 0) > 0,
			rainAmount: data.current.precipitation ?? 0,

			windSpeed: data.current.wind_speed_10m,
			windSpeedUnit: data.current_units.wind_speed_10m,
			windDirectionDeg: data.current.wind_direction_10m,
			windDirectionText: degToCompass(data.current.wind_direction_10m),

			time: data.current.time,

			// Vorhersage für HEUTE (Index 0 entspricht dem aktuellen Tag)
			today: {
				tempMax: data.daily.temperature_2m_max[0],
				tempMin: data.daily.temperature_2m_min[0],
				precipitationSum: data.daily.precipitation_sum[0],
				rainProbability: data.daily.precipitation_probability_max[0]
			},

			hourly,
			daily
		});
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			return json({ error: 'Wetterdaten aktuell nicht erreichbar (Timeout)' }, { status: 503 });
		}
		return json({ error: 'Wetterdaten aktuell nicht erreichbar' }, { status: 503 });
	} finally {
		clearTimeout(timeoutId);
	}
};