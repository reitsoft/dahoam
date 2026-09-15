<!-- routes/+layout.svelte -->
<script lang="ts">
	import './layout.css';
	import { pwaInfo } from 'virtual:pwa-info';
	import { useRegisterSW } from 'virtual:pwa-register/svelte';
	import InstallPWA from '$lib/InstallPWA.svelte';
	import favicon from '$lib/assets/favicon.svg';
	import AppNav from '$lib/components/AppNav.svelte';

	let { children } = $props();

	let webManifestHref = $derived(pwaInfo?.webManifest?.href ?? '');

	useRegisterSW({
		onRegistered(r) {
			console.log('SW Registered:', r);
		},
		onRegisterError(error) {
			console.error('SW registration error', error);
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	{#if webManifestHref}
		<link rel="manifest" href={webManifestHref} />
	{/if}
</svelte:head>

<div class="flex h-dvh w-full flex-col overflow-hidden bg-navy-950 text-cream-100">
  <InstallPWA />
  
  <!-- Content nimmt den gesamten verbleibenden Platz ein -->
  <main class="flex min-h-0 flex-1 flex-col overflow-hidden">
    {@render children()}
  </main>

  <!-- AppNav sitzt ganz unten im Flex-Fluss -->
  <AppNav />
</div>

<style>
  /* Verhindert das elastische Overscrolling auf iOS im Hintergrund */
  :global(html, body) {
    margin: 0;
    padding: 0;
    height: 100%;
    overflow: hidden;
  }
</style>