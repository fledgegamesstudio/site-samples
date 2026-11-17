// Signature extras, served as /js/signature.js after /js/premium.js. Every page works without this file:
// the hero shows its still photo, the scroll story shows two pictures, the cart is a price table, the quote form is plain.
(function () {
  'use strict';
  var d = document;
  var mq = function (q) { return !!(window.matchMedia && matchMedia(q).matches); };
  var still = mq('(prefers-reduced-motion: reduce)');
  var fmt = function (n) { return '$' + Number(n).toLocaleString('en-US'); };
  var range = function (lo, hi) { return lo === hi ? fmt(lo) : fmt(lo) + ' to ' + fmt(hi); };

  // Hero video: only on wide screens, never with reduced motion or reduced data, and only after the page has loaded,
  // so phones never fetch it and it never counts against the first view. A real button pauses it.
  var video = d.querySelector('.s-hero-video[data-src]');
  if (video) {
    var saveData = !!(navigator.connection && navigator.connection.saveData);
    var wide = mq('(min-width: 60rem)');
    if (wide && !still && !saveData && !mq('(prefers-reduced-data: reduce)')) {
      var start = function () {
        video.addEventListener('playing', function () { video.hidden = false; video.classList.add('is-on'); }, { once: true });
        video.src = video.getAttribute('data-src');
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
        var btn = d.querySelector('[data-video-toggle]');
        if (btn) {
          btn.hidden = false;
          btn.addEventListener('click', function () {
            var paused = video.paused;
            if (paused) video.play(); else video.pause();
            btn.setAttribute('aria-pressed', paused ? 'false' : 'true');
            btn.textContent = paused ? 'Pause video' : 'Play video';
          });
        }
      };
      if (d.readyState === 'complete') setTimeout(start, 300); else addEventListener('load', function () { setTimeout(start, 300); });
    }
  }

  // Cart data (the same numbers as the price table) and the total rule, which matches cartTotal() in premium-core.mjs.
  var readData = function (root) {
    var el = root.querySelector('[data-cart-data]');
    try { return el ? JSON.parse(el.textContent) : null; } catch (e) { return null; }
  };
  var total = function (items, bundle) {
    var lo = 0, hi = 0, kinds = {};
    items.forEach(function (i) { lo += i.low; hi += i.high; kinds[i.service] = 1; });
    var n = Object.keys(kinds).length;
    var on = !!bundle && n >= bundle.minServices && bundle.percentOff > 0;
    var f = on ? 1 - bundle.percentOff / 100 : 1;
    return { low: Math.floor(lo * f), high: Math.ceil(hi * f), discount: on, kinds: n, before: { low: lo, high: hi } };
  };
  var find = function (data, s, o) {
    var svc = null, opt = null;
    data.services.forEach(function (x) { if (x.slug === s) svc = x; });
    if (svc) svc.options.forEach(function (x) { if (x.value === o) opt = x; });
    return svc && opt ? { service: s, option: o, label: svc.name + ': ' + opt.label, low: opt.low, high: opt.high } : null;
  };
  var bundleText = function (t, bundle) {
    if (!bundle) return '';
    if (t.discount) return bundle.percentOff + '% off for ' + t.kinds + ' services in one visit (you save about ' + range(t.before.low - t.low, t.before.high - t.high) + ').';
    var more = bundle.minServices - t.kinds;
    return t.kinds ? 'Add ' + more + ' more service' + (more > 1 ? 's' : '') + ' to get ' + bundle.percentOff + '% off.' : '';
  };

  // Estimate cart.
  d.querySelectorAll('[data-cart]').forEach(function (sec) {
    var tool = sec.querySelector('[data-cart-tool]');
    var data = tool && readData(tool);
    if (!data) return;
    var items = [];
    var list = tool.querySelector('[data-cart-list]'), out = tool.querySelector('[data-cart-out]');
    var empty = tool.querySelector('[data-cart-empty]'), save = tool.querySelector('[data-cart-bundle]'), send = tool.querySelector('[data-cart-send]');
    var render = function (focusAfter) {
      list.textContent = '';
      items.forEach(function (it, i) {
        var li = d.createElement('li');
        var name = d.createElement('span'); name.className = 's-cart-name'; name.textContent = it.label;
        var price = d.createElement('span'); price.className = 's-cart-price'; price.textContent = range(it.low, it.high);
        var rm = d.createElement('button'); rm.type = 'button'; rm.className = 's-cart-rm'; rm.textContent = 'Remove';
        rm.setAttribute('aria-label', 'Remove ' + it.label);
        rm.addEventListener('click', function () { items.splice(i, 1); render(true); });
        li.appendChild(name); li.appendChild(price); li.appendChild(rm);
        list.appendChild(li);
      });
      var t = total(items, data.bundle);
      out.textContent = items.length ? range(t.low, t.high) : '$0';
      empty.hidden = items.length > 0;
      var bt = bundleText(t, data.bundle);
      save.hidden = !bt; save.textContent = bt;
      save.classList.toggle('is-on', t.discount);
      send.disabled = !items.length;
      // After a removal the button that had focus is gone: move focus to the summary heading.
      if (focusAfter) { var h = tool.querySelector('.s-cart-sum h3'); h.setAttribute('tabindex', '-1'); h.focus(); }
    };
    tool.querySelectorAll('[data-cart-add]').forEach(function (b) {
      b.addEventListener('click', function () {
        var s = b.getAttribute('data-cart-add');
        var picked = tool.querySelector('input[name="pick-' + s + '"]:checked');
        var it = picked && find(data, s, picked.value);
        if (!it) return;
        if (items.some(function (x) { return x.service === it.service && x.option === it.option; })) return;   // already in the cart
        items.push(it);
        render(false);
      });
    });
    tool.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!items.length) return;
      var q = '?service=' + encodeURIComponent(items[0].service) + '&cart=' + encodeURIComponent(items.map(function (x) { return x.service + ':' + x.option; }).join(','));
      location.href = tool.getAttribute('action') + q;
    });
    tool.hidden = false;
    var all = sec.querySelector('[data-est-all]');
    if (all) all.open = false;
    render(false);
  });

  // The quote form: show the cart that came from the estimate and send it along (hidden field "cart").
  var qc = d.querySelector('[data-qcart]');
  if (qc) {
    var qd = readData(qc);
    var raw = new URLSearchParams(location.search).get('cart') || '';
    var got = [];
    raw.split(',').slice(0, 8).forEach(function (p) {
      var bits = p.split(':');
      var it = qd && find(qd, bits[0], bits[1]);
      if (it && !got.some(function (x) { return x.service === it.service && x.option === it.option; })) got.push(it);
    });
    if (got.length) {
      var ul = qc.querySelector('[data-qcart-list]');
      got.forEach(function (it) {
        var li = d.createElement('li');
        var a = d.createElement('span'); a.className = 's-cart-name'; a.textContent = it.label;
        var b = d.createElement('span'); b.className = 's-cart-price'; b.textContent = range(it.low, it.high);
        li.appendChild(a); li.appendChild(b); ul.appendChild(li);
      });
      var t = total(got, qd.bundle);
      qc.querySelector('[data-qcart-total]').textContent = range(t.low, t.high);
      var sv = qc.querySelector('[data-qcart-bundle]');
      if (t.discount) { sv.hidden = false; sv.textContent = bundleText(t, qd.bundle); }
      qc.querySelector('[data-qcart-field]').value = got.map(function (x) { return x.service + ':' + x.option; }).join(',');
      qc.hidden = false;
    }
  }

  // Preferred day: from tomorrow to the configured days ahead, working days only (quote.php checks the same).
  d.querySelectorAll('[data-sched]').forEach(function (fs) {
    var input = fs.querySelector('input[type=date]');
    if (!input) return;
    var days = (fs.getAttribute('data-days') || '').split(',');
    var ahead = Number(fs.getAttribute('data-ahead')) || 30;
    var names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var iso = function (dt) { return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0'); };
    var now = new Date();
    var min = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    var max = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ahead);
    input.min = iso(min);
    input.max = iso(max);
    var es = d.documentElement.lang === 'es';
    input.addEventListener('change', function () {
      var msg = '';
      if (input.value) {
        var p = input.value.split('-').map(Number);
        var dt = new Date(p[0], p[1] - 1, p[2]);
        if (days.indexOf(names[dt.getDay()]) < 0) msg = es ? 'Ese día no trabajamos. Elija otro día.' : 'We do not work that day. Pick one of our working days.';
        else if (dt < min || dt > max) msg = es ? 'Elija un día dentro del plazo indicado.' : 'Pick a day within the range shown.';
      }
      input.setCustomValidity(msg);
      if (msg) input.reportValidity();
    });
  });
})();
