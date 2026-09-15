// src/lib/config/stundenplan.ts

export interface Stunde {
	nummer: number;
	von: string;
	bis: string;
	fach: string;
	raum?: string;
	lehrer?: string;
}

export type Wochentag = 'montag' | 'dienstag' | 'mittwoch' | 'donnerstag' | 'freitag';

export const WOCHENTAGE: { key: Wochentag; label: string }[] = [
	{ key: 'montag', label: 'Montag' },
	{ key: 'dienstag', label: 'Dienstag' },
	{ key: 'mittwoch', label: 'Mittwoch' },
	{ key: 'donnerstag', label: 'Donnerstag' },
	{ key: 'freitag', label: 'Freitag' }
];

export const STUNDENPLAN: Record<Wochentag, Stunde[]> = {
	montag: [
		{ nummer: 1, von: '08:00', bis: '08:45', fach: 'Mathematik', raum: 'R 204', lehrer: 'Fr. Weber' },
		{ nummer: 2, von: '08:50', bis: '09:35', fach: 'Deutsch', raum: 'R 204', lehrer: 'Hr. Schmidt' },
		{ nummer: 3, von: '09:55', bis: '10:40', fach: 'Englisch', raum: 'R 118', lehrer: 'Fr. Klein' },
		{ nummer: 4, von: '10:45', bis: '11:30', fach: 'Sport', raum: 'Halle 2', lehrer: 'Hr. Bauer' },
		{ nummer: 5, von: '11:50', bis: '12:35', fach: 'Biologie', raum: 'R 310', lehrer: 'Fr. Hoffmann' },
		{ nummer: 6, von: '12:40', bis: '13:25', fach: 'Kunst', raum: 'R 015', lehrer: 'Hr. Lange' }
	],
	dienstag: [
		{ nummer: 1, von: '08:00', bis: '08:45', fach: 'Physik', raum: 'R 220', lehrer: 'Hr. Fischer' },
		{ nummer: 2, von: '08:50', bis: '09:35', fach: 'Mathematik', raum: 'R 204', lehrer: 'Fr. Weber' },
		{ nummer: 3, von: '09:55', bis: '10:40', fach: 'Geschichte', raum: 'R 112', lehrer: 'Hr. Wolf' },
		{ nummer: 4, von: '10:45', bis: '11:30', fach: 'Deutsch', raum: 'R 204', lehrer: 'Hr. Schmidt' },
		{ nummer: 5, von: '11:50', bis: '12:35', fach: 'Musik', raum: 'R 008', lehrer: 'Fr. Krause' },
		{ nummer: 6, von: '12:40', bis: '13:25', fach: 'Chemie', raum: 'R 301', lehrer: 'Fr. Neumann' }
	],
	mittwoch: [
		{ nummer: 1, von: '08:00', bis: '08:45', fach: 'Englisch', raum: 'R 118', lehrer: 'Fr. Klein' },
		{ nummer: 2, von: '08:50', bis: '09:35', fach: 'Mathematik', raum: 'R 204', lehrer: 'Fr. Weber' },
		{ nummer: 3, von: '09:55', bis: '10:40', fach: 'Sport', raum: 'Halle 1', lehrer: 'Hr. Bauer' },
		{ nummer: 4, von: '10:45', bis: '11:30', fach: 'Erdkunde', raum: 'R 209', lehrer: 'Hr. Richter' },
		{ nummer: 5, von: '11:50', bis: '12:35', fach: 'Deutsch', raum: 'R 204', lehrer: 'Hr. Schmidt' },
		{ nummer: 6, von: '12:40', bis: '13:25', fach: 'Informatik', raum: 'R 401', lehrer: 'Fr. Peters' }
	],
	donnerstag: [
		{ nummer: 1, von: '08:00', bis: '08:45', fach: 'Biologie', raum: 'R 310', lehrer: 'Fr. Hoffmann' },
		{ nummer: 2, von: '08:50', bis: '09:35', fach: 'Englisch', raum: 'R 118', lehrer: 'Fr. Klein' },
		{ nummer: 3, von: '09:55', bis: '10:40', fach: 'Mathematik', raum: 'R 204', lehrer: 'Fr. Weber' },
		{ nummer: 4, von: '10:45', bis: '11:30', fach: 'Religion', raum: 'R 015', lehrer: 'Hr. Vogel' },
		{ nummer: 5, von: '11:50', bis: '12:35', fach: 'Physik', raum: 'R 220', lehrer: 'Hr. Fischer' },
		{ nummer: 6, von: '12:40', bis: '13:25', fach: 'Kunst', raum: 'R 015', lehrer: 'Hr. Lange' }
	],
	freitag: [
		{ nummer: 1, von: '08:00', bis: '08:45', fach: 'Deutsch', raum: 'R 204', lehrer: 'Hr. Schmidt' },
		{ nummer: 2, von: '08:50', bis: '09:35', fach: 'Chemie', raum: 'R 301', lehrer: 'Fr. Neumann' },
		{ nummer: 3, von: '09:55', bis: '10:40', fach: 'Mathematik', raum: 'R 204', lehrer: 'Fr. Weber' },
		{ nummer: 4, von: '10:45', bis: '11:30', fach: 'Sport', raum: 'Halle 2', lehrer: 'Hr. Bauer' },
		{ nummer: 5, von: '11:50', bis: '12:35', fach: 'Englisch', raum: 'R 118', lehrer: 'Fr. Klein' },
		{ nummer: 6, von: '12:40', bis: '13:25', fach: 'Geschichte', raum: 'R 112', lehrer: 'Hr. Wolf' }
	]
};

export function heutigerWochentag(): Wochentag | null {
	const tag = new Date().getDay(); // 0 = So, 1 = Mo, ..., 6 = Sa
	const map: Record<number, Wochentag> = {
		1: 'montag',
		2: 'dienstag',
		3: 'mittwoch',
		4: 'donnerstag',
		5: 'freitag'
	};
	return map[tag] ?? null; // null am Wochenende
}