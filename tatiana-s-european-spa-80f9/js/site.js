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

  // The request went through: forget the saved draft.
  if (/\/thanks\/$/.test(location.pathname)) { try { Object.keys(sessionStorage).forEach(function (k) { if (k.indexOf('quote-draft:') === 0) sessionStorage.removeItem(k); }); } catch (x) {} }

  // Quote form: preselect ?service=, record when the form was opened (a bot check), stop double sends.
  var form = document.querySelector('[data-quote]');
  if (!form) return;
  var want = new URLSearchParams(location.search).get('service');
  if (want) {
    form.querySelectorAll('input[name=service]').forEach(function (r) { if (r.value === want) r.checked = true; });
  }
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
  var photo = form.elements.photo;
  photo.addEventListener('change', function () {
    var f = photo.files && photo.files[0];
    photo.setCustomValidity(f && f.size > 8 * 1024 * 1024 ? 'That photo is over 8 MB. Pick a smaller one or text it to us.' : '');
  });
  form.addEventListener('submit', function (e) {
    if (!check(form)) { e.preventDefault(); return; }
    var b = form.querySelector('button[type=submit]');
    b.disabled = true;
    b.textContent = 'Sending...';
  });
})();
