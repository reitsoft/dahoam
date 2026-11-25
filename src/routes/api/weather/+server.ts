import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const DEFAULT_LATITUDE = 47.8;
const DEFAULT_LONGITUDE = 8.7;
const FETCH_TIMEOUT_MS = 5000;
const HOURLY_STUNDEN = 12;
const CACHE_MS = 10 * 60 * 1000; // Open-Meteo aktualisiert ca. alle 15 Minuten

function parseCoordinate(rawValue: string | undefined, fallback: number, min: number, max: number): number {
	const trimmed = rawValue?.trim();
	if (!trimmed) return fallback;
	const parsed = Number(trimmed);
	if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
		return fallback;
	}
	return parsed;
}

const LATITUDE = parseCoordinate(env.WEATHER_LATITUDE, DEFAULT_LATITUDE, -90, 90);
const LONGITUDE = parseCoordinate(env.WEATHER_LONGITUDE, DEFAULT_LONGITUDE, -180, 180);

// --- Typisierung der genutzten Open-Meteo-Felder ---
interface OpenMeteoResponse {
	current: {
		time: string;
		temperature_2m: number;
		relative_humidity_2m: number;
		precipitation: number | null;
		wind_speed_10m: number;
		wind_direction_10m: number;
		weather_code: number;
		is_day: number;
	};
	current_units: {
		temperature_2m: string;
		relative_humidity_2m: string;
		wind_speed_10m: string;
	};
	hourly: {
		time: string[];
		temperature_2m: number[];
		weather_code: number[];
		precipitation_probability: (number | null)[];
		is_day: number[];
	};
	daily: {
		time: string[];
		temperature_2m_max: number[];
		temperature_2m_min: number[];
		precipitation_sum: number[];
		precipitation_probability_max: (number | null)[];
		weather_code: number[];
	};
}

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
	56: { text: 'Leichter gefrierender Nieselregen', iconDay: '🌧️', iconNight: '🌧️' },
	57: { text: 'Starker gefrierender Nieselregen', iconDay: '🌧️', iconNight: '🌧️' },
	61: { text: 'Leichter Regen', iconDay: '🌧️', iconNight: '🌧️' },
	63: { text: 'Regen', iconDay: '🌧️', iconNight: '🌧️' },
	65: { text: 'Starker Regen', iconDay: '🌧️', iconNight: '🌧️' },
	66: { text: 'Leichter gefrierender Regen', iconDay: '🌧️', iconNight: '🌧️' },
	67: { text: 'Starker gefrierender Regen', iconDay: '🌧️', iconNight: '🌧️' },
	71: { text: 'Leichter Schneefall', iconDay: '🌨️', iconNight: '🌨️' },
	73: { text: 'Schneefall', iconDay: '🌨️', iconNight: '🌨️' },
	75: { text: 'Starker Schneefall', iconDay: '❄️', iconNight: '❄️' },
	77: { text: 'Schneegriesel', iconDay: '🌨️', iconNight: '🌨️' },
	80: { text: 'Leichte Regenschauer', iconDay: '🌦️', iconNight: '🌦️' },
	81: { text: 'Regenschauer', iconDay: '🌧️', iconNight: '🌧️' },
	82: { text: 'Starke Regenschauer', iconDay: '⛈️', iconNight: '⛈️' },
	85: { text: 'Leichte Schneeschauer', iconDay: '🌨️', iconNight: '🌨️' },
	86: { text: 'Starke Schneeschauer', iconDay: '❄️', iconNight: '❄️' },
	95: { text: 'Gewitter', iconDay: '⛈️', iconNight: '⛈️' },
	96: { text: 'Gewitter mit Hagel', iconDay: '⛈️', iconNight: '⛈️' },
	99: { text: 'Starkes Gewitter mit Hagel', iconDay: '⛈️', iconNight: '⛈️' }
};

const WMO_UNKNOWN = { text: 'Unbekannt', iconDay: '❓', iconNight: '❓' };

function getWeatherInfo(code: number, isDay: boolean) {
	const entry = WMO_MAP[code] ?? WMO_UNKNOWN;
	return { text: entry.text, icon: isDay ? entry.iconDay : entry.iconNight };
}

function degToCompass(deg: number): string {
	const richtungen = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
	const index = Math.round(deg / 45) % 8;
	return richtungen[index];
}

function buildApiUrl(): string {
	const params = new URLSearchParams({
		latitude: String(LATITUDE),
		longitude: String(LONGITUDE),
		current: [
			'temperature_2m',
			'relative_humidity_2m',
			'precipitation',
			'wind_speed_10m',
			'wind_direction_10m',
			'weather_code',
			'is_day'
		].join(','),
		hourly: ['temperature_2m', 'weather_code', 'precipitation_probability', 'is_day'].join(','),
		daily: [
			'temperature_2m_max',
			'temperature_2m_min',
			'precipitation_sum',
			'precipitation_probability_max',
			'weather_code'
		].join(','),
		forecast_days: '6',
		timezone: 'Europe/Berlin'
	});
	return `https://api.open-meteo.com/v1/forecast?${params}`;
}

function buildBody(data: OpenMeteoResponse) {
	const isDay = data.current.is_day === 1;
	const weatherInfo = getWeatherInfo(data.current.weather_code, isDay);

	// --- Stündliche Vorhersage ab aktueller Stunde ---
	// Open-Meteo liefert Zeiten ohne Offset in der angefragten Zeitzone (Europe/Berlin).
	// String-Vergleich statt new Date(), damit die Server-Zeitzone keine Rolle spielt.
	const currentHour = data.current.time.slice(0, 13); // z.B. "2026-11-25T14"
	const hourlyTimes = data.hourly.time;
	const startIndex = hourlyTimes.findIndex((t) => t >= currentHour);
	const from = startIndex === -1 ? 0 : startIndex;

	const hourly = hourlyTimes.slice(from, from + HOURLY_STUNDEN).map((time, i) => {
		const idx = from + i;
		const info = getWeatherInfo(data.hourly.weather_code[idx], data.hourly.is_day[idx] === 1);
		return {
			time,
			temperature: data.hourly.temperature_2m[idx],
			icon: info.icon,
			rainProbability: data.hourly.precipitation_probability[idx] ?? null
		};
	});

	// --- 5-Tage-Vorhersage (Index 0 = heute, wird übersprungen) ---
	const daily = data.daily.time.slice(1, 6).map((dateStr, i) => {
		const idx = i + 1;
		const info = getWeatherInfo(data.daily.weather_code[idx], true); // Tages-Icon für Übersicht
		return {
			date: dateStr,
			tempMax: data.daily.temperature_2m_max[idx],
			tempMin: data.daily.temperature_2m_min[idx],
			icon: info.icon,
			condition: info.text,
			rainProbability: data.daily.precipitation_probability_max[idx] ?? null
		};
	});

	const precipitation = data.current.precipitation ?? 0;

	return {
		temperature: data.current.temperature_2m,
		temperatureUnit: data.current_units.temperature_2m,
		humidity: data.current.relative_humidity_2m,
		humidityUnit: data.current_units.relative_humidity_2m,

		weatherCode: data.current.weather_code,
		condition: weatherInfo.text,
		icon: weatherInfo.icon,

		// "precipitation" enthält Regen, Schauer und Schnee
		isRaining: precipitation > 0,
		rainAmount: precipitation,

		windSpeed: data.current.wind_speed_10m,
		windSpeedUnit: data.current_units.wind_speed_10m,
		windDirectionDeg: data.current.wind_direction_10m,
		windDirectionText: degToCompass(data.current.wind_direction_10m),

		time: data.current.time,

		today: {
			tempMax: data.daily.temperature_2m_max[0],
			tempMin: data.daily.temperature_2m_min[0],
			precipitationSum: data.daily.precipitation_sum[0],
			rainProbability: data.daily.precipitation_probability_max[0] ?? null
		},

		hourly,
		daily
	};
}

type WeatherBody = ReturnType<typeof buildBody>;

// --- Einfacher In-Memory-Cache (mit Stale-Fallback bei Fehlern) ---
let cache: { ts: number; body: WeatherBody } | null = null;

function staleOrError(message: string, status: number) {
	if (cache) {
		return json({ ...cache.body, stale: true });
	}
	return json({ error: message }, { status });
}

export const GET: RequestHandler = async ({ fetch }) => {
	if (cache && Date.now() - cache.ts < CACHE_MS) {
		return json(cache.body);
	}

	try {
		const response = await fetch(buildApiUrl(), {
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
		});

		if (!response.ok) {
			console.error(`Wetter-API: Open-Meteo antwortete mit Status ${response.status}`);
			// Upstream-Fehler nicht 1:1 durchreichen, sondern als Bad Gateway melden
			return staleOrError('Fehler beim Laden der Wetterdaten', 502);
		}

		const data = (await response.json()) as OpenMeteoResponse;
		const body = buildBody(data);

		cache = { ts: Date.now(), body };
		return json(body);
	} catch (error) {
		console.error('Wetter-API:', error);

		const isTimeout =
			error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');

		return staleOrError(
			isTimeout
				? 'Wetterdaten aktuell nicht erreichbar (Timeout)'
				: 'Wetterdaten aktuell nicht erreichbar',
			503
		);
	}
};