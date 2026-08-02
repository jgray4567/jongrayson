/* ═══════════════════════════════════════════════════════════════
   JON GRAYSON · 2026
   ═══════════════════════════════════════════════════════════════ */

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (id) => document.getElementById(id);
const setText = (id, v) => {
  const el = $(id);
  if (!el) return;
  el.textContent = (v === 0 || v) ? v : '—';
};

/* ── Progress bar ─────────────────────────────────────────── */
(function () {
  const bar = $('progress-bar');
  if (!bar) return;
  const update = () => {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (total > 0 ? (window.scrollY / total) * 100 : 0) + '%';
  };
  addEventListener('scroll', update, { passive: true });
  update();
})();

/* ── Scroll reveal ────────────────────────────────────────── */
(function () {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('vis');
      io.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
})();

/* ── Nav ──────────────────────────────────────────────────── */
(function () {
  const btn = $('hamBtn');
  const menu = $('mobileMenu');
  if (!btn || !menu) return;
  const close = () => { menu.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  addEventListener('resize', () => { if (innerWidth > 900) close(); });
})();

/* ── Anchor scrolling that clears the fixed nav ───────────── */
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY - 56;
    window.scrollTo({ top, behavior: REDUCED ? 'auto' : 'smooth' });
  });
});

/* ── Contact form ─────────────────────────────────────────── */
(function () {
  const form = $('contactForm');
  if (!form) return;
  const stamp = $('_form_time');
  if (stamp) stamp.value = Date.now();

  const btn = form.querySelector('.btn-send');
  const label = btn ? btn.textContent : '';
  const flash = (text, revert) => {
    if (!btn) return;
    btn.textContent = text;
    setTimeout(() => { btn.textContent = label; btn.disabled = false; }, revert);
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const honey = form.querySelector('input[name="website"]');
    if (honey && honey.value.length > 0) { flash('Sent', 3000); form.reset(); return; }
    const t = parseInt(stamp && stamp.value ? stamp.value : '0', 10);
    if (t > 0 && Date.now() - t < 3000) { flash('One moment…', 2000); return; }

    btn.textContent = 'Sending…';
    btn.disabled = true;
    fetch('/php/contact-me.php', { method: 'POST', body: new FormData(form) })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) { form.reset(); flash('Sent', 4000); }
        else { flash(d.error || 'Error — try again', 4000); }
      })
      .catch(() => flash('Error — try again', 4000));
  });
})();

/* ── Efficiency panel: fill bars when seen ────────────────── */
(function () {
  const rows = document.querySelector('.panel-rows');
  if (!rows) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.querySelectorAll('[data-w]').forEach((bar, i) => {
        setTimeout(() => { bar.style.width = bar.dataset.w + '%'; }, REDUCED ? 0 : i * 90);
      });
      io.unobserve(e.target);
    });
  }, { threshold: 0.25 });
  io.observe(rows);
})();

/* ═══════════════════════════════════════════════════════════
   VISITOR INTELLIGENCE
   ═══════════════════════════════════════════════════════════ */

/* Local time */
(function () {
  const tick = () => setText('env-time', new Date().toLocaleTimeString('en-US', { hour12: true }));
  tick();
  setInterval(tick, 1000);
})();

/* Greeting */
(function () {
  const el = $('dash-greeting');
  if (!el) return;
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  el.textContent = part + ' — thanks for stopping by.';
})();

/* Referrer */
(function () {
  const ref = document.referrer;
  if (!ref) { setText('ref-source', 'Direct'); return; }
  try {
    const host = new URL(ref).hostname.replace('www.', '');
    const map = { google: 'Google', bing: 'Bing', linkedin: 'LinkedIn', twitter: 'X', 't.co': 'X', facebook: 'Facebook', github: 'GitHub', duckduckgo: 'DuckDuckGo' };
    const key = Object.keys(map).find((k) => host.includes(k));
    setText('ref-source', key ? map[key] : host);
  } catch { setText('ref-source', 'External'); }
})();

/* Device */
(function () {
  const ua = navigator.userAgent;
  const browser = ua.includes('Edg') ? 'Edge' : ua.includes('Firefox') ? 'Firefox' : ua.includes('OPR') ? 'Opera'
    : ua.includes('Chrome') ? 'Chrome' : ua.includes('Safari') ? 'Safari' : 'Unknown';
  const os = ua.includes('iPhone') || ua.includes('iPad') ? 'iOS' : ua.includes('Android') ? 'Android'
    : ua.includes('Windows') ? 'Windows' : ua.includes('Mac') ? 'macOS' : ua.includes('Linux') ? 'Linux' : 'Unknown';
  setText('dp-browser', browser);
  setText('dp-os', os);
  setText('dp-screen', screen.width + ' × ' + screen.height);
  setText('dp-viewport', innerWidth + ' × ' + innerHeight);
  setText('dp-dpr', devicePixelRatio + '×');
  setText('dp-touch', 'ontouchstart' in window ? 'Yes' : 'No');
  setText('dp-cpu', navigator.hardwareConcurrency ? navigator.hardwareConcurrency + ' cores' : '—');
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
    setText('dp-gpu', dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL).replace(/ANGLE \(|,.*?\)$/g, '').replace(/\(TM\)|\(R\)/g, '').trim() : '—');
  } catch { setText('dp-gpu', '—'); }
})();

/* Environment */
(function () {
  setText('env-tz', Intl.DateTimeFormat().resolvedOptions().timeZone);
  setText('env-lang', navigator.language);
  setText('env-dnt', navigator.doNotTrack === '1' ? 'On' : 'Off');
  setText('env-cookies', navigator.cookieEnabled ? 'Enabled' : 'Disabled');
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  setText('env-conn', conn && conn.effectiveType ? conn.effectiveType.toUpperCase() : '—');
  setText('env-dl', conn && conn.downlink ? conn.downlink + ' Mb/s' : '—');
  if (navigator.getBattery) {
    navigator.getBattery().then((b) => setText('env-bat', Math.round(b.level * 100) + '%' + (b.charging ? ' charging' : '')));
  } else setText('env-bat', '—');
})();

/* Preferences and signals */
(function () {
  setText('sys-scheme', matchMedia('(prefers-color-scheme: dark)').matches ? 'Dark' : 'Light');
  setText('sys-motion', REDUCED ? 'Reduced' : 'Full');
  setText('sys-contrast', matchMedia('(prefers-contrast: more)').matches ? 'High' : 'Standard');
  setText('sys-online', navigator.onLine ? 'Online' : 'Offline');
  setText('sys-platform', navigator.platform || '—');
  setText('sys-coldepth', screen.colorDepth + '-bit');
  try {
    setText('sys-webgl', document.createElement('canvas').getContext('webgl') ? 'Yes' : 'No');
  } catch { setText('sys-webgl', '—'); }
})();

/* Session engagement */
let engScrolls = 0, engMoves = 0, engClicks = 0, engKeys = 0, maxDepth = 0;
const sessionStart = Date.now();
const scrollDepth = () => {
  const total = document.documentElement.scrollHeight - window.innerHeight;
  return total > 0 ? Math.round((window.scrollY / total) * 100) : 0;
};
const totalInteractions = () => setText('hero-interactions', engClicks + engKeys + engScrolls);

addEventListener('scroll', () => {
  engScrolls++;
  const d = scrollDepth();
  if (d > maxDepth) maxDepth = d;
  setText('eng-scrolls', engScrolls);
  setText('eng-depth', maxDepth + '%');
  const hero = $('hero-scroll');
  if (hero) hero.innerHTML = maxDepth + '<span class="unit">%</span>';
}, { passive: true });

addEventListener('mousemove', () => {
  engMoves++;
  if (engMoves % 20 === 0) setText('eng-moves', engMoves);
}, { passive: true });

addEventListener('click', () => { engClicks++; setText('eng-clicks', engClicks); totalInteractions(); });
addEventListener('keydown', () => { engKeys++; setText('eng-keys', engKeys); totalInteractions(); });

setInterval(() => {
  const s = Math.floor((Date.now() - sessionStart) / 1000);
  setText('hero-time', String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'));
  totalInteractions();
}, 1000);

/* Session activity chart */
(function () {
  const canvas = $('waveCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let history = new Array(120).fill(0), t = 0;

  const resize = () => {
    canvas.width = canvas.offsetWidth * devicePixelRatio;
    canvas.height = canvas.offsetHeight * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  };

  setInterval(() => { history.push(scrollDepth()); history.shift(); }, 500);

  function draw() {
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    const pad = 16, plotW = W - pad * 2, plotH = H - pad * 2;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#f5f5f7';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 1;
    [0, 25, 50, 75, 100].forEach((v) => {
      const y = pad + plotH - (v / 100) * plotH;
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
    });

    ctx.font = '500 11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    [0, 50, 100].forEach((v) => {
      const y = pad + plotH - (v / 100) * plotH;
      ctx.fillText(v + '%', pad + 2, y - 5);
    });

    const x = (i) => pad + plotW * i / (history.length - 1);
    const y = (v) => pad + plotH - (v / 100) * plotH;

    ctx.beginPath();
    ctx.moveTo(pad, pad + plotH);
    history.forEach((v, i) => ctx.lineTo(x(i), y(v)));
    ctx.lineTo(W - pad, pad + plotH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad, 0, pad + plotH);
    grad.addColorStop(0, 'rgba(159,174,0,0.22)');
    grad.addColorStop(1, 'rgba(159,174,0,0.02)');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    history.forEach((v, i) => (i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v))));
    ctx.strokeStyle = '#9fae00';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    const last = history[history.length - 1];
    const lx = W - pad, ly = y(last);
    const p = REDUCED ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.08);
    ctx.beginPath(); ctx.arc(lx, ly, 6 + p * 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(159,174,0,' + (0.08 + p * 0.08) + ')'; ctx.fill();
    ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#9fae00'; ctx.fill();

    t++;
    requestAnimationFrame(draw);
  }

  addEventListener('load', () => { resize(); draw(); });
  addEventListener('resize', resize);
})();

/* ── Ambient canvas — hero texture only ───────────────────── */
(function () {
  const canvas = $('ambient');
  if (!canvas || REDUCED) return;
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(devicePixelRatio || 1, 2);
  let W, H, scrollY = 0;

  const resize = () => {
    W = canvas.width = innerWidth * DPR;
    H = canvas.height = innerHeight * DPR;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
  };
  resize();
  addEventListener('resize', resize);
  addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });

  const dots = Array.from({ length: 26 }, () => ({
    x: Math.random(), y: Math.random(),
    r: 0.5 + Math.random() * 1.4,
    vx: (Math.random() - 0.5) * 0.0003,
    vy: (Math.random() - 0.5) * 0.0003
  }));

  function frame() {
    if (scrollY > innerHeight) { requestAnimationFrame(frame); return; }
    ctx.clearRect(0, 0, W, H);
    const grid = 64 * DPR;
    const offset = (scrollY * 0.25) % grid;
    ctx.strokeStyle = 'rgba(29,29,31,0.045)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -grid + offset; x < W; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = -grid - offset; y < H; y += grid) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    dots.forEach((d) => {
      d.x += d.vx; d.y += d.vy;
      if (d.x < 0 || d.x > 1) d.vx *= -1;
      if (d.y < 0 || d.y > 1) d.vy *= -1;
      ctx.beginPath();
      ctx.arc(d.x * W, (d.y * H + scrollY * 0.1 * DPR) % H, d.r * DPR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(196,214,0,0.30)';
      ctx.fill();
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
