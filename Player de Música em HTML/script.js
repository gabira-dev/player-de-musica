(function () {
  const $ = id => document.getElementById(id);
  const audio = new Audio();
  audio.preload = 'metadata';

  const el = {
    player: $('player'), title: $('title'), subtitle: $('subtitle'),
    seek: $('seek'), cur: $('cur'), dur: $('dur'),
    play: $('play'), playIcon: $('playIcon'), prev: $('prev'), next: $('next'),
    shuffle: $('shuffle'), repeat: $('repeat'), repeatIcon: $('repeatIcon'),
    volume: $('volume'), file: $('file'), addBtn: $('addBtn'), clearBtn: $('clearBtn'),
    list: $('list'), canvas: $('viz')
  };

  const ICON_PLAY = '<path d="M8 5v14l11-7z"/>';
  const ICON_PAUSE = '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>';
  const ICON_REPEAT = '<path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>';
  const ICON_REPEAT_ONE = '<path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z"/>';

  let tracks = [];       // {name, url, duration}
  let index = -1;
  let shuffle = false;
  let repeat = 0;        // 0 = off, 1 = all, 2 = one

  /* ---------- Utilidades ---------- */
  const fmt = s => {
    if (!isFinite(s)) return '0:00';
    s = Math.floor(s);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  const cleanName = n => n.replace(/\.[^/.]+$/, '').replace(/[_]+/g, ' ');
  const fillRange = r => {
    const pct = ((r.value - r.min) / (r.max - r.min)) * 100;
    r.style.setProperty('--val', pct + '%');
  };

  /* ---------- Playlist ---------- */
  function addFiles(files) {
    const wasEmpty = tracks.length === 0;
    [...files].forEach(f => {
      if (!f.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|flac|aac|opus|weba)$/i.test(f.name)) return;
      const t = { name: cleanName(f.name), url: URL.createObjectURL(f), duration: 0 };
      tracks.push(t);
      // descobre a duração
      const probe = new Audio();
      probe.preload = 'metadata';
      probe.src = t.url;
      probe.addEventListener('loadedmetadata', () => { t.duration = probe.duration; render(); });
    });
    render();
    if (wasEmpty && tracks.length) load(0, true);
  }

  function render() {
    el.list.innerHTML = '';
    if (!tracks.length) {
      el.list.innerHTML = '<li class="empty">A playlist está vazia</li>';
      return;
    }
    tracks.forEach((t, i) => {
      const li = document.createElement('li');
      if (i === index) li.classList.add('current');
      li.innerHTML =
        '<span class="idx">' + (i === index && !audio.paused ? '▶' : i + 1) + '</span>' +
        '<span class="name"></span>' +
        '<span class="dur">' + (t.duration ? fmt(t.duration) : '') + '</span>' +
        '<button class="rm" title="Remover">✕</button>';
      li.querySelector('.name').textContent = t.name;
      li.addEventListener('click', () => load(i, true));
      li.querySelector('.rm').addEventListener('click', e => { e.stopPropagation(); removeTrack(i); });
      el.list.appendChild(li);
    });
  }

  function removeTrack(i) {
    URL.revokeObjectURL(tracks[i].url);
    tracks.splice(i, 1);
    if (!tracks.length) { reset(); }
    else if (i === index) { load(Math.min(i, tracks.length - 1), !audio.paused); }
    else if (i < index) { index--; }
    render();
  }

  function reset() {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    index = -1;
    el.title.textContent = 'Nenhuma música';
    el.subtitle.textContent = 'Adicione arquivos de áudio para começar';
    el.seek.value = 0; fillRange(el.seek);
    el.cur.textContent = el.dur.textContent = '0:00';
    setPlayIcon(false);
    document.title = 'Player de Música';
  }

  /* ---------- Reprodução ---------- */
  function load(i, autoplay) {
    if (i < 0 || i >= tracks.length) return;
    index = i;
    const t = tracks[i];
    audio.src = t.url;
    el.title.textContent = t.name;
    el.subtitle.textContent = 'Faixa ' + (i + 1) + ' de ' + tracks.length;
    document.title = t.name + ' · Player';
    el.seek.value = 0; fillRange(el.seek);
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: t.name, artist: 'Player de Música' });
    }
    if (autoplay) play();
    render();
  }

  function play() {
    if (index < 0 && tracks.length) { load(0, true); return; }
    if (index < 0) return;
    initAudioContext();
    audio.play().catch(() => {});
  }
  function pause() { audio.pause(); }
  function toggle() { audio.paused ? play() : pause(); }

  function nextIndex(auto) {
    if (!tracks.length) return -1;
    if (shuffle && tracks.length > 1) {
      let n;
      do { n = Math.floor(Math.random() * tracks.length); } while (n === index);
      return n;
    }
    if (index + 1 < tracks.length) return index + 1;
    return (repeat === 1 || !auto) ? 0 : -1;
  }
  function next(auto) {
    const n = nextIndex(auto);
    if (n >= 0) load(n, true);
    else { pause(); audio.currentTime = 0; }
  }
  function prev() {
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    if (!tracks.length) return;
    load(index > 0 ? index - 1 : tracks.length - 1, true);
  }

  function setPlayIcon(playing) {
    el.playIcon.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
  }

  /* ---------- Eventos do áudio ---------- */
  audio.addEventListener('play', () => { setPlayIcon(true); render(); });
  audio.addEventListener('pause', () => { setPlayIcon(false); render(); });
  audio.addEventListener('loadedmetadata', () => {
    el.dur.textContent = fmt(audio.duration);
    if (tracks[index]) { tracks[index].duration = audio.duration; }
  });
  audio.addEventListener('timeupdate', () => {
    if (!seeking && audio.duration) {
      el.seek.value = (audio.currentTime / audio.duration) * 100;
      fillRange(el.seek);
    }
    el.cur.textContent = fmt(audio.currentTime);
  });
  audio.addEventListener('ended', () => {
    if (repeat === 2) { audio.currentTime = 0; play(); }
    else next(true);
  });
  audio.addEventListener('error', () => {
    if (index >= 0) el.subtitle.textContent = 'Não foi possível reproduzir este arquivo';
  });

  /* ---------- Controles ---------- */
  let seeking = false;
  el.seek.addEventListener('input', () => {
    seeking = true;
    fillRange(el.seek);
    if (audio.duration) el.cur.textContent = fmt((el.seek.value / 100) * audio.duration);
  });
  el.seek.addEventListener('change', () => {
    if (audio.duration) audio.currentTime = (el.seek.value / 100) * audio.duration;
    seeking = false;
  });

  el.volume.addEventListener('input', () => { audio.volume = +el.volume.value; fillRange(el.volume); });
  audio.volume = +el.volume.value; fillRange(el.volume);

  el.play.addEventListener('click', toggle);
  el.next.addEventListener('click', () => next(false));
  el.prev.addEventListener('click', prev);

  function toggleShuffle() { shuffle = !shuffle; el.shuffle.classList.toggle('active', shuffle); }
  function cycleRepeat() {
    repeat = (repeat + 1) % 3;
    el.repeat.classList.toggle('active', repeat > 0);
    el.repeatIcon.innerHTML = repeat === 2 ? ICON_REPEAT_ONE : ICON_REPEAT;
    el.repeat.title = ['Repetir: desligado', 'Repetir: todas', 'Repetir: faixa atual'][repeat];
  }
  el.shuffle.addEventListener('click', toggleShuffle);
  el.repeat.addEventListener('click', cycleRepeat);

  el.addBtn.addEventListener('click', () => el.file.click());
  el.file.addEventListener('change', () => { addFiles(el.file.files); el.file.value = ''; });
  el.clearBtn.addEventListener('click', () => {
    tracks.forEach(t => URL.revokeObjectURL(t.url));
    tracks = []; reset(); render();
  });

  /* Arrastar e soltar */
  ['dragenter', 'dragover'].forEach(ev =>
    document.addEventListener(ev, e => { e.preventDefault(); el.player.classList.add('dropping'); }));
  ['dragleave', 'drop'].forEach(ev =>
    document.addEventListener(ev, e => { e.preventDefault(); el.player.classList.remove('dropping'); }));
  document.addEventListener('drop', e => { if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });

  /* Atalhos de teclado */
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
    switch (e.code) {
      case 'Space': e.preventDefault(); toggle(); break;
      case 'ArrowRight': e.shiftKey ? (audio.currentTime += 10) : next(false); break;
      case 'ArrowLeft': e.shiftKey ? (audio.currentTime -= 10) : prev(); break;
      case 'ArrowUp': e.preventDefault(); el.volume.value = Math.min(1, +el.volume.value + .05); el.volume.dispatchEvent(new Event('input')); break;
      case 'ArrowDown': e.preventDefault(); el.volume.value = Math.max(0, +el.volume.value - .05); el.volume.dispatchEvent(new Event('input')); break;
      case 'KeyS': toggleShuffle(); break;
      case 'KeyR': cycleRepeat(); break;
    }
  });

  /* Controles de mídia do sistema */
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', play);
    navigator.mediaSession.setActionHandler('pause', pause);
    navigator.mediaSession.setActionHandler('previoustrack', prev);
    navigator.mediaSession.setActionHandler('nexttrack', () => next(false));
  }

  /* ---------- Visualizador ---------- */
  let ctx, analyser, data;
  function initAudioContext() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaElementSource(audio);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      data = new Uint8Array(analyser.frequencyBinCount);
      src.connect(analyser);
      analyser.connect(ctx.destination);
    } catch (e) { ctx = null; }
  }

  const c2d = el.canvas.getContext('2d');
  function resizeCanvas() {
    const r = el.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    el.canvas.width = r.width * dpr;
    el.canvas.height = r.height * dpr;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function draw() {
    requestAnimationFrame(draw);
    const w = el.canvas.width, h = el.canvas.height;
    c2d.clearRect(0, 0, w, h);
    const bars = 40;
    const gap = w * 0.008;
    const bw = (w - gap * (bars - 1)) / bars;
    if (analyser && !audio.paused) analyser.getByteFrequencyData(data);
    for (let i = 0; i < bars; i++) {
      let v = 0;
      if (analyser && !audio.paused) v = data[Math.floor(i * data.length * 0.75 / bars)] / 255;
      else v = 0.04;
      const bh = Math.max(4, v * h * 0.9);
      c2d.fillStyle = 'rgba(255,255,255,' + (0.45 + v * 0.55) + ')';
      const x = i * (bw + gap);
      const r = Math.min(bw / 2, 6);
      c2d.beginPath();
      c2d.roundRect ? c2d.roundRect(x, h - bh, bw, bh, r) : c2d.rect(x, h - bh, bw, bh);
      c2d.fill();
    }
  }
  draw();

  render();
})();