// Premium extras, served as /js/premium.js. Every page works without this file:
// the estimate is a price table, the quote form is one plain form, all content is visible.
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Header condenses once the page scrolls.
  var top = d.querySelector('.top-sticky');
  if (top) {
    var ticking = false;
    // Hysteresis, and only on pages with room to scroll: the header shrinking moves the page, which on a short page
    // pushed the scroll back under the line and flipped it again forever (found by a sample site's quote page).
    var setTop = function () {
      var y = window.scrollY, room = d.documentElement.scrollHeight - innerHeight, on = top.classList.contains('is-condensed');
      top.classList.toggle('is-condensed', room > 160 && (on ? y > 8 : y > 64)); ticking = false;
    };
    addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(setTop); } }, { passive: true });
    setTop();
  }

  // Scroll reveal: only blocks still below the screen are faded, so nothing visible ever blinks out.
  var reveal = d.querySelectorAll('[data-reveal]');
  if (reveal.length && !still && 'IntersectionObserver' in window && root.classList.contains('rv-ok')) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.remove('rv'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    reveal.forEach(function (el) {
      if (el.getBoundingClientRect().top > innerHeight) { el.classList.add('rv'); io.observe(el); }
    });
  }

  // Instant estimate.
  var fmt = function (n) { return '$' + Number(n).toLocaleString('en-US'); };
  d.querySelectorAll('[data-estimate]').forEach(function (sec) {
    var tool = sec.querySelector('[data-est-tool]');
    if (!tool) return;
    var out = tool.querySelector('[data-est-out]');
    var sets = tool.querySelectorAll('.p-est-opts');
    var update = function () {
      var picked = tool.querySelector('input[name=service]:checked') || tool.querySelector('input[name=service]');
      var slug = picked ? picked.value : '';
      sets.forEach(function (fs) {
        var on = fs.getAttribute('data-service') === slug;
        fs.hidden = !on;
        fs.disabled = !on;
      });
      var opt = tool.querySelector('.p-est-opts:not([disabled]) input:checked');
      if (opt) {
        var lo = opt.getAttribute('data-low'), hi = opt.getAttribute('data-high');
        out.textContent = 'Typically ' + (lo === hi ? fmt(lo) : fmt(lo) + ' to ' + fmt(hi));
      }
    };
    tool.hidden = false;
    var all = sec.querySelector('[data-est-all]');
    if (all) all.open = false;
    tool.addEventListener('change', update);
    update();
  });

  // Quote form in steps.
  var form = d.querySelector('[data-quote-premium]');
  if (!form) return;
  var params = new URLSearchParams(location.search);
  params.forEach(function (v, k) {
    if (k !== 'service' && k.indexOf('answers[') !== 0) return;
    form.querySelectorAll('[name="' + k.replace(/"/g, '') + '"]').forEach(function (el) {
      if (el.type === 'radio') el.checked = el.value === v; else if (el.type !== 'file') el.value = v.slice(0, 300);
    });
  });
  form.elements.started.value = String(Math.floor(Date.now() / 1000));

  var photos = form.querySelector('input[type=file]');
  if (photos) photos.addEventListener('change', function () {
    var files = Array.prototype.slice.call(photos.files || []);
    var msg = files.length > 3 ? 'Pick up to 3 photos, or text the rest to us.' : '';
    if (!msg && files.some(function (f) { return f.size > 8 * 1024 * 1024; })) msg = 'One photo is over 8 MB. Pick a smaller one or text it to us.';
    photos.setCustomValidity(msg);
  });

  // Only the picked service's questions count: the others are disabled (not sent), its required ones become required.
  var blocks = form.querySelectorAll('.p-qs');
  var syncService = function () {
    var picked = form.querySelector('input[name=service]:checked');
    blocks.forEach(function (b) {
      var on = !!picked && b.getAttribute('data-service') === picked.value;
      b.querySelectorAll('input, select, textarea').forEach(function (el) {
        el.disabled = !on;
        var group = el.closest('[data-required]');
        el.required = on && (el.hasAttribute('data-required') || (!!group && el.type === 'radio'));
      });
    });
  };
  form.addEventListener('change', function (e) { if (e.target.name === 'service') syncService(); });
  syncService();

  var steps = form.querySelectorAll('[data-step]');
  var topBar = form.querySelector('[data-qf-top]'), count = form.querySelector('[data-qf-count]');
  var nav = form.querySelector('[data-qf-nav]'), back = form.querySelector('[data-qf-back]'), next = form.querySelector('[data-qf-next]');
  var dots = form.querySelectorAll('[data-step-dot]');
  var names = ['Service', 'Details', 'Photos', 'Contact'];
  var cur = 1, last = steps.length;
  var show = function (n, focus) {
    cur = n;
    steps.forEach(function (s, i) { s.hidden = i + 1 !== n; });
    dots.forEach(function (li, i) {
      li.classList.toggle('is-done', i + 1 < n);
      if (i + 1 === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    count.textContent = 'Step ' + n + ' of ' + last + ': ' + names[n - 1];
    back.hidden = n === 1;
    next.hidden = n === last;
    if (focus) {
      var legend = steps[n - 1].querySelector('.p-step-title');
      if (legend) legend.focus();
      var r = form.getBoundingClientRect();
      if (r.top < 0) form.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
    }
  };
  var valid = function (n) {
    var fields = steps[n - 1].querySelectorAll('input:not([disabled]), textarea:not([disabled])');
    for (var i = 0; i < fields.length; i++) {
      if (!fields[i].checkValidity()) { fields[i].reportValidity(); return false; }
    }
    return true;
  };
  topBar.hidden = false;
  nav.hidden = false;
  next.addEventListener('click', function () { if (valid(cur)) show(cur + 1, true); });
  back.addEventListener('click', function () { show(cur - 1, true); });
  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'submit' && cur < last) {
      e.preventDefault();
      if (valid(cur)) show(cur + 1, true);
    }
  });
  form.addEventListener('submit', function (e) {
    if (cur < last) { e.preventDefault(); if (valid(cur)) show(cur + 1, true); return; }
    var b = form.querySelector('[data-qf-send]');
    b.disabled = true;
    b.textContent = 'Sending...';
  });
  show(form.querySelector('input[name=service]:checked') ? 2 : 1, false);
})();
