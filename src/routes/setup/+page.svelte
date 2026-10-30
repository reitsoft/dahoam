<!-- src/routes/setup/+page.svelte -->
<script lang="ts">
    import { startRegistration } from '@simplewebauthn/browser';
    import Viewport from '$lib/components/Viewport.svelte';
    import AppHeader from '$lib/components/AppHeader.svelte';

    let secret = $state('');
    let geraetename = $state('Handy 1');
    let laeuft = $state(false);
    let meldung = $state<{ typ: 'ok' | 'fehler'; text: string } | null>(null);

    async function passkeyRegistrieren() {
        if (laeuft || !secret) return;
        laeuft = true;
        meldung = null;

        const h = { 'x-setup-secret': secret, 'content-type': 'application/json' };

        try {
            const optRes = await fetch('/api/webauthn/register/options', { method: 'POST', headers: h });
            if (optRes.status === 403) {
                meldung = { typ: 'fehler', text: 'Setup-Secret falsch.' };
                return;
            }
            if (!optRes.ok) throw new Error(`Optionen: ${optRes.status}`);

            const att = await startRegistration({ optionsJSON: await optRes.json() });

            const res = await fetch('/api/webauthn/register/verify', {
                method: 'POST',
                headers: h,
                body: JSON.stringify({ response: att, name: geraetename.trim() || 'Gerät' })
            });
            if (!res.ok) throw new Error(`Verifikation: ${res.status}`);

            meldung = { typ: 'ok', text: `„${geraetename}“ ist registriert. Du kannst die Tür jetzt entriegeln.` };
            secret = '';
        } catch (err) {
            const name = (err as Error).name;
            if (name === 'NotAllowedError') {
                meldung = { typ: 'fehler', text: 'Abgebrochen oder Zeitüberschreitung.' };
            } else if (name === 'InvalidStateError') {
                meldung = { typ: 'fehler', text: 'Dieses Gerät ist bereits registriert.' };
            } else {
                console.error('Passkey-Registrierung fehlgeschlagen:', err);
                meldung = { typ: 'fehler', text: 'Registrierung fehlgeschlagen. Details in der Konsole.' };
            }
        } finally {
            laeuft = false;
        }
    }
</script>

<Viewport>
    <AppHeader title="Passkey einrichten" />

    <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-3 no-scrollbar">
        <div class="flex flex-col gap-3 rounded-3xl border border-navy-800 bg-navy-900 p-4">
            <label class="flex flex-col gap-1">
                <span class="text-xs font-bold tracking-wide text-cream-100/50 uppercase">Setup-Secret</span>
                <input
                    type="password"
                    bind:value={secret}
                    autocomplete="off"
                    class="rounded-xl border border-cream-100/10 bg-navy-950 px-3 py-2 text-cream-100"
                />
            </label>

            <label class="flex flex-col gap-1">
                <span class="text-xs font-bold tracking-wide text-cream-100/50 uppercase">Gerätename</span>
                <input
                    type="text"
                    bind:value={geraetename}
                    class="rounded-xl border border-cream-100/10 bg-navy-950 px-3 py-2 text-cream-100"
                />
            </label>

            <button
                type="button"
                onclick={passkeyRegistrieren}
                disabled={laeuft || !secret}
                class="rounded-full bg-teal-500 px-4 py-3 text-sm font-bold tracking-wide text-navy-950 uppercase disabled:opacity-40"
            >
                {laeuft ? 'Bitte warten…' : 'Passkey registrieren'}
            </button>

            {#if meldung}
                <p class="text-sm {meldung.typ === 'ok' ? 'text-teal-400' : 'text-orange-400'}">
                    {meldung.text}
                </p>
            {/if}
        </div>
    </div>
</Viewport>