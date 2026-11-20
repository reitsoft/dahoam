<!-- $lib/InstallPWA.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';

	interface BeforeInstallPromptEvent extends Event {
		prompt(): Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	const DISMISS_KEY = 'pwa-install-dismissed';

	let deferredPrompt: BeforeInstallPromptEvent | null = $state(null);
	let showInstallButton = $state(false);

	function isDismissed(): boolean {
		try {
			return localStorage.getItem(DISMISS_KEY) === '1';
		} catch {
			return false;
		}
	}

	onMount(() => {
		const handleBeforeInstallPrompt = (e: Event) => {
			e.preventDefault();
			deferredPrompt = e as BeforeInstallPromptEvent;
			showInstallButton = !isDismissed();
		};

		const handleAppInstalled = () => {
			showInstallButton = false;
			deferredPrompt = null;
		};

		window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
		window.addEventListener('appinstalled', handleAppInstalled);

		return () => {
			window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
			window.removeEventListener('appinstalled', handleAppInstalled);
		};
	});

	async function installPWA() {
		if (!deferredPrompt) return;

		showInstallButton = false;
		await deferredPrompt.prompt();

		const { outcome } = await deferredPrompt.userChoice;
		if (outcome === 'accepted') {
			console.log('PWA wurde installiert');
		}
		deferredPrompt = null;
	}

	function dismiss() {
		showInstallButton = false;
		try {
			localStorage.setItem(DISMISS_KEY, '1');
		} catch {
			/* Speicher nicht verfügbar – dann nur für diese Sitzung ausblenden */
		}
	}
</script>

{#if showInstallButton}
	<div
		class="flex shrink-0 items-center gap-2 border-b border-white/10 bg-white/5 px-3 py-1.5 text-xs text-cream-100/80"
	>
		<span class="min-w-0 flex-1 truncate">Dahoam als App installieren</span>

		<button
			type="button"
			onclick={installPWA}
			class="shrink-0 rounded-md bg-white/10 px-2.5 py-1 font-semibold text-cream-100 transition hover:bg-white/20 active:bg-white/25"
		>
			Installieren
		</button>

		<button
			type="button"
			onclick={dismiss}
			aria-label="Hinweis ausblenden"
			class="shrink-0 rounded-md p-1 text-cream-100/60 transition hover:bg-white/10 hover:text-cream-100"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M18 6 6 18" />
				<path d="m6 6 12 12" />
			</svg>
		</button>
	</div>
{/if}