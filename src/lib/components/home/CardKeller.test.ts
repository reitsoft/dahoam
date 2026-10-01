import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tick } from 'svelte';
import Keller from './CardKeller.svelte';

// ---------------------------------------------------------------------------
// Mocks aufbauen
// ---------------------------------------------------------------------------

// 1. Mock für die Taupunkt-Berechnung
vi.mock('$lib/utilities/taupunkt', () => ({
    kondensationsRisiko: vi.fn(({ quellTempC }) => {
        // Beispielslogik für den Mock: Hohe Außentemperatur erzeugt ein Schimmel/Kondensationsrisiko
        return {
            risiko: quellTempC > 20
        };
    })
}));

// 2. Mocks für WeatherStore & SensorStore als reactive state/getters
const mockWeatherData = {
    data: null as { temperature: number | null; humidity: number | null } | null
};

const mockSensorData = new Map<string, any>();

vi.mock('$lib/stores/weather.svelte', () => ({
    createWeatherStore: () => mockWeatherData
}));

vi.mock('$lib/stores/sensors.sse.svelte', () => ({
    sensorStore: {
        get: (key: string) => mockSensorData.get(key)
    }
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Keller Komponente', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockWeatherData.data = null;
        mockSensorData.clear();
    });

    it('rendert Fallback-Werte ("–"), wenn keine Sensor- und Wetterdaten vorliegen', () => {
        render(Keller);

        expect(screen.getByText('Keller')).toBeInTheDocument();
        expect(screen.getByText('–°')).toBeInTheDocument();
        expect(screen.getByText('–%')).toBeInTheDocument();
        expect(screen.queryByText(/Lüften/i)).not.toBeInTheDocument();
    });

    it('zeigt Temperatur und Luftfeuchtigkeit an, wenn Sensordaten vorliegen', () => {
        mockSensorData.set('keller', {
            temperature: 16.4,
            humidity: 65,
            batteryPercent: 80
        });

        render(Keller);

        expect(screen.getByText('16.4°')).toBeInTheDocument();
        expect(screen.getByText('65%')).toBeInTheDocument();
    });

    describe('Taupunkt- & Lüftungsempfehlung', () => {
        it('zeigt "Lüften möglich" bei niedrigem Kondensationsrisiko', () => {
            mockWeatherData.data = { temperature: 10, humidity: 50 };
            mockSensorData.set('keller', { temperature: 16.0, humidity: 60 });

            render(Keller);

            expect(screen.getByText('Lüften möglich')).toBeInTheDocument();
            expect(screen.queryByText('Nicht lüften!')).not.toBeInTheDocument();
        });

        it('zeigt "Nicht lüften!" bei hohem Kondensationsrisiko', () => {
            // Gemäß unserem Mock löst temp > 20 ein Risiko aus
            mockWeatherData.data = { temperature: 25, humidity: 80 };
            mockSensorData.set('keller', { temperature: 16.0, humidity: 60 });

            render(Keller);

            expect(screen.getByText('Nicht lüften!')).toBeInTheDocument();
            expect(screen.queryByText('Lüften möglich')).not.toBeInTheDocument();
        });
    });

    describe('Batteriestatus & Tooltip', () => {
        it('blendet den Tooltip bei Hover ein und nach 5 Sekunden automatisch wieder aus', async () => {
            mockSensorData.set('keller', {
                temperature: 15,
                humidity: 60,
                batteryPercent: 85
            });

            render(Keller);

            const batteryBtn = screen.getByRole('button', { name: /Batteriestand 85%/i });

            // Initial sollte der Tooltip nicht sichtbar sein
            expect(screen.queryByText('85%')).not.toBeInTheDocument();

            // Hover auslösen
            await fireEvent.mouseEnter(batteryBtn);
            expect(screen.getByText('85%')).toBeInTheDocument();

            // 5 Sekunden vergehen lassen -> Tooltip muss verschwinden
            vi.advanceTimersByTime(5000);

            // WICHTIG: Svelte mitteilen, dass das DOM nach der State-Änderung aktualisiert werden muss
            await tick(); // <-- 2. Hier auf das DOM-Re-Render warten

            expect(screen.queryByText('85%')).not.toBeInTheDocument();
        });

        it('blendet den Tooltip sofort aus, wenn die Maus das Icon verlässt', async () => {
            mockSensorData.set('keller', {
                temperature: 15,
                humidity: 60,
                batteryPercent: 12
            });

            render(Keller);

            const batteryBtn = screen.getByRole('button', { name: /Batteriestand 12%/i });

            await fireEvent.mouseEnter(batteryBtn);
            expect(screen.getByText('12%')).toBeInTheDocument();

            await fireEvent.mouseLeave(batteryBtn);
            expect(screen.queryByText('12%')).not.toBeInTheDocument();
        });
    });
});