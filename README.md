# 🏡 Dahoam

Lokales Smart-Home- und Familien-Dashboard als **Progressive Web App** – Rolläden, Heizung, Energie/PV, Lüftung, Haustür, Wetter und Stundenplan in einer Oberfläche.

![SvelteKit](https://img.shields.io/badge/SvelteKit-Svelte_5-FF3E00?logo=svelte&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)
![MQTT](https://img.shields.io/badge/MQTT-Echtzeit-660066?logo=mqtt&logoColor=white)
![InfluxDB](https://img.shields.io/badge/InfluxDB-v2-22ADF6?logo=influxdb&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

| Bereich | Beschreibung |
| --- | --- |
| **Rolläden** | Steuerung von Shelly-Rolläden (öffnen, schließen, stoppen, Position anfahren) mit Live-Status |
| **Haustür & Klingel** | Türöffner und Klingelsteuerung inkl. Stummschaltung; sicherheitskritische Aktionen sind per Passkey (WebAuthn) geschützt |
| **Heizung** | Telemetrie von Wärmepumpe und Regelung über eBUS (`ebusd`) |
| **Lüftung** | Automatische Bad-Lüfter-Steuerung nach Luftfeuchte sowie Taupunkt-Bewertung für die Kellerlüftung |
| **Energie & PV** | Verbrauch, Bezug, Einspeisung und Stromfluss (Sankey) aus InfluxDB |
| **Wetter** | Aktuelle Werte und Vorhersage über Open-Meteo |
| **Schule** | Stundenplan, Ferientermine und Schultermine |
| **PWA** | Installierbar, Standalone-Modus, für Portrait-Nutzung optimiert |

## Tech-Stack

- **Framework:** SvelteKit mit Svelte 5 (Runes), TypeScript
- **Runtime:** Node.js (`@sveltejs/adapter-node`)
- **Styling:** Tailwind CSS v4, Lucide Icons
- **Charts:** Chart.js
- **Messaging:** MQTT (`mqtt.js`)
- **Zeitreihen:** InfluxDB v2
- **Auth:** WebAuthn / Passkeys (`@simplewebauthn`)
- **Tooling:** pnpm, Vite, Vitest, ESLint, Prettier
- **CI/CD:** GitHub Actions

## Architektur

```text
[Smart-Home-Geräte] ◄──(MQTT)──► [SvelteKit Node Server] ◄──► [InfluxDB]
                                       │          ▲
                                 (SSE / REST)   (REST)
                                       ▼          │
                             [Browser / PWA (Svelte 5)]
                                       │
                                       ▼
                               [Open-Meteo API]
```

- Der Server hält eine dauerhafte MQTT-Verbindung und verteilt Zustandsänderungen per **Server-Sent Events** an die Clients.
- Energiedaten werden aus mehreren InfluxDB-Buckets aggregiert und mit Live-Werten kombiniert.
- Automatisierungen (z. B. Lüfter) laufen im Server-Prozess und überstehen Neustarts durch lokale Persistenz.

## Projektstruktur

```text
├── .github/workflows/   # CI/CD
├── data/                # Lokale Laufzeitdaten (nicht versioniert)
├── src/
│   ├── lib/
│   │   ├── components/  # UI-Komponenten nach Domäne
│   │   ├── config/      # Geräte- und Schulkonfiguration
│   │   ├── server/      # Serverlogik (MQTT, InfluxDB, eBUS, Auth, …)
│   │   ├── stores/      # Reaktive Svelte-5-Stores
│   │   └── utilities/   # Hilfsfunktionen
│   └── routes/          # Seiten und Backend-API
└── static/              # PWA-Manifest, Icons, Fonts
```

## Voraussetzungen

- Node.js und [pnpm](https://pnpm.io)
- MQTT-Broker mit Shelly-Geräten
- InfluxDB v2 mit Strom-/PV-Daten
- Optional: `ebusd` für Heizungsdaten
- HTTPS für die Passkey-Funktion (in der Entwicklung genügt `localhost`)

## Installation & Entwicklung

```sh
git clone https://github.com/<user>/dahoam.git
cd dahoam
pnpm install
cp .env.example .env   # Werte anpassen
pnpm dev
```

Ohne InfluxDB lässt sich die Energie-Ansicht mit Mock-Daten testen:

```sh
USE_MOCK_DATA=true pnpm dev
```

| Befehl | Zweck |
| --- | --- |
| `pnpm dev` | Entwicklungsserver |
| `pnpm build` | Produktions-Build |
| `pnpm preview` | Build lokal ansehen |
| `pnpm check` | Typprüfung |
| `pnpm lint` / `pnpm format` | Linting / Formatierung |
| `pnpm test` | Unit-Tests |

## Konfiguration

Zugangsdaten werden ausschließlich über Umgebungsvariablen geladen und gehören **nicht** ins Repository.

| Variable | Beschreibung |
| --- | --- |
| `MQTT_URL`, `MQTT_USER`, `MQTT_PASSWORD` | Verbindung zum MQTT-Broker |
| `INFLUX_URL`, `INFLUX_TOKEN`, `INFLUX_ORG`, `INFLUX_BUCKET` | InfluxDB-Zugang |
| `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`, `WEBAUTHN_SETUP_SECRET` | Passkey-Konfiguration |
| `PREIS_PRO_KWH` | Optional: Strompreis für die Kostenanzeige |
| `DATA_DIR` | Optional: Verzeichnis für lokale Laufzeitdaten |
| `USE_MOCK_DATA` | Optional: Mock-Daten für die Energie-Ansicht |

Geräte (Rolläden, Sensoren) sowie Stundenplan und Ferien sind in `src/lib/config/` hinterlegt und müssen an die eigene Installation angepasst werden.

## API

Das Backend stellt REST- und SSE-Endpunkte unter `src/routes/api/` bereit, u. a. für:

- **Rolläden:** Befehle senden und Live-Status streamen
- **Sensoren:** Live-Daten von Raumsensoren streamen
- **Lüfter:** Status abfragen und Betriebsmodus ändern
- **Heizung:** Daten der Heizungsanlage abrufen
- **Haustür & Klingel:** geschützte Türöffnung sowie Klingelsteuerung
- **Passkeys:** Registrierung und Verifizierung
- **Wetter:** aufbereitete Wetterdaten
- **Termine:** Schultermine anlegen, ändern und löschen
- **Status:** Zustand der MQTT-Verbindung

## Deployment

Das Projekt wird per GitHub Actions automatisiert auf einen eigenen Server im Heimnetz ausgeliefert (über ein VPN). Der Node-Prozess wird mit PM2 betrieben.

## Sicherheit

- Sicherheitskritische Aktionen sind per Passkey geschützt.
- Die App ist für den Betrieb im Heimnetz bzw. hinter einem VPN gedacht und **nicht** für den direkten Zugriff aus dem Internet.
- Keine Zugangsdaten im Repository – nur über Umgebungsvariablen.

## Lizenz

[MIT](./LICENSE) © 2026 reitsoft
