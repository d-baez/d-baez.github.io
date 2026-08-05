document.addEventListener('DOMContentLoaded', function () {
    var pile = document.querySelector('.photo-pile');
    if (!pile) return;

    var photos = Array.prototype.slice.call(pile.querySelectorAll('.photo'));
    if (!photos.length) return;

    // Until this runs the photos sit in a plain wrapped row, so the section
    // still reads fine if the script never loads.
    pile.classList.add('is-scattered');

    var topZ = photos.length;

    // Deterministic per-photo jitter, so the scatter looks hand-placed but
    // lands the same way on every reload.
    function jitter(i, salt) {
        var n = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
        return (n - Math.floor(n)) * 2 - 1;
    }

    function place(el) {
        el.style.transform =
            'translate(' + el._x + 'px, ' + el._y + 'px) rotate(' + el._rot + 'deg)';
    }

    function layout() {
        var width = pile.clientWidth;
        var cols = Math.max(2, Math.min(4, Math.floor(width / 190)));
        var maxBottom = 0;

        // Photos are shown uncropped, so portraits are much taller than
        // landscapes. Pitch the rows off the tallest one and let them overlap
        // a little, which is what gives the piled-snapshots look.
        var tallest = 0;
        photos.forEach(function (el) {
            if (el.offsetHeight > tallest) tallest = el.offsetHeight;
        });
        var cellH = Math.max(150, tallest * 0.82);

        photos.forEach(function (el, i) {
            // Leave a photo the visitor placed where they put it, but pull it
            // back inside if the container has since got narrower.
            if (el._moved) {
                el._x = Math.max(0, Math.min(el._x, width - el.offsetWidth));
                place(el);
                maxBottom = Math.max(maxBottom, el._y + el.offsetHeight);
                return;
            }

            var row = Math.floor(i / cols);
            var col = i % cols;

            // A trailing partial row spreads across the full width rather than
            // bunching at the left and leaving a hole on the right.
            var inRow = Math.min(cols, photos.length - row * cols);
            var cellW = width / inRow;

            var x = col * cellW + (cellW - el.offsetWidth) / 2 + jitter(i, 0) * cellW * 0.14;
            var y = row * cellH + jitter(i, 1) * cellH * 0.16;

            // Keep everything inside the container.
            el._x = Math.max(0, Math.min(x, width - el.offsetWidth));
            el._y = Math.max(0, y);
            el._rot = jitter(i, 2) * 7;
            place(el);

            maxBottom = Math.max(maxBottom, el._y + el.offsetHeight);
        });

        // Height follows the actual photos, so there's no dead space below.
        pile.style.height = Math.ceil(maxBottom + 20) + 'px';
    }

    function raise(el) {
        topZ += 1;
        el.style.zIndex = topZ;
    }

    photos.forEach(function (el) {
        var dragging = false;
        var grabX = 0;
        var grabY = 0;

        el.addEventListener('pointerdown', function (e) {
            dragging = true;
            grabX = e.clientX - el._x;
            grabY = e.clientY - el._y;
            raise(el);
            el.classList.add('is-dragging');
            el.setPointerCapture(e.pointerId);
            e.preventDefault();
        });

        el.addEventListener('pointermove', function (e) {
            if (!dragging) return;
            el._x = e.clientX - grabX;
            el._y = e.clientY - grabY;
            el._moved = true;
            place(el);
        });

        function endDrag(e) {
            if (!dragging) return;
            dragging = false;
            el.classList.remove('is-dragging');
            if (el.hasPointerCapture(e.pointerId)) {
                el.releasePointerCapture(e.pointerId);
            }
        }

        el.addEventListener('pointerup', endDrag);
        el.addEventListener('pointercancel', endDrag);

        // Dragging is pointer-only, so give keyboard users a way to move a
        // photo too: focus it and nudge with the arrow keys.
        el.addEventListener('keydown', function (e) {
            var step = e.shiftKey ? 24 : 6;
            var moved = true;

            if (e.key === 'ArrowLeft') el._x -= step;
            else if (e.key === 'ArrowRight') el._x += step;
            else if (e.key === 'ArrowUp') el._y -= step;
            else if (e.key === 'ArrowDown') el._y += step;
            else moved = false;

            if (moved) {
                el._moved = true;
                raise(el);
                place(el);
                e.preventDefault();
            }
        });

        el.addEventListener('focus', function () { raise(el); });
    });

    // A landscape photo at the same width as a portrait one looks much
    // smaller, since it is only about half as tall. Tag them so CSS can give
    // them extra width and even the two out. Reading it off the decoded image
    // means new photos are handled without touching the markup.
    function tagOrientation(el) {
        var img = el.querySelector('img');
        if (img && img.naturalWidth > img.naturalHeight) {
            el.classList.add('is-landscape');
        }
    }

    // Images must be decoded before offsetWidth/Height are meaningful.
    var pending = photos.length;

    function ready(el) {
        tagOrientation(el);
        if (--pending === 0) layout();
    }

    photos.forEach(function (el) {
        var img = el.querySelector('img');
        if (img && !img.complete) {
            img.addEventListener('load', function () { ready(el); });
            img.addEventListener('error', function () { ready(el); });
        } else {
            ready(el);
        }
    });

    // Re-layout on resize. Photos the visitor moved keep their spot and are
    // only clamped back into view; the rest are re-scattered to fit.
    var resizeTimer;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(layout, 150);
    });
});
