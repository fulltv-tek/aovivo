// sports.js (ESM) — módulo carregado apenas na aba "⚽ Jogos ao vivo"
export function mount({ tabsHost, listEl, apiBase, onPlay }) {
  if (!listEl) throw new Error('listEl não encontrado');

  let currentTab = 'LIVE';
  let timer = null;
  let cache = { items: [], ts: 0 };

  // Abinhas internas
  if (tabsHost) {
    tabsHost.style.display = '';
    tabsHost.innerHTML = '';
    const tabs = document.createElement('div'); tabs.className = 'sports-tabs';
    const make = (id, label) => {
      const b = document.createElement('button');
      b.className = 'sports-tab'; b.dataset.id = id; b.textContent = label;
      if (id === currentTab) b.classList.add('active');
      b.addEventListener('click', () => { currentTab = id; for (const x of tabs.querySelectorAll('.sports-tab')) x.classList.toggle('active', x===b); render(); });
      return b;
    };
    tabs.append(make('LIVE', 'AO VIVO'), make('UPCOMING','EM BREVE'), make('ALL','TODOS'));
    tabsHost.appendChild(tabs);
  }

  const endpoints = [
    `${apiBase}/sports?status=live`,
    `${apiBase}/sports?status=upcoming`,
    `${apiBase}/sports`
  ];

  function pickFirstEmbedUrl(ev) {
    if (Array.isArray(ev.embeds) && ev.embeds.length) {
      for (const it of ev.embeds) {
        if (typeof it === 'string') return it;
        if (it && typeof it.embed_url === 'string') return it.embed_url;
        if (it && typeof it.url === 'string') return it.url;
      }
    }
    return null;
  }

  function firstUrlFrom(obj) {
    const urls = []; const seen = new Set();
    const push = v => { if (typeof v === 'string' && /^https?:\/\//i.test(v)) urls.push(v); };
    const walk = (val, depth=0) => {
      if (!val || depth>8) return;
      if (typeof val === 'string') { push(val); return; }
      if (typeof val !== 'object') return;
      if (seen.has(val)) return; seen.add(val);
      if (Array.isArray(val)) { for (const v of val) walk(v, depth+1); return; }
      for (const k of ['streamUrl','player','embed','iframe','watch','url','link','play','hls','m3u8','file','src']) if (k in val) walk(val[k], depth+1);
      for (const k of ['players','links','streams','sources','playlist','manifests','videos','embeds']) if (k in val) walk(val[k], depth+1);
      for (const k in val) walk(val[k], depth+1);
    };
    walk(obj,0);
    return urls[0] || '';
  }

  function normalize(ev) {
    const status = String(ev.status || (ev.live?'live':'') || (ev.is_live?'live':'' )).toLowerCase();
    const first = pickFirstEmbedUrl(ev);
    const stream =
      first ||
      ev.streamUrl || ev.player || ev.embed || ev.iframe || ev.url || ev.link || ev.watch ||
      (Array.isArray(ev.players) && (ev.players[0]?.url || ev.players[0])) ||
      (Array.isArray(ev.links)   && (ev.links[0]?.url || ev.links[0]?.href)) ||
      (Array.isArray(ev.streams) && (ev.streams[0]?.file || ev.streams[0]?.url || ev.streams[0]?.src)) ||
      (Array.isArray(ev.sources) && (ev.sources[0]?.file || ev.sources[0]?.src || ev.sources[0]?.url)) ||
      firstUrlFrom(ev);

    // data/hora
    let start = ev.start ?? ev.start_time ?? ev.date ?? ev.time ?? ev.kickoff ?? ev.startAt ?? ev.start_at ?? ev.begin;
    if (ev?.time?.start) start = ev.time.start;
    let startMs = null;
    if (typeof start === 'number') startMs = start > 2_000_000_000 ? start : start * 1000;
    else if (typeof start === 'string') {
      const n = Number(start);
      if (!Number.isNaN(n) && n > 0) startMs = n > 2_000_000_000 ? n : n * 1000;
      else { const d = new Date(start.replace(' ', 'T')); if (!isNaN(d)) startMs = d.getTime(); }
    }

    return {
      id: ev.id ?? ev.slug ?? ev._id ?? (ev.title || ev.name),
      title: ev.title ?? ev.name ?? `${ev.homeTeam?.name || ev.home || '?'} x ${ev.awayTeam?.name || ev.away || '?'}`,
      category: ev.category ?? ev.sport ?? ev.league ?? ev.competition ?? 'Esporte',
      poster: ev.poster || ev.image || ev.thumbnail || ev.thumb || null,
      status,
      start: startMs,
      url: stream
    };
  }

  async function fetchAll() {
    const now = Date.now();
    if (now - cache.ts < 60_000 && cache.items.length) return cache.items;
    let all = [];
    for (const u of endpoints) {
      try {
        const r = await fetch(u, { cache: 'no-store' });
        if (!r.ok) continue;
        const j = await r.json();
        const arr = Array.isArray(j) ? j : (Array.isArray(j?.data) ? j.data : []);
        all = all.concat(arr.map(normalize));
      } catch {}
    }
    const filtered = all.filter(ev => {
      const s = ev.status;
      const isEnded = s.includes('end') || ['finished','concluded','ended','finalizado','encerrado'].includes(s);
      if (currentTab !== 'ALL' && isEnded) return false;
      if (currentTab !== 'ALL' && ev.start && ev.start < Date.now() && !s.includes('live')) return false;
      return true;
    });
    const seen = new Set(); const uniq = [];
    for (const ev of filtered) { const k = ev.id || ev.title; if (!seen.has(k)) { seen.add(k); uniq.push(ev); } }
    cache = { items: uniq, ts: now };
    return uniq;
  }

  function formatDate(ts) { try { return ts ? new Date(ts).toLocaleString() : ''; } catch { return ''; } }
  function statusBadge(ev) {
    const live = ev.status.includes('live');
    const el = document.createElement('span');
    el.className = `badge-dot ${live? 'badge-live':'badge-up'}`;
    el.textContent = live ? 'AO VIVO' : 'PRÓXIMO';
    return el;
  }

  async function render() {
    if (!listEl) return;
    listEl.innerHTML = '';
    const data = await fetchAll();

    const filtered = data.filter(ev => {
      if (currentTab === 'LIVE') return ev.status.includes('live');
      if (currentTab === 'UPCOMING') return !ev.status.includes('live');
      return true;
    });

    if (!filtered.length) {
      const vazio = document.createElement('div'); vazio.textContent = 'Nenhum evento nesta aba.'; vazio.style.opacity = '.8'; listEl.appendChild(vazio);
      return;
    }

    for (const ev of filtered) {
      const item = document.createElement('button'); item.className = 'event-card';

      const thumb = document.createElement('div'); thumb.className = 'event-thumb';
      if (ev.poster) { const img = document.createElement('img'); img.src = ev.poster; img.alt = ev.title; img.loading='lazy'; thumb.appendChild(img); }
      else { thumb.textContent = ev.title.charAt(0).toUpperCase(); }
      item.appendChild(thumb);

      const meta = document.createElement('div'); meta.className = 'event-meta';
      const t = document.createElement('div'); t.className = 'event-title'; t.textContent = ev.title;
      const sub = document.createElement('div'); sub.className = 'event-sub'; sub.textContent = [ev.category, formatDate(ev.start)].filter(Boolean).join(' • ');
      const row = document.createElement('div'); row.style.display='flex'; row.style.alignItems='center';
      row.appendChild(t); row.appendChild(statusBadge(ev));
      meta.appendChild(row); meta.appendChild(sub);
      item.appendChild(meta);

      item.addEventListener('click', () => onPlay(ev.title, ev.category, ev.url || '', `${apiBase}/sports/${encodeURIComponent(ev.id)}`));
      listEl.appendChild(item);
    }
  }

  render();
  timer = setInterval(() => { render(); }, 60_000);

  return {
    destroy() { if (timer) clearInterval(timer); timer = null; if (tabsHost) tabsHost.style.display='none'; if (listEl) listEl.innerHTML=''; }
  };
}
