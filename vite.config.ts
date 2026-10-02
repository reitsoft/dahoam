import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	cacheDir: 'node_modules/.vite',
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			injectRegister: false,
			devOptions: {
				enabled: true,
				type: 'module'
			},
			manifest: {
				name: 'Dahoam',
				short_name: 'Dahoam',
				description: 'Home automation',
				theme_color: '#0f172a',
				background_color: '#0f172a',
				display: 'standalone',

				start_url: '/',
				icons: [
					{
						src: 'icon-192.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'any maskable'
					},
					{
						src: 'icon-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any maskable'
					}
				]
			},
			workbox: {
				globPatterns: ['**/*.{js,css,svg,png,ico}'], // html raus, da kein statisches Shell-Dokument existiert
				navigateFallback: null,
				skipWaiting: true,
    			clientsClaim: true,
				runtimeCaching: [
					{
						urlPattern: ({ request }) => request.mode === 'navigate',
						handler: 'NetworkFirst',
						options: { cacheName: 'pages' }
					}
				]
			}
		})
	],
	test: {
		environment: 'jsdom',
		// Optional: Macht `describe`, `it`, `expect` global verfügbar (kein manueller Import nötig)
		globals: true,
	},
	ssr: {
        noExternal: ['layerchart', 'd3-sankey', 'd3-path', 'd3-shape']
    },
	resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined
});
