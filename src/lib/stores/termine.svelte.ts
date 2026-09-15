// src/lib/stores/termine.svelte.ts
import { onMount } from 'svelte';

export interface Termin {
	id: string;
	datum: string;
	uhrzeit: string;
	titel: string;
	notizen?: string;
}

export function createTermineStore() {
	let termine = $state<Termin[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	async function fetchTermine() {
		try {
			const res = await fetch('/api/termine');
			if (!res.ok) throw new Error('Fehler beim Laden der Termine');
			termine = await res.json();
			error = null;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unbekannter Fehler';
		} finally {
			loading = false;
		}
	}

	async function addTermin(neuerTermin: Omit<Termin, 'id'>) {
		const res = await fetch('/api/termine', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(neuerTermin)
		});
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			throw new Error(body.error ?? 'Fehler beim Erstellen des Termins');
		}
		await fetchTermine();
	}

	async function removeTermin(id: string) {
		const res = await fetch(`/api/termine/${id}`, { method: 'DELETE' });
		if (!res.ok) throw new Error('Fehler beim Löschen des Termins');
		termine = termine.filter((t) => t.id !== id);
	}

	onMount(() => {
		fetchTermine();
	});

	return {
		get termine() {
			return termine;
		},
		get loading() {
			return loading;
		},
		get error() {
			return error;
		},
		refresh: fetchTermine,
		add: addTermin,
		remove: removeTermin
	};
}