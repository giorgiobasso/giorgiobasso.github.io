// Rechner «When can I leave?»
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('overtime-form');
    const resultDiv = document.getElementById('result');
    const $ = (id) => document.getElementById(id);

    const ids = {
        start: 'start-time',
        end: 'end-time',
        required: 'required-work-time',
        max: 'max-work-time',
        overtime: 'current-overtime',
    };

    // Felder, die beim nächsten Besuch wieder vorausgefüllt werden
    const persisted = ['required', 'max', 'overtime'];
    const STORAGE_KEY = 'wcil-settings';

    // ---------- Pausen ----------
    const breaksDiv = $('breaks');
    const MIN_BREAKS = 1;
    let breakCounter = 0;

    const breakField = (id, label) => `
        <div class="field">
            <label for="${id}">${label}</label>
            <div class="input-group">
                <input type="text" id="${id}" class="time-input" inputmode="numeric" placeholder="HH:MM" autocomplete="off">
                <button type="button" class="now" data-target="${id}" title="Aktuelle Uhrzeit eintragen">Jetzt</button>
            </div>
        </div>`;

    // Fügt eine Pausenzeile hinzu; ab der zweiten Pause mit «Entfernen»
    const addBreak = (start = '', end = '') => {
        const n = ++breakCounter;
        const removable = breaksDiv.children.length >= MIN_BREAKS;
        const el = document.createElement('div');
        el.className = 'break';
        el.innerHTML = `
            <div class="break-head">
                <span class="break-title"></span>
                ${removable ? '<button type="button" class="remove-break">Entfernen</button>' : ''}
            </div>
            <div class="row">
                ${breakField(`break-start-${n}`, 'Beginn')}
                ${breakField(`break-end-${n}`, 'Ende')}
            </div>`;
        // Werte per DOM setzen (nicht ins HTML einbauen)
        const inputs = el.querySelectorAll('input');
        inputs[0].value = start || '';
        inputs[1].value = end || '';
        breaksDiv.appendChild(el);
        numberBreaks();
        return el;
    };

    const numberBreaks = () => {
        // Bei nur einer Pause heisst sie «Pause», sonst «Pause 1», «Pause 2», …
        const total = breaksDiv.children.length;
        [...breaksDiv.children].forEach((el, i) => {
            el.querySelector('.break-title').textContent = total === 1 ? 'Pause' : `Pause ${i + 1}`;
        });
    };

    // Liest alle Pausenzeilen als Textwerte
    const readBreaks = () => [...breaksDiv.children].map((el) => {
        const inputs = el.querySelectorAll('input');
        return { start: inputs[0].value, end: inputs[1].value };
    });

    // ---------- Speicher ----------
    const loadSettings = () => {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            persisted.forEach((key) => {
                if (typeof saved[key] === 'string') $(ids[key]).value = saved[key];
            });
            if (Array.isArray(saved.breaks)) {
                saved.breaks.forEach((pair) => addBreak(pair[0], pair[1]));
            } else if (saved.breakStart || saved.breakEnd) {
                // Alte Version mit nur einer Pause
                addBreak(saved.breakStart, saved.breakEnd);
            }
        } catch (e) { /* localStorage nicht verfügbar */ }
        // Mindestens ein Pausenfeld anzeigen
        while (breaksDiv.children.length < MIN_BREAKS) addBreak();
    };

    const saveSettings = () => {
        try {
            const data = {};
            persisted.forEach((key) => { data[key] = $(ids[key]).value; });
            data.breaks = readBreaks().map((b) => [b.start, b.end]);
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
    // Kleines «?» mit Erklärung (Tooltip)
    const info = (tip) =>
        `<button type="button" class="info" aria-label="Erklärung" data-tip="${tip}">?</button>`;

    const row = (label, value, negative, tip) =>
        `<div class="item${negative ? ' neg' : ''}"><dt>${label}${tip ? info(tip) : ''}</dt><dd>${value}</dd></div>`;

    // Ergebnis nur ersetzen, wenn es sich geändert hat (Tooltips bleiben offen)
    let lastHtml = '';
    const setResult = (html) => {
        if (html === lastHtml) return;
        lastHtml = html;
        resultDiv.innerHTML = html;
    };

    const render = () => {
        const raw = {};
        Object.keys(ids).forEach((key) => { raw[key] = $(ids[key]).value; });

        const errors = [];
        const start = raw.start.trim() === '' ? null : parseTime(raw.start);
        if (raw.start.trim() !== '' && start === null) errors.push('Beginn');
        const end = raw.end.trim() === '' ? null : parseTime(raw.end);
        if (raw.end.trim() !== '' && end === null) errors.push('Ende');
        const required = parseDuration(raw.required);
        if (required === null) errors.push('Sollarbeitszeit');
        const max = parseDuration(raw.max);
        if (max === null) errors.push('Maximale Arbeitszeit');
        const balance = parseSigned(raw.overtime);
        if (balance === null) errors.push('Überstunden-Saldo');

        if (errors.length) {
            setResult(`<p class="notice error">Ungültige Eingabe: ${errors.join(', ')}. Format: HH:MM (z. B. 08:30 oder 830).</p>`);
            return;
        }

        // Pausen summieren; komplett leere Zeilen werden ignoriert
        let breakMinutes = 0;
        const breakErrors = [];
        readBreaks().forEach((b, i) => {
            const bs = b.start.trim();
            const be = b.end.trim();
            if (bs === '' && be === '') return;
            const startMin = parseTime(bs);
            const endMin = parseTime(be);
            if (bs === '' || be === '' || startMin === null || endMin === null) {
                breakErrors.push(`Pause ${i + 1}: Beginn und Ende im Format HH:MM angeben (oder beide leer lassen).`);
            } else if (endMin < startMin) {
                breakErrors.push(`Pause ${i + 1}: Das Ende darf nicht vor dem Beginn liegen.`);
            } else {
                breakMinutes += endMin - startMin;
            }
        });
        if (breakErrors.length) {
            setResult(`<p class="notice error">${breakErrors.join('<br>')}</p>`);
            return;
        }

        if (start === null) {
            setResult('<p class="empty">Trage deinen Arbeitsbeginn ein, um die Gehzeit zu sehen.</p>');
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
                ${row(balance > 0 ? 'Früheste Gehzeit (Saldo abbauen)' : 'Gehzeit mit Saldo auf null', zeroLeave <= start ? 'Saldo reicht für den ganzen Tag' : formatClock(zeroLeave), false, 'Früheste Zeit, zu der du gehen kannst, wenn du heute deinen ganzen Saldo abbauen willst. Bei Minusstunden ist es später als normal.')}
                ${row(`Späteste Gehzeit (max. ${formatDuration(max)})`, formatClock(maxLeave))}
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

        setResult(html);
    };

    // ---------- Ereignisse ----------
    // Eingaben beim Verlassen des Feldes normalisieren (830 -> 08:30)
    const normalizeIds = new Set([ids.start, ids.end, ids.required, ids.max]);
    form.addEventListener('focusout', (event) => {
        const input = event.target;
        if (input.tagName !== 'INPUT') return;
        if (!normalizeIds.has(input.id) && !input.classList.contains('time-input')) return;
        const minutes = parseTime(input.value);
        if (minutes !== null) input.value = formatDuration(minutes);
        render();
        saveSettings();
    });

    // Live-Berechnung bei jeder Eingabe
    form.addEventListener('input', () => { render(); saveSettings(); });
    form.addEventListener('submit', (event) => event.preventDefault());

    // «Jetzt»-Buttons tragen die aktuelle Uhrzeit ein, «Entfernen» löscht eine Pause
    form.addEventListener('click', (event) => {
        const nowButton = event.target.closest('.now');
        if (nowButton) {
            const now = new Date();
            $(nowButton.dataset.target).value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
        } else if (event.target.closest('.remove-break')) {
            event.target.closest('.break').remove();
            numberBreaks();
        } else if (event.target.closest('#add-break')) {
            addBreak().querySelector('input').focus();
            return;
        } else {
            return;
        }
        render();
        saveSettings();
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
