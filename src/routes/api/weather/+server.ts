import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const LATITUDE = 47.85639756600935;
const LONGITUDE = 8.781613169200257;
const FETCH_TIMEOUT_MS = 5000;

// Helper: Windrichtung Grad in Himmelsrichtung umwandeln
function getWindDirectionText(degrees: number): string {
	const directions = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
	return directions[Math.round(degrees / 45) % 8];
}

// Helper: WMO Wetter-Code in Text und Icon übersetzen
function getWeatherCondition(code: number): { description: string; icon: string } {
	switch (code) {
		case 0:
			return { description: 'Klar / Sonnig', icon: '☀️' };
		case 1:
		case 2:
		case 3:
			return { description: 'Leicht bewölkt bis bedeckt', icon: 'PartlyCloudy' }; // z.B. ⛅
		case 45:
		case 48:
			return { description: 'Nebel', icon: '🌫️' };
		case 51:
		case 53:
		case 55:
			return { description: 'Nieselregen', icon: '🌧️' };
		case 61:
		case 63:
		case 65:
			return { description: 'Regen', icon: '🌧️' };
		case 71:
		case 73:
		case 75:
			return { description: 'Schneefall', icon: '❄️' };
		case 80:
		case 81:
		case 82:
			return { description: 'Regenschauer', icon: '🌦️' };
		case 95:
		case 96:
		case 99:
			return { description: 'Gewitter', icon: '🌩️' };
		default:
			return { description: 'Unbekannt', icon: '❓' };
	}
}

export const GET: RequestHandler = async ({ fetch }) => {
	// Erweitert um: weather_code
	const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&current=temperature_2m,relative_humidity_2m,rain,precipitation,wind_speed_10m,wind_direction_10m,weather_code&timezone=Europe/Berlin`;

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

	try {
		const response = await fetch(apiUrl, { signal: controller.signal });

		if (!response.ok) {
			return json({ error: 'Fehler beim Laden der Wetterdaten' }, { status: response.status });
		}

		const data = await response.json();
		const weatherCode = data.current.weather_code;
		const windDeg = data.current.wind_direction_10m;

		return json({
			temperature: data.current.temperature_2m,
			temperatureUnit: data.current_units.temperature_2m,
			humidity: data.current.relative_humidity_2m,
			humidityUnit: data.current_units.relative_humidity_2m,

			// Zustand & WMO-Code
			weatherCode,
			condition: getWeatherCondition(weatherCode).description,
			icon: getWeatherCondition(weatherCode).icon,

			// Regen
			isRaining: (data.current.precipitation ?? 0) > 0,
			rainAmount: data.current.rain,

			// Wind
			windSpeed: data.current.wind_speed_10m,
			windSpeedUnit: data.current_units.wind_speed_10m,
			windDirectionDeg: windDeg,
			windDirectionText: getWindDirectionText(windDeg), // z. B. "SW"

			time: data.current.time
		});
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			return json({ error: 'Wetterdaten aktuell nicht erreichbar (Timeout)' }, { status: 503 });
		}
		const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
		return json({ error: 'Wetterdaten aktuell nicht erreichbar', details: message }, { status: 503 });
	} finally {
		clearTimeout(timeoutId);
	}
};
