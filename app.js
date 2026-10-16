/* ten-ten UI. Plain DOM, no framework.
   Screens: login -> loading -> main. Modals: google, guide, profile, map. */
(function () {
  'use strict';

  const app = document.getElementById('app');
  const modalRoot = document.getElementById('modals');
  const toastRoot = document.getElementById('toast');

  /* ---------- tiny helpers ---------- */

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const ICONS = {
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M8 16H3v5"/>',
    map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15"/><path d="M15 6v15"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  };
  const icon = (name, size = 18) =>
    `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

  const GOOGLE_G = (size = 20) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>`;

  const fmtClock = (d) =>
    d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const fmtHM = (d) => d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  const peso = (n) => `₱${Number(n).toFixed(2)}`;

  const LINE_IDS = ['lrt2', 'lrt1', 'mrt3'];

  /* ---------- state ---------- */

  const S = {
    screen: 'login', // 'login' | 'loading' | 'main'
    user: getStoredUser(),
    pendingUser: null,
    lineId: 'lrt2',
    station: null,
    dest: null,
    time: new Date(),
    lastMinute: new Date().getMinutes(),
    arrivals: [],
    refreshing: false,
    mode: 'origin', // which station the list is editing
    loginTrack: 'all',
    modals: { map: false, guide: false, google: false, profile: false },
    fresh: null, // modal that just opened (gets the pop-in)
    focusSel: null,
    intro: false,
    g: { other: false, email: '', authorizing: false, context: 'login' },
    p: { beep: '', editingBeep: false, label: '', showAdd: false, confirmLogout: false, notice: false },
  };

  const activeLine = () => TRANSIT_LINES[S.lineId] || TRANSIT_LINES.lrt2;

  function setLineDefaults(lineId) {
    S.lineId = lineId;
    const l = TRANSIT_LINES[lineId];
    if (lineId === 'lrt2') {
      S.station = l.stations[7]; // Cubao
      S.dest = l.stations[12]; // Antipolo
    } else if (lineId === 'lrt1') {
      S.station = l.stations[9]; // Doroteo Jose
      S.dest = l.stations[18]; // EDSA
    } else {
      S.station = l.stations[3]; // Araneta Center-Cubao
      S.dest = l.stations[10]; // Ayala
    }
  }
  setLineDefaults('lrt2');

  function tripDirection() {
    const forward = S.dest.position > S.station.position;
    if (S.lineId === 'lrt2') return forward ? 'Eastbound' : 'Westbound';
    return forward ? 'Southbound' : 'Northbound';
  }

  function computeArrivals() {
    const dir = tripDirection();
    S.arrivals = getArrivals(S.lineId, S.station.id, S.time).filter((a) => a.direction === dir);
  }

  function tripStats() {
    const line = activeLine();
    const stops = Math.abs(S.dest.position - S.station.position);
    const mins = Math.abs(line.travelTimes[S.dest.position] - line.travelTimes[S.station.position]);
    const fare = calculateFare(stops, S.user ? S.user.commuterType : 'regular');
    return { stops, mins, fare };
  }

  /* ---------- toast ---------- */

  let toastTimer;
  function toast(msg) {
    clearTimeout(toastTimer);
    toastRoot.innerHTML = `<div class="toast"><span class="toast-check">${icon('check', 14)}</span><span>${esc(msg)}</span></div>`;
    toastTimer = setTimeout(() => {
      const t = toastRoot.firstElementChild;
      if (t) t.classList.add('out');
      toastTimer = setTimeout(() => (toastRoot.innerHTML = ''), 260);
    }, 2800);
  }

  /* ---------- shared bits ---------- */

  const brandHTML = (sub) => `
    <span class="brand-badge" aria-hidden="true">10</span>
    <span class="brand-text"><span class="brand-word">ten-ten</span>${sub ? `<span class="brand-sub">${esc(sub)}</span>` : ''}</span>`;

  /* =====================================================================
     SCREEN 1: LOGIN
     ===================================================================== */

  const TRACKS = {
    lrt2: { name: 'LRT-2 Purple', route: 'Antipolo, Cubao, Recto', label: 'LRT-2 to Antipolo', dur: 8, offset: 3, dir: 'r' },
    lrt1: { name: 'LRT-1 Green', route: 'Dr. Santos, EDSA, FPJ', label: 'LRT-1 Cavite Ext', dur: 9.5, offset: 6, dir: 'l' },
    mrt3: { name: 'MRT-3 Yellow & Blue', route: 'Taft Ave, Ayala, North Ave', label: 'MRT-3 4-car', dur: 7, offset: 1, dir: 'r' },
  };

  function tracksHTML() {
    return LINE_IDS.filter((id) => S.loginTrack === 'all' || S.loginTrack === id)
      .map((id) => {
        const t = TRACKS[id];
        return `
        <div class="track-row">
          <div class="track-label"><b class="tl-${id}">${esc(t.name)}</b><span>${esc(t.route)}</span></div>
          <div class="track">
            <div class="rail"></div>
            <div class="tr tr-${id} ${t.dir === 'l' ? 'tr-left' : ''}" style="--dur:${t.dur}s;--off:-${t.offset}s">
              <span class="tr-win"></span><span class="tr-win"></span>
              <b>${esc(t.label)}</b>
              <span class="tr-light"></span>
            </div>
          </div>
        </div>`;
      })
      .join('');
  }

  function loginTabsHTML() {
    return ['all', ...LINE_IDS]
      .map(
        (t) =>
          `<button class="pill-tab ${S.loginTrack === t ? 'on' : ''}" data-action="login-track" data-t="${t}">${
            t === 'all' ? 'All lines' : TRANSIT_LINES[t].code
          }</button>`
      )
      .join('');
  }

  function loginHTML() {
    return `
    <div class="login">
      <header class="login-top">
        <div class="brand">${brandHTML('Metro Manila rail, live')}</div>
        <div class="login-top-right">
          <span class="ops">LRTA, LRMC and DOTr MRT-3</span>
          <button class="link-btn" data-action="guest">Quick guest view</button>
        </div>
      </header>

      <main class="login-main">
        <section class="login-hero">
          <h1 class="mega">Sakay na.<br />Skip the guessing.</h1>
          <p class="lede">
            <b>ten-ten</b> shows when your train hits the platform, what time you'll actually get there, and
            which stations are about to close. LRT-1, LRT-2 and MRT-3, all in one place.
          </p>

          <div class="panel sim">
            <div class="sim-head">
              <h2>Live line sim</h2>
              <div class="pill-tabs" id="login-tabs">${loginTabsHTML()}</div>
            </div>
            <div class="tracks" id="tracks">${tracksHTML()}</div>
            <p class="sim-foot">A train every 4 to 5 minutes at peak.</p>
          </div>
        </section>

        <section class="panel signin pop-in">
          <h2>Sign in to ten-ten</h2>
          <p>Sync your saved routes, keep an eye on your Beep™ balance, and see your 20% concession fare.</p>

          <button class="btn btn-google" data-action="google-open-login">
            ${GOOGLE_G(22)}
            <span>Continue with Google</span>
            ${icon('arrow', 18)}
          </button>

          <div class="or"><span>or</span></div>

          <button class="btn btn-ink btn-block" data-action="guest">Hop in as a guest</button>

          <ul class="facts">
            <li><b>51 stations</b> across LRT-2 (13), LRT-1 (25) and MRT-3 (13)</li>
            <li><b>Early starts</b> from 4:30 AM, with nightly cut-offs shown live</li>
            <li><b>20% off</b> for students, seniors and PWDs</li>
          </ul>
        </section>
      </main>

      <footer class="login-foot">
        <span>ten-ten, Metro Manila rail timetable</span>
        <span>LRTA / LRMC / DOTr MRT-3</span>
      </footer>
    </div>`;
  }

  /* =====================================================================
     SCREEN 2: LOADING
     ===================================================================== */

  let loadingTimer;
  function loadingHTML() {
    const line = activeLine();
    return `
    <div class="loading">
      <div class="ld-top">
        <div class="brand">${brandHTML()}</div>
        <span class="chip chip-pop">${esc(line.name)}</span>
      </div>

      <div class="ld-mid">
        <div class="ld-scene" aria-hidden="true">
          <div class="ld-ties"></div>
          <div class="ld-rail"></div>
          <div class="ld-train">
            <div class="coach coach-sm c-lrt1"><i></i><i></i><b>LRT-1</b></div>
            <span class="couple"></span>
            <div class="coach coach-lg c-lrt2"><i></i><i></i><b>ten-ten</b><span class="coach-light"></span></div>
            <span class="couple"></span>
            <div class="coach coach-sm c-mrt3"><i></i><i></i><b>MRT-3</b></div>
          </div>
        </div>

        <h2 class="ld-title">Getting your board ready</h2>
        <p class="ld-step" id="ld-step"></p>

        <div class="ld-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="ld-bar">
          <div class="ld-fill" id="ld-fill"></div>
        </div>
        <div class="ld-meta"><span>Leaving the concourse</span><b id="ld-pct">0%</b><span>Live board ready</span></div>
      </div>

      <div class="ld-bot"><span>Train times based on LRTA and DOTr service hours</span><span>All 3 lines running</span></div>
    </div>`;
  }

  function startLoading() {
    const name = S.user ? S.user.name : null;
    const steps = [
      'Starting the Metro Manila rail feed',
      'Checking the LRT-1, LRT-2 and MRT-3 lines',
      'Syncing train gaps with LRTA and DOTr',
      name ? `Signing in ${name}` : 'Setting you up as a guest',
      "You're cleared to board. Train's almost here",
    ];
    const stepEl = document.getElementById('ld-step');
    const fillEl = document.getElementById('ld-fill');
    const pctEl = document.getElementById('ld-pct');
    const barEl = document.getElementById('ld-bar');

    const totalDuration = 1800;
    const tickMs = 30;
    const inc = 100 / (totalDuration / tickMs);
    let progress = 0;
    let lastStep = -1;

    clearInterval(loadingTimer);
    loadingTimer = setInterval(() => {
      progress += inc;
      if (progress >= 100) {
        progress = 100;
        clearInterval(loadingTimer);
        setTimeout(loadingComplete, 250);
      }
      const idx = Math.min(steps.length - 1, Math.floor((progress / 100) * steps.length));
      if (idx !== lastStep) {
        lastStep = idx;
        stepEl.textContent = steps[idx];
        stepEl.classList.remove('swap');
        void stepEl.offsetWidth;
        stepEl.classList.add('swap');
      }
      fillEl.style.width = `${progress}%`;
      pctEl.textContent = `${Math.round(progress)}%`;
      barEl.setAttribute('aria-valuenow', String(Math.round(progress)));
    }, tickMs);
  }

  /* =====================================================================
     SCREEN 3: MAIN BOARD
     ===================================================================== */

  const STATUS_UI = {
    'NORMAL OPERATIONS': { label: 'Running normally', cls: 'ok' },
    'CLOSING SOON': { label: 'Closing soon', cls: 'warn' },
    CLOSED: { label: 'Closed', cls: 'bad' },
  };

  function statusHTML() {
    const status = getStationStatus(S.lineId, S.station.id, S.time);
    const ui = STATUS_UI[status.status] || STATUS_UI['NORMAL OPERATIONS'];
    return `
      <span class="status-dot ${ui.cls}" aria-hidden="true"></span>
      <div>
        <b>${ui.label}</b>
        <p>${esc(status.message)}</p>
      </div>`;
  }

  function ribbonHTML() {
    const line = activeLine();
    const n = line.stations.length;
    const pct = (i) => (i / (n - 1)) * 100;
    const o = pct(S.station.position);
    const d = pct(S.dest.position);
    const lo = Math.min(o, d);
    const hi = Math.max(o, d);
    const align = (p) => (p < 18 ? 'al-start' : p > 82 ? 'al-end' : 'al-mid');
    const ride = Math.min(9, Math.max(3.5, Math.abs(d - o) / 9));

    const dots = line.stations
      .map((st, i) => {
        const p = pct(i);
        const inRange = p >= lo - 0.01 && p <= hi + 0.01;
        const kind = st.id === S.station.id ? 'is-origin' : st.id === S.dest.id ? 'is-dest' : inRange ? 'in-range' : '';
        return `<i class="rb-dot ${kind}" style="left:${p}%" title="${esc(st.name)}"></i>`;
      })
      .join('');

    return `
    <div class="ribbon" aria-hidden="true">
      <div class="rb-line"></div>
      <div class="rb-fill" style="left:${lo}%;width:${hi - lo}%"></div>
      ${dots}
      <span class="rb-flag rb-top ${align(o)}" style="left:${o}%">${esc(S.station.name)}</span>
      <span class="rb-flag rb-bottom ${align(d)}" style="left:${d}%">${esc(S.dest.name)}</span>
      <span class="rb-train ${d < o ? 'back' : ''}" style="--from:${o}%;--to:${d}%;--ride:${ride}s"><i></i><i></i></span>
    </div>`;
  }

  function arrivalsHTML() {
    if (!S.arrivals.length) {
      return `<div class="empty"><b>No trains this way right now.</b><p>This line may be outside its service hours. Check the first and last train times below.</p></div>`;
    }
    return S.arrivals
      .map((a, i) => {
        const eta = calculateTripETA(S.lineId, S.station.id, S.dest.id, a, S.time);
        const approaching = a.status === 'Approaching';
        const statCls = a.status === 'Delayed' ? 'bad' : approaching ? 'warn' : 'ok';
        const statLabel = a.status === 'On Time' ? 'On time' : a.status;
        return `
        <article class="arr ${i === 0 ? 'next' : ''}" style="--i:${i}">
          <div class="arr-main">
            ${i === 0 ? '<span class="sticker">Next up</span>' : ''}
            <h3>${approaching ? "Train's pulling in" : `To ${esc(a.destination)}`}</h3>
            <p class="arr-meta">
              <span>${esc(approaching ? `${a.direction} to ${a.destination}` : a.direction)}</span>
              <span>${a.cars || 4}-car set</span>
              <span class="stat ${statCls}">${statLabel}</span>
            </p>
          </div>
          <div class="arr-nums">
            <div class="num"><small>Wait</small><b class="big">${a.eta}<i>min</i></b></div>
            <div class="num"><small>You arrive at ${esc(S.dest.name)}</small><b class="big">${fmtHM(eta)}</b></div>
          </div>
        </article>`;
      })
      .join('');
  }

  function mainHTML() {
    const line = activeLine();
    const { stops, mins, fare } = tripStats();
    const dir = tripDirection();
    const hub = TRANSFER_HUBS.find(
      (h) =>
        (h.station1.line === S.lineId && h.station1.stationId === S.station.id) ||
        (h.station2.line === S.lineId && h.station2.stationId === S.station.id)
    );

    const lineTabs = LINE_IDS.map((id) => {
      const l = TRANSIT_LINES[id];
      const on = S.lineId === id;
      return `<button class="tab" role="tab" aria-selected="${on}" data-l="${id}" data-action="line" data-id="${id}" title="${esc(l.name)}">${esc(l.code)}</button>`;
    }).join('');

    const account = S.user
      ? `<button class="me" data-action="profile-open" title="Your profile">
           <span class="avatar">${esc(S.user.name.charAt(0).toUpperCase())}</span>
           <span class="me-text"><b>${esc(S.user.name)}</b><small>${esc(S.user.email)}</small></span>
         </button>
         <button class="icon-btn" data-action="logout" title="Sign out of Google" aria-label="Sign out of Google">${icon('logout', 18)}</button>`
      : `<button class="btn btn-ink btn-sm" data-action="google-open-main">Sign in with Google</button>`;

    const presets =
      S.user && S.user.savedRoutes.length > 0
        ? `<section class="panel presets">
             <div class="row-between"><h2>Saved routes</h2><button class="link-btn" data-action="profile-open">Edit</button></div>
             <div class="preset-list">
               ${S.user.savedRoutes
                 .slice(0, 2)
                 .map(
                   (r) =>
                     `<button class="preset" data-action="preset" data-id="${esc(r.id)}"><span>${esc(r.label)}</span>${icon('arrow', 15)}</button>`
                 )
                 .join('')}
             </div>
           </section>`
        : '';

    const stationItems = line.stations
      .map((st) => {
        const isOrigin = S.station.id === st.id;
        const isDest = S.dest.id === st.id;
        const isActive = S.mode === 'origin' ? isOrigin : isDest;
        const isLocked = S.mode === 'origin' ? isDest : isOrigin;
        return `<button class="st ${isActive ? 'is-active' : ''} ${isLocked ? 'is-locked' : ''}" data-action="pick" data-id="${st.id}" ${isLocked ? 'disabled' : ''}>
          <span class="st-name">${esc(st.name)}</span>
          <span class="st-tag">${isOrigin ? 'Boarding' : isDest ? 'Getting off' : st.position + 1}</span>
        </button>`;
      })
      .join('');

    return `
    <div class="shell ${S.intro ? 'intro' : ''}">
      <header class="topbar panel">
        <button class="brand brand-btn" data-action="home" title="Back to the ten-ten home page">${brandHTML('Rail telemetry')}</button>
        <div class="tabs" role="tablist" aria-label="Choose a line">${lineTabs}</div>
        <div class="top-actions">
          <button class="link-btn with-ic" data-action="guide">${icon('help', 16)}<span>Guide</span></button>
          ${account}
        </div>
      </header>

      <div class="grid">
        <aside class="side">
          <section class="panel line-card">
            <span class="code-badge">${esc(line.code)}</span>
            <h2>${esc(line.name)}</h2>
            <p>Schedule follows ${esc(line.operator)} service hours.</p>
          </section>

          <section class="panel status" id="status-card">${statusHTML()}</section>

          ${presets}

          <section class="panel picker">
            <div class="row-between">
              <h2>Pick your stops</h2>
              <div class="seg" role="tablist" aria-label="Which stop are you choosing?">
                <button class="seg-btn ${S.mode === 'origin' ? 'on' : ''}" role="tab" aria-selected="${S.mode === 'origin'}" data-action="mode" data-m="origin">From</button>
                <button class="seg-btn ${S.mode === 'destination' ? 'on' : ''}" role="tab" aria-selected="${S.mode === 'destination'}" data-action="mode" data-m="destination">To</button>
              </div>
            </div>
            <p class="hint">${
              S.mode === 'origin'
                ? `Boarding at <b>${esc(S.station.name)}</b>. Tap another station to change it.`
                : `Getting off at <b>${esc(S.dest.name)}</b>. Tap another station to change it.`
            }</p>
            <div class="st-list" id="station-list">${stationItems}</div>
          </section>

          <div class="side-actions">
            <button class="btn btn-primary btn-block" data-action="refresh">
              <span class="${S.refreshing ? 'spin' : ''}" id="refresh-ic">${icon('refresh', 17)}</span>
              <span>Refresh times</span>
            </button>
            <button class="btn btn-block" data-action="map-open">${icon('map', 17)}<span>See route map</span></button>
          </div>
        </aside>

        <main class="board">
          <section class="panel hero">
            <div class="hero-top">
              <h1 class="route">
                <span class="r-from">${esc(S.station.name)}</span>
                <span class="r-arrow">${icon('arrow', 34)}</span>
                <span class="r-to">${esc(S.dest.name)}</span>
              </h1>
              <div class="clock"><span class="live-dot" aria-hidden="true"></span><b id="clock">${fmtClock(S.time)}</b></div>
            </div>

            ${ribbonHTML()}

            <div class="chips">
              <span class="chip">${stops} ${stops === 1 ? 'stop' : 'stops'}</span>
              <span class="chip">~${mins} min ride</span>
              <span class="chip chip-pop">Fare ${peso(fare.discounted)}</span>
              ${fare.hasDiscount ? '<span class="chip chip-ok">20% concession applied</span>' : ''}
            </div>
          </section>

          ${
            hub
              ? `<section class="hub" aria-label="Interchange">
                   <div><b>Transfer here:</b> ${esc(hub.hubName)}<span class="hub-desc"> ${esc(hub.description)}</span></div>
                   <button class="link-btn light" data-action="map-open">Open map</button>
                 </section>`
              : ''
          }

          <section class="arr-wrap">
            <div class="arr-head">
              <h2>Next trains ${esc(dir.toLowerCase())}</h2>
              <span class="count" id="run-count">${S.arrivals.length} ${S.arrivals.length === 1 ? 'run' : 'runs'} scheduled</span>
            </div>
            <div class="arr-list" id="arrivals">${arrivalsHTML()}</div>
          </section>

          <footer class="panel info">
            <div><small>First train</small><b>${esc(line.schedule.firstTrain)}</b></div>
            <div><small>Last train</small><b>${esc(line.schedule.lastTrainNorthOrEast)}</b></div>
            <div><small>Operator</small><b>${esc(line.operator)}</b></div>
          </footer>
        </main>
      </div>
    </div>`;
  }

  function renderMain() {
    const y = window.scrollY;
    const list = document.getElementById('station-list');
    const listTop = list ? list.scrollTop : 0;
    computeArrivals();
    app.innerHTML = mainHTML();
    const list2 = document.getElementById('station-list');
    if (list2) list2.scrollTop = listTop;
    window.scrollTo(0, y);
    if (S.intro) setTimeout(() => (S.intro = false), 1600);
  }

  function updateArrivals(animate) {
    computeArrivals();
    const el = document.getElementById('arrivals');
    if (!el) return;
    el.innerHTML = arrivalsHTML();
    const count = document.getElementById('run-count');
    if (count) count.textContent = `${S.arrivals.length} ${S.arrivals.length === 1 ? 'run' : 'runs'} scheduled`;
    if (animate) {
      el.classList.remove('swap');
      void el.offsetWidth;
      el.classList.add('swap');
    }
  }

  function updateStatus() {
    const el = document.getElementById('status-card');
    if (el) el.innerHTML = statusHTML();
  }

  /* =====================================================================
     MODALS
     ===================================================================== */

  function modalShell(name, cls, labelId, inner) {
    return `
    <div class="overlay" data-overlay="${name}">
      <div class="modal ${cls} ${S.fresh === name ? 'fresh' : ''}" role="dialog" aria-modal="true" aria-labelledby="${labelId}" tabindex="-1">
        ${inner}
      </div>
    </div>`;
  }

  /* --- Google account picker --- */
  function googleModal() {
    const g = S.g;
    return modalShell(
      'google',
      'modal-sm',
      'g-title',
      `
      <div class="modal-head">
        <div class="g-brand">
          ${GOOGLE_G(28)}
          <div><h3 id="g-title">Sign in with Google</h3><p>to keep going on ten-ten</p></div>
        </div>
        <button class="icon-btn" data-action="modal-close" data-modal="google" aria-label="Close" ${g.authorizing ? 'disabled' : ''}>${icon('x', 18)}</button>
      </div>

      <p class="modal-sub">Choose a Google account</p>
      <div class="stack">
        <button class="acct" data-action="g-account" data-email="jeydieb05@gmail.com" data-name="Jeydie B." ${g.authorizing ? 'disabled' : ''}>
          <span class="avatar avatar-lg">J</span>
          <span class="acct-text"><b>Jeydie B.</b><small>jeydieb05@gmail.com</small></span>
          <span class="acct-go">Continue ${icon('arrow', 15)}</span>
        </button>

        ${
          !g.other
            ? `<button class="acct acct-add" data-action="g-other" ${g.authorizing ? 'disabled' : ''}>
                 <span class="avatar avatar-lg avatar-ghost">+</span>
                 <span class="acct-text"><b>Use another Google account</b></span>
               </button>`
            : `<form class="other-form" data-form="g-other">
                 <input class="field" type="email" required placeholder="Your Google email" value="${esc(g.email)}" data-input="g-email" data-autofocus autocomplete="email" />
                 <div class="row-gap">
                   <button type="submit" class="btn btn-primary btn-sm grow" ${g.authorizing ? 'disabled' : ''}>Authorize account</button>
                   <button type="button" class="btn btn-sm" data-action="g-other-cancel">Cancel</button>
                 </div>
               </form>`
        }
      </div>

      ${
        g.authorizing
          ? `<div class="verifying"><span class="spinner"></span><span>Checking your Google account…</span></div>`
          : ''
      }

      <div class="modal-foot between small">
        <span class="with-ic ok-text">${icon('shield', 14)}<span>Google sign-in, no password shared</span></span>
        <span class="muted">Privacy &amp; Terms</span>
      </div>`
    );
  }

  /* --- How to use --- */
  function guideModal() {
    const steps = [
      {
        t: 'Switch lines',
        h: 'Three networks, one tab bar',
        p: 'Flip between <b>LRT-2 Purple Line</b> (Recto to Antipolo), <b>LRT-1 Green Line</b> (Dr. Santos to FPJ) and <b>MRT-3 Yellow Line</b> (Taft to North Ave) from the top bar. The whole app changes colour with the line.',
        tag: ['LRT-2', 'LRT-1', 'MRT-3'],
      },
      {
        t: 'Pick your stops',
        h: 'Set where you board and get off',
        p: 'Use <i>From</i> and <i>To</i> in the side panel to choose your boarding and exit stations. ten-ten works out the direction and train gaps for you.',
      },
      {
        t: 'Read the board',
        h: 'Wait time vs. arrival time',
        p: '<b>Wait</b> is how many minutes until the train reaches your platform. <b>You arrive</b> is the clock time (like <i>15:42</i>) you get to your exit station.',
      },
      {
        t: 'Check hours and transfers',
        h: 'First trains, last trains, interchanges',
        p: 'Trains start from 4:30 AM and the last ones leave between 9:00 PM and 10:15 PM. A banner pops up at transfer stations like Recto to Doroteo Jose, Cubao, and EDSA to Taft.',
      },
    ];
    return modalShell(
      'guide',
      'modal-lg',
      'guide-title',
      `
      <div class="modal-head">
        <div>
          <h2 id="guide-title" class="modal-title">How ten-ten works</h2>
          ${S.user ? `<p class="modal-sub-inline">Signed in as <b>${esc(S.user.name)}</b></p>` : ''}
        </div>
        <button class="icon-btn" data-action="modal-close" data-modal="guide" aria-label="Close">${icon('x', 18)}</button>
      </div>
      <ol class="guide-grid">
        ${steps
          .map(
            (s, i) => `
          <li class="guide-card gc-${i + 1}">
            <span class="step-n">${i + 1}</span>
            <small>${esc(s.t)}</small>
            <h3>${esc(s.h)}</h3>
            <p>${s.p}</p>
            ${s.tag ? `<div class="chips">${s.tag.map((t) => `<span class="chip">${t}</span>`).join('')}</div>` : ''}
          </li>`
          )
          .join('')}
      </ol>
      <div class="modal-foot end">
        <button class="btn btn-primary" data-action="modal-close" data-modal="guide">Start commuting</button>
      </div>`
    );
  }

  /* --- Profile / personalization --- */
  function profileModal() {
    const user = S.user;
    if (!user) return '';
    const p = S.p;
    const line = activeLine();
    const stops = Math.abs(S.dest.position - S.station.position);
    const fare = calculateFare(stops, user.commuterType);
    const types = [
      ['regular', 'Regular'],
      ['student', 'Student'],
      ['senior', 'Senior'],
      ['pwd', 'PWD'],
    ];

    const routes = user.savedRoutes.length
      ? user.savedRoutes
          .map((r) => {
            const l = TRANSIT_LINES[r.lineId];
            const o = l ? l.stations.find((s) => s.id === r.originId) : null;
            const d = l ? l.stations.find((s) => s.id === r.destinationId) : null;
            return `
            <div class="route-row">
              <div>
                <b>${esc(r.label)}</b>
                <p><span class="chip chip-xs" data-l="${esc(r.lineId)}">${esc(l ? l.code : r.lineId)}</span> ${esc(o ? o.name : r.originId)} to ${esc(d ? d.name : r.destinationId)}</p>
              </div>
              <div class="row-gap">
                <button class="btn btn-sm" data-action="p-apply" data-id="${esc(r.id)}">Apply</button>
                <button class="icon-btn danger" data-action="p-del" data-id="${esc(r.id)}" title="Delete route" aria-label="Delete route ${esc(r.label)}">${icon('trash', 16)}</button>
              </div>
            </div>`;
          })
          .join('')
      : `<p class="empty-note">No saved routes yet. Bookmark your current trip to get one-tap access.</p>`;

    return modalShell(
      'profile',
      'modal-md',
      'p-title',
      `
      <div class="modal-head">
        <div>
          <h2 id="p-title" class="modal-title">Your commuter profile</h2>
          <p class="modal-sub-inline"><b>${esc(user.name)}</b> &nbsp;${esc(user.email)}</p>
        </div>
        <button class="icon-btn" data-action="modal-close" data-modal="profile" aria-label="Close">${icon('x', 18)}</button>
      </div>

      ${p.notice ? `<div class="notice">${icon('check', 15)}<span>Saved. Your preferences are updated.</span></div>` : ''}

      <div class="stack-lg">
        <section class="beep">
          <div class="row-between">
            <h3 class="with-ic">${icon('card', 18)}<span>Beep™ card balance</span></h3>
            <button class="link-btn" data-action="p-beep-toggle">${p.editingBeep ? 'Save balance' : 'Edit balance'}</button>
          </div>
          <div class="beep-amt">
            <span class="cur">₱</span>
            ${
              p.editingBeep
                ? `<input class="field field-amt" type="number" step="0.5" min="0" value="${esc(p.beep)}" data-input="beep" data-autofocus aria-label="Beep card balance" />`
                : `<b>${user.beepCardBalance.toFixed(2)}</b>`
            }
          </div>
          <div class="beep-fare">
            <span>This trip (${stops} ${stops === 1 ? 'stop' : 'stops'} on ${esc(line.code)})</span>
            <b>${peso(fare.discounted)} ${fare.hasDiscount ? `<s>${peso(fare.base)}</s>` : ''}</b>
          </div>
        </section>

        <section>
          <div class="row-between"><h3>Fare concession</h3><span class="muted small">Active: <b class="cap">${esc(user.commuterType)}</b></span></div>
          <p class="small muted">Under RA 11314, certified students, senior citizens and PWDs get 20% off train fares.</p>
          <div class="type-grid">
            ${types
              .map(
                ([val, label]) =>
                  `<button class="type-btn ${user.commuterType === val ? 'on' : ''}" data-action="p-type" data-t="${val}" aria-pressed="${user.commuterType === val}">
                     <b>${label}</b>${val === 'regular' ? '' : '<small>-20%</small>'}
                   </button>`
              )
              .join('')}
          </div>
        </section>

        <section>
          <div class="row-between">
            <div><h3>Saved routes</h3><p class="small muted">One-tap trip presets.</p></div>
            ${!p.showAdd ? `<button class="btn btn-sm with-ic" data-action="p-add-open">${icon('plus', 14)}<span>Bookmark current trip</span></button>` : ''}
          </div>
          ${
            p.showAdd
              ? `<div class="add-route">
                   <input class="field" type="text" maxlength="40" placeholder="Name it (e.g. Office commute)" value="${esc(p.label)}" data-input="label" data-autofocus />
                   <div class="row-gap">
                     <button class="btn btn-primary btn-sm" data-action="p-add-save">Save route</button>
                     <button class="btn btn-sm" data-action="p-add-cancel">Cancel</button>
                   </div>
                 </div>`
              : ''
          }
          <div class="route-list">${routes}</div>
        </section>
      </div>

      <div class="modal-foot between">
        ${
          p.confirmLogout
            ? `<div class="row-gap wrap"><span class="danger-text">Sign out of Google?</span>
                 <button class="btn btn-danger btn-sm" data-action="p-logout-yes">Yes, sign out</button>
                 <button class="btn btn-sm" data-action="p-logout-no">Stay</button></div>`
            : `<button class="link-btn danger-text with-ic" data-action="p-logout-ask">${icon('logout', 15)}<span>Sign out from Google</span></button>`
        }
        <button class="btn btn-primary" data-action="modal-close" data-modal="profile">Done</button>
      </div>`
    );
  }

  /* --- Route map --- */
  function mapModal() {
    const line = activeLine();
    const tabs = LINE_IDS.map((id) => {
      const l = TRANSIT_LINES[id];
      const on = S.lineId === id;
      return `<button class="tab" role="tab" aria-selected="${on}" data-l="${id}" data-action="line" data-id="${id}">${esc(l.name)}</button>`;
    }).join('');

    const stations = line.stations
      .map((st) => {
        const isOrigin = S.station.id === st.id;
        const isDest = S.dest.id === st.id;
        return `
        <li class="ms ${isOrigin ? 'is-origin' : ''} ${isDest ? 'is-dest' : ''}">
          <span class="ms-dot"></span>
          <div class="ms-text">
            <b>${esc(st.name)}</b>
            <small>${esc(st.full_name)}</small>
            ${st.transfers ? `<span class="ms-transfer">Transfer: ${esc(st.transfers.join(', '))}</span>` : ''}
          </div>
          <div class="ms-tags">
            ${isOrigin ? '<span class="tag tag-ink">You board here</span>' : ''}
            ${isDest ? '<span class="tag tag-line">You get off here</span>' : ''}
          </div>
        </li>`;
      })
      .join('');

    return modalShell(
      'map',
      'modal-map',
      'map-title',
      `
      <div class="modal-head">
        <div>
          <p class="modal-sub-inline">${esc(line.operator)}</p>
          <h2 id="map-title" class="modal-title">${esc(line.name)} map</h2>
        </div>
        <button class="btn btn-sm" data-action="modal-close" data-modal="map">Close map</button>
      </div>

      <div class="tabs tabs-wide" role="tablist" aria-label="Choose a line">${tabs}</div>

      <ol class="map-list">${stations}</ol>

      <div class="map-facts">
        <div><small>Route length</small><b>${line.totalDistanceKm} km, double-track elevated</b></div>
        <div><small>First train</small><b>${esc(line.schedule.firstTrain)}</b></div>
        <div><small>Operator</small><b>${esc(line.operator)}</b></div>
      </div>`
    );
  }

  function renderModals() {
    const saved = {};
    modalRoot.querySelectorAll('[data-overlay]').forEach((o) => (saved[o.dataset.overlay] = o.scrollTop));

    let html = '';
    if (S.modals.map) html += mapModal();
    if (S.modals.guide) html += guideModal();
    if (S.modals.profile && S.user) html += profileModal();
    if (S.modals.google) html += googleModal();
    modalRoot.innerHTML = html;

    modalRoot.querySelectorAll('[data-overlay]').forEach((o) => {
      if (saved[o.dataset.overlay]) o.scrollTop = saved[o.dataset.overlay];
    });
    document.body.classList.toggle('lock', !!html);

    const af = modalRoot.querySelector('[data-autofocus]');
    if (S.focusSel && af) {
      af.focus();
      if (af.setSelectionRange && af.type === 'text') af.setSelectionRange(af.value.length, af.value.length);
    } else if (S.fresh) {
      const m = modalRoot.querySelector(`[data-overlay="${S.fresh}"] .modal`);
      if (m) m.focus();
    }
    S.fresh = null;
    S.focusSel = null;
  }

  function openModal(name) {
    S.modals[name] = true;
    S.fresh = name;
    if (name === 'profile' && S.user) {
      S.p = { beep: S.user.beepCardBalance.toFixed(2), editingBeep: false, label: '', showAdd: false, confirmLogout: false, notice: false };
    }
    if (name === 'google') {
      S.g = { other: false, email: '', authorizing: false, context: S.screen };
    }
    renderModals();
  }

  function closeModal(name) {
    S.modals[name] = false;
    renderModals();
  }

  function topModal() {
    return ['google', 'profile', 'guide', 'map'].find((n) => S.modals[n]) || null;
  }

  /* =====================================================================
     FLOWS
     ===================================================================== */

  function render() {
    document.body.dataset.line = S.screen === 'login' ? 'lrt2' : S.lineId;
    window.scrollTo(0, 0);
    if (S.screen === 'login') {
      app.innerHTML = loginHTML();
    } else if (S.screen === 'loading') {
      app.innerHTML = loadingHTML();
      startLoading();
    } else {
      renderMain();
    }
  }

  function selectLine(lineId) {
    setLineDefaults(lineId);
    document.body.dataset.line = lineId;
    renderMain();
    if (S.modals.map) renderModals();
  }

  function startLogin(user) {
    S.pendingUser = user;
    S.user = user;
    if (user.defaultLine) setLineDefaults(user.defaultLine);
    S.screen = 'loading';
    render();
  }

  function guestEntry() {
    S.pendingUser = null;
    S.screen = 'loading';
    render();
  }

  function loadingComplete() {
    S.screen = 'main';
    S.intro = true;
    render();
    toast(S.pendingUser ? `Signed in as ${S.pendingUser.name}` : 'Live board is on');
    setTimeout(() => openModal('guide'), 350);
  }

  function logout() {
    saveUser(null);
    S.user = null;
    S.pendingUser = null;
    S.modals.profile = false;
    S.screen = 'login';
    render();
    renderModals();
    toast('Signed out of your Google session');
  }

  function applySavedRoute(route) {
    S.lineId = route.lineId;
    const line = TRANSIT_LINES[route.lineId];
    const orig = line.stations.find((s) => s.id === route.originId);
    const dest = line.stations.find((s) => s.id === route.destinationId);
    if (orig && dest) {
      S.station = orig;
      S.dest = dest;
      document.body.dataset.line = S.lineId;
      renderMain();
      if (S.modals.map) renderModals();
      toast(`Route loaded: ${route.label}`);
    }
  }

  function pickStation(id) {
    const line = activeLine();
    const st = line.stations.find((s) => s.id === id);
    if (!st) return;
    if (S.mode === 'origin') {
      S.station = st;
      if (st.id === S.dest.id) {
        const np = st.position === line.stations.length - 1 ? 0 : st.position + 1;
        S.dest = line.stations[np];
      }
    } else {
      S.dest = st;
      if (st.id === S.station.id) {
        const np = st.position === 0 ? line.stations.length - 1 : st.position - 1;
        S.station = line.stations[np];
      }
    }
    renderMain();
    const el = document.getElementById('arrivals');
    if (el) {
      el.classList.add('swap');
    }
  }

  function refresh() {
    if (S.refreshing) return;
    S.refreshing = true;
    const ic = document.getElementById('refresh-ic');
    if (ic) ic.classList.add('spin');
    setTimeout(() => {
      S.time = new Date();
      updateArrivals(true);
      updateStatus();
      S.refreshing = false;
      const ic2 = document.getElementById('refresh-ic');
      if (ic2) ic2.classList.remove('spin');
      toast('Train times refreshed');
    }, 500);
  }

  /* --- profile updates --- */
  function updateUser(updated) {
    saveUser(updated);
    S.user = updated;
    S.p.notice = true;
    renderMain();
    renderModals();
    clearTimeout(updateUser._t);
    updateUser._t = setTimeout(() => {
      S.p.notice = false;
      if (S.modals.profile) renderModals();
    }, 2000);
  }

  function saveBeep() {
    const parsed = parseFloat(S.p.beep);
    if (!isNaN(parsed) && parsed >= 0) {
      S.p.editingBeep = false;
      updateUser({ ...S.user, beepCardBalance: parsed });
    }
  }

  function saveRoute() {
    const line = activeLine();
    const origin = S.station.name || 'Origin';
    const dest = S.dest.name || 'Destination';
    const label = S.p.label.trim() || `${origin} to ${dest}`;
    const route = { id: `route-${Date.now()}`, label, lineId: S.lineId, originId: S.station.id, destinationId: S.dest.id };
    S.p.label = '';
    S.p.showAdd = false;
    updateUser({ ...S.user, savedRoutes: [route, ...S.user.savedRoutes] });
    void line;
  }

  /* --- google modal --- */
  function chooseAccount(email, name) {
    S.g.authorizing = true;
    renderModals();
    setTimeout(() => {
      const user = createGoogleUser(email, name);
      saveUser(user);
      S.g.authorizing = false;
      S.modals.google = false;
      if (S.g.context === 'login') {
        renderModals();
        startLogin(user);
      } else {
        S.user = user;
        renderMain();
        renderModals();
        toast(`Signed in as ${user.name}`);
      }
    }, 600);
  }

  /* =====================================================================
     EVENTS (delegated)
     ===================================================================== */

  document.addEventListener('click', (e) => {
    const overlay = e.target.classList && e.target.classList.contains('overlay') ? e.target : null;
    if (overlay) {
      const name = overlay.dataset.overlay;
      if (name === 'google' && S.g.authorizing) return;
      closeModal(name);
      return;
    }

    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const d = el.dataset;

    switch (d.action) {
      /* login */
      case 'google-open-login':
      case 'google-open-main':
        openModal('google');
        break;
      case 'guest':
        guestEntry();
        break;
      case 'login-track':
        S.loginTrack = d.t;
        document.getElementById('tracks').innerHTML = tracksHTML();
        document.getElementById('login-tabs').innerHTML = loginTabsHTML();
        break;

      /* main */
      case 'home':
        S.screen = 'login';
        render();
        break;
      case 'line':
        selectLine(d.id);
        break;
      case 'guide':
        openModal('guide');
        break;
      case 'profile-open':
        openModal('profile');
        break;
      case 'logout':
        logout();
        break;
      case 'mode':
        S.mode = d.m;
        renderMain();
        break;
      case 'pick':
        pickStation(d.id);
        break;
      case 'preset': {
        const r = S.user && S.user.savedRoutes.find((x) => x.id === d.id);
        if (r) applySavedRoute(r);
        break;
      }
      case 'refresh':
        refresh();
        break;
      case 'map-open':
        openModal('map');
        break;

      /* modals */
      case 'modal-close':
        closeModal(d.modal);
        break;

      /* google modal */
      case 'g-account':
        chooseAccount(d.email, d.name);
        break;
      case 'g-other':
        S.g.other = true;
        S.focusSel = true;
        renderModals();
        break;
      case 'g-other-cancel':
        S.g.other = false;
        renderModals();
        break;

      /* profile modal */
      case 'p-type':
        updateUser({ ...S.user, commuterType: d.t });
        break;
      case 'p-beep-toggle':
        if (S.p.editingBeep) saveBeep();
        else {
          S.p.editingBeep = true;
          S.focusSel = true;
          renderModals();
        }
        break;
      case 'p-add-open':
        S.p.showAdd = true;
        S.focusSel = true;
        renderModals();
        break;
      case 'p-add-cancel':
        S.p.showAdd = false;
        renderModals();
        break;
      case 'p-add-save':
        saveRoute();
        break;
      case 'p-del':
        updateUser({ ...S.user, savedRoutes: S.user.savedRoutes.filter((r) => r.id !== d.id) });
        break;
      case 'p-apply': {
        const r = S.user.savedRoutes.find((x) => x.id === d.id);
        if (r) {
          S.modals.profile = false;
          renderModals();
          applySavedRoute(r);
        }
        break;
      }
      case 'p-logout-ask':
        S.p.confirmLogout = true;
        renderModals();
        break;
      case 'p-logout-no':
        S.p.confirmLogout = false;
        renderModals();
        break;
      case 'p-logout-yes':
        logout();
        break;
    }
  });

  document.addEventListener('input', (e) => {
    const k = e.target.dataset && e.target.dataset.input;
    if (!k) return;
    if (k === 'g-email') S.g.email = e.target.value;
    if (k === 'beep') S.p.beep = e.target.value;
    if (k === 'label') S.p.label = e.target.value;
  });

  document.addEventListener('submit', (e) => {
    if (e.target.dataset && e.target.dataset.form === 'g-other') {
      e.preventDefault();
      const email = S.g.email.trim();
      if (!email || !email.includes('@')) return;
      chooseAccount(email);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const name = topModal();
      if (name && !(name === 'google' && S.g.authorizing)) closeModal(name);
      return;
    }
    if (e.key === 'Enter' && e.target.dataset) {
      if (e.target.dataset.input === 'beep') {
        e.preventDefault();
        saveBeep();
      } else if (e.target.dataset.input === 'label') {
        e.preventDefault();
        saveRoute();
      }
    }
  });

  /* ---------- clock + live updates ---------- */

  setInterval(() => {
    S.time = new Date();
    if (S.screen !== 'main') return;
    const clock = document.getElementById('clock');
    if (clock) clock.textContent = fmtClock(S.time);
    const m = S.time.getMinutes();
    if (m !== S.lastMinute) {
      S.lastMinute = m;
      updateStatus();
      updateArrivals(false);
    }
  }, 1000);

  /* ---------- go ---------- */
  render();
})();
