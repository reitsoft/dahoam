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
		{ nummer: 1, von: '08:15', bis: '09:00', fach: 'Deutsch', raum: 'R 106', lehrer: 'Fr. Mauch' },
		{ nummer: 2, von: '09:30', bis: '10:15', fach: 'Englsich', raum: 'R 106', lehrer: 'Fr. Mauch' },
		{ nummer: 3, von: '10:15', bis: '11:00', fach: 'Sachunterricht', raum: 'R 106', lehrer: 'Fr. Mauch' },
		{ nummer: 4, von: '11:15', bis: '12:00', fach: 'Sport (BSS)', raum: 'Turnhalle', lehrer: 'Hr. Arnold' },
		{ nummer: 5, von: '12:00', bis: '12:45', fach: 'Mathematik', raum: 'R 106', lehrer: 'Fr. Rendler' },
		{ nummer: 6, von: '13:45', bis: '15:00', fach: 'Hausaufgaben', raum: 'R 106', lehrer: 'Fr. YYY' }
	],
	dienstag: [
		{ nummer: 1, von: '08:15', bis: '09:00', fach: 'Deutsch', raum: 'R 106', lehrer: 'Fr. Mauch' },
		{ nummer: 2, von: '09:30', bis: '10:15', fach: 'Sachunterricht', raum: 'R 106', lehrer: 'Fr. Mauch' },
		{ nummer: 3, von: '10:15', bis: '11:00', fach: 'Mathematik', raum: 'R 106', lehrer: 'Fr. Rendler' },
		{ nummer: 4, von: '11:15', bis: '12:00', fach: 'Sport (BSS)', raum: 'Turnhalle', lehrer: 'Hr. Arnold' },
		{ nummer: 5, von: '12:00', bis: '12:45', fach: 'Sport (BSS)', raum: 'Turnhalle', lehrer: 'Hr. Arnold' },
		{ nummer: 6, von: '13:45', bis: '15:00', fach: 'Hausaufgaben', raum: 'R 106', lehrer: 'Fr. YYY' }
	],
	mittwoch: [
		{ nummer: 1, von: '07:30', bis: '08:15', fach: 'Kunst und Werken', raum: 'R 106/Kunstraum', lehrer: 'Fr. XXX' },
		{ nummer: 2, von: '08:15', bis: '09:00', fach: 'Kunst und Werken', raum: 'R 106/Kunstraum', lehrer: 'Fr. XXX' },
		{ nummer: 3, von: '09:30', bis: '10:15', fach: 'Deutsch', raum: 'R 106', lehrer: 'Fr. Mauch' },
		{ nummer: 4, von: '10:15', bis: '11:00', fach: 'Deutsch', raum: 'R 106', lehrer: 'Fr. Mauch' },
		{ nummer: 5, von: '11:15', bis: '12:00', fach: 'Musik', raum: 'R 209', lehrer: 'Hr. Richter' },
		{ nummer: 6, von: '12:00', bis: '12:45', fach: 'Englsich', raum: 'R 106', lehrer: 'Fr. Mauch' },
		{ nummer: 7, von: '13:45', bis: '15:00', fach: 'Hausaufgaben', raum: 'R 106', lehrer: 'Fr. YYY' }
	],
	donnerstag: [
		{ nummer: 1, von: '08:15', bis: '09:00', fach: 'Deutsch', raum: 'R 106', lehrer: 'Fr. Mauch' },
		{ nummer: 2, von: '09:30', bis: '10:15', fach: 'Mathematik', raum: 'R 106', lehrer: 'Fr. Rendler' },
		{ nummer: 3, von: '10:15', bis: '11:00', fach: 'Mathematik', raum: 'R 106', lehrer: 'Fr. Rendler' },
		{ nummer: 4, von: '11:15', bis: '12:00', fach: 'Reli / Werte', raum: 'R 106', lehrer: 'Fr. Mauch' },
		{ nummer: 5, von: '12:00', bis: '12:45', fach: 'Sachunterricht', raum: 'R 106', lehrer: 'Fr. Mauch' },
		{ nummer: 6, von: '13:45', bis: '15:00', fach: 'Hausaufgaben', raum: 'R 106', lehrer: 'Fr. YYY' }
	],
	freitag: [
		{ nummer: 1, von: '07:30', bis: '08:15', fach: 'Mathematik', raum: 'R 106', lehrer: 'Fr. Rendler' },
		{ nummer: 2, von: '08:15', bis: '09:00', fach: 'Deutsch', raum: 'R 106', lehrer: 'Fr. Mauch' },
		{ nummer: 3, von: '09:30', bis: '10:15', fach: 'KL', raum: 'R 106', lehrer: 'Fr. XXX' },
		{ nummer: 4, von: '10:15', bis: '11:00', fach: 'Reli / Werte', raum: 'R 106', lehrer: 'Fr. Mauch' },
		{ nummer: 5, von: '11:15', bis: '12:00', fach: 'Musik', raum: 'Musikraum', lehrer: 'Hr. Blum' },
		{ nummer: 6, von: '12:00', bis: '12:45', fach: 'Mathematik', raum: 'R 106', lehrer: 'Fr. Rendler' },
		{ nummer: 7, von: '13:45', bis: '15:00', fach: 'Hausaufgaben', raum: 'R 106', lehrer: 'Fr. YYY' }
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