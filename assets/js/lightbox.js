document.addEventListener('DOMContentLoaded', function () {
    var containers = document.querySelectorAll('[data-lightbox]');
    if (!containers.length) return;

    var box = document.createElement('div');
    box.className = 'lightbox';
    box.hidden = true;
    box.innerHTML =
        '<button type="button" class="lightbox-close" aria-label="Close">&times;</button>' +
        '<button type="button" class="lightbox-prev" aria-label="Previous photo">&lsaquo;</button>' +
        '<button type="button" class="lightbox-next" aria-label="Next photo">&rsaquo;</button>' +
        '<figure class="lightbox-figure">' +
            '<img alt="">' +
            '<figcaption class="lightbox-caption"></figcaption>' +
        '</figure>';
    document.body.appendChild(box);

    var boxImg = box.querySelector('img');
    var boxCaption = box.querySelector('.lightbox-caption');
    var photos = [];
    var current = -1;

    containers.forEach(function (container) {
        var imgs = Array.prototype.slice.call(container.querySelectorAll('figure img'));
        imgs.forEach(function (img) {
            var index = photos.length;
            photos.push(img);
            img.addEventListener('click', function () { open(index); });
        });
    });

    if (!photos.length) return;

    function captionFor(img) {
        var fig = img.closest('figure');
        var cap = fig && fig.querySelector('figcaption');
        return cap ? cap.textContent : img.alt;
    }

    function show(index) {
        current = (index + photos.length) % photos.length;
        var img = photos[current];
        boxImg.src = img.currentSrc || img.src;
        boxImg.alt = img.alt;
        boxCaption.textContent = captionFor(img);
    }

    function open(index) {
        show(index);
        box.hidden = false;
        document.body.style.overflow = 'hidden';
    }

    function close() {
        box.hidden = true;
        boxImg.src = '';
        document.body.style.overflow = '';
    }

    box.querySelector('.lightbox-close').addEventListener('click', close);
    box.querySelector('.lightbox-prev').addEventListener('click', function () { show(current - 1); });
    box.querySelector('.lightbox-next').addEventListener('click', function () { show(current + 1); });

    box.addEventListener('click', function (event) {
        if (event.target === box) close();
    });

    document.addEventListener('keydown', function (event) {
        if (box.hidden) return;
        if (event.key === 'Escape') close();
        if (event.key === 'ArrowLeft') show(current - 1);
        if (event.key === 'ArrowRight') show(current + 1);
    });
});
