type DatenPunkt = { time: string; value: number | null };

export async function getVerbrauchProStunde(): Promise<DatenPunkt[]> {
    return Array.from({ length: 24 }, (_, hour) => ({
        time: new Date(new Date().setHours(hour, 0, 0, 0)).toISOString(),
        value: hour >= 6 && hour <= 22 ? Math.round((0.3 + Math.random() * 1.2) * 10) / 10 : Math.round(Math.random() * 20) / 100
    }));
}

export async function getAktuellerZaehlerstand(): Promise<number> {
    return 12345.6;
}

export async function getVerbrauchHeute(): Promise<number> {
    return Math.round((5 + Math.random() * 20) * 10) / 10;
}

export async function getVerbrauchProTagMonat() {
    const now = new Date();
    const tageImMonat = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Array.from({ length: tageImMonat }, (_, i) => {
        const tag = i + 1;
        if (tag > now.getDate()) return { tag, value: null };
        return { tag, value: Math.round((5 + Math.random() * 20) * 10) / 10 };
    });
}

export async function getVerbrauchVormonat(): Promise<number> {
    return 320.5;
}

export async function getVerbrauchMonat(): Promise<number> {
    const tag = new Date().getDate();
    return Math.round(tag * (10 + Math.random() * 5) * 10) / 10;
}

export async function getVerbrauchLetzte7Tage() {
    const tageKurz = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    return Array.from({ length: 7 }, (_, i) => ({
        tag: tageKurz[(new Date().getDay() - 6 + i + 7) % 7],
        value: Math.round((5 + Math.random() * 20) * 10) / 10
    }));
}

export async function getAktuelleLeistung(): Promise<number> {
    return Math.round((200 + Math.random() * 2500));
}