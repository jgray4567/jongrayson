
// ── PROGRESS BAR
window.addEventListener('scroll',()=>{
  document.getElementById('progress-bar').style.width=(window.scrollY/(document.documentElement.scrollHeight-window.innerHeight)*100)+'%';
},{passive:true});

// ── SCROLL REVEAL
const io=new IntersectionObserver(e=>e.forEach(x=>{if(!x.isIntersecting)return;x.target.classList.add('vis');io.unobserve(x.target);}),{threshold:0.1});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

// Skill bars + craft bars
const sio=new IntersectionObserver(e=>e.forEach(x=>{if(!x.isIntersecting)return;x.target.querySelectorAll('[data-w]').forEach((b,i)=>setTimeout(()=>{b.style.width=b.dataset.w+'%';},i*90));sio.unobserve(x.target);}),{threshold:0.2});
document.querySelectorAll('.skill-bars,.ai-workflow').forEach(el=>sio.observe(el));

// Segmented bar fill helper
/* fillSegBars removed — replaced by Apple-style dashboard */

// ── NAV
function toggleMob(){document.getElementById('mobileMenu').classList.toggle('open');}
function closeMob(){document.getElementById('mobileMenu').classList.remove('open');}

// ── SMOOTH SCROLL
document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{const t=document.querySelector(a.getAttribute('href'));if(t){e.preventDefault();t.scrollIntoView({behavior:'smooth'});}}));

// ── FORM
document.addEventListener('DOMContentLoaded',()=>{const ft=document.getElementById('_form_time');if(ft)ft.value=Date.now();});
function handleSubmit(e){
  e.preventDefault();const form=e.target,btn=form.querySelector('.btn-send');
  const hp=form.querySelector('input[name="website"]');
  if(hp&&hp.value.length>0){btn.textContent='Sent ✓';setTimeout(()=>{btn.textContent='Send Message →';form.reset();},3000);return;}
  const ft=parseInt(form.querySelector('#_form_time')?.value||'0');
  if(ft>0&&Date.now()-ft<3000){btn.textContent='Please wait…';setTimeout(()=>{btn.textContent='Send Message →';},2000);return;}
  btn.textContent='Sending…';btn.disabled=true;
  fetch('/php/contact-me.php',{method:'POST',body:new FormData(form)})
    .then(r=>r.json())
    .then(d=>{
      if(d.success){btn.textContent='Sent ✓';btn.style.background='#28c940';btn.style.color='#fff';form.reset();setTimeout(()=>{btn.textContent='Send Message →';btn.style.background='';btn.style.color='';btn.disabled=false;},4000);}
      else{btn.textContent=d.error||'Error — Try Again';btn.style.background='#ff3b30';btn.style.color='#fff';setTimeout(()=>{btn.textContent='Send Message →';btn.style.background='';btn.style.color='';btn.disabled=false;},4000);}
    })
    .catch(()=>{btn.textContent='Error — Try Again';btn.style.background='#ff3b30';btn.style.color='#fff';setTimeout(()=>{btn.textContent='Send Message →';btn.style.background='';btn.style.color='';btn.disabled=false;},4000);});
}

/* ═══════════════════════════════════
   VISITOR INTELLIGENCE DASHBOARD
   ═══════════════════════════════════ */

// TIME
function updateTime(){
  const n=new Date();
  const e2=document.getElementById('env-time');if(e2)e2.textContent=n.toLocaleTimeString('en-US',{hour12:true});
}
setInterval(updateTime,1000);updateTime();

// REFERRER
(function(){
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v||'—';};
  const ref=document.referrer;
  if(!ref){set('ref-source','Direct');}
  else{
    try{
      const u=new URL(ref);const src=u.hostname.replace('www.','');
      const map={'google':'Google','bing':'Bing','linkedin':'LinkedIn','twitter':'X / Twitter','t.co':'X / Twitter','facebook':'Facebook','github':'GitHub','duckduckgo':'DuckDuckGo'};
      const key=Object.keys(map).find(k=>src.includes(k));
      set('ref-source',key?map[key]:src);
    }catch{set('ref-source','External');}
  }
})();

// TIMEZONE + REGION
(function(){
  const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v||'—';};
  set('env-tz',tz);
  const regionMap={'America/New_York':'US East','America/Chicago':'US Central','America/Denver':'US Mountain','America/Los_Angeles':'US West','America/Vancouver':'Canada West','America/Toronto':'Canada East','Europe/London':'UK','Europe/Paris':'W. Europe','Europe/Berlin':'C. Europe','Europe/Moscow':'Russia','Asia/Tokyo':'Japan','Asia/Shanghai':'China','Asia/Seoul':'Korea','Asia/Kolkata':'India','Asia/Dubai':'Gulf','Australia/Sydney':'Australia','Pacific/Auckland':'New Zealand'};
  const region=Object.keys(regionMap).find(k=>tz.includes(k.split('/')[1]))||null;
  const regionName=region?regionMap[region]:tz.split('/')[0];
  /* hero-region removed — replaced by hero-device, populated in DEVICE PROFILE block */

  // ── PERSONALIZED GREETING ──
  const greetEl=document.getElementById('dash-greeting');
  function getTimeGreeting(){
    const h=new Date().getHours();
    if(h<12) return 'Good morning';
    if(h<17) return 'Good afternoon';
    return 'Good evening';
  }
  function setGreeting(locationStr){
    if(!greetEl)return;
    if(locationStr){
      greetEl.innerHTML=getTimeGreeting()+' — hope things are going well in <span class="greeting-location">'+locationStr+'</span>.';
    } else {
      greetEl.textContent=getTimeGreeting()+' — thanks for stopping by.';
    }
  }
  // Use generic greeting (no location)
  setGreeting(null);

  /* COMMENTED OUT: Timezone-based region greeting
  setGreeting(regionName);
  */

  /* COMMENTED OUT: Browser Geolocation (requires user permission prompt)
  // Uncomment to enable precise location via Geolocation API + reverse geocoding
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(
      function(pos){
        fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude='+pos.coords.latitude+'&longitude='+pos.coords.longitude+'&localityLanguage=en')
          .then(r=>r.json())
          .then(d=>{
            let loc='';
            const state=d.principalSubdivision||'';
            const country=d.countryName||'';
            const code=d.countryCode||'';
            if(code==='US'&&state){loc=state;}
            else{loc=country||regionName;}
            setGreeting(loc);
            // heroRegion card removed — update hero-device if re-enabling
          })
          .catch(()=>setGreeting(regionName));
      },
      function(){setGreeting(regionName);},
      {timeout:5000,maximumAge:300000}
    );
  } else {
    setGreeting(regionName);
  }
  */
})();

// DEVICE PROFILE
(function(){
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v||'—';};
  const ua=navigator.userAgent;
  const br=ua.includes('Edg')?'Edge':ua.includes('Firefox')?'Firefox':ua.includes('OPR')?'Opera':ua.includes('Chrome')?'Chrome':ua.includes('Safari')?'Safari':'Unknown';
  const os=ua.includes('iPhone')||ua.includes('iPad')?'iOS':ua.includes('Android')?'Android':ua.includes('Windows')?'Windows':ua.includes('Mac')?'macOS':ua.includes('Linux')?'Linux':'Unknown';
  set('dp-browser',br);set('dp-os',os);
  const heroDevice=document.getElementById('hero-device');
  if(heroDevice){heroDevice.textContent=os;heroDevice.style.fontSize='clamp(1.6rem,3.2vw,2.4rem)';}
  set('dp-screen',screen.width+' × '+screen.height);
  set('dp-viewport',window.innerWidth+' × '+window.innerHeight);
  set('dp-dpr',window.devicePixelRatio+'×');
  set('dp-touch','ontouchstart' in window?'Yes':'No');
  set('dp-cpu',navigator.hardwareConcurrency?navigator.hardwareConcurrency+' cores':'—');
  try{const c=document.createElement('canvas');const gl=c.getContext('webgl')||c.getContext('experimental-webgl');if(gl){const dbg=gl.getExtension('WEBGL_debug_renderer_info');set('dp-gpu',dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL).replace(/ANGLE \(|,.*?\)$/g,'').replace(/\(TM\)|\(R\)/g,'').trim():'—');}else set('dp-gpu','—');}catch{set('dp-gpu','—');}
})();

// ENVIRONMENT
(function(){
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v||'—';};
  set('env-lang',navigator.language);
  set('env-dnt',navigator.doNotTrack==='1'?'On':'Off');
  set('env-cookies',navigator.cookieEnabled?'Enabled':'Disabled');
  const cn=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
  if(cn){set('env-conn',(cn.effectiveType||'—').toUpperCase());set('env-dl',cn.downlink?(cn.downlink+' Mb/s'):'—');}
  else{set('env-conn','—');set('env-dl','—');}
  if(navigator.getBattery){navigator.getBattery().then(b=>set('env-bat',Math.round(b.level*100)+'%'+(b.charging?' Charging':'')));}
  else set('env-bat','—');
})();

// SYSTEM SIGNALS
(function(){
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v||'—';};
  set('sys-scheme',window.matchMedia('(prefers-color-scheme:dark)').matches?'Dark':'Light');
  set('sys-motion',window.matchMedia('(prefers-reduced-motion:reduce)').matches?'Reduced':'Full');
  set('sys-contrast',window.matchMedia('(prefers-contrast:high)').matches?'High':'Standard');
  set('sys-online',navigator.onLine?'Online':'Offline');
  set('sys-platform',navigator.platform||'—');
  set('sys-coldepth',screen.colorDepth+'-bit');
  try{const c=document.createElement('canvas');set('sys-webgl',(c.getContext('webgl')||c.getContext('experimental-webgl'))?'Yes':'No');}catch{set('sys-webgl','—');}
})();

// SESSION ENGAGEMENT
let engScrolls=0,engMoves=0,engClicks=0,engKeys=0,maxDepth=0;
const sessionStart=Date.now();
function getScrollDepth(){const tot=document.documentElement.scrollHeight-window.innerHeight;return tot>0?Math.round((window.scrollY/tot)*100):0;}

window.addEventListener('scroll',()=>{
  engScrolls++;const d=getScrollDepth();if(d>maxDepth)maxDepth=d;
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  set('eng-scrolls',engScrolls);set('eng-depth',maxDepth+'%');
  // Hero stat
  const hs=document.getElementById('hero-scroll');
  if(hs)hs.innerHTML=maxDepth+'<span class="num-unit">%</span>';
},{passive:true});
document.addEventListener('mousemove',()=>{engMoves++;if(engMoves%20===0){const e=document.getElementById('eng-moves');if(e)e.textContent=engMoves;}},{passive:true});
document.addEventListener('click',()=>{engClicks++;const e=document.getElementById('eng-clicks');if(e)e.textContent=engClicks;updateInteractions();});
document.addEventListener('keydown',()=>{engKeys++;const e=document.getElementById('eng-keys');if(e)e.textContent=engKeys;updateInteractions();});
function updateInteractions(){const e=document.getElementById('hero-interactions');if(e)e.textContent=engClicks+engKeys+engScrolls;}
setInterval(()=>{
  const s=Math.floor((Date.now()-sessionStart)/1000);
  const heroTime=document.getElementById('hero-time');
  if(heroTime){
    const mm=String(Math.floor(s/60)).padStart(2,'0');
    const ss=String(s%60).padStart(2,'0');
    heroTime.textContent=mm+':'+ss;
  }
  updateInteractions();
},1000);

// SCROLL WAVEFORM — clean Apple style
const waveEl=document.getElementById('waveCanvas');
const wCtx=waveEl?waveEl.getContext('2d'):null;
let scrollHistory=Array(120).fill(0),wt=0;
function resizeWave(){
  if(!waveEl)return;
  waveEl.width=waveEl.offsetWidth*window.devicePixelRatio;
  waveEl.height=waveEl.offsetHeight*window.devicePixelRatio;
  wCtx.scale(window.devicePixelRatio,window.devicePixelRatio);
}
setInterval(()=>{scrollHistory.push(getScrollDepth());scrollHistory.shift();},500);
function drawWave(){
  if(!wCtx)return;
  const W=waveEl.offsetWidth,H=waveEl.offsetHeight;
  wCtx.clearRect(0,0,W,H);
  // Light background
  wCtx.fillStyle='#f5f5f7';wCtx.fillRect(0,0,W,H);
  // Subtle grid
  wCtx.strokeStyle='rgba(0,0,0,0.04)';wCtx.lineWidth=1;
  const pad=12,plotW=W-pad*2,plotH=H-pad*2;
  [0,25,50,75,100].forEach(v=>{
    const y=pad+plotH-(v/100)*plotH;
    wCtx.beginPath();wCtx.moveTo(pad,y);wCtx.lineTo(W-pad,y);wCtx.stroke();
  });
  // Y-axis labels
  wCtx.font='500 9px -apple-system,BlinkMacSystemFont,sans-serif';wCtx.fillStyle='rgba(0,0,0,0.2)';wCtx.textAlign='left';
  [0,50,100].forEach(v=>{
    const y=pad+plotH-(v/100)*plotH;
    wCtx.fillText(v+'%',pad+2,y-4);
  });
  // Fill area
  wCtx.beginPath();wCtx.moveTo(pad,pad+plotH);
  scrollHistory.forEach((v,i)=>{const x=pad+plotW*i/(scrollHistory.length-1),y=pad+plotH-(v/100)*plotH;wCtx.lineTo(x,y);});
  wCtx.lineTo(W-pad,pad+plotH);wCtx.closePath();
  const g=wCtx.createLinearGradient(0,pad,0,pad+plotH);
  g.addColorStop(0,'rgba(159,174,0,0.2)');g.addColorStop(1,'rgba(159,174,0,0.02)');
  wCtx.fillStyle=g;wCtx.fill();
  // Line
  wCtx.beginPath();
  scrollHistory.forEach((v,i)=>{const x=pad+plotW*i/(scrollHistory.length-1),y=pad+plotH-(v/100)*plotH;i===0?wCtx.moveTo(x,y):wCtx.lineTo(x,y);});
  wCtx.strokeStyle='#9fae00';wCtx.lineWidth=2;wCtx.lineJoin='round';wCtx.stroke();
  // Live dot
  const lv=scrollHistory[scrollHistory.length-1];const lx=W-pad,ly=pad+plotH-(lv/100)*plotH;
  const p=0.5+0.5*Math.sin(wt*0.1);
  wCtx.beginPath();wCtx.arc(lx,ly,6+p*3,0,Math.PI*2);wCtx.fillStyle=`rgba(159,174,0,${0.08+p*0.08})`;wCtx.fill();
  wCtx.beginPath();wCtx.arc(lx,ly,3.5,0,Math.PI*2);wCtx.fillStyle='#9fae00';wCtx.fill();
  wt++;requestAnimationFrame(drawWave);
}

window.addEventListener('load',()=>{resizeWave();drawWave();});
window.addEventListener('resize',()=>resizeWave());

/* ═══════════════════════════════════════
   ADVENTURE SCROLL LAYER
   ═══════════════════════════════════════ */
(function(){
  const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* 1) Hero H1 letter-split */
  const h1 = document.getElementById('hero-h1');
  if (h1 && !reduce) {
    h1.querySelectorAll('span').forEach(span => {
      const txt = span.textContent;
      span.textContent = '';
      [...txt].forEach((ch,i) => {
        const s = document.createElement('span');
        s.className = 'letter';
        s.textContent = ch === ' ' ? '\u00A0' : ch;
        s.style.transitionDelay = (0.3 + i*0.035) + 's';
        span.appendChild(s);
      });
    });
    requestAnimationFrame(()=>h1.classList.add('ready'));
  } else if (h1) {
    h1.classList.add('ready');
  }

  /* 2) Quote word-split + reveal */
  const bq = document.querySelector('#quote-band blockquote');
  if (bq) {
    const html = bq.innerHTML;
    // Split only text nodes into words, preserving <em>
    const wrap = (html) => html.replace(/(<em[^>]*>[^<]*<\/em>|[^\s<]+)/g, (m) =>
      m.startsWith('<em') ? `<span class="word"><em>${m.replace(/<\/?em[^>]*>/g,'')}</em></span>` :
      `<span class="word">${m}</span>`);
    bq.innerHTML = wrap(html);
  }

  /* 4) Ambient canvas — drifting grid + dots, scroll-reactive */
  const amb = document.getElementById('ambient');
  if (amb && !reduce) {
    const ctx = amb.getContext('2d');
    let W, H, DPR = Math.min(devicePixelRatio||1, 2);
    const dots = [];
    function resize() {
      W = amb.width = innerWidth*DPR;
      H = amb.height = innerHeight*DPR;
      amb.style.width = innerWidth+'px';
      amb.style.height = innerHeight+'px';
    }
    resize(); addEventListener('resize', resize);
    // Seed dots
    for (let i=0;i<40;i++) dots.push({
      x: Math.random(), y: Math.random(),
      r: 0.5 + Math.random()*1.6,
      vx: (Math.random()-0.5)*0.0004,
      vy: (Math.random()-0.5)*0.0004,
    });
    let scrollY = 0;
    addEventListener('scroll', () => { scrollY = window.scrollY; }, {passive:true});
    function frame(t) {
      ctx.clearRect(0,0,W,H);
      // Grid
      const gridSize = 60 * DPR;
      const offset = (scrollY * 0.25) % gridSize;
      ctx.strokeStyle = 'rgba(196,214,0,0.09)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = -gridSize + offset; x < W; x += gridSize) {
        ctx.moveTo(x, 0); ctx.lineTo(x, H);
      }
      for (let y = -gridSize - offset; y < H; y += gridSize) {
        ctx.moveTo(0, y); ctx.lineTo(W, y);
      }
      ctx.stroke();
      // Dots
      dots.forEach(d => {
        d.x += d.vx; d.y += d.vy;
        if (d.x<0||d.x>1) d.vx *= -1;
        if (d.y<0||d.y>1) d.vy *= -1;
        const px = d.x*W;
        const py = (d.y*H + scrollY*0.1*DPR) % H;
        ctx.beginPath();
        ctx.arc(px, py, d.r*DPR, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(196,214,0,0.35)';
        ctx.fill();
      });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* 5) Parallax for floating shapes */
  const parallaxEls = document.querySelectorAll('[data-parallax]');
  let scrollTicking = false, lastScroll = 0;
  function onScroll() {
    lastScroll = window.scrollY;
    if (!scrollTicking) {
      requestAnimationFrame(()=>{
        parallaxEls.forEach(el => {
          const speed = parseFloat(el.dataset.parallax);
          el.style.transform = `translate3d(0, ${lastScroll * speed}px, 0)`;
        });
        scrollTicking = false;
      });
      scrollTicking = true;
    }
  }
  addEventListener('scroll', onScroll, {passive:true});

  /* 6) Section reveal observer */
  const sectionIO = new IntersectionObserver((entries)=>{
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in-view'); });
  }, {threshold: 0.15});
  document.querySelectorAll('#stats, #capabilities, #ai-consulting, #how-i-work, #intelligence, #expertise, #contact').forEach(s => sectionIO.observe(s));

  /* 7) Cards stagger on entry */
  const staggerIO = new IntersectionObserver((entries)=>{
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.querySelectorAll('.cap-card').forEach((c,i)=>setTimeout(()=>c.classList.add('in'), i*90));
      e.target.querySelectorAll('.step-item').forEach((c,i)=>setTimeout(()=>c.classList.add('in'), i*130));
      e.target.querySelectorAll('.terminal, .skill-panel').forEach((c,i)=>setTimeout(()=>c.classList.add('in'), i*200));
      staggerIO.unobserve(e.target);
    });
  }, {threshold: 0.1});
  document.querySelectorAll('#capabilities, #how-i-work, #expertise').forEach(s => staggerIO.observe(s));

  /* 8) AI visual — mark live when in view */
  const aiIO = new IntersectionObserver((entries)=>{
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('live');
        aiIO.unobserve(e.target);
      }
    });
  }, {threshold: 0.3});
  document.querySelectorAll('.ai-visual').forEach(el => aiIO.observe(el));

  /* 9) Quote word-by-word reveal as it scrolls into view */
  const quoteIO = new IntersectionObserver((entries)=>{
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const words = e.target.querySelectorAll('.word');
      words.forEach((w,i)=>setTimeout(()=>w.classList.add('on'), i*55));
      quoteIO.unobserve(e.target);
    });
  }, {threshold: 0.3});
  document.querySelectorAll('#quote-band blockquote').forEach(el => quoteIO.observe(el));

  /* 10) Process rail fill + step active dot */
  const processSec = document.getElementById('how-i-work');
  const stepsList = document.querySelector('.steps-list');
  function updateRail() {
    if (!stepsList) return;
    const rect = stepsList.getBoundingClientRect();
    const vh = innerHeight;
    const start = rect.top;
    const end = rect.bottom;
    const height = rect.height;
    // Fill progresses as user scrolls through the steps list
    const progress = Math.max(0, Math.min(1, (vh*0.55 - start) / height));
    stepsList.style.setProperty('--rail', (progress*100) + '%');
  }
  addEventListener('scroll', updateRail, {passive:true});
  updateRail();

  /* 11) Number counters — intelligence dashboard impact + stats */
  function animateCount(el, target, opts={}) {
    const dur = opts.duration || 1600;
    const prefix = opts.prefix || '';
    const suffix = opts.suffix || '';
    const start = performance.now();
    function tick(t) {
      const p = Math.min(1, (t - start)/dur);
      const eased = 1 - Math.pow(1-p, 3);
      const val = Math.round(target * eased);
      el.textContent = prefix + val + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  const impactIO = new IntersectionObserver((entries)=>{
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.querySelectorAll('.dash-impact-num').forEach(n => {
        const txt = n.textContent.trim();
        const match = txt.match(/^(\d+)(.*)$/);
        if (match) {
          const tgt = parseInt(match[1]);
          const suf = match[2];
          n.textContent = '0' + suf;
          animateCount(n, tgt, {suffix: suf, duration: 1400});
        }
      });
      impactIO.unobserve(e.target);
    });
  }, {threshold: 0.3});
  document.querySelectorAll('.dash-impact').forEach(el => impactIO.observe(el));

  /* 12) Chapter index (right rail) + scroll ring */
  const chapters = document.getElementById('chapters');
  const ring = document.getElementById('scroll-ring');
  const ringBar = ring?.querySelector('.bar');
  const ringCirc = 2 * Math.PI * 22;
  const darkSections = new Set(['ai-consulting']);
  function updateChrome() {
    const sy = window.scrollY;
    const vh = innerHeight;
    const dh = document.documentElement.scrollHeight - vh;
    const p = dh > 0 ? sy/dh : 0;
    // Ring
    if (ring && ringBar) {
      if (sy > 400) ring.classList.add('on'); else ring.classList.remove('on');
      ringBar.style.strokeDasharray = ringCirc;
      ringBar.style.strokeDashoffset = ringCirc * (1 - p);
    }
    // Chapters
    if (chapters) {
      if (sy > 300) chapters.classList.add('on'); else chapters.classList.remove('on');
      let activeId = 'hero';
      let activeIsDark = false;
      chapters.querySelectorAll('.tick').forEach(t => {
        const id = t.dataset.target;
        const el = document.getElementById(id);
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.top < vh*0.4 && r.bottom > vh*0.4) {
          activeId = id;
          if (darkSections.has(id)) activeIsDark = true;
        }
      });
      chapters.querySelectorAll('.tick').forEach(t => {
        t.classList.toggle('active', t.dataset.target === activeId);
      });
      chapters.classList.toggle('dark', activeIsDark);
    }
  }
  addEventListener('scroll', updateChrome, {passive:true});
  updateChrome();

  /* 13) Scroll velocity — skew marquee */
  let prevSy = scrollY, vel = 0, smoothed = 0;
  function velTick() {
    const cur = window.scrollY;
    vel = cur - prevSy;
    prevSy = cur;
    smoothed += (vel - smoothed) * 0.18;
    const skew = Math.max(-8, Math.min(8, smoothed * 0.3));
    document.querySelectorAll('.marquee-track').forEach(m => {
      m.style.filter = `skewX(${skew*0.5}deg)`;
    });
    requestAnimationFrame(velTick);
  }
  if (!reduce) requestAnimationFrame(velTick);

  /* 14) Stats — make numbers count up when in view */
  const statsIO = new IntersectionObserver((entries)=>{
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const firstStat = e.target.querySelector('.stat-item:first-child .stat-number');
      if (firstStat && firstStat.dataset.done !== '1') {
        firstStat.dataset.done = '1';
        firstStat.textContent = '0×';
        animateCount(firstStat, 10, {suffix:'×', duration: 1400});
      }
      statsIO.unobserve(e.target);
    });
  }, {threshold: 0.4});
  document.querySelectorAll('#stats').forEach(el => statsIO.observe(el));

  /* 15) Capabilities header + AI consulting header mouse-tilt */
  // Removed (kept animation budget focused) — cap-card hover handled by CSS

  /* 16) Contact form reveal */
  const form = document.querySelector('.contact-form');
  if (form) {
    [...form.children].forEach((ch,i)=>ch.style.setProperty('--i', i));
    const fIO = new IntersectionObserver((entries)=>{
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); fIO.unobserve(e.target); }
      });
    }, {threshold: 0.25});
    fIO.observe(form);
  }

})();
