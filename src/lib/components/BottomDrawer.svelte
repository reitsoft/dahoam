<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import X from '@lucide/svelte/icons/x';

	let {
		open = $bindable(false),
		title,
		label = title,
		onclose,
		children
	}: {
		open?: boolean;
		/** Überschrift im Griff-Bereich */
		title: string;
		/** Accessible Name des Dialogs (Default: title) */
		label?: string;
		onclose?: () => void;
		children?: Snippet;
	} = $props();

	let dragY = $state(0);
	let dragging = $state(false);
	let startY = 0;
	let startZeit = 0;

	let schliessenBtn = $state<HTMLButtonElement>();
	let opener: HTMLElement | null = null;

	/** Hängt das Element an <body>, damit `fixed` nicht vom umgebenden Layout beeinflusst wird. */
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}

	function schliessen() {
		if (!open) return;
		open = false;
		dragY = 0;
		onclose?.();
	}

	function dragStart(e: PointerEvent) {
		dragging = true;
		startY = e.clientY;
		startZeit = e.timeStamp;
		dragY = 0;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function dragMove(e: PointerEvent) {
		if (!dragging) return;
		dragY = Math.max(0, e.clientY - startY);
	}

	function dragEnde(e: PointerEvent) {
		if (!dragging) return;
		dragging = false;
		const geschwindigkeit = dragY / Math.max(e.timeStamp - startZeit, 1); // px/ms
		if (dragY > 100 || geschwindigkeit > 0.6) {
			schliessen();
		} else {
			dragY = 0;
		}
	}

	// Beim Öffnen: Fokus in den Drawer, Body-Scroll sperren.
	// Beim Schließen (Cleanup): Scroll freigeben, Fokus zurück an den Auslöser.
	$effect(() => {
		if (!open) return;

		opener = document.activeElement as HTMLElement | null;
		dragY = 0;
		tick().then(() => schliessenBtn?.focus());

		const vorher = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		return () => {
			document.body.style.overflow = vorher;
			opener?.focus();
			opener = null;
		};
	});
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && open && schliessen()} />

<!-- Bottom-Drawer (an <body> gehängt) -->
<div use:portal>
	<!-- Hintergrund: Tippen schließt -->
	<button
		type="button"
		tabindex="-1"
		aria-label="Schließen"
		onclick={schliessen}
		class="fixed inset-0 z-[60] bg-black/60 transition-opacity duration-300 {open
			? 'opacity-100'
			: 'pointer-events-none opacity-0'}"
	></button>

	<div
		role="dialog"
		aria-modal="true"
		aria-label={label}
		aria-hidden={!open}
		inert={!open}
		style:transform={open ? `translateY(${dragY}px)` : 'translateY(100%)'}
		class="fixed inset-x-0 bottom-0 z-[70] flex max-h-[85dvh] flex-col rounded-t-3xl border-t border-cream-100/10 bg-navy-900 shadow-2xl {dragging
			? ''
			: 'transition-transform duration-300 ease-out'}"
	>
		<!-- Griff + Titel: hier wird gewischt -->
		<div
			role="presentation"
			class="shrink-0 cursor-grab touch-none px-4 pt-3 pb-2 select-none active:cursor-grabbing"
			onpointerdown={dragStart}
			onpointermove={dragMove}
			onpointerup={dragEnde}
			onpointercancel={dragEnde}
		>
			<div class="mx-auto mb-3 h-1.5 w-10 rounded-full bg-cream-100/20"></div>
			<div class="flex items-center justify-between">
				<span class="text-xs font-bold tracking-wide text-cream-100/50 uppercase">{title}</span>
				<!-- <button
					type="button"
					bind:this={schliessenBtn}
					onclick={schliessen}
					onpointerdown={(e) => e.stopPropagation()}
					aria-label="Details schließen"
					class="flex h-8 w-8 items-center justify-center rounded-full bg-cream-100/5 text-cream-100/60 active:bg-cream-100/10"
				>
					<X class="h-4 w-4 stroke-2" />
				</button> -->
			</div>
		</div>

		<!-- Inhalt (scrollbar, falls zu hoch) -->
		<div
			class="flex flex-col gap-5 overflow-y-auto overscroll-contain px-4 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
		>
			{@render children?.()}
		</div>
	</div>
</div>