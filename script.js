(function () {
  const byId = (id) => document.getElementById(id);

  function readChannelsSafe() {
    try { if (Array.isArray(CHANNELS)) return CHANNELS; } catch {}
    for (const key of ['CHANNELS','channels','CANAIS','canais']) {
      try { if (Array.isArray(globalThis[key])) return globalThis[key]; } catch {}
      try { if (Array.isArray(window[key])) return window[key]; } catch {}
    }
    try {
      const ov = localStorage.getItem('CHANNELS_OVERRIDE');
      if (ov) { const arr = JSON.parse(ov); if (Array.isArray(arr)) return arr; }
    } catch {}
    return [];
  }

  let RAW_CHANNELS = readChannelsSafe();
  let selectedIndex = 0;
  let activeCategory = 'ALL';
  let sportsHandle = null;

  const TAB_TO_CATEGORY = {
    'TODOS OS CANAIS': 'ALL',
    'JOGOS AO VIVO': 'LIVE_GAMES',
    'ABERTOS': 'Abertos',
    'ESPORTES': 'Esportes',
    'VARIEDADES': 'Variedades',
    'KIDS': 'Kids',
    'DESTAQUES': 'Destaque'
  };

  const normalize = (s) =>
    (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

  function getVisibleChannels() {
    if (activeCategory === 'ALL') return RAW_CHANNELS;
    if (activeCategory === 'LIVE_GAMES') return [];
    return RAW_CHANNELS.filter(ch => normalize(ch.category) === normalize(activeCategory));
  }

  // Play Shield
  const PLAY_GATE_KEY = 'playGateDone';
  function showPlayShield(){ const el=byId('playShield'); if(el) el.style.display='flex'; }
  function hidePlayShield(){ const el=byId('playShield'); if(el) el.style.display='none'; }
  function initPlayShield(){
    const shield = byId('playShield');
    const btn = byId('playBtn');
    const used = localStorage.getItem(PLAY_GATE_KEY) === '1';
    if(!shield) return;
    if(used){ hidePlayShield(); return; }
    const accept = () => { localStorage.setItem(PLAY_GATE_KEY,'1'); hidePlayShield(); };
    shield.addEventListener('click', accept);
    if(btn) btn.addEventListener('click', (e)=>{ e.stopPropagation(); accept(); });
  }

  // Player helpers (para sports.js)
  function normalizeEmbedUrl(url) {
    if (!url) return url;
    try {
      const u = new URL(url, location.href);
      if (u.hostname.includes('youtube.com')) { const v=u.searchParams.get('v'); if (v) return `https://www.youtube.com/embed/${v}`; }
      if (u.hostname === 'youtu.be') return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
      return u.toString();
    } catch { return url; }
  }
  function setPlayerSource(rawUrl, fallbackHrefIfNoUrl) {
    const iframe = byId('player');
    const notice = byId('playerNotice');
    const open = byId('playerOpen');
    const url = normalizeEmbedUrl(rawUrl);

    const show = (msg, href, label='Abrir em nova aba ↗') => {
      if (notice) { notice.textContent = msg; notice.style.display = ''; }
      if (open)   { if (href) { open.href = href; open.textContent = label; open.style.display = ''; } else { open.style.display = 'none'; } }
    };
    const hide = () => { if (notice) notice.style.display = 'none'; if (open) open.style.display = 'none'; };
    hide();

    if (!url) { if (iframe) iframe.src='about:blank'; show('Fonte indisponível para este evento.', fallbackHrefIfNoUrl || null, 'Abrir detalhes do evento (JSON) ↗'); return; }
    if (location.protocol==='https:' && url.startsWith('http:')) { if (iframe) iframe.src='about:blank'; show('Conteúdo HTTP bloqueado (misto).', url); return; }

    if (iframe) iframe.src = url;
    let ok=false; const onLoad=()=>{ok=true; iframe&&iframe.removeEventListener('load',onLoad);};
    iframe&&iframe.addEventListener('load',onLoad,{once:true});
    setTimeout(()=>{ if(!ok) show('Este provedor não permite incorporação.', url); },3000);
  }
  window.FulltvPlayer = { setPlayerSource, showPlayShield, els:{ infoTitle:()=>byId('infoTitle'), infoSubtitle:()=>byId('infoSubtitle') } };

  // Lista de canais
  function renderList() {
    const listEl = byId('channelList');
    const tabsHost = byId('sportsTabsHost');
    if (!listEl) return;
    listEl.innerHTML = '';
    if (tabsHost) tabsHost.style.display = 'none';

    if (!RAW_CHANNELS || RAW_CHANNELS.length === 0) RAW_CHANNELS = readChannelsSafe();

    const visible = getVisibleChannels();
    if (!visible.length) {
      const empty = document.createElement('div');
      empty.textContent = 'Nenhum canal nesta categoria.';
      empty.style.opacity = '.8';
      listEl.appendChild(empty);
      return;
    }

    visible.forEach((ch, idx) => {
      const btn = document.createElement('button');
      btn.className = 'channel-item';
      if (idx === selectedIndex) btn.classList.add('active');

      const logoWrap = document.createElement('div');
      logoWrap.className = 'channel-logo';
      if (ch.logoUrl) {
        const img = document.createElement('img'); img.src = ch.logoUrl; img.alt = ch.name || 'Canal'; img.loading='lazy';
        logoWrap.appendChild(img);
      } else {
        const fallback = document.createElement('div'); fallback.textContent = (ch.name||'?').charAt(0).toUpperCase(); fallback.className = 'channel-logo-fallback';
        logoWrap.appendChild(fallback);
      }

      const textWrap = document.createElement('div'); textWrap.className = 'channel-texts';
      const titleRow = document.createElement('div'); titleRow.className = 'channel-title-row';

      const num = document.createElement('span'); num.className = 'channel-number'; num.textContent = ch.number != null ? ch.number : '—';
      const name = document.createElement('span'); name.className = 'channel-name'; name.textContent = ch.name || 'Sem nome';
      const badge = document.createElement('span'); badge.className = 'channel-badge'; badge.textContent = ch.quality || '';

      titleRow.append(num, name, badge);

      const cat = document.createElement('div'); cat.className = 'channel-category'; cat.textContent = ch.category || '';
      textWrap.append(titleRow, cat);

      btn.append(logoWrap, textWrap);
      if (ch.live) { const live = document.createElement('span'); live.className='channel-live'; live.textContent='AO VIVO'; btn.appendChild(live); }
      btn.addEventListener('click', () => selectChannel(idx));

      listEl.appendChild(btn);
    });
  }

  function selectChannel(idx) {
    const visible = getVisibleChannels(); if (!visible.length) return;
    selectedIndex = Math.max(0, Math.min(idx, visible.length-1));
    const ch = visible[selectedIndex];

    setPlayerSource(ch.streamUrl || '', null);
    const t = byId('infoTitle'); const s = byId('infoSubtitle');
    if (t) t.textContent = ch.name || '—'; if (s) s.textContent = ch.category || '—';
    if (localStorage.getItem('playGateDone') !== '1') showPlayShield();
    renderList();
  }

  // Abas
  function setActiveTabUI(activeBtn) {
    const btns = Array.from(document.querySelectorAll('header nav.menu button'));
    btns.forEach(b => b.classList.toggle('active', b === activeBtn));
  }

  async function switchToSports(btn) {
    if (sportsHandle && sportsHandle.destroy) { sportsHandle.destroy(); sportsHandle = null; }
    setActiveTabUI(btn);
    const mod = await import('./sports.js?v=15');
    sportsHandle = mod.mount({
      tabsHost: byId('sportsTabsHost'),
      listEl: byId('channelList'),
      apiBase: window.SPORTS_API_BASE || 'https://api.reidoscanais.io',
      onPlay: (title, category, url, detailHref) => {
        window.FulltvPlayer.setPlayerSource(url, detailHref);
        const t = byId('infoTitle'); const s = byId('infoSubtitle');
        if (t) t.textContent = title || '—'; if (s) s.textContent = category || '—';
        if (localStorage.getItem('playGateDone') !== '1') showPlayShield();
      }
    });
  }

  function initTabs() {
    const btns = Array.from(document.querySelectorAll('header nav.menu button'));
    if (!btns.length) return;

    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault?.();
        const key = (btn.dataset.tab || btn.textContent || '').trim().toUpperCase();
        const mapped = TAB_TO_CATEGORY[key] || 'ALL';

        if (mapped === 'LIVE_GAMES') { switchToSports(btn); return; }

        if (sportsHandle && sportsHandle.destroy) { sportsHandle.destroy(); sportsHandle = null; }
        byId('channelList').innerHTML = '';
        const tabsHost = byId('sportsTabsHost'); if (tabsHost) tabsHost.style.display='none';

        activeCategory = mapped;
        setActiveTabUI(btn);

        RAW_CHANNELS = readChannelsSafe();
        const prev = getVisibleChannels()[selectedIndex];
        const nowList = getVisibleChannels();
        const keepIdx = prev ? nowList.findIndex(c => c.id === prev.id) : -1;
        selectedIndex = keepIdx >= 0 ? keepIdx : 0;

        renderList();
        if (getVisibleChannels().length) selectChannel(selectedIndex);
      });
    });

    const initial = btns.find(b => (b.dataset.tab || b.textContent || '').trim().toUpperCase() === 'TODOS OS CANAIS') || btns[0];
    if (initial) initial.click();
  }

  // Teclado
  function initKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (sportsHandle) return;
      const visible = getVisibleChannels(); if (!visible.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); selectChannel(selectedIndex + 1); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); selectChannel(selectedIndex - 1); }
    });
  }

  // Relógio / FS / Shield
  function initClock() {
    const el = byId('clock'); if (!el) return;
    const tick = () => { el.textContent = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}); };
    tick(); setInterval(tick, 1000);
  }
  function initFullscreen() {
    const btn = byId('btnFullscreen'); const container = byId('playerContainer'); const infoBar = byId('infoBar');
    if (!btn || !container) return;
    function updateInfoBarVisibility() { const isFS = !!document.fullscreenElement; if (infoBar) infoBar.style.display = isFS ? 'none' : ''; }
    btn.addEventListener('click', async () => { if (document.fullscreenElement) await document.exitFullscreen(); else { updateInfoBarVisibility(); await container.requestFullscreen?.(); } });
    document.addEventListener('fullscreenchange', updateInfoBarVisibility);
  }

  function init() {
    initTabs();
    renderList();
    if (getVisibleChannels().length) selectChannel(0);
    initKeyboard();
    initClock();
    initFullscreen();
    initPlayShield();
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
