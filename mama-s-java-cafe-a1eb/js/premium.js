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
  // Time stamp for the bot check: signed by quote.php (GET ?token=1), so a bot cannot make its own. Without
  // JavaScript the field stays empty and nojs=1 tells the server to use its slower, rate-limited path.
  // The form's own action (the build puts BASE_PATH on it); a static-host build has no quote.php, so no request.
  var stampAt = 0;
  var staticHost = !!form.querySelector('.s-static-note');
  function stamp() {
    if (staticHost) return;
    fetch(form.getAttribute('action') + '?token=1', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
      t = t.trim();
      if (/^\d+\|[0-9a-f]{64}$/.test(t)) { form.elements.started.value = t; form.elements.nojs.value = ''; stampAt = Date.now(); }
    }).catch(function () {});
  }
  stamp();
  document.addEventListener('visibilitychange', function () { if (!document.hidden && stampAt && Date.now() - stampAt > 12 * 3600 * 1000) stamp(); });


  // Help while filling in: a problem is told next to its field (and the first one gets focus), and what was typed is
  // kept in sessionStorage until the request is sent, so a refresh, a Back or a server message loses nothing.
  var KEY = 'quote-draft:' + location.pathname;
  function errBox(el) {
    var host = el.closest('.field') || el.closest('fieldset') || el.parentNode;
    var id = 'err-' + (el.name || el.id).replace(/\W+/g, '_');
    var box = document.getElementById(id);
    if (!box) { box = document.createElement('p'); box.id = id; box.className = 'field-error'; box.setAttribute('role', 'alert'); host.appendChild(box); }
    return box;
  }
  function flag(el) {
    var radio = el.type === 'radio';
    var msg = el.validity.valueMissing ? (radio ? 'Please pick one.' : 'Please fill this in.') : (el.validationMessage || 'Please check this.');
    var box = errBox(el);
    box.textContent = msg;
    if (radio) { var fs = el.closest('fieldset'); if (fs) fs.setAttribute('data-invalid', ''); return; }
    el.setAttribute('aria-invalid', 'true');
    var d = (el.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
    if (d.indexOf(box.id) < 0) d.push(box.id);
    el.setAttribute('aria-describedby', d.join(' '));
  }
  function unflag(el) {
    var box = document.getElementById('err-' + (el.name || el.id).replace(/\W+/g, '_'));
    if (box) box.remove();
    el.removeAttribute('aria-invalid');
    var fs = el.closest('fieldset'); if (fs) fs.removeAttribute('data-invalid');
  }
  // Checks the fields inside root; shows every problem, focuses the first. Returns true when all are fine.
  function check(root) {
    var first = null;
    root.querySelectorAll('input:not([disabled]):not([type=hidden]), textarea:not([disabled])').forEach(function (el) {
      if (el.checkValidity()) { unflag(el); return; }
      flag(el);
      if (!first) first = el;
    });
    if (first) first.focus();
    return !first;
  }
  form.noValidate = true;   // with JavaScript, our own messages replace the browser bubble; without it the browser's checks still work
  form.addEventListener('input', function (e) { if (e.target.getAttribute && e.target.getAttribute('aria-invalid') && e.target.checkValidity()) unflag(e.target); });
  form.addEventListener('change', function (e) { if (e.target.type === 'radio') unflag(e.target); });
  function save() {
    var o = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || /^(started|nojs|website|cart|lang)$/.test(el.name) || el.type === 'file' || el.type === 'hidden' || el.type === 'submit' || el.type === 'button') return;
      if (el.type === 'radio' || el.type === 'checkbox') { if (el.checked) o[el.name + '=' + el.value] = 1; } else if (el.value) o[el.name] = el.value;
    });
    try { sessionStorage.setItem(KEY, JSON.stringify(o)); } catch (x) {}
  }
  function restore() {
    var o; try { o = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (x) {}
    if (!o) return;
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.type === 'file' || el.type === 'hidden') return;
      if (el.type === 'radio' || el.type === 'checkbox') { if (o[el.name + '=' + el.value] && !form.querySelector('[name="' + el.name.replace(/"/g, '') + '"]:checked')) el.checked = true; } else if (o[el.name] && !el.value) el.value = o[el.name];
    });
  }
  restore();
  form.addEventListener('input', save);
  form.addEventListener('change', save);
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
    try { sessionStorage.setItem(KEY + ':step', String(n)); } catch (x) {}
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
  var valid = function (n) { return check(steps[n - 1]); };
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
    if (!valid(cur)) { e.preventDefault(); return; }
    var b = form.querySelector('[data-qf-send]');
    b.disabled = true;
    b.textContent = 'Sending...';
  });
  var savedStep = 0; try { savedStep = Number(sessionStorage.getItem(KEY + ':step')) || 0; } catch (x) {}
  var picked0 = form.querySelector('input[name=service]:checked');
  show(picked0 ? (savedStep > 1 && savedStep <= last ? savedStep : 2) : 1, false);
})();
