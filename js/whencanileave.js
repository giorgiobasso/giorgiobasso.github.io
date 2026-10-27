// Rechner «When can I leave?»
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('overtime-form');
    const resultDiv = document.getElementById('result');
    const $ = (id) => document.getElementById(id);

    const ids = {
        start: 'start-time',
        end: 'end-time',
        breakStart: 'start-break-time',
        breakEnd: 'end-break-time',
        required: 'required-work-time',
        max: 'max-work-time',
        overtime: 'current-overtime',
    };

    // Felder, die beim nächsten Besuch wieder vorausgefüllt werden
    const persisted = ['breakStart', 'breakEnd', 'required', 'max', 'overtime'];
    const STORAGE_KEY = 'wcil-settings';

    // ---------- Speicher ----------
    const loadSettings = () => {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            persisted.forEach((key) => {
                if (typeof saved[key] === 'string') $(ids[key]).value = saved[key];
            });
        } catch (e) { /* localStorage nicht verfügbar */ }
    };

    const saveSettings = () => {
        try {
            const data = {};
            persisted.forEach((key) => { data[key] = $(ids[key]).value; });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) { /* localStorage nicht verfügbar */ }
    };

    // ---------- Eingabe-Parser ----------
    // Akzeptiert «830», «8:30», «08:30» oder «8»; gibt Minuten oder null zurück
    const parseTime = (str) => {
        const value = str.trim();
        let h, m;
        let match;
        if ((match = value.match(/^(\d{1,2})[:.](\d{1,2})$/))) {
            h = +match[1]; m = +match[2];
        } else if ((match = value.match(/^(\d{1,2})(\d{2})$/))) {
            h = +match[1]; m = +match[2];
        } else if ((match = value.match(/^(\d{1,2})$/))) {
            h = +match[1]; m = 0;
        } else {
            return null;
        }
        return h > 23 || m > 59 ? null : h * 60 + m;
    };

    // Dauern (Soll, Maximum) werden wie Uhrzeiten eingegeben
    const parseDuration = parseTime;

    // Saldo: «+1:30», «-0:45», «90» (Minuten); leer = 0
    const parseSigned = (str) => {
        const value = str.trim();
        if (value === '') return 0;
        let match;
        if ((match = value.match(/^([+-])?\s*(\d+):(\d{1,2})$/))) {
            const minutes = +match[2] * 60 + +match[3];
            return match[1] === '-' ? -minutes : minutes;
        }
        if (/^[+-]?\d+$/.test(value)) return parseInt(value, 10);
        return null;
    };

    // ---------- Formatierung ----------
    const pad = (n) => String(n).padStart(2, '0');
    const formatDuration = (total) => {
        const sign = total < 0 ? '-' : '';
        const abs = Math.abs(total);
        return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
    };
    const formatSigned = (total) => (total > 0 ? '+' : '') + formatDuration(total);
    // Uhrzeit mit Umbruch nach 24 Stunden
    const formatClock = (total) => `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
    const formatCountdown = (minutes) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return h > 0 ? `${h} h ${m} min` : `${m} min`;
    };

    // Gesetzliche Mindestpause (ArG Art. 15) nach Arbeitszeit
    const minimumBreak = (workMinutes) => {
        if (workMinutes > 9 * 60) return 60;
        if (workMinutes > 7 * 60) return 30;
        if (workMinutes > 5.5 * 60) return 15;
        return 0;
    };

    // ---------- Rendern ----------
    const row = (label, value, negative) =>
        `<div class="item${negative ? ' neg' : ''}"><dt>${label}</dt><dd>${value}</dd></div>`;

    const render = () => {
        const raw = {};
        Object.keys(ids).forEach((key) => { raw[key] = $(ids[key]).value; });

        const errors = [];
        const start = raw.start.trim() === '' ? null : parseTime(raw.start);
        if (raw.start.trim() !== '' && start === null) errors.push('Beginn');
        const end = raw.end.trim() === '' ? null : parseTime(raw.end);
        if (raw.end.trim() !== '' && end === null) errors.push('Ende');
        const breakStart = raw.breakStart.trim() === '' ? null : parseTime(raw.breakStart);
        if (raw.breakStart.trim() !== '' && breakStart === null) errors.push('Pausenbeginn');
        const breakEnd = raw.breakEnd.trim() === '' ? null : parseTime(raw.breakEnd);
        if (raw.breakEnd.trim() !== '' && breakEnd === null) errors.push('Pausenende');
        const required = parseDuration(raw.required);
        if (required === null) errors.push('Sollarbeitszeit');
        const max = parseDuration(raw.max);
        if (max === null) errors.push('Maximale Arbeitszeit');
        const balance = parseSigned(raw.overtime);
        if (balance === null) errors.push('Überstunden-Saldo');

        if (errors.length) {
            resultDiv.innerHTML = `<p class="notice error">Ungültige Eingabe: ${errors.join(', ')}. Format: HH:MM (z. B. 08:30 oder 830).</p>`;
            return;
        }

        if ((breakStart === null) !== (breakEnd === null)) {
            resultDiv.innerHTML = '<p class="notice error">Bitte Pausenbeginn und Pausenende angeben (oder beide leer lassen).</p>';
            return;
        }

        let breakMinutes = 0;
        if (breakStart !== null) {
            breakMinutes = breakEnd - breakStart;
            if (breakMinutes < 0) {
                resultDiv.innerHTML = '<p class="notice error">Das Pausenende darf nicht vor dem Pausenbeginn liegen.</p>';
                return;
            }
        }

        if (start === null) {
            resultDiv.innerHTML = '<p class="empty">Trage deinen Arbeitsbeginn ein, um die Gehzeit zu sehen.</p>';
            return;
        }

        // Gehzeiten (in Minuten, ggf. über 24 Uhr hinaus)
        const balancedLeave = start + required + breakMinutes;
        const zeroLeave = balancedLeave - balance;
        const maxLeave = start + max + breakMinutes;

        // Countdown zur ausgeglichenen Gehzeit
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        let countdown = '';
        if (end === null) {
            const remaining = balancedLeave - nowMinutes;
            if (nowMinutes >= start && remaining > 0) {
                countdown = `Noch ${formatCountdown(remaining)} bis zur Gehzeit`;
            } else if (nowMinutes >= start && remaining <= 0) {
                countdown = 'Sollarbeitszeit erreicht – du kannst gehen';
            }
        }

        let html = `
            <div class="answer">
                <span class="label">Gehzeit (Soll erreicht)</span>
                <span class="time">${formatClock(balancedLeave)}</span>
                ${countdown ? `<span class="countdown">${countdown}</span>` : ''}
            </div>
            <dl class="rows">
                ${row('Ausgeglichen (Soll erreicht)', formatClock(balancedLeave))}
                ${row(balance > 0 ? 'Saldo auf null (Überstunden abbauen)' : 'Saldo auf null', formatClock(zeroLeave))}
                ${row(`Maximale Arbeitszeit (${formatDuration(max)})`, formatClock(maxLeave))}
            </dl>`;

        // Bisheriger Tag, sobald ein Ende eingetragen ist
        let workMinutes = required;
        if (end !== null) {
            workMinutes = end - start - breakMinutes;
            // Nachtschichten: liegt das Ende vor dem Beginn, gilt der Folgetag
            if (workMinutes < 0) workMinutes += 24 * 60;
            const daily = workMinutes - required;
            const progress = Math.min(100, Math.max(0, Math.round((workMinutes / required) * 100)));
            html += `
            <div class="worked">
                <span class="label">Arbeitszeit heute</span>
                <span class="value">${formatDuration(workMinutes)}</span>
                <span class="sub">von ${formatDuration(required)} Soll</span>
                <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><div style="width: ${progress}%"></div></div>
            </div>
            <dl class="rows">
                ${row('Über-/Minusstunden heute', formatSigned(daily), daily < 0)}
                ${row('Neuer Überstunden-Saldo', formatSigned(balance + daily), balance + daily < 0)}
            </dl>`;
        }

        // Hinweis zur gesetzlichen Mindestpause
        const minBreak = minimumBreak(Math.max(workMinutes, 0));
        if (breakMinutes < minBreak) {
            html += `<p class="notice warning">Gesetzlich sind bei dieser Arbeitszeit mindestens ${minBreak} Minuten Pause vorgeschrieben (aktuell: ${breakMinutes} Min.).</p>`;
        }
        if (end === null && balancedLeave > maxLeave) {
            html += '<p class="notice warning">Die Sollarbeitszeit liegt über der maximalen Arbeitszeit.</p>';
        }

        resultDiv.innerHTML = html;
    };

    // ---------- Ereignisse ----------
    // Eingaben beim Verlassen des Feldes normalisieren (830 -> 08:30)
    const timeFields = ['start', 'end', 'breakStart', 'breakEnd', 'required', 'max'];
    timeFields.forEach((key) => {
        $(ids[key]).addEventListener('blur', (event) => {
            const minutes = parseTime(event.target.value);
            if (minutes !== null) event.target.value = formatDuration(minutes);
            render();
            saveSettings();
        });
    });

    // Live-Berechnung bei jeder Eingabe
    form.addEventListener('input', () => { render(); saveSettings(); });
    form.addEventListener('submit', (event) => event.preventDefault());

    // «Jetzt»-Buttons tragen die aktuelle Uhrzeit ein
    document.querySelectorAll('.now').forEach((button) => {
        button.addEventListener('click', () => {
            const now = new Date();
            $(button.dataset.target).value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
            render();
            saveSettings();
        });
    });

    // Beginn und Ende des Tages zurücksetzen (Vorgaben bleiben)
    $('reset-day').addEventListener('click', () => {
        ['start', 'end'].forEach((key) => { $(ids[key]).value = ''; });
        render();
    });

    loadSettings();
    render();
    // Countdown regelmässig aktualisieren
    setInterval(render, 20000);
});
