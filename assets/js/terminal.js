/*
 * The artist statement on the front page, as a live terminal.
 *
 * The statement itself is plain HTML in index.html - this file finds it,
 * empties it, and re-types it character by character once the visitor
 * scrolls the box into view. That ordering matters: with JS off, or if this
 * file never loads, the statement is just sitting there already rendered.
 * Nothing here is required to read it.
 *
 * After the typing finishes the box drops to a real prompt that accepts a
 * handful of commands. Everything the visitor types is written back with
 * textContent, never innerHTML, so an echoed command is text and only text.
 */
(function () {
    'use strict';

    var root = document.getElementById('statement-terminal');
    if (!root) return;

    var statement = document.getElementById('statement-source');
    var log = document.getElementById('terminal-log');
    var form = document.getElementById('terminal-form');
    var input = document.getElementById('terminal-input');
    var keys = document.getElementById('terminal-keys');
    var skipBtn = document.getElementById('terminal-skip');
    var scroller = root.querySelector('.terminal-body');
    if (!statement || !log || !form || !input || !scroller) return;

    var code = statement.querySelector('code') || statement;
    var reduceMotion = window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;
    // Coarse pointers are phones and tablets. The rule for them is: never
    // move focus into the input on our own, because focus is what summons
    // the on-screen keyboard. Only a deliberate tap on the prompt does that.
    var coarsePointer = window.matchMedia
        ? window.matchMedia('(pointer: coarse)').matches
        : false;

    /* ── the places `ls` and `open` know about ─────────────── */
    // Internal links stay relative so the terminal still works when the site
    // is served from a local preview rather than danielbaez.xyz.
    var PLACES = [
        { key: 'calendario',  name: 'calendario/',      url: 'calendario', note: 'ai calendar assistant - case study' },
        { key: 'music',       name: 'music-library/',   url: 'music',      note: 'the library, the sets, the mixes' },
        { key: 'photos',      name: 'daniel-b-photos@', url: 'https://www.danielbphotos.wordpress.com/', note: 'photography, hosted elsewhere', external: true },
        { key: 'digital-lab', name: 'digital-lab@',     url: 'https://danielbaez.webflow.io', note: "daniel's digital lab", external: true },
        { key: 'github',      name: 'github@',          url: 'https://github.com/d-baez', note: 'the repos', external: true },
        { key: 'resume',      name: 'resume.txt',       url: 'resume',     note: 'the formal version' },
        { key: 'about',       name: 'about.md',         url: 'about',      note: 'who is daniel báez?' }
    ];

    /* ── small DOM helpers ─────────────────────────────────── */

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    function link(text, url, external) {
        var a = el('a', 'term-link', text);
        a.href = url;
        if (external) {
            a.target = '_blank';
            a.rel = 'noopener';
        }
        return a;
    }

    function nearBottom() {
        return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 48;
    }

    // Follow the output down, but stop following the moment the visitor
    // scrolls back up to re-read something.
    function keepAtBottom(force) {
        if (force || nearBottom()) scroller.scrollTop = scroller.scrollHeight;
    }

    function out(node) {
        log.appendChild(node);
        keepAtBottom();
        return node;
    }

    function print(text, cls) {
        return out(el('div', 'term-line' + (cls ? ' ' + cls : ''), text));
    }

    function blank() {
        return out(el('div', 'term-space'));
    }

    // `label  value` rows, used by help / contact / ls -l style output.
    function row(key, value) {
        var line = el('div', 'term-row');
        line.appendChild(el('span', 'term-key', key));
        var val = el('span', 'term-val');
        if (typeof value === 'string') val.textContent = value;
        else val.appendChild(value);
        line.appendChild(val);
        return line;
    }

    function promptLabel() {
        var frag = document.createDocumentFragment();
        frag.appendChild(el('span', 'term-host', 'visitor@danielbaez.xyz'));
        frag.appendChild(el('span', 'term-cwd', '~'));
        frag.appendChild(el('span', 'term-sigil', '%'));
        return frag;
    }

    /* ── typing the statement ──────────────────────────────── */

    // Snapshot the statement before anything is cleared. Each child of
    // <code> becomes one segment, so the typed copy keeps the exact same
    // syntax colouring as the static markup without duplicating the text.
    var segments = [];
    Array.prototype.forEach.call(code.childNodes, function (node) {
        var text = node.textContent;
        if (!text) return;
        segments.push({ text: text, cls: node.nodeType === 1 ? node.className : '' });
    });

    var cursor = el('span', 'term-cursor');
    cursor.setAttribute('aria-hidden', 'true');
    var skipped = false;
    var timer = null;
    var resumeTyping = null;

    function renderAll() {
        segments.forEach(function (seg) {
            var node = seg.cls ? el('span', seg.cls, seg.text) : document.createTextNode(seg.text);
            code.insertBefore(node, cursor);
        });
    }

    function typeOut(done) {
        var si = 0;
        var ci = 0;
        var node = null;

        function tick() {
            if (skipped) {
                code.textContent = '';
                code.appendChild(cursor);
                renderAll();
                return done();
            }
            if (si >= segments.length) return done();

            if (!node) {
                var seg = segments[si];
                node = seg.cls ? el('span', seg.cls) : document.createTextNode('');
                code.insertBefore(node, cursor);
            }

            var ch = segments[si].text.charAt(ci);
            node.textContent += ch;
            ci += 1;
            if (ci >= segments[si].text.length) {
                si += 1;
                ci = 0;
                node = null;
            }
            keepAtBottom();

            // A pause at each line break is most of what sells the
            // live-coding feel; the jitter on the rest keeps it off-grid.
            var delay = ch === '\n' ? 110 : 5 + Math.random() * 12;
            timer = setTimeout(tick, delay);
        }

        // Skipping cancels the pending tick, so it needs a way to run one
        // more by hand - that last call is what paints the rest of the text.
        resumeTyping = tick;
        tick();
    }

    /* ── commands ──────────────────────────────────────────── */

    // Kept out of `help` on purpose - they are there to be found.
    var HIDDEN = ['sudo', 'crea', 'exit', 'dj'];

    var HELP = [
        ['help', "what you're reading"],
        ['about', 'more about me'],
        ['projects', "everything i've built"],
        ['ls', 'list the projects like files'],
        ['open <name>', 'open one of them'],
        ['whoami', '...you tell me'],
        ['contact', 'how to reach me'],
        ['theme', 'flip between editor and retro green'],
        ['clear', 'wipe the screen']
    ];

    var CREA_ART = [
        '  ___ ___ ___   _   ',
        ' / __| _ \\ __| /_\\  ',
        '| (__|   / _| / _ \\ ',
        ' \\___|_|_\\___/_/ \\_\\'
    ].join('\n');

    function goTo(url, external) {
        if (external) {
            // A submit / click is user activation, so this normally opens.
            // If a blocker eats it anyway, leave the visitor a link instead
            // of a dead end.
            var win = window.open(url, '_blank', 'noopener');
            if (!win) out(row('blocked', link(url, url, true)));
            return;
        }
        setTimeout(function () { window.location.href = url; }, 650);
    }

    function findPlace(name) {
        var wanted = name.toLowerCase();
        for (var i = 0; i < PLACES.length; i++) {
            var place = PLACES[i];
            if (place.key === wanted || place.name.toLowerCase() === wanted) return place;
            // so `open music-library` and `open music` both land
            if (place.name.replace(/[\/@]$/, '').toLowerCase() === wanted) return place;
        }
        return null;
    }

    function setTheme(mode) {
        root.classList.toggle('is-retro', mode === 'retro');
        try {
            window.localStorage.setItem('statement-terminal-theme', mode);
        } catch (e) {
            // Private mode and blocked storage both throw here. The theme
            // still flips, it just won't survive a reload.
        }
    }

    var COMMANDS = {
        help: function () {
            print('available commands:', 'term-note');
            HELP.forEach(function (entry) { out(row(entry[0], entry[1])); });
            blank();
            print("not everything is on this list.", 'term-dim');
        },

        about: function () {
            print('opening the about page…');
            out(row('→', link('danielbaez.xyz/about', 'about')));
            goTo('about');
        },

        projects: function () {
            print('opening every project…');
            out(row('→', link('danielbaez.xyz/projects', 'projects')));
            goTo('projects');
        },

        contact: function () {
            // There is no standalone contact page yet, so this is the
            // contact page: the addresses themselves.
            print('reach me:', 'term-note');
            out(row('email', link('hello@danielbaez.xyz', 'mailto:hello@danielbaez.xyz')));
            out(row('instagram', link('@_danielbaez', 'https://instagram.com/_danielbaez', true)));
            out(row('linkedin', link('/in/-danielbaez', 'https://linkedin.com/in/-danielbaez/', true)));
            out(row('github', link('@d-baez', 'https://github.com/d-baez', true)));
            blank();
            print('i answer. say what you are building.', 'term-dim');
        },

        whoami: function () {
            print('visitor');
            print('  ↳ except you found the prompt and typed into it. so: builder.', 'term-dim');
            blank();
            print('daniel báez — computer engineering student, creative director, dj.');
            print('runs on curiosity, café, and the belief that you can just make things.');
            print('crea lo que tu quieras.', 'term-accent');
        },

        ls: function () {
            var grid = el('div', 'term-ls');
            PLACES.forEach(function (place) {
                var a = link(place.name, place.url, place.external);
                a.title = place.note;
                grid.appendChild(a);
            });
            out(grid);
            print('try: open calendario', 'term-dim');
        },

        open: function (arg) {
            if (!arg) {
                print('open what? run `ls` to see the options.', 'term-warn');
                return;
            }
            var place = findPlace(arg);
            if (!place) {
                print('open: no such project: ' + arg, 'term-warn');
                return;
            }
            print('opening ' + place.name + ' — ' + place.note);
            goTo(place.url, place.external);
        },

        theme: function (arg) {
            var mode = arg === 'retro' || arg === 'green' ? 'retro'
                : arg === 'editor' || arg === 'dark' ? 'editor'
                : root.classList.contains('is-retro') ? 'editor' : 'retro';
            setTheme(mode);
            print(mode === 'retro'
                ? 'phosphor mode. green on black, like it was in the basement.'
                : 'back to the editor.', 'term-accent');
        },

        clear: function () {
            log.textContent = '';
            code.textContent = '';
            statement.hidden = true;
            keepAtBottom(true);
        },

        /* ── the ones that aren't in help ──────────────────── */

        sudo: function () {
            print('visitor is not in the sudoers file. this incident has been reported.', 'term-warn');
            blank();
            print("relax — you never needed permission for the part that matters.", 'term-dim');
        },

        crea: function () {
            var art = el('pre', 'term-art', CREA_ART);
            art.setAttribute('aria-label', 'ascii art reading crea');
            out(art);
            print('crea lo que tu quieras.', 'term-accent');
            print('create whatever you want. you already have everything you need.', 'term-dim');
            print('hazlo hoy.', 'term-accent');
        },

        dj: function () {
            print('now playing: whatever moves the room.', 'term-accent');
            out(row('→', link('the music library', 'music')));
        },

        exit: function () {
            print('there is no exit. there is only the next thing you make.', 'term-dim');
        }
    };

    var ALIASES = {
        'ls -l': 'ls', 'dir': 'ls', 'cd': 'open', 'man': 'help', '?': 'help',
        'cls': 'clear', 'who': 'whoami', 'email': 'contact', 'work': 'projects',
        'quit': 'exit', 'logout': 'exit'
    };

    var NAMES = Object.keys(COMMANDS);

    /* ── running a line ────────────────────────────────────── */

    var history = [];
    var historyIndex = 0;

    function echo(raw) {
        var line = el('div', 'term-echo');
        var label = el('span', 'term-prompt');
        label.appendChild(promptLabel());
        line.appendChild(label);
        line.appendChild(el('span', 'term-typed', raw));
        out(line);
    }

    function run(raw) {
        echo(raw);

        var trimmed = raw.trim();
        if (!trimmed) return;

        history.push(trimmed);
        historyIndex = history.length;

        var lower = trimmed.toLowerCase();
        if (ALIASES[lower]) lower = ALIASES[lower];

        var space = lower.indexOf(' ');
        var name = space === -1 ? lower : lower.slice(0, space);
        var arg = space === -1 ? '' : lower.slice(space + 1).trim();
        if (ALIASES[name]) name = ALIASES[name];

        // "crea lo que tu quieras" typed out in full should hit the egg too.
        if (name === 'crea') arg = '';

        if (COMMANDS[name]) {
            COMMANDS[name](arg);
        } else if (findPlace(name)) {
            COMMANDS.open(name);
        } else {
            print('zsh: command not found: ' + name, 'term-warn');
            print('try `help` — or just `ls`.', 'term-dim');
        }
        blank();
    }

    /* ── wiring ────────────────────────────────────────────── */

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var raw = input.value;
        input.value = '';
        run(raw);
        keepAtBottom(true);
    });

    input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowUp') {
            if (!history.length) return;
            e.preventDefault();
            historyIndex = Math.max(0, historyIndex - 1);
            input.value = history[historyIndex];
        } else if (e.key === 'ArrowDown') {
            if (!history.length) return;
            e.preventDefault();
            historyIndex = Math.min(history.length, historyIndex + 1);
            input.value = historyIndex === history.length ? '' : history[historyIndex];
        } else if (e.key === 'Tab') {
            var partial = input.value.trim().toLowerCase();
            if (!partial || partial.indexOf(' ') !== -1) return;
            e.preventDefault();
            var matches = NAMES.filter(function (n) {
                return n.indexOf(partial) === 0 && HIDDEN.indexOf(n) === -1;
            });
            if (matches.length === 1) input.value = matches[0];
            else if (matches.length > 1) print(matches.join('   '), 'term-dim');
        } else if (e.key === 'l' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            COMMANDS.clear();
        }
    });

    // Clicking the dead space of a terminal should put you at the prompt.
    // On touch that would raise the keyboard unasked, so there the label is
    // the only target - and the label is a <label for>, which handles itself.
    if (!coarsePointer) {
        scroller.addEventListener('click', function (e) {
            if (form.hidden) return;
            if (e.target.closest('a, button')) return;
            if (window.getSelection && String(window.getSelection())) return;
            input.focus({ preventScroll: true });
        });
    }

    if (keys) {
        keys.addEventListener('click', function (e) {
            var button = e.target.closest('button[data-cmd]');
            if (!button) return;
            run(button.getAttribute('data-cmd'));
            keepAtBottom(true);
            // Same rule as above: give focus back on desktop, leave the
            // keyboard down on touch.
            if (!coarsePointer) input.focus({ preventScroll: true });
        });
    }

    /* ── start when the box is scrolled into view ──────────── */

    function finishIntro() {
        root.classList.remove('is-typing');
        if (skipBtn) skipBtn.hidden = true;
        if (cursor.parentNode) cursor.parentNode.removeChild(cursor);

        blank();
        print('statement.js loaded. this prompt is live —', 'term-note');
        print('type `help` to see what it knows.', 'term-note');
        blank();

        form.hidden = false;
        if (keys) keys.hidden = false;
        keepAtBottom(true);
        // Deliberately no focus() here. Autofocusing would yank a phone's
        // keyboard up the second the section scrolled past.
    }

    var started = false;

    function start() {
        if (started) return;
        started = true;

        // Hand screen readers the finished statement up front - they should
        // not have to sit through an animation, and the typed copy below is
        // hidden from them for the same reason.
        var srCopy = el('div', 'term-sr', code.textContent);
        statement.parentNode.insertBefore(srCopy, statement);
        statement.setAttribute('aria-hidden', 'true');

        code.textContent = '';
        code.appendChild(cursor);

        if (reduceMotion) {
            renderAll();
            finishIntro();
            return;
        }

        root.classList.add('is-typing');
        if (skipBtn) skipBtn.hidden = false;
        typeOut(finishIntro);
    }

    function skip() {
        if (!started || skipped) return;
        skipped = true;
        if (timer) clearTimeout(timer);
        timer = null;
        if (resumeTyping) resumeTyping();
    }

    if (skipBtn) skipBtn.addEventListener('click', skip);
    root.addEventListener('click', function () {
        if (root.classList.contains('is-typing')) skip();
    });

    try {
        if (window.localStorage.getItem('statement-terminal-theme') === 'retro') {
            root.classList.add('is-retro');
        }
    } catch (e) {
        // no stored preference available; the default editor theme stands
    }

    if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                observer.disconnect();
                start();
            });
        }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
        observer.observe(root);
    } else {
        start();
    }
}());
