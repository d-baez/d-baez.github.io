document.addEventListener('DOMContentLoaded', function () {
    var dropdowns = document.querySelectorAll('.nav-dropdown');

    function closeAll() {
        dropdowns.forEach(function (dropdown) {
            dropdown.classList.remove('open');
            dropdown.querySelector('.dropdown-toggle').setAttribute('aria-expanded', 'false');
        });
    }

    dropdowns.forEach(function (dropdown) {
        var toggle = dropdown.querySelector('.dropdown-toggle');
        toggle.addEventListener('click', function (e) {
            e.stopPropagation();
            var isOpen = dropdown.classList.contains('open');
            closeAll();
            if (!isOpen) {
                dropdown.classList.add('open');
                toggle.setAttribute('aria-expanded', 'true');
            }
        });
    });

    document.addEventListener('click', closeAll);
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeAll();
    });
});
