<script lang="ts">
  import { page } from '$app/stores';
  import { resolve } from '$app/paths';
  import { House, PanelsTopLeft, Zap, SunIcon, School, School2, SchoolIcon, LucideSchool, LucideSquareCenterlineDashedHorizontal } from '@lucide/svelte';

  const items = [
    { href: resolve('/'), label: 'Haus', icon: House },
    { href: resolve('/shutters'), label: 'Rollos', icon: PanelsTopLeft },
    { href: resolve('/energy'), label: 'Energie', icon: Zap },
    { href: resolve('/weather'), label: 'Wetter', icon: SunIcon },
    { href: resolve('/school'), label: 'Schule', icon: School },
  ];
</script>

<nav
  class="z-50 flex min-h-16 w-full flex-shrink-0 items-center justify-around border-t-4 border-navy-800 bg-navy-900"
  style="padding-bottom: env(safe-area-inset-bottom);"
>
  {#each items as item (item.href)}
    {@const active = item.href === '/' 
      ? $page.url.pathname === item.href 
      : $page.url.pathname.startsWith(item.href)}
    
    <a
      href={item.href}
      aria-current={active ? 'page' : undefined}
      class="flex min-w-16 flex-col items-center gap-1 transition-colors {active ? 'text-orange-500' : 'text-cream-100/50'}"
    >
      <item.icon class="h-5 w-5 stroke-2" />
      <span class="text-[11px] font-semibold tracking-wider uppercase">{item.label}</span>
    </a>
  {/each}
</nav>
