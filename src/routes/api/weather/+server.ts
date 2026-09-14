import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const LATITUDE = 47.85639756600935;
const LONGITUDE = 8.781613169200257;
const FETCH_TIMEOUT_MS = 5000;

export const GET: RequestHandler = async ({ fetch }) => {
	// Ergänzt um daily-Parameter & forecast_days=1 (nur für den aktuellen Tag)
	const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&current=temperature_2m,relative_humidity_2m,rain,precipitation,wind_speed_10m,wind_direction_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&forecast_days=1&timezone=Europe/Berlin`;

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

	try {
		const response = await fetch(apiUrl, { signal: controller.signal });

		if (!response.ok) {
			return json({ error: 'Fehler beim Laden der Wetterdaten' }, { status: response.status });
		}

		const data = await response.json();

		return json({
			// Aktuelle Werte
			temperature: data.current.temperature_2m,
			temperatureUnit: data.current_units.temperature_2m,
			humidity: data.current.relative_humidity_2m,
			humidityUnit: data.current_units.relative_humidity_2m,
			weatherCode: data.current.weather_code,
			isRaining: (data.current.precipitation ?? 0) > 0,
			windSpeed: data.current.wind_speed_10m,
			windSpeedUnit: data.current_units.wind_speed_10m,
			windDirectionDeg: data.current.wind_direction_10m,
			time: data.current.time,

			// Vorhersage für HEUTE (Index 0 entspricht dem aktuellen Tag)
			today: {
				tempMax: data.daily.temperature_2m_max[0],
				tempMin: data.daily.temperature_2m_min[0],
				precipitationSum: data.daily.precipitation_sum[0], // Gesamter Regen heute in mm
				rainProbability: data.daily.precipitation_probability_max[0] // Max. Regenwahrscheinlichkeit in %
			}
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
