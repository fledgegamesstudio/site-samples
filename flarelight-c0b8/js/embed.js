// Click-to-load players. Each .embed block carries the player address in data-src; nothing is requested until the
// visitor taps its button. Only three hosts are ever framed (the page's CSP allows the same three).
(function () {
  var OK = ['https://open.spotify.com/', 'https://www.youtube-nocookie.com/', 'https://embed.music.apple.com/'];
  document.querySelectorAll('[data-embed]').forEach(function (box) {
    var btn = box.querySelector('.embed-go');
    var src = box.getAttribute('data-src') || '';
    if (!btn || !OK.some(function (h) { return src.indexOf(h) === 0; })) return;
    box.hidden = false;
    btn.addEventListener('click', function () {
      var f = document.createElement('iframe');
      f.src = src;
      f.title = box.getAttribute('data-title') || 'Player';
      f.height = box.getAttribute('data-height') || '352';
      f.width = '100%';
      f.loading = 'lazy';
      f.allow = 'encrypted-media; fullscreen';
      f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-presentation');
      f.className = 'embed-frame';
      box.textContent = '';
      box.appendChild(f);
    });
  });
})();
