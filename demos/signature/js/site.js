// Small extras. Every page works without this file.
(function () {
  'use strict';
  // Before/after slider: the range input drives a CSS variable; arrow keys work because it is a real range input.
  document.querySelectorAll('[data-ba]').forEach(function (fig) {
    var range = fig.querySelector('.ba-range');
    if (!range) return;
    var set = function () {
      var v = Number(range.value);
      fig.style.setProperty('--pos', v + '%');
      range.setAttribute('aria-valuetext', v + ' percent before, ' + (100 - v) + ' percent after');
    };
    range.hidden = false;
    fig.classList.add('is-live');
    range.addEventListener('input', set);
    set();
  });

  // Quote form: preselect ?service=, record when the form was opened (a bot check), stop double sends.
  var form = document.querySelector('[data-quote]');
  if (!form) return;
  var want = new URLSearchParams(location.search).get('service');
  if (want) {
    form.querySelectorAll('input[name=service]').forEach(function (r) { if (r.value === want) r.checked = true; });
  }
  form.elements.started.value = String(Math.floor(Date.now() / 1000));
  var photo = form.elements.photo;
  photo.addEventListener('change', function () {
    var f = photo.files && photo.files[0];
    photo.setCustomValidity(f && f.size > 8 * 1024 * 1024 ? 'That photo is over 8 MB. Pick a smaller one or text it to us.' : '');
  });
  form.addEventListener('submit', function () {
    var b = form.querySelector('button[type=submit]');
    b.disabled = true;
    b.textContent = 'Sending...';
  });
})();
