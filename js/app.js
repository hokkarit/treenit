'use strict';

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DAY_FI = {
  monday: 'Maanantai', tuesday: 'Tiistai', wednesday: 'Keskiviikko',
  thursday: 'Torstai', friday: 'Perjantai', saturday: 'Lauantai', sunday: 'Sunnuntai'
};
const MONTHS_FI = ['tammikuuta','helmikuuta','maaliskuuta','huhtikuuta','toukokuuta','kesäkuuta',
  'heinäkuuta','elokuuta','syyskuuta','lokakuuta','marraskuuta','joulukuuta'];

let clubs = [];
let currentClub = null;
let teams = [];
let currentTeam = null;
let currentWeekMonday = thisWeekMonday();
let touchStartX = 0;
let touchStartY = 0;

// ── Boot ──────────────────────────────────────────────────────────
if (window.navigator.standalone) {
  document.documentElement.classList.add('pwa-ios');
}

async function init() {
  registerSW();

  try {
    clubs = await fetch('data/clubs.json').then(r => r.json());
  } catch {
    clubs = [];
  }

  setupTeamSelectorEvents();

  const hashParts = location.hash.replace(/^#\//, '').split('/');
  const urlClub = hashParts[0] || null;
  const urlTeam = hashParts[1] ? hashParts[1].toUpperCase() : null;
  const urlWeek = hashParts[2] ? parseInt(hashParts[2]) : null;

  if (urlWeek && urlWeek >= 1 && urlWeek <= 53) {
    currentWeekMonday = mondayOfISOWeek(isoYear(thisWeekMonday()), urlWeek);
  }

  const savedClub = localStorage.getItem('hokkarit_club');
  const initialClub = (urlClub && clubs.find(c => c.id === urlClub)) ? urlClub
    : ((savedClub && clubs.find(c => c.id === savedClub)) ? savedClub : (clubs[0]?.id ?? null));
  if (initialClub) await selectClub(initialClub, urlTeam);

  setupSwipe();
  maybeShowNotifBanner();

  window.addEventListener('hashchange', async () => {
    const parts = location.hash.replace(/^#\//, '').split('/');
    const hClub = parts[0] || null;
    const hTeam = parts[1] ? parts[1].toUpperCase() : null;
    const hWeek = parts[2] ? parseInt(parts[2]) : null;

    if (hWeek && hWeek >= 1 && hWeek <= 53) {
      currentWeekMonday = mondayOfISOWeek(isoYear(thisWeekMonday()), hWeek);
    } else {
      currentWeekMonday = thisWeekMonday();
    }

    if (hClub && hClub !== currentClub) {
      await selectClub(hClub, hTeam);
    } else if (hTeam && hTeam !== currentTeam) {
      selectTeam(hTeam);
    } else {
      loadWeek();
    }
  });
}

// ── Service Worker ────────────────────────────────────────────────
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// ── Club selector ─────────────────────────────────────────────────
async function selectClub(id, teamOverride = null) {
  currentClub = id;
  localStorage.setItem('hokkarit_club', id);
  const club = clubs.find(c => c.id === id);

  const logoEl = document.getElementById('club-logo');
  logoEl.src = club?.logo ?? '';
  logoEl.alt = club?.name ?? id;

  document.querySelector('meta[name="theme-color"]').setAttribute('content', '#0A1628');

  try {
    teams = await fetch(`data/${id}/teams.json`).then(r => r.json());
  } catch {
    teams = [];
  }

  currentTeam = null;
  renderTeamOptions();

  const savedTeam = localStorage.getItem(`hokkarit_team_${id}`);
  const initial = (teamOverride && teams.find(t => t.id === teamOverride)) ? teamOverride
    : ((savedTeam && teams.find(t => t.id === savedTeam)) ? savedTeam : (teams[0]?.id ?? null));
  if (initial) selectTeam(initial);
}

// ── Team dropdown ─────────────────────────────────────────────────
function renderTeamOptions() {
  const menu = document.getElementById('team-select-menu');
  menu.innerHTML = teams.map(t =>
    `<button class="team-option" role="option" data-id="${esc(t.id)}">${esc(t.name)}</button>`
  ).join('');
}

function setupTeamSelectorEvents() {
  document.getElementById('team-select-btn').addEventListener('click', toggleTeamMenu);
  document.getElementById('team-select-menu').addEventListener('click', e => {
    const opt = e.target.closest('.team-option');
    if (opt) selectTeam(opt.dataset.id);
  });
  document.addEventListener('click', e => {
    if (!document.getElementById('team-select').contains(e.target)) closeTeamMenu();
    if (!document.getElementById('more-menu').contains(e.target)) closeMoreMenu();
    const modal = document.getElementById('stats-modal');
    if (!modal.hidden && !document.getElementById('stats-modal').querySelector('.stats-panel').contains(e.target)) closeStats();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeTeamMenu(); closeMoreMenu(); closeStats(); }
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft') shiftWeek(-1);
    if (e.key === 'ArrowRight') shiftWeek(1);
  });

  document.getElementById('more-btn').addEventListener('click', toggleMoreMenu);
  document.getElementById('import-file').addEventListener('change', e => {
    if (e.target.files[0]) importProgress(e.target.files[0]);
    e.target.value = '';
  });
}

function toggleTeamMenu() {
  const menu = document.getElementById('team-select-menu');
  const btn = document.getElementById('team-select-btn');
  const open = menu.hidden;
  menu.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
}

function closeTeamMenu() {
  document.getElementById('team-select-menu').hidden = true;
  document.getElementById('team-select-btn').setAttribute('aria-expanded', 'false');
}

function selectTeam(id) {
  currentTeam = id;
  localStorage.setItem(`hokkarit_team_${currentClub}`, id);
  const team = teams.find(t => t.id === id);
  document.getElementById('team-select-label').textContent = team?.name ?? id;
  document.querySelectorAll('.team-option').forEach(o =>
    o.classList.toggle('active', o.dataset.id === id)
  );
  closeTeamMenu();
  updateManifest(currentClub, id);
  loadWeek();
}

// ── Week helpers ──────────────────────────────────────────────────
function thisWeekMonday() {
  const d = new Date();
  const dow = d.getDay() || 7;
  d.setDate(d.getDate() - dow + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoWeekNumber(monday) {
  const thu = new Date(monday);
  thu.setDate(thu.getDate() + 3);
  const jan1 = new Date(Date.UTC(thu.getFullYear(), 0, 1));
  return Math.ceil(((thu - jan1) / 86400000 + 1) / 7);
}

function isoYear(monday) {
  const thu = new Date(monday);
  thu.setDate(thu.getDate() + 3);
  return thu.getFullYear();
}

function weekKey(monday) {
  return `${isoYear(monday)}-W${String(isoWeekNumber(monday)).padStart(2, '0')}`;
}

function weekDateRange(monday) {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const fmt = d => `${d.getDate()}. ${MONTHS_FI[d.getMonth()]}`;
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

function shiftWeek(n) {
  const d = new Date(currentWeekMonday);
  d.setDate(d.getDate() + n * 7);
  currentWeekMonday = d;
  updateURL();
  loadWeek();
}

function goToToday() {
  currentWeekMonday = thisWeekMonday();
  clearWeekFromURL();
  loadWeek();
}

function clearWeekFromURL() {
  if (currentClub && currentTeam) {
    history.replaceState(null, '', '#/' + currentClub + '/' + currentTeam.toLowerCase());
  }
}

// ── Load & render week ────────────────────────────────────────────
async function loadWeek() {
  if (!currentTeam || !currentClub) return;
  const wk = weekKey(currentWeekMonday);

  const yr = isoYear(currentWeekMonday);
  const yearSuffix = yr !== new Date().getFullYear() ? ` / ${yr}` : '';
  document.getElementById('week-label').textContent = `Viikko ${isoWeekNumber(currentWeekMonday)}${yearSuffix}`;
  document.getElementById('week-dates').textContent = weekDateRange(currentWeekMonday);
  document.getElementById('today-btn').hidden = (weekKey(currentWeekMonday) === weekKey(thisWeekMonday()));

  const container = document.getElementById('days-container');
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Ladataan…</div>`;

  try {
    const resp = await fetch(`data/weeks/${currentClub}/${currentTeam}/${wk}.json`);
    if (!resp.ok) throw new Error();
    const data = await resp.json();

    if (data.repeat) {
      const refResp = await fetch(`data/weeks/${currentClub}/${currentTeam}/${data.repeat}.json`);
      if (!refResp.ok) throw new Error();
      renderDays(await refResp.json(), wk, data.repeat);
    } else {
      renderDays(data, wk);
    }
  } catch {
    container.innerHTML = `<div class="no-data"><strong>Ei harjoitusohjelmaa</strong>Tälle viikolle ei ole vielä ladattu haastetta.</div>`;
  }
}

function renderDays(data, wk, repeatedFrom = null) {
  const isCurrentWeek = wk === weekKey(thisWeekMonday());
  const todayKey = isCurrentWeek ? todayDayKey() : null;
  const completion = loadCompletion(currentTeam, wk);
  const container = document.getElementById('days-container');

  const repeatNotice = repeatedFrom
    ? `<div class="repeat-notice">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 4h8a3 3 0 010 6H4M1 4l2.5-2.5M1 4l2.5 2.5"/></svg>
        Toistuva ohjelma – sama haaste kuin viikolla ${parseInt(repeatedFrom.split('-W')[1])}
      </div>`
    : '';

  container.innerHTML = repeatNotice + DAYS.map(day => {
    const dayData = data.days?.[day];
    if (!dayData) return '';
    const isToday = day === todayKey;
    const tasks = dayData.tasks || [];
    const saved = completion[day] || [];
    const done = saved.filter(Boolean).length;
    const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
    const allDone = tasks.length > 0 && done === tasks.length;

    const tasksHtml = tasks.map((task, i) => {
      const taskText  = typeof task === 'string' ? task : task.text;
      const taskInfo  = typeof task === 'object' && task.info  ? task.info  : null;
      const taskVideo = typeof task === 'object' && task.video ? task.video : null;
      return `<label class="task-item${saved[i] ? ' done' : ''}">
        <input type="checkbox"${saved[i] ? ' checked' : ''} data-day="${day}" data-idx="${i}" data-week="${wk}">
        <span class="task-content">
          <span class="task-text">${esc(taskText)}</span>${taskInfo ? `<span class="task-info">${esc(taskInfo)}</span>` : ''}${taskVideo ? `<a class="task-video" href="${esc(taskVideo)}" target="_blank" rel="noopener">&#9654; Katso video</a>` : ''}
        </span>
      </label>`;
    }).join('');

    return `<div class="day-card${isToday ? ' today' : ''}${allDone ? ' all-done' : ''}" data-day="${day}">
      <div class="day-header">
        <div class="day-title-row">
          <h3>${esc(dayData.title || DAY_FI[day])}</h3>
          <span class="today-badge">Tänään</span>
        </div>
        <span class="progress-text">${allDone ? '✓ Valmis' : `${done}/${tasks.length}`}</span>
      </div>
      <div class="progress-bar"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
      <div class="tasks">${tasksHtml}</div>
    </div>`;
  }).join('');

  const todayCard = container.querySelector('.today');
  if (todayCard) {
    setTimeout(() => {
      const topbar = document.querySelector('.topbar');
      const offset = (topbar ? topbar.offsetHeight : 0) + 8;
      const top = todayCard.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }, 80);
  }
}

// ── Task completion ────────────────────────────────────────────────
document.addEventListener('change', e => {
  const cb = e.target;
  if (cb.type !== 'checkbox' || !cb.dataset.week) return;

  const { day, idx, week } = cb.dataset;
  const completion = loadCompletion(currentTeam, week);
  if (!completion[day]) completion[day] = [];
  completion[day][parseInt(idx)] = cb.checked;
  saveCompletion(currentTeam, week, completion);

  cb.closest('.task-item').classList.toggle('done', cb.checked);

  if (cb.checked) fireConfetti(cb);

  const card = cb.closest('.day-card');
  const boxes = [...card.querySelectorAll('input[type="checkbox"]')];
  const total = boxes.length;
  const done = boxes.filter(c => c.checked).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  const allDone = done === total && total > 0;

  card.querySelector('.progress-bar-fill').style.width = pct + '%';
  card.querySelector('.progress-text').textContent = allDone ? '✓ Valmis' : `${done}/${total}`;
  card.classList.toggle('all-done', allDone);
});

// ── localStorage ──────────────────────────────────────────────────
function loadCompletion(team, wk) {
  try { return JSON.parse(localStorage.getItem(`hokkarit_${team}_${wk}`)) || {}; }
  catch { return {}; }
}

function saveCompletion(team, wk, data) {
  localStorage.setItem(`hokkarit_${team}_${wk}`, JSON.stringify(data));
}

// ── Swipe navigation ──────────────────────────────────────────────
function setupSwipe() {
  document.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)) {
      shiftWeek(dx < 0 ? 1 : -1);
    }
  }, { passive: true });
}

// ── More menu ─────────────────────────────────────────────────────
function toggleMoreMenu() {
  const menu = document.getElementById('more-menu-items');
  const btn = document.getElementById('more-btn');
  const open = menu.hidden;
  menu.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
}

function closeMoreMenu() {
  document.getElementById('more-menu-items').hidden = true;
  document.getElementById('more-btn').setAttribute('aria-expanded', 'false');
}

// ── Export / Import ────────────────────────────────────────────────
function exportProgress() {
  closeMoreMenu();
  const progress = {};
  const re = /^hokkarit_([^_]+)_(\d{4}-W\d{2})$/;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (re.test(key)) {
      try { progress[key.replace('hokkarit_', '')] = JSON.parse(localStorage.getItem(key)); } catch {}
    }
  }
  if (!Object.keys(progress).length) {
    showToast('Ei tallennettua edistymistä.');
    return;
  }
  const payload = JSON.stringify({ version: 1, exported: new Date().toISOString(), progress }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `hokkarit-treenit-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importProgress(file) {
  const reader = new FileReader();
  reader.onload = e => {
    let data;
    try { data = JSON.parse(e.target.result); } catch {
      showToast('Virheellinen tiedosto.');
      return;
    }
    if (data.version !== 1 || typeof data.progress !== 'object' || data.progress === null) {
      showToast('Ei tuettua tiedostomuotoa.');
      return;
    }
    let count = 0;
    for (const [shortKey, val] of Object.entries(data.progress)) {
      if (/^[A-Z0-9]+_\d{4}-W\d{2}$/.test(shortKey) && typeof val === 'object' && val !== null) {
        localStorage.setItem(`hokkarit_${shortKey}`, JSON.stringify(val));
        count++;
      }
    }
    showToast(`Tuotu ${count} viikon tiedot ✓`);
    loadWeek();
  };
  reader.readAsText(file);
}

// ── Statistics ────────────────────────────────────────────────────
function showStats(e) {
  e?.stopPropagation();
  closeMoreMenu();
  const re = /^hokkarit_([^_]+)_(\d{4}-W\d{2})$/;
  const weekData = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const m = key.match(re);
    if (!m) continue;
    try {
      const completion = JSON.parse(localStorage.getItem(key));
      let done = 0;
      for (const day of Object.values(completion)) {
        if (Array.isArray(day)) done += day.filter(Boolean).length;
      }
      if (done > 0) weekData.push({ team: m[1], week: m[2], done });
    } catch {}
  }

  if (!weekData.length) {
    showToast('Ei vielä tilastoja.');
    return;
  }

  weekData.sort((a, b) => a.week < b.week ? -1 : 1);

  const totalDone = weekData.reduce((s, w) => s + w.done, 0);

  const items = weekData.map(w => {
    const wNum = parseInt(w.week.split('-W')[1]);
    return `<li class="stat-item">
      <span class="stat-week">Viikko ${wNum}</span>
      <span class="stat-team">${esc(w.team)}</span>
      <span class="stat-done">${w.done} tehtävää</span>
    </li>`;
  }).join('');

  document.getElementById('stats-summary').textContent = `${totalDone} tehtävää tehty yhteensä`;
  document.getElementById('stats-list').innerHTML = items;
  document.getElementById('stats-modal').hidden = false;
}

function closeStats() {
  document.getElementById('stats-modal').hidden = true;
}

// ── Toast ─────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 2500);
}

// ── Notifications ─────────────────────────────────────────────────
function maybeShowNotifBanner() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') { scheduleNotification(); return; }
  if (Notification.permission === 'denied') return;
  if (localStorage.getItem('hokkarit_notif_dismissed')) return;
  setTimeout(() => document.getElementById('notif-banner').classList.remove('hidden'), 1800);
}

function requestNotifPermission() {
  Notification.requestPermission().then(perm => {
    dismissNotifBanner();
    if (perm === 'granted') scheduleNotification();
  });
}

function dismissNotifBanner() {
  document.getElementById('notif-banner').classList.add('hidden');
  localStorage.setItem('hokkarit_notif_dismissed', '1');
}

function scheduleNotification() {
  if (Notification.permission !== 'granted') return;
  const now = new Date();
  const next = new Date(now);
  next.setHours(9, 0, 0, 0);
  if (now >= next) next.setDate(next.getDate() + 1);
  setTimeout(() => {
    showNotification();
    scheduleNotification();
  }, next - now);
}

function showNotification() {
  const sw = navigator.serviceWorker?.controller;
  if (sw) {
    sw.postMessage({ type: 'NOTIFY' });
  } else if (Notification.permission === 'granted') {
    new Notification('Hokkarit Kotitreenit 🏒', {
      body: 'Muista tarkistaa päivän harjoitustehtävät!',
      icon: 'https://static.jopox.fi/hokkarit/logos/logo-300.png',
      tag: 'daily-reminder'
    });
  }
}

// ── Confetti ──────────────────────────────────────────────────────
function fireConfetti(checkbox) {
  if (typeof confetti !== 'function') return;
  const rect = checkbox.closest('.task-item').getBoundingClientRect();
  const x = (rect.left + rect.width / 2) / window.innerWidth;
  const y = (rect.top + rect.height / 2) / window.innerHeight;
  confetti({
    particleCount: 80,
    spread: 80,
    origin: { x, y },
    colors: ['#4FC3F7', '#ffffff', '#4ade80', '#fbbf24'],
    scalar: 1.0,
    gravity: 1.1,
    ticks: 200
  });
}

// ── PWA manifest ──────────────────────────────────────────────────
function updateManifest(clubId, teamId) {
  const club = clubs.find(c => c.id === clubId);
  const team = teams.find(t => t.id === teamId);
  if (!club || !team) return;

  const themeColor = '#0A1628';
  const shortName = clubId.charAt(0).toUpperCase() + clubId.slice(1) + ' ' + team.name;
  const startUrl = '/#/' + clubId + '/' + teamId.toLowerCase();

  // iOS: apple-specific tags are what Safari reads at "Add to Home Screen" time
  document.querySelector('meta[name="apple-mobile-web-app-title"]').setAttribute('content', shortName);
  document.getElementById('apple-touch-icon').setAttribute('href', club.logo);

  // Update URL with club/team so iOS saves the correct start URL when adding to home screen
  history.replaceState(null, '', '#/' + clubId + '/' + teamId.toLowerCase());

  // Android/Chrome: update web manifest via blob URL
  // start_url intentionally without week so PWA opens on current week
  const manifest = {
    name: club.name + ' ' + team.name,
    short_name: shortName,
    start_url: startUrl,
    display: 'standalone',
    background_color: themeColor,
    theme_color: themeColor,
    icons: [{ src: club.logo, sizes: '300x300', type: 'image/png', purpose: 'any maskable' }]
  };
  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
  const link = document.getElementById('manifest-link');
  if (link._prevBlobUrl) URL.revokeObjectURL(link._prevBlobUrl);
  link._prevBlobUrl = URL.createObjectURL(blob);
  link.href = link._prevBlobUrl;
}

// ── URL helpers ───────────────────────────────────────────────────
function updateURL() {
  if (!currentClub || !currentTeam) return;
  history.replaceState(null, '', '#/' + currentClub + '/' + currentTeam.toLowerCase() + '/' + isoWeekNumber(currentWeekMonday));
}

function mondayOfISOWeek(year, week) {
  const jan4 = new Date(year, 0, 4);
  const dow = jan4.getDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setDate(jan4.getDate() - (dow - 1));
  const result = new Date(week1Mon);
  result.setDate(week1Mon.getDate() + (week - 1) * 7);
  result.setHours(0, 0, 0, 0);
  return result;
}

function copyWeekLink() {
  closeMoreMenu();
  const weekNum = isoWeekNumber(currentWeekMonday);
  const url = location.origin + location.pathname + '#/' + currentClub + '/' + currentTeam.toLowerCase() + '/' + weekNum;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url)
      .then(() => showToast('Viikkolinkki kopioitu ✓'))
      .catch(() => copyFallback(url));
  } else {
    copyFallback(url);
  }
}

function copyFallback(text) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
  document.body.appendChild(el);
  el.focus();
  el.select();
  try {
    document.execCommand('copy');
    showToast('Viikkolinkki kopioitu ✓');
  } catch {
    showToast('Kopioi: ' + text);
  }
  document.body.removeChild(el);
}

// ── Utils ─────────────────────────────────────────────────────────
function todayDayKey() {
  return ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date().getDay()];
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', init);
