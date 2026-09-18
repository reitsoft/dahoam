// Fixe Ferientermine (Schuljahr 2026/27)
	export const FERIEN: { name: string; zeitraum: string }[] = [
		{ name: 'Herbstferien', zeitraum: 'Sa. 24.10.26 – So. 01.11.26' },
		{ name: 'Weihnachtsferien', zeitraum: 'Mi. 23.12.26 – So. 10.01.27' },
		{ name: 'Fastnacht', zeitraum: 'Fr. 05.02.27 – Mi. 10.02.27' },
		{ name: 'Osterferien', zeitraum: 'Sa. 20.03.27 – So. 04.04.27' },
		{ name: 'Pfingstferien', zeitraum: 'Sa. 15.05.27 – So. 30.05.27' },
		{ name: 'Sommerferien', zeitraum: 'Do. 29.07.27 – So. 12.09.27' }
	];

	export const BEWEGLICHE_TAGE_HINWEIS = 'Bewegliche Ferientage / unterrichtsfreie Tage:';
	export const BEWEGLICHE_TAGE = ['05.02.27', '08.02.27', '09.02.27', '10.02.27', '22.03.27', '23.03.27', '24.03.27'];