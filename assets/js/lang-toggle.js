// EN | ES switch for pages that carry both languages.
// Each language block has data-lang="en" or data-lang="es"; buttons have data-set-lang.
// Choice order: ?lang= in the URL, then the last choice saved on this device, then English.
(function () {
    var KEY = 'site-lang';
    var root = document.documentElement;
    var buttons = document.querySelectorAll('[data-set-lang]');
    var titles = { en: document.title, es: root.getAttribute('data-title-es') || document.title };

    function scrollToHash(lang) {
        if (!location.hash) return;
        var id = location.hash.slice(1).replace(/-es$/, '');
        var target = document.getElementById(lang === 'es' ? id + '-es' : id);
        if (target) target.scrollIntoView();
    }

    function apply(lang) {
        document.querySelectorAll('[data-lang]').forEach(function (el) {
            el.hidden = el.getAttribute('data-lang') !== lang;
        });
        root.lang = lang;
        document.title = titles[lang];
        buttons.forEach(function (b) {
            b.setAttribute('aria-pressed', String(b.getAttribute('data-set-lang') === lang));
        });
    }

    var fromUrl = new URLSearchParams(location.search).get('lang');
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    var lang = fromUrl === 'es' || fromUrl === 'en' ? fromUrl : (saved === 'es' ? 'es' : 'en');

    apply(lang);
    scrollToHash(lang);

    buttons.forEach(function (b) {
        b.addEventListener('click', function () {
            lang = b.getAttribute('data-set-lang');
            try { localStorage.setItem(KEY, lang); } catch (e) {}
            apply(lang);
            var url = new URL(location.href);
            url.searchParams.set('lang', lang);
            history.replaceState(null, '', url);
        });
    });
})();
