const $ = (sel) => document.querySelector(sel);

const promptEl = $('#prompt');
const composerEl = $('#composer');
const sendBtn = $('#generate');
const threadEl = $('#thread');
const boardEl = $('#board');
const tabBar = $('#tabBar');
const lightbox = $('#lightbox');
const lightboxTitle = $('#lightboxTitle');
const lightboxStage = $('#lightboxStage');
const lbCopy = $('#lbCopy');
const lbPng = $('#lbPng');
const lbOpenTab = $('#lbOpenTab');
const lbReload = $('#lbReload');
const lbClose = $('#lbClose');
const headerSettingsBtn = $('#headerSettings');
const attachBtn = $('#attachBtn');
const attachPop = $('#attachPop');
const attachChips = $('#attachChips');
const fileInput = $('#fileInput');
const figInput = $('#figInput');
const contextBar = $('#contextBar');
const onbBackdrop = $('#onbBackdrop');
const onbClose = $('#onbClose');
const onbSave = $('#onbSave');
const onbSkip = $('#onbSkip');
const dsBackdrop = $('#dsBackdrop');
const dsClose = $('#dsClose');
const dsEditor = $('#dsEditor');
const dsSave = $('#dsSave');
const dsRevert = $('#dsRevert');
const dsTabs = $('#dsTabs');
const dsStatus = $('#dsStatus');
const connBackdrop = $('#connBackdrop');
const connClose = $('#connClose');
const connectorsList = $('#connectorsList');
const inputBackdrop = $('#inputBackdrop');
const homeEl = $('#home');
const homeBodyEl = $('#homeBody');
const shellEl = $('#shell');
const backHomeBtn = $('#backHome');
const projectNameEl = $('#projectName');
const homeNewProjectBtn = $('#homeNewProject');
const collapseChatBtn = $('#collapseChat');
const expandChatBtn = $('#expandChat');

const CHAT_COLLAPSED_KEY = 'rockdesign:chatCollapsed';
function setChatCollapsed(collapsed) {
  shellEl.classList.toggle('chat-collapsed', collapsed);
  try { localStorage.setItem(CHAT_COLLAPSED_KEY, collapsed ? '1' : '0'); } catch {}
}
collapseChatBtn?.addEventListener('click', () => setChatCollapsed(true));
expandChatBtn?.addEventListener('click', () => setChatCollapsed(false));
try { if (localStorage.getItem(CHAT_COLLAPSED_KEY) === '1') shellEl.classList.add('chat-collapsed'); } catch {}

/* ---------- Model picker (Fast = Sonnet, Quality = Opus) ---------- */
const MODEL_KEY = 'rockdesign:model';
const VALID_MODELS = new Set(['sonnet', 'opus']);
const modelBtn = $('#modelBtn');
const modelPop = $('#modelPop');
function getModel() {
  try {
    const v = localStorage.getItem(MODEL_KEY);
    if (VALID_MODELS.has(v)) return v;
  } catch {}
  return 'sonnet';
}
function renderModelChoice() {
  const m = getModel();
  modelPop?.querySelectorAll('.pop-item[data-model]').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.model === m);
  });
  modelBtn?.setAttribute('title', m === 'opus' ? 'Model: Quality (Opus)' : 'Model: Fast (Sonnet)');
}
function setModel(m) {
  if (!VALID_MODELS.has(m)) return;
  try { localStorage.setItem(MODEL_KEY, m); } catch {}
  renderModelChoice();
}
function closeModelPop() {
  if (!modelPop) return;
  modelPop.hidden = true;
  modelBtn?.setAttribute('aria-expanded', 'false');
}
function openModelPop() {
  if (!modelPop) return;
  renderModelChoice();
  modelPop.hidden = false;
  modelBtn?.setAttribute('aria-expanded', 'true');
}
modelBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (modelPop?.hidden) openModelPop(); else closeModelPop();
});
modelPop?.addEventListener('click', (e) => {
  const item = e.target.closest('.pop-item[data-model]');
  if (!item) return;
  setModel(item.dataset.model);
  closeModelPop();
});
document.addEventListener('click', (e) => {
  if (!modelPop || modelPop.hidden) return;
  if (modelPop.contains(e.target) || modelBtn.contains(e.target)) return;
  closeModelPop();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modelPop && !modelPop.hidden) closeModelPop();
});
renderModelChoice();

/* ---------- Board pan + zoom (Figma-style canvas freedom) ---------- */
const ZOOM_KEY = 'rockdesign:zoom';
const ZOOM_MIN = 0.35;
const ZOOM_MAX = 2.5;
const zoomLevelEl = $('#zoomLevel');
const zoomInBtn = $('#zoomIn');
const zoomOutBtn = $('#zoomOut');
let zoom = 1;
try {
  const saved = parseFloat(localStorage.getItem(ZOOM_KEY) || '');
  if (Number.isFinite(saved) && saved >= ZOOM_MIN && saved <= ZOOM_MAX) zoom = saved;
} catch {}
function applyZoom() {
  document.documentElement.style.setProperty('--zoom', String(zoom));
  if (zoomLevelEl) zoomLevelEl.textContent = `${Math.round(zoom * 100)}%`;
  try { localStorage.setItem(ZOOM_KEY, String(zoom)); } catch {}
}
function setZoom(z) {
  zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
  applyZoom();
}
applyZoom();
zoomInBtn?.addEventListener('click', () => setZoom(zoom * 1.15));
zoomOutBtn?.addEventListener('click', () => setZoom(zoom / 1.15));
zoomLevelEl?.addEventListener('click', () => setZoom(1));

// Figma-style infinite canvas: pan = translate on .board-row, NOT scroll.
// Unlimited drag range, no edge clamping.
let panX = 0, panY = 0;
function applyBoardTransform() {
  const row = boardEl.querySelector('.board-row');
  if (row) row.style.transform = `translate(${panX}px, ${panY}px)`;
}

// Cmd/Ctrl + wheel zooms; plain wheel pans (trackpad two-finger scroll).
boardEl.addEventListener('wheel', (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setZoom(zoom * factor);
    return;
  }
  e.preventDefault();
  panX -= e.deltaX;
  panY -= e.deltaY;
  applyBoardTransform();
}, { passive: false });

// Click-and-drag pan on board (works anywhere except interactive buttons).
let panState = null;
boardEl.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (e.target.closest('.card-act, .card-close, button, a, input, textarea, select')) return;
  panState = {
    x: e.clientX,
    y: e.clientY,
    px: panX,
    py: panY,
    moved: false,
  };
});
document.addEventListener('mousemove', (e) => {
  if (!panState) return;
  const dx = e.clientX - panState.x;
  const dy = e.clientY - panState.y;
  if (!panState.moved && Math.hypot(dx, dy) > 4) {
    panState.moved = true;
    boardEl.classList.add('panning');
  }
  if (panState.moved) {
    panX = panState.px + dx;
    panY = panState.py + dy;
    applyBoardTransform();
  }
});
document.addEventListener('mouseup', () => {
  if (!panState) return;
  const wasMoved = panState.moved;
  panState = null;
  boardEl.classList.remove('panning');
  if (wasMoved) {
    const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    boardEl.addEventListener('click', swallow, { capture: true, once: true });
  }
});

// Reset pan when user resets zoom (clicks the "100%" label).
zoomLevelEl?.addEventListener('click', () => { panX = 0; panY = 0; applyBoardTransform(); });

/* ---------- Lightbox zoom ---------- */
const lbZoomInBtn = $('#lbZoomIn');
const lbZoomOutBtn = $('#lbZoomOut');
const lbZoomLevelEl = $('#lbZoomLevel');
let lbZoom = 1;
function applyLbZoom() {
  document.documentElement.style.setProperty('--lb-zoom', String(lbZoom));
  if (lbZoomLevelEl) lbZoomLevelEl.textContent = `${Math.round(lbZoom * 100)}%`;
}
function setLbZoom(z) {
  lbZoom = Math.max(0.25, Math.min(3, z));
  applyLbZoom();
}
applyLbZoom();
lbZoomInBtn?.addEventListener('click', () => setLbZoom(lbZoom * 1.15));
lbZoomOutBtn?.addEventListener('click', () => setLbZoom(lbZoom / 1.15));
lbZoomLevelEl?.addEventListener('click', () => setLbZoom(1));

// Click selection: clicking a card focuses it (green outline follows the
// click); clicking empty board space clears the selection. Buttons and the
// menu stop propagation themselves, so they don't trigger selection.
boardEl.addEventListener('click', (e) => {
  const card = e.target.closest('.board-card');
  if (card) {
    if (card.dataset.id && card.dataset.id !== activeId) focusBoardItem(card.dataset.id);
    return;
  }
  if (activeId !== null) {
    activeId = null;
    boardEl.querySelectorAll('.board-card.active').forEach((c) => c.classList.remove('active'));
    renderTabs();
    renderThread();
  }
});

let items = [];
let activeId = null;
let pendingAttachments = []; // [{ id, filename, relPath, url, isImg }]
let openIds = loadOpenIds(); // ids currently on the board
let projects = [];           // [{ id, name, designCount, lastDesignAt, ... }]
let currentProjectId = localStorage.getItem('rockdesign:project') || null;

const OPEN_KEY = 'rockdesign:open';
function loadOpenIds() {
  try { return JSON.parse(localStorage.getItem(OPEN_KEY)) || []; }
  catch { return []; }
}
function saveOpenIds() {
  try { localStorage.setItem(OPEN_KEY, JSON.stringify(openIds)); } catch {}
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('en-US', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
}

function autoSize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

function makeEl(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

// Group designs that came from the same multi-page generation.
// Returns an array of groups (each is { groupId|null, items: [design...] })
// in chronological order.
function groupChronologically(designs) {
  const chrono = designs.slice().sort((a, b) =>
    (a.createdAt || '').localeCompare(b.createdAt || '') ||
    ((a.pageIndex ?? 0) - (b.pageIndex ?? 0)));
  const groups = [];
  const seenGroups = new Map(); // groupId -> group
  for (const it of chrono) {
    if (it.groupId) {
      if (seenGroups.has(it.groupId)) {
        seenGroups.get(it.groupId).items.push(it);
      } else {
        const g = { groupId: it.groupId, items: [it] };
        seenGroups.set(it.groupId, g);
        groups.push(g);
      }
    } else {
      groups.push({ groupId: null, items: [it] });
    }
  }
  return groups;
}

function renderThread() {
  threadEl.innerHTML = '';
  const groups = groupChronologically(items);

  let lastPrompt = null;
  groups.forEach((group) => {
    const head = group.items[0];

    // User bubble (once per distinct prompt)
    if (head.prompt !== lastPrompt) {
      const u = makeEl('div', 'msg user');
      u.appendChild(makeEl('div', 'who', 'You'));
      u.appendChild(makeEl('div', 'body', head.prompt));
      const row = buildMiniAttachRow(head.attachments);
      if (row) u.appendChild(row);
      threadEl.appendChild(u);
      lastPrompt = head.prompt;
    }

    const a = makeEl('div', 'msg ai');
    a.appendChild(makeEl('div', 'who', 'rockdesign'));

    // ONE compact tile per result — single-page and multi-page render the
    // same way. The tile shows the first page as a thumbnail with a page-count
    // badge when there's more than one. Click to open the full detail in
    // the right-side board.
    const it = group.items[0];
    const totalCost = group.items.reduce((s, x) => s + (Number(x.cost) || 0), 0);
    const isOpenOnBoard = group.items.some((g) => openIds.includes(g.id));

    const tile = makeEl('div', 'result-tile' + (isOpenOnBoard ? ' open' : ''));
    tile.addEventListener('click', () => openGroupOnBoard(group));

    const thumbWrap = makeEl('div', 'tile-thumb');
    const f = makeEl('iframe');
    f.src = `/preview/${encodeURIComponent(it.id)}`;
    f.loading = 'lazy';
    f.title = head.prompt;
    f.setAttribute('sandbox', 'allow-scripts');
    f.setAttribute('scrolling', 'no');
    thumbWrap.appendChild(f);

    if (group.items.length > 1) {
      const badge = makeEl('span', 'tile-pages-badge');
      badge.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="6" width="14" height="14" rx="1.5"/><path d="M8 3h12v12"/></svg> ${group.items.length} pages`;
      thumbWrap.appendChild(badge);
    }
    tile.appendChild(thumbWrap);

    const meta = makeEl('div', 'tile-meta');
    const left = makeEl('div', 'tile-meta-left');
    left.appendChild(makeEl('span', 'tile-time', fmtDate(head.createdAt)));
    if (totalCost) left.appendChild(makeEl('span', 'tile-cost', `$${totalCost.toFixed(3)}`));
    if (head.partial) left.appendChild(makeEl('span', 'tile-partial', 'partial'));
    meta.appendChild(left);
    meta.appendChild(makeEl('span', 'tile-open-hint',
      isOpenOnBoard ? 'Open ↗' : 'Click to open →'));
    tile.appendChild(meta);

    a.appendChild(tile);
    threadEl.appendChild(a);
  });

  if (items.length === 0 && typeof renderEmptyHero === 'function') {
    renderEmptyHero();
  }
  threadEl.scrollTop = threadEl.scrollHeight;
}

function renderTabs() {
  tabBar.innerHTML = '';
  openIds.forEach((id) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const tab = makeEl('div', 'tab' + (id === activeId ? ' active' : ''));
    tab.title = item.prompt;
    const label = makeEl('span', 'tab-label', item.prompt);
    tab.appendChild(label);
    const x = makeEl('button', 'tab-close');
    x.type = 'button';
    x.title = 'Close';
    x.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    x.addEventListener('click', (e) => { e.stopPropagation(); closeBoardItem(id); });
    tab.appendChild(x);
    tab.addEventListener('click', () => focusBoardItem(id));
    tabBar.appendChild(tab);
  });
}

function renderBoard() {
  // Remove existing card row but keep the empty placeholder element
  Array.from(boardEl.querySelectorAll('.board-row')).forEach((r) => r.remove());

  const validIds = openIds.filter((id) => items.some((i) => i.id === id));
  if (validIds.length !== openIds.length) {
    openIds = validIds;
    saveOpenIds();
  }

  if (openIds.length === 0) {
    boardEl.classList.remove('has-cards');
    return;
  }
  boardEl.classList.add('has-cards');

  const row = makeEl('div', 'board-row');
  openIds.forEach((id) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    row.appendChild(buildCard(item));
  });
  boardEl.appendChild(row);
  applyBoardTransform();
}

function getGroupSiblings(item) {
  if (!item?.groupId) return null;
  const sibs = items
    .filter((x) => x.groupId === item.groupId)
    .sort((a, b) => (a.pageIndex ?? 0) - (b.pageIndex ?? 0));
  return sibs.length > 1 ? sibs : null;
}

// Pick the board-card visual target. ONLY context.target === 'mobile' gets the
// phone-shaped card; tablet / desktop / responsive all use the landscape card
// so they render at their native 1280×800 proportions instead of being squeezed
// into a phone frame. Falls back to first sibling's context for paginated
// items that don't carry context themselves.
function getCardTarget(item) {
  if (!item) return 'desktop';
  const t = item.context?.target;
  if (t) return t === 'mobile' ? 'mobile' : 'desktop';
  if (item.groupId) {
    const lead = items.find((x) => x.groupId === item.groupId && x.context?.target);
    if (lead) return lead.context.target === 'mobile' ? 'mobile' : 'desktop';
  }
  // No context anywhere — multi-page generations are almost always mobile apps;
  // single-page generations are usually landing pages / desktop.
  return item.groupId && items.some((x) => x.groupId === item.groupId && x.id !== item.id)
    ? 'mobile'
    : 'desktop';
}

// Click handler for the chat result tile. Opens the FIRST page of the
// generation on the board (the current detail view), focused — user can then
// flip pages with the prev/next arrows we already built.
function openGroupOnBoard(group) {
  const first = group.items[0];
  if (!first) return;
  // Open ALL pages in the group side by side (prototype-grid style)
  group.items.forEach((it) => {
    if (!openIds.includes(it.id)) openIds.push(it.id);
  });
  saveOpenIds();
  activeId = first.id;
  renderBoard();
  renderTabs();
  renderThread();
  // Scroll to the first card so user sees the start of the group
  requestAnimationFrame(() => {
    const card = boardEl.querySelector(`.board-card[data-id="${CSS.escape(first.id)}"]`);
    if (card) card.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  });
}

// Replace one open card with a sibling page (same slot in the openIds list).
function swapCardPage(currentId, nextId) {
  const i = openIds.indexOf(currentId);
  if (i === -1) {
    if (!openIds.includes(nextId)) openIds.push(nextId);
  } else {
    openIds[i] = nextId;
  }
  if (activeId === currentId) activeId = nextId;
  saveOpenIds();
  renderBoard();
  renderTabs();
  renderThread();
}

function buildCard(item) {
  const card = makeEl('div', 'board-card' + (item.id === activeId ? ' active' : ''));
  card.dataset.id = item.id;
  card.dataset.target = getCardTarget(item);

  // Frame (iframe preview). Fullscreen now requires clicking the dedicated
  // icon — the preview surface itself is intentionally inert.
  const frame = makeEl('div', 'card-frame');
  const iframe = makeEl('iframe');
  iframe.src = `/preview/${encodeURIComponent(item.id)}`;
  iframe.loading = 'lazy';
  iframe.setAttribute('scrolling', 'no');
  iframe.setAttribute('sandbox', 'allow-scripts');
  frame.appendChild(iframe);
  card.appendChild(frame);

  // Floating controls in the top-right corner: maximize + 3-dots menu.
  const controls = makeEl('div', 'card-controls');

  const expandBtn = makeEl('button', 'card-ctrl-btn');
  expandBtn.type = 'button';
  expandBtn.title = 'Open fullscreen';
  expandBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h6M4 4v6M20 20h-6M20 20v-6M4 4l6 6M20 20l-6-6"/></svg>';
  expandBtn.addEventListener('click', (e) => { e.stopPropagation(); openLightbox(item.id); });
  controls.appendChild(expandBtn);

  const menuBtn = makeEl('button', 'card-ctrl-btn');
  menuBtn.type = 'button';
  menuBtn.title = 'More actions';
  menuBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>';
  controls.appendChild(menuBtn);
  card.appendChild(controls);

  const menu = makeEl('div', 'card-menu');
  menu.hidden = true;
  const makeMenuItem = (label, svg, onClick, extraClass) => {
    const b = makeEl('button', 'card-menu-item' + (extraClass ? ' ' + extraClass : ''));
    b.type = 'button';
    b.innerHTML = `<span class="cmi-icon">${svg}</span><span class="cmi-label">${label}</span>`;
    b.addEventListener('click', (e) => { e.stopPropagation(); onClick(b); });
    menu.appendChild(b);
    return b;
  };
  makeMenuItem(
    'Copy code',
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="3" width="13" height="13" rx="2"/><path d="M3 8h2v11a2 2 0 0 0 2 2h11v-2"/></svg>',
    (b) => copyCode(item.id, b),
  );
  makeMenuItem(
    'Download PNG',
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4v12M6 10l6 6 6-6M5 20h14"/></svg>',
    (b) => downloadPng(item.id, b),
  );
  const pushItem = makeMenuItem(
    'Push to GitHub',
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M6 8.5v7M8.5 6H14a4 4 0 0 1 4 4v5.5"/></svg>',
    (b) => pushToGitHub(item.id, b),
  );
  pushItem.title = ctx.github ? `Push to ${ctx.github}` : 'Connect a GitHub repo to push';
  makeMenuItem(
    'Close',
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    () => closeBoardItem(item.id),
    'danger',
  );
  card.appendChild(menu);

  const closeMenu = () => {
    menu.hidden = true;
    menuBtn.classList.remove('open');
    document.removeEventListener('click', onDocClick, true);
  };
  const onDocClick = (e) => { if (!menu.contains(e.target) && !menuBtn.contains(e.target)) closeMenu(); };
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu.hidden) {
      menu.hidden = false;
      menuBtn.classList.add('open');
      setTimeout(() => document.addEventListener('click', onDocClick, true), 0);
    } else {
      closeMenu();
    }
  });

  return card;
}

function selectItem(id) {
  // Click in the chat: ensure the design is on the board and scroll to it.
  ensureOnBoard(id);
  focusBoardItem(id);
}

function ensureOnBoard(id) {
  const item = items.find((i) => i.id === id);
  const siblings = item ? getGroupSiblings(item) : null;
  const targets = siblings ? siblings.map((s) => s.id) : [id];
  let changed = false;
  targets.forEach((tid) => {
    if (!openIds.includes(tid)) {
      openIds.push(tid);
      changed = true;
    }
  });
  if (changed) {
    saveOpenIds();
    renderBoard();
    renderTabs();
  }
}

function focusBoardItem(id) {
  activeId = id;
  renderTabs();
  // Update active class on cards without rebuilding iframes
  boardEl.querySelectorAll('.board-card').forEach((c) => {
    c.classList.toggle('active', c.dataset.id === id);
  });
  const card = boardEl.querySelector(`.board-card[data-id="${CSS.escape(id)}"]`);
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
  renderThread();
}

function closeBoardItem(id) {
  openIds = openIds.filter((x) => x !== id);
  saveOpenIds();
  if (activeId === id) {
    activeId = openIds[openIds.length - 1] || null;
  }
  renderBoard();
  renderTabs();
  renderThread();
}

/* ---------- Lightbox ---------- */
let lbCurrentId = null;

function openLightbox(id) {
  const item = items.find((i) => i.id === id);
  if (!item) return;
  lbCurrentId = id;
  const siblings = getGroupSiblings(item);
  lightboxTitle.textContent = item.prompt + (siblings
    ? `  ·  ${item.pageLabel || `Page ${(item.pageIndex ?? 0) + 1}`} (${(item.pageIndex ?? 0) + 1}/${siblings.length})`
    : '');
  lightboxStage.innerHTML = '';
  const f = makeEl('iframe');
  f.src = `/preview/${encodeURIComponent(id)}`;
  f.title = item.prompt;
  f.setAttribute('sandbox', 'allow-scripts');
  lightboxStage.appendChild(f);

  // If grouped, render a thin page strip at the bottom of the lightbox
  const oldStrip = lightboxStage.parentElement.querySelector('.lb-pagestrip');
  if (oldStrip) oldStrip.remove();
  if (siblings) {
    const strip = makeEl('div', 'lb-pagestrip');
    siblings.forEach((s) => {
      const pill = makeEl('button', 'lb-pill' + (s.id === id ? ' active' : ''));
      pill.type = 'button';
      pill.textContent = s.pageLabel || `Page ${(s.pageIndex ?? 0) + 1}`;
      pill.addEventListener('click', () => openLightbox(s.id));
      strip.appendChild(pill);
    });
    lightboxStage.parentElement.appendChild(strip);
  }

  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  lightbox.hidden = true;
  lightboxStage.innerHTML = '';
  const oldStrip = lightboxStage.parentElement.querySelector('.lb-pagestrip');
  if (oldStrip) oldStrip.remove();
  lbCurrentId = null;
  document.body.style.overflow = '';
}
lbClose.addEventListener('click', closeLightbox);
lbReload.addEventListener('click', () => {
  const f = lightboxStage.querySelector('iframe');
  if (f) f.src = f.src;
});
lbOpenTab.addEventListener('click', () => {
  if (lbCurrentId) window.open(`/preview/${encodeURIComponent(lbCurrentId)}`, '_blank');
});
lbCopy.addEventListener('click', () => { if (lbCurrentId) copyCode(lbCurrentId, lbCopy); });
lbPng.addEventListener('click', () => { if (lbCurrentId) downloadPng(lbCurrentId, lbPng); });

document.addEventListener('keydown', (e) => {
  if (lightbox.hidden) return;
  if (e.key === 'Escape') { closeLightbox(); return; }
  // Arrow keys flip pages within a multi-page group
  if (!lbCurrentId) return;
  const cur = items.find((i) => i.id === lbCurrentId);
  const sibs = getGroupSiblings(cur);
  if (!sibs) return;
  const idx = sibs.findIndex((s) => s.id === lbCurrentId);
  if (e.key === 'ArrowRight' && idx < sibs.length - 1) openLightbox(sibs[idx + 1].id);
  if (e.key === 'ArrowLeft' && idx > 0) openLightbox(sibs[idx - 1].id);
});

/* ---------- Card actions: Copy code & PNG ---------- */
async function copyCode(id, btn) {
  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.classList.remove('failed', 'copied');
  setBtnLabel(btn, 'Copying…');
  try {
    const res = await fetch(`/api/raw/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    await navigator.clipboard.writeText(text);
    btn.classList.add('copied');
    setBtnLabel(btn, 'Copied');
  } catch (err) {
    btn.classList.add('failed');
    setBtnLabel(btn, 'Failed');
  } finally {
    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.classList.remove('copied', 'failed');
      btn.disabled = false;
    }, 1400);
  }
}

async function downloadPng(id, btn) {
  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.classList.remove('failed', 'saved');
  setBtnLabel(btn, 'Rendering…');
  try {
    const res = await fetch(`/api/png/${encodeURIComponent(id)}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'HTTP ' + res.status);
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rockdesign-${id}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    btn.classList.add('saved');
    setBtnLabel(btn, 'Saved');
  } catch (err) {
    btn.classList.add('failed');
    setBtnLabel(btn, 'Failed');
    appendError(`PNG render failed: ${err?.message || err}`);
  } finally {
    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.classList.remove('saved', 'failed');
      btn.disabled = false;
    }, 1600);
  }
}

function setBtnLabel(btn, text) {
  // Keep the leading icon SVG, replace only the trailing text
  const html = btn.innerHTML;
  const svgEnd = html.indexOf('</svg>');
  if (svgEnd === -1) { btn.textContent = text; return; }
  btn.innerHTML = html.slice(0, svgEnd + 6) + ' ' + text;
}

function buildMiniAttachRow(attachments) {
  if (!attachments?.length) return null;
  const row = makeEl('div', 'msg-attach');
  attachments.forEach((a) => {
    const c = makeEl('span', 'chip-mini');
    if (/\.(png|jpe?g|gif|webp|svg|avif|heic)$/i.test(a.filename) && a.url) {
      const img = makeEl('img', 'thumb-img');
      img.src = a.url;
      img.alt = a.filename;
      c.appendChild(img);
    } else {
      const m = String(a.filename).match(/\.([^./\\]+)$/);
      c.appendChild(makeEl('span', 'thumb-ext', (m ? m[1] : 'file').slice(0, 4)));
    }
    c.appendChild(makeEl('span', 'label', a.filename));
    row.appendChild(c);
  });
  return row;
}

function appendPending(prompt, attachments) {
  const lastUserBody = threadEl.querySelector('.msg.user:last-of-type .body');
  if (!lastUserBody || lastUserBody.textContent !== prompt) {
    const u = makeEl('div', 'msg user');
    u.appendChild(makeEl('div', 'who', 'You'));
    u.appendChild(makeEl('div', 'body', prompt));
    const row = buildMiniAttachRow(attachments);
    if (row) u.appendChild(row);
    threadEl.appendChild(u);
  }
  const pend = makeEl('div', 'msg pending');
  pend.appendChild(makeEl('div', 'who', 'rockdesign'));
  const body = makeEl('div', 'body');
  body.appendChild(makeEl('div', 'spinner'));
  const status = makeEl('span', 'pending-status', 'Starting up…');
  body.appendChild(status);
  pend.appendChild(body);
  const log = makeEl('div', 'pending-log');
  pend.appendChild(log);
  threadEl.appendChild(pend);
  threadEl.scrollTop = threadEl.scrollHeight;
  // Animated rotating tips so the user sees motion before the first file lands.
  const tips = [
    'Claude is reading your design system…',
    'Sketching the first screen…',
    'Composing the layout…',
    'Writing styles inline…',
    'Polishing details…',
  ];
  let tipIdx = 0;
  const t0 = Date.now();
  pend._tipTimer = setInterval(() => {
    if (!pend.isConnected) { clearInterval(pend._tipTimer); return; }
    if (pend.dataset.pages) return; // real progress overrides tips
    tipIdx = (tipIdx + 1) % tips.length;
    const secs = Math.floor((Date.now() - t0) / 1000);
    status.textContent = `${tips[tipIdx]}  ·  ${secs}s`;
  }, 2500);
  pend._statusEl = status;
  pend._logEl = log;
  pend._t0 = t0;
  return pend;
}

// Update the pending message with live progress as pages are persisted.
function updatePendingProgress(pend, newRecords) {
  if (!pend || !pend.isConnected) return;
  const status = pend._statusEl;
  const log = pend._logEl;
  if (!status || !log) return;
  const existing = parseInt(pend.dataset.pages || '0', 10);
  const total = existing + newRecords.length;
  pend.dataset.pages = String(total);
  for (const rec of newRecords) {
    const entry = makeEl('div', 'pending-log-entry');
    entry.innerHTML = `<span class="pending-check">✓</span> ${rec.pageLabel || rec.id}`;
    log.appendChild(entry);
  }
  const secs = Math.floor((Date.now() - pend._t0) / 1000);
  status.textContent = `Wrote ${total} ${total === 1 ? 'page' : 'pages'} so far…  ·  ${secs}s`;
}

function appendError(msg, pendingEl) {
  if (pendingEl) pendingEl.remove();
  const err = makeEl('div', 'msg error');
  err.appendChild(makeEl('div', 'who', 'error'));
  err.appendChild(makeEl('div', 'body', msg));
  threadEl.appendChild(err);
  threadEl.scrollTop = threadEl.scrollHeight;
}

async function loadAll() {
  if (!currentProjectId) { items = []; return; }
  try {
    const res = await fetch(`/api/generations?projectId=${encodeURIComponent(currentProjectId)}`);
    items = await res.json();
    if (!Array.isArray(items)) items = [];
    // Drop board ids that no longer exist (e.g., db.json wiped) — but DON'T
    // auto-add anything new. The board only shows what the user explicitly
    // clicked on.
    const valid = openIds.filter((id) => items.some((i) => i.id === id));
    if (valid.length !== openIds.length) { openIds = valid; saveOpenIds(); }
    if (activeId && !items.some((i) => i.id === activeId)) activeId = null;
    renderThread();
    renderBoard();
    renderTabs();
  } catch (err) {
    appendError('Failed to load history: ' + (err?.message || err));
  }
}

async function generate(e) {
  e?.preventDefault();
  const prompt = promptEl.value.trim();
  if (!prompt) return;

  // Block submit while any attachment is still uploading
  if (pendingAttachments.some((a) => a.uploading)) {
    appendError('File still uploading, please wait.');
    return;
  }

  sendBtn.disabled = true;
  promptEl.value = '';
  autoSize(promptEl);
  const attachments = pendingAttachments
    .filter((a) => !a.uploading && a.relPath)
    .map((a) => ({ filename: a.filename, relPath: a.relPath, url: a.url }));
  const pend = appendPending(prompt, attachments);

  // Live streaming: poll /api/generations while the server runs Claude. Each
  // new HTML file the server persists shows up here within ~1.5s and we
  // auto-open it on the board so the user sees pages arrive one by one.
  const projectAtStart = currentProjectId;
  const seenIds = new Set(items.map((it) => it.id));
  let pendRemoved = false;
  const pollTimer = setInterval(async () => {
    if (!projectAtStart || projectAtStart !== currentProjectId) return;
    try {
      const r = await fetch(`/api/generations?projectId=${encodeURIComponent(projectAtStart)}`);
      const fresh = await r.json();
      if (!Array.isArray(fresh)) return;
      const newOnes = fresh.filter((d) => !seenIds.has(d.id));
      if (!newOnes.length) return;
      newOnes.forEach((d) => seenIds.add(d.id));
      items.push(...newOnes);
      newOnes.forEach((d) => {
        if (!openIds.includes(d.id)) openIds.push(d.id);
      });
      saveOpenIds();
      // Keep the pending message visible — update it with live progress
      // so the user knows the system is actually working, not stuck.
      updatePendingProgress(pend, newOnes);
      renderBoard();
      renderTabs();
    } catch { /* swallow — next tick retries */ }
  }, 1500);

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, attachments, context: ctx, projectId: currentProjectId, model: getModel() }),
    });
    clearInterval(pollTimer);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Generation failed');

    // Multi-page response: { groupId, pageCount, records: [...] }
    // Single-page response: a bare design record.
    const records = Array.isArray(data?.records) ? data.records : [data];
    records.forEach((rec) => {
      const existing = items.findIndex((it) => it.id === rec.id);
      if (existing >= 0) items[existing] = rec;
      else items.push(rec);
      if (!openIds.includes(rec.id)) openIds.push(rec.id);
    });
    saveOpenIds();
    if (!pendRemoved) { pend.remove(); pendRemoved = true; }
    pendingAttachments = [];
    renderChips();
    renderThread();
    renderBoard();
    renderTabs();
  } catch (err) {
    clearInterval(pollTimer);
    appendError('Error: ' + (err?.message || err), pend);
  } finally {
    sendBtn.disabled = false;
    promptEl.focus();
  }
}

/* ---------- Attach popover & file uploads ---------- */

function isImage(name) {
  return /\.(png|jpe?g|gif|webp|svg|avif|heic)$/i.test(name);
}

function extOf(name) {
  const m = String(name).match(/\.([^./\\]+)$/);
  return m ? m[1] : 'file';
}

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || '').split(',')[1] || '');
    fr.onerror = () => reject(fr.error || new Error('read failed'));
    fr.readAsDataURL(file);
  });
}

function renderChips() {
  attachChips.innerHTML = '';
  if (pendingAttachments.length === 0) {
    attachChips.hidden = true;
    return;
  }
  attachChips.hidden = false;
  pendingAttachments.forEach((a) => {
    const chip = document.createElement('span');
    chip.className = 'chip' + (a.uploading ? ' uploading' : '');
    if (a.isImg && a.url) {
      const img = document.createElement('img');
      img.className = 'thumb-img';
      img.src = a.url;
      img.alt = a.filename;
      chip.appendChild(img);
    } else {
      const ext = document.createElement('span');
      ext.className = 'thumb-ext';
      ext.textContent = extOf(a.filename).slice(0, 4);
      chip.appendChild(ext);
    }
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = a.uploading ? `${a.filename} · uploading…` : a.filename;
    chip.appendChild(label);

    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'x';
    x.title = 'Remove';
    x.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    x.addEventListener('click', () => {
      pendingAttachments = pendingAttachments.filter((p) => p.localId !== a.localId);
      renderChips();
    });
    chip.appendChild(x);

    attachChips.appendChild(chip);
  });
}

async function uploadFile(file) {
  const localId = `loc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const entry = {
    localId,
    filename: file.name,
    isImg: isImage(file.name),
    uploading: true,
    url: isImage(file.name) ? URL.createObjectURL(file) : null,
  };
  pendingAttachments.push(entry);
  renderChips();

  try {
    const b64 = await readAsBase64(file);
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, dataBase64: b64 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'upload failed');

    Object.assign(entry, {
      uploading: false,
      relPath: data.relPath,
      url: data.url,
      id: data.id,
      filename: data.filename,
    });
    renderChips();
  } catch (err) {
    pendingAttachments = pendingAttachments.filter((p) => p.localId !== localId);
    renderChips();
    appendError(`Upload failed (${file.name}): ${err?.message || err}`);
  }
}

function openPopover() {
  attachPop.hidden = false;
  attachBtn.setAttribute('aria-expanded', 'true');
}
function closePopover() {
  attachPop.hidden = true;
  attachBtn.setAttribute('aria-expanded', 'false');
}
function togglePopover() {
  if (attachPop.hidden) openPopover(); else closePopover();
}

attachBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  togglePopover();
});

document.addEventListener('click', (e) => {
  if (attachPop.hidden) return;
  if (attachPop.contains(e.target) || attachBtn.contains(e.target)) return;
  closePopover();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !attachPop.hidden) closePopover();
});

attachPop.addEventListener('click', (e) => {
  const item = e.target.closest('.pop-item');
  if (!item) return;
  if (item.classList.contains('disabled')) {
    appendError('This feature is not available yet.');
    closePopover();
    return;
  }
  const action = item.dataset.action;
  closePopover();
  switch (action) {
    case 'attach-file':   fileInput.click(); break;
    case 'upload-fig':    figInput.click(); break;
    case 'ref-project':   openProjectRefModal(); break;
    case 'github':        openGithubModal(); break;
    case 'local-code':    openLocalCodeModal(); break;
    case 'grab-web':      openGrabWebModal(); break;
    case 'skills':        openDesignSystem(); break;
    case 'connectors':    openConnectors(); break;
  }
});

fileInput.addEventListener('change', () => {
  Array.from(fileInput.files || []).forEach(uploadFile);
  fileInput.value = '';
});
figInput.addEventListener('change', () => {
  Array.from(figInput.files || []).forEach(uploadFile);
  figInput.value = '';
});

// Drag & drop anywhere over the chat panel (composer included)
const chatEl = document.querySelector('.chat');
let dragDepth = 0;
const isFileDrag = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');

chatEl.addEventListener('dragenter', (e) => {
  if (!isFileDrag(e)) return;
  e.preventDefault();
  dragDepth++;
  chatEl.classList.add('drag-over');
});
chatEl.addEventListener('dragover', (e) => {
  if (!isFileDrag(e)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});
chatEl.addEventListener('dragleave', (e) => {
  if (!isFileDrag(e)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) chatEl.classList.remove('drag-over');
});
chatEl.addEventListener('drop', (e) => {
  if (!isFileDrag(e)) return;
  e.preventDefault();
  dragDepth = 0;
  chatEl.classList.remove('drag-over');
  Array.from(e.dataTransfer.files || []).forEach(uploadFile);
});

composerEl.addEventListener('submit', generate);
promptEl.addEventListener('input', () => autoSize(promptEl));
promptEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    generate(e);
  }
});

headerSettingsBtn.addEventListener('click', openOnboarding);

/* ---------- Context state (persisted per project) ---------- */
// ctx (projectType / target / style / github / projectRef / localCode) used to
// live in a single global key. That meant style preferences leaked across
// projects — opening a marketing landing project still showed your old
// "Mobile / Liquid glass" chips. Now each project gets its own key:
//   rockdesign:ctx:<projectId>
// On enterProject we look up that key first; if missing, fall back to the
// seeded project.context the server returns.
const CTX_KEY_PREFIX = 'rockdesign:ctx:';
const CTX_LEGACY_KEY = 'rockdesign:ctx';
const ONB_KEY = 'rockdesign:onboarded';

const CTX_META = {
  projectType: { label: 'Type', icon: 'box' },
  target:      { label: 'Target', icon: 'screen' },
  style:       { label: 'Style', icon: 'spark' },
  github:      { label: 'GitHub', icon: 'git' },
  projectRef:  { label: 'Ref', icon: 'folder' },
  localCode:   { label: 'Local code', icon: 'folder' },
};
const VALUE_LABEL = {
  projectType: { web: 'Web app', mobile: 'Mobile app', marketing: 'Marketing site', dashboard: 'Dashboard' },
  target: { mobile: 'Mobile', tablet: 'Tablet', desktop: 'Desktop', responsive: 'Responsive' },
  style: { 'liquid-glass': 'Liquid glass', minimal: 'Minimal', brutalist: 'Brutalist', editorial: 'Editorial' },
};

let ctx = {};

function ctxKey(projectId) {
  return CTX_KEY_PREFIX + projectId;
}

// Load context for a specific project. Precedence:
//   1. per-project localStorage (`rockdesign:ctx:<id>`) — user's edits
//   2. server-seeded project.context (from /api/projects)
//   3. empty
function loadCtxForProject(projectId) {
  if (!projectId) return {};
  try {
    const raw = localStorage.getItem(ctxKey(projectId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch { /* fall through */ }
  const p = projects.find((x) => x.id === projectId);
  return (p && p.context && typeof p.context === 'object') ? { ...p.context } : {};
}

function saveCtx() {
  if (!currentProjectId) return;
  try { localStorage.setItem(ctxKey(currentProjectId), JSON.stringify(ctx)); } catch {}
  renderContextBar();
}

function ctxIconSVG(name) {
  const map = {
    box:    '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>',
    screen: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
    spark:  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z"/></svg>',
    git:    '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M6 8v8M8 6h6a4 4 0 0 1 4 4v6"/></svg>',
    folder: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  };
  return map[name] || '';
}

function renderContextBar() {
  contextBar.innerHTML = '';
  const keys = Object.keys(CTX_META).filter((k) => ctx[k]);
  if (keys.length === 0) {
    contextBar.hidden = true;
    return;
  }
  contextBar.hidden = false;
  keys.forEach((k) => {
    const chip = document.createElement('span');
    chip.className = 'ctx-chip';
    chip.dataset.key = k;
    chip.title = 'Click to edit';

    const icon = document.createElement('span');
    icon.className = 'ctx-icon';
    icon.innerHTML = ctxIconSVG(CTX_META[k].icon);
    chip.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'ctx-label';
    label.textContent = (VALUE_LABEL[k] && VALUE_LABEL[k][ctx[k]]) || ctx[k];
    chip.appendChild(label);

    chip.addEventListener('click', (e) => {
      if (e.target.closest('.ctx-x')) return;
      reopenContext(k);
    });

    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'ctx-x';
    x.title = 'Remove';
    x.innerHTML = '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    x.addEventListener('click', (e) => {
      e.stopPropagation();
      delete ctx[k];
      saveCtx();
    });
    chip.appendChild(x);

    contextBar.appendChild(chip);
  });
}

function reopenContext(key) {
  switch (key) {
    case 'projectType':
    case 'target':
    case 'style':
      openOnboarding(); break;
    case 'github':       openGithubModal(); break;
    case 'projectRef':   openProjectRefModal(); break;
    case 'localCode':    openLocalCodeModal(); break;
  }
}

/* ---------- Onboarding modal ---------- */
let onbChoice = {};

function openOnboarding() {
  onbChoice = { projectType: ctx.projectType, target: ctx.target, style: ctx.style };
  onbBackdrop.querySelectorAll('.opt-card').forEach((b) => {
    const q = b.parentElement.dataset.q;
    b.classList.toggle('selected', onbChoice[q] === b.dataset.value);
  });
  onbBackdrop.hidden = false;
}
function closeOnboarding() { onbBackdrop.hidden = true; }

onbBackdrop.addEventListener('click', (e) => {
  if (e.target === onbBackdrop) closeOnboarding();
  const card = e.target.closest('.opt-card');
  if (!card) return;
  const q = card.parentElement.dataset.q;
  const v = card.dataset.value;
  onbChoice[q] = onbChoice[q] === v ? null : v;
  card.parentElement.querySelectorAll('.opt-card').forEach((c) => c.classList.remove('selected'));
  if (onbChoice[q]) card.classList.add('selected');
});
onbClose.addEventListener('click', closeOnboarding);
onbSkip.addEventListener('click', () => {
  localStorage.setItem(ONB_KEY, '1');
  closeOnboarding();
});
onbSave.addEventListener('click', () => {
  ['projectType', 'target', 'style'].forEach((k) => {
    if (onbChoice[k]) ctx[k] = onbChoice[k]; else delete ctx[k];
  });
  saveCtx();
  localStorage.setItem(ONB_KEY, '1');
  closeOnboarding();
  renderEmptyHero();
});

/* ---------- Empty-state hero inside thread ---------- */
function renderEmptyHero() {
  // Show a friendly hero in the empty thread if no items and onboarding done
  if (items.length > 0) return;
  threadEl.innerHTML = '';
  const hero = makeEl('div', 'thread-hero');
  const h = makeEl('h3', null, 'What are we designing today?');
  const p = makeEl('p', null,
    ctx.target || ctx.style
      ? `I'll keep your preferences in mind. Drop attachments or describe a screen — Claude will write a single-file HTML you can preview right here.`
      : `Tell me what you're building, or take 10 seconds to set the scene first so every generation fits.`
  );
  hero.appendChild(h);
  hero.appendChild(p);

  if (!ctx.target && !ctx.style) {
    const row = makeEl('div', 'quick-row');
    [['Web app', 'web', 'desktop'], ['Mobile app', 'mobile', 'mobile'], ['Marketing site', 'marketing', 'responsive']]
      .forEach(([label, type, target]) => {
        const b = makeEl('button', 'quick-pill', label);
        b.type = 'button';
        b.addEventListener('click', () => {
          ctx.projectType = type;
          ctx.target = target;
          saveCtx();
          renderEmptyHero();
        });
        row.appendChild(b);
      });
    hero.appendChild(row);
  }

  threadEl.appendChild(hero);
}

/* ---------- Generic input modal helper ---------- */
function showInputModal({ title, description, fields, submitLabel = 'Save', extraButton }) {
  return new Promise((resolve) => {
    inputBackdrop.hidden = false;
    inputBackdrop.innerHTML = '';
    const modal = makeEl('div', 'modal');
    modal.style.maxWidth = '480px';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const head = makeEl('header', 'modal-head');
    const titleWrap = makeEl('div');
    titleWrap.appendChild(makeEl('h2', null, title));
    if (description) titleWrap.appendChild(makeEl('p', 'modal-lead', description));
    head.appendChild(titleWrap);
    const x = makeEl('button', 'icon-btn');
    x.type = 'button';
    x.title = 'Close';
    x.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    head.appendChild(x);
    modal.appendChild(head);

    const body = makeEl('div', 'modal-body');
    body.style.gap = '14px';
    const inputs = {};
    const helpers = {};
    fields.forEach((f) => {
      const wrap = makeEl('div', 'field');
      if (f.label) wrap.appendChild(makeEl('label', null, f.label));
      if (f.hint) wrap.appendChild(makeEl('span', 'hint', f.hint));
      if (f.type === 'choice') {
        const group = makeEl('div', 'choice-group');
        let current = f.value || '';
        const buttons = [];
        f.options.forEach((opt) => {
          const b = makeEl('button', 'choice-btn', opt.label);
          b.type = 'button';
          b.dataset.value = opt.value;
          if (current === opt.value) b.classList.add('selected');
          b.addEventListener('click', () => {
            current = opt.value;
            buttons.forEach((x) => x.classList.toggle('selected', x.dataset.value === current));
          });
          group.appendChild(b);
          buttons.push(b);
        });
        inputs[f.name] = { isChoice: true, get value() { return current; } };
        wrap.appendChild(group);
        body.appendChild(wrap);
        return;
      }
      const el = f.multiline
        ? makeEl('textarea')
        : Object.assign(document.createElement('input'), { type: f.type || 'text' });
      el.placeholder = f.placeholder || '';
      el.value = f.value || '';
      if (f.autofocus) setTimeout(() => el.focus(), 50);
      inputs[f.name] = el;
      wrap.appendChild(el);
      if (f.helperEl) {
        helpers[f.name] = makeEl('div', 'path-result');
        helpers[f.name].textContent = '';
        wrap.appendChild(helpers[f.name]);
      }
      body.appendChild(wrap);
      if (f.onInput) {
        el.addEventListener('input', () => f.onInput(el.value, helpers[f.name]));
      }
    });
    modal.appendChild(body);

    const actions = makeEl('div', 'modal-actions');
    actions.style.padding = '14px 20px 18px';
    actions.style.borderTop = '1px solid var(--hair)';
    if (extraButton) {
      const xb = makeEl('button', 'btn-secondary', extraButton.label);
      xb.type = 'button';
      xb.style.marginRight = 'auto';
      xb.addEventListener('click', () => { extraButton.onClick({ inputs, close }); });
      actions.appendChild(xb);
    }
    const cancel = makeEl('button', 'btn-secondary', 'Cancel');
    cancel.type = 'button';
    cancel.addEventListener('click', () => close(null));
    actions.appendChild(cancel);

    const submit = makeEl('button', 'btn-primary', submitLabel);
    submit.type = 'button';
    submit.addEventListener('click', () => {
      const values = {};
      for (const [k, el] of Object.entries(inputs)) {
        const v = el.value;
        values[k] = typeof v === 'string' ? v.trim() : v;
      }
      close(values);
    });
    actions.appendChild(submit);
    modal.appendChild(actions);

    inputBackdrop.appendChild(modal);

    function close(result) {
      inputBackdrop.hidden = true;
      inputBackdrop.innerHTML = '';
      onKey && document.removeEventListener('keydown', onKey);
      backdropClick && inputBackdrop.removeEventListener('click', backdropClick);
      resolve(result);
    }
    x.addEventListener('click', () => close(null));
    const onKey = (e) => {
      if (e.key === 'Escape') close(null);
      if (e.key === 'Enter' && !e.shiftKey && e.target?.tagName !== 'TEXTAREA') {
        submit.click();
      }
    };
    document.addEventListener('keydown', onKey);
    const backdropClick = (e) => { if (e.target === inputBackdrop) close(null); };
    inputBackdrop.addEventListener('click', backdropClick);
  });
}

/* ---------- Popover-action modals ---------- */
async function openProjectRefModal() {
  const values = await showInputModal({
    title: 'Reference another project',
    description: 'Name a previous rockdesign project — Claude will try to match its aesthetic.',
    fields: [{
      name: 'name',
      label: 'Project name',
      placeholder: 'e.g. landing-v2',
      value: ctx.projectRef || '',
      autofocus: true,
    }],
  });
  if (values === null) return;
  if (values.name) ctx.projectRef = values.name; else delete ctx.projectRef;
  saveCtx();
}

async function openGithubModal() {
  const values = await showInputModal({
    title: 'GitHub',
    description: 'Connect a repo to push generated designs into it.',
    fields: [
      {
        name: 'repo',
        label: 'Repository',
        placeholder: 'owner/repo or github.com/owner/repo',
        value: ctx.github || '',
        autofocus: !ctx.github,
      },
      {
        name: 'token',
        label: 'Personal access token',
        type: 'password',
        placeholder: 'ghp_…',
        value: ctx.githubToken || '',
        autofocus: !!ctx.github,
        hint: 'Needs the "Contents: read & write" scope on the target repo. Stored in your browser; only sent to api.github.com.',
      },
      {
        name: 'branch',
        label: 'Branch',
        placeholder: 'main',
        value: ctx.githubBranch || 'main',
      },
      {
        name: 'basePath',
        label: 'Folder in repo',
        placeholder: 'designs',
        value: ctx.githubPath || 'designs',
        hint: 'Files land at <folder>/<slug>.html — existing files are updated in place.',
      },
    ],
    extraButton: (ctx.github || ctx.githubToken) ? {
      label: 'Sign out',
      onClick: ({ close }) => {
        delete ctx.github;
        delete ctx.githubToken;
        delete ctx.githubBranch;
        delete ctx.githubPath;
        saveCtx();
        close(null);
      },
    } : null,
  });
  if (values === null) return;
  if (values.repo) {
    ctx.github = values.repo
      .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
      .replace(/\.git\/?$/, '')
      .replace(/^\/+|\/+$/g, '');
  } else {
    delete ctx.github;
  }
  if (values.token) ctx.githubToken = values.token; else delete ctx.githubToken;
  if (values.branch) ctx.githubBranch = values.branch; else delete ctx.githubBranch;
  if (values.basePath) ctx.githubPath = values.basePath; else delete ctx.githubPath;
  saveCtx();
}

async function pushToGitHub(id, btn) {
  if (!ctx.github || !ctx.githubToken) {
    openGithubModal();
    return;
  }
  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.classList.remove('saved', 'failed');
  setBtnLabel(btn, 'Pushing…');
  try {
    const res = await fetch('/api/github/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: [id],
        repo: ctx.github,
        token: ctx.githubToken,
        branch: ctx.githubBranch || 'main',
        basePath: ctx.githubPath || 'designs',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'push failed');
    if (data.errors?.length) throw new Error(data.errors[0].error || 'push failed');
    btn.classList.add('saved');
    setBtnLabel(btn, 'Pushed');
    const url = data.pushed?.[0]?.htmlUrl;
    if (url) {
      const tip = makeEl('div', 'msg ai');
      tip.appendChild(makeEl('div', 'who', 'github'));
      const body = makeEl('div', 'body');
      body.style.fontSize = '12.5px';
      body.style.background = 'rgba(61, 220, 151, 0.08)';
      body.style.borderColor = 'rgba(61, 220, 151, 0.32)';
      body.style.color = '#0a4a30';
      body.innerHTML = `Pushed <strong>${escapeHtml(id)}.html</strong> → <a href="${escapeHtml(url)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">view on GitHub</a>`;
      tip.appendChild(body);
      threadEl.appendChild(tip);
      threadEl.scrollTop = threadEl.scrollHeight;
    }
  } catch (err) {
    btn.classList.add('failed');
    setBtnLabel(btn, 'Failed');
    appendError(`GitHub push failed: ${err?.message || err}`);
  } finally {
    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.classList.remove('saved', 'failed');
      btn.disabled = false;
    }, 1800);
  }
}

async function openLocalCodeModal() {
  let lastCheck = null;
  const values = await showInputModal({
    title: 'Link local code',
    description: 'Absolute path to a folder Claude can Read while generating.',
    fields: [{
      name: 'path',
      label: 'Folder path',
      placeholder: '/Users/you/Desktop/Projects/my-app',
      value: ctx.localCode || '',
      autofocus: true,
      helperEl: true,
      onInput: debounce(async (val, helper) => {
        if (!val) { helper.textContent = ''; helper.className = 'path-result'; return; }
        helper.textContent = 'Checking…';
        helper.className = 'path-result';
        try {
          const res = await fetch('/api/check-path', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: val }),
          });
          const data = await res.json();
          lastCheck = data;
          if (data.exists && data.kind === 'dir') {
            helper.className = 'path-result ok';
            helper.innerHTML = `<strong>Found folder.</strong> ` +
              (data.sample?.length
                ? `<div class="local-files">${data.sample.map((s) => '· ' + escapeHtml(s)).join('<br>')}</div>`
                : '');
          } else if (data.exists) {
            helper.className = 'path-result err';
            helper.textContent = 'That is a file, not a folder.';
          } else {
            helper.className = 'path-result err';
            helper.textContent = data.error || 'Not found.';
          }
        } catch (err) {
          helper.className = 'path-result err';
          helper.textContent = String(err?.message || err);
        }
      }, 350),
    }],
    extraButton: ctx.localCode ? {
      label: 'Unlink',
      onClick: ({ close }) => { delete ctx.localCode; saveCtx(); close(null); },
    } : null,
  });
  if (values === null) return;
  if (values.path) ctx.localCode = values.path; else delete ctx.localCode;
  saveCtx();
}

async function openGrabWebModal() {
  const values = await showInputModal({
    title: 'Grab web element',
    description: 'Paste a public URL. rockdesign fetches the page and attaches it as a reference.',
    submitLabel: 'Fetch',
    fields: [{
      name: 'url',
      label: 'URL',
      type: 'url',
      placeholder: 'https://example.com',
      autofocus: true,
    }],
  });
  if (values === null || !values.url) return;
  await grabWeb(values.url);
}

async function grabWeb(url) {
  const localId = `loc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const entry = {
    localId,
    filename: 'web_' + (url.replace(/^https?:\/\//, '').slice(0, 24)),
    isImg: false,
    uploading: true,
  };
  pendingAttachments.push(entry);
  renderChips();
  try {
    const res = await fetch('/api/grab-web', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'fetch failed');
    Object.assign(entry, {
      uploading: false,
      relPath: data.relPath,
      url: data.url,
      id: data.id,
      filename: data.filename,
    });
    renderChips();
  } catch (err) {
    pendingAttachments = pendingAttachments.filter((p) => p.localId !== localId);
    renderChips();
    appendError(`Web grab failed: ${err?.message || err}`);
  }
}

/* ---------- Design system modal ---------- */
let dsCurrent = '';
let dsActivePreset = 'current';

const DS_PRESETS = {
  minimal: `# Design System — Minimal

You are a senior product designer who values restraint above all.

## Output contract
- Single self-contained HTML file. All CSS & JS inline. No external deps.

## Typography
Use a strict scale: 11 / 13 / 16 / 22 / 32 / 48. System font stack only.
Body 16/1.55. Headings tight (-0.01em). No display fonts.

## Color
- bg: #FFFFFF
- ink: #111111
- ink-dim: #6B7280
- hair: rgba(0,0,0,0.08)
- accent: #111111 (text itself is the only accent)

## Layout
- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48.
- Generous whitespace. 1px hairlines only. No shadows.
- Radii: 8 / 12 max.

## Components
- Buttons: hairline outline, no fill. Solid only for primary, ink fill.
- Cards: hairline border, no shadow, 16px radius.
- No glass, no gradients, no glow.

## Accessibility
AA contrast, visible focus, semantic HTML, 44px tap targets.

## Quality
Real copy. No decoration that doesn't earn its place.
`,

  brutalist: `# Design System — Brutalist

You are a designer who treats the screen like newsprint and concrete.

## Output contract
Single inline HTML, no external deps.

## Typography
- System sans for body; system mono ('SF Mono') for accents and numbers.
- Use 12 / 14 / 18 / 24 / 36 / 64. Tight leading. Mostly UPPERCASE for titles.

## Color
- bg: #F4F2EC (off-white)
- ink: #0A0A0A
- accent: #FF4E1A (one hot color)
- hair: #0A0A0A at 100%

## Layout
- Big slab blocks. Asymmetric grids. Visible 2px borders.
- Hard offset shadows: \`box-shadow: 6px 6px 0 var(--ink)\`.
- Radii: 0 (everywhere) or full pill 999 for chips.
- Spacing: 4 / 8 / 16 / 24 / 48 / 96.

## Components
- Buttons: 2px ink border, hard shadow, no radius, all caps label.
- Cards: 2px border, hard shadow.
- Heavy use of tags/chips with monospace labels.

## Quality
Loud but legible. Hierarchy via size, not subtlety.
`,

  apple: `# Design System — Apple HIG

You are a designer following Apple Human Interface Guidelines.

## Output contract
Single inline HTML, no external deps.

## Typography
- SF Pro stack: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif.
- iOS scale (pt-like in px): 11 / 13 / 15 / 17 / 20 / 22 / 28 / 34 / 41.
- Use the named text styles: largeTitle 34, title1 28, title2 22, headline 17/600, body 17/400, callout 16, subhead 15, footnote 13, caption 12.

## Color
Light:
- bg: #F2F2F7 (systemGroupedBackground)
- surface: #FFFFFF
- ink: #1C1C1E (label)
- secondary: rgba(60,60,67,0.6)
- separator: rgba(60,60,67,0.29)
- tint: #007AFF (systemBlue)

Dark variant available; pick one per design.

## Layout
- 8px grid. Spacing: 4 / 8 / 12 / 16 / 24 / 32 / 44.
- Radii: 10 / 14 / 18 / 22 (matches iOS standards).
- Use SF Symbols-like inline SVG icons (1.5 stroke).

## Components
- Buttons: tinted background with tint text, 14 radius, 44 tall.
- Cards: rounded grouped lists with hairline separators.
- Bottom sheet pattern: drag handle, 22 radius top.

## Quality
Feel native, not "designed". Crisp hairlines, deferential color.
`,

  material: `# Design System — Material 3

You are a designer following Material You / Material 3.

## Output contract
Single inline HTML, no external deps.

## Typography
- Stack: 'Roboto', system-ui, sans-serif (system fallback only).
- Roles: displayLarge 57, displayMedium 45, headlineLarge 32, titleLarge 22, titleMedium 16/500, bodyLarge 16, bodyMedium 14, labelLarge 14/500.

## Color (M3 tokens, dynamic-color friendly)
- primary: #6750A4
- onPrimary: #FFFFFF
- primaryContainer: #EADDFF
- surface: #FFFBFE
- onSurface: #1C1B1F
- outline: #79747E
- elevation overlays via tonal surfaces.

## Layout
- 4px grid. Radii: 4 / 8 / 12 / 16 / 28.
- FAB: 56dp, large radius.
- Spacing: 4 / 8 / 12 / 16 / 24 / 32 / 56.

## Components
- Filled, tonal, outlined, text buttons (offer the right variant for hierarchy).
- Cards (filled, outlined, elevated): elevation via subtle tonal background.
- Top app bar: small, medium, large variants.
- Use state layers (8% / 12% / 16% overlays) for hover/focus/pressed.

## Motion
Use M3 easing emphasized / standard tokens. Container transforms.

## Quality
Adaptive, layered, generous in touch targets (48dp).
`,
};

async function openDesignSystem() {
  dsBackdrop.hidden = false;
  dsStatus.textContent = 'Loading…';
  dsStatus.className = 'ds-save-status';
  try {
    const res = await fetch('/api/design-system');
    const data = await res.json();
    dsCurrent = data.content || '';
    dsEditor.value = dsCurrent;
    dsStatus.textContent = '';
    setActivePreset('current');
  } catch (err) {
    dsStatus.textContent = 'Failed to load: ' + (err?.message || err);
    dsStatus.className = 'ds-save-status err';
  }
}
function closeDesignSystem() { dsBackdrop.hidden = true; }

function setActivePreset(name) {
  dsActivePreset = name;
  dsTabs.querySelectorAll('.ds-tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.preset === name);
  });
}

dsTabs.addEventListener('click', (e) => {
  const tab = e.target.closest('.ds-tab');
  if (!tab) return;
  const preset = tab.dataset.preset;
  setActivePreset(preset);
  if (preset === 'current') dsEditor.value = dsCurrent;
  else if (preset === 'rockdesign') {
    // The shipped default lives on disk; reload it
    dsEditor.value = dsCurrent;
    dsStatus.textContent = 'Tip · "Current" reflects what Claude reads now. Save to overwrite.';
    dsStatus.className = 'ds-save-status';
  } else if (DS_PRESETS[preset]) {
    dsEditor.value = DS_PRESETS[preset];
  }
});

dsRevert.addEventListener('click', () => {
  dsEditor.value = dsCurrent;
  setActivePreset('current');
  dsStatus.textContent = 'Reverted to last saved.';
  dsStatus.className = 'ds-save-status';
});

dsSave.addEventListener('click', async () => {
  dsStatus.textContent = 'Saving…';
  dsStatus.className = 'ds-save-status';
  try {
    const res = await fetch('/api/design-system', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: dsEditor.value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'save failed');
    dsCurrent = dsEditor.value;
    dsStatus.textContent = `Saved · ${data.bytes} bytes`;
    dsStatus.className = 'ds-save-status saved';
    setActivePreset('current');
  } catch (err) {
    dsStatus.textContent = 'Error: ' + (err?.message || err);
    dsStatus.className = 'ds-save-status err';
  }
});

dsClose.addEventListener('click', closeDesignSystem);
dsBackdrop.addEventListener('click', (e) => { if (e.target === dsBackdrop) closeDesignSystem(); });

/* ---------- Connectors modal ---------- */
function openConnectors() {
  connectorsList.innerHTML = '';
  const rows = [
    {
      icon: 'git', name: 'GitHub',
      meta: ctx.github ? `Connected · ${ctx.github}` : 'Not connected',
      connected: !!ctx.github,
      action: ctx.github ? 'Manage' : 'Connect',
      onClick: () => { closeConnectors(); openGithubModal(); },
    },
    {
      icon: 'folder', name: 'Local code',
      meta: ctx.localCode ? `Linked · ${ctx.localCode}` : 'No local folder linked',
      connected: !!ctx.localCode,
      action: ctx.localCode ? 'Manage' : 'Link',
      onClick: () => { closeConnectors(); openLocalCodeModal(); },
    },
    {
      icon: 'web', name: 'Web grab',
      meta: 'Ready · paste any URL to snapshot',
      connected: true,
      action: 'Grab',
      onClick: () => { closeConnectors(); openGrabWebModal(); },
    },
    {
      icon: 'spark', name: 'Design system',
      meta: 'Skill Claude reads on every generation',
      connected: true,
      action: 'Edit',
      onClick: () => { closeConnectors(); openDesignSystem(); },
    },
    {
      icon: 'figma', name: 'Figma',
      meta: 'Upload .fig files from the attach menu',
      connected: false,
      action: 'How to download',
      onClick: () => window.open('https://help.figma.com/hc/en-us/articles/360045003114', '_blank'),
    },
  ];
  rows.forEach((r) => {
    const row = makeEl('div', 'connector-row');
    const icon = makeEl('div', 'connector-icon');
    icon.innerHTML = connectorIcon(r.icon);
    row.appendChild(icon);
    const body = makeEl('div', 'connector-body');
    body.appendChild(makeEl('div', 'connector-name', r.name));
    body.appendChild(makeEl('div', 'connector-meta', r.meta));
    row.appendChild(body);
    const btn = makeEl('button', 'connector-action' + (r.connected ? ' connected' : ''), r.action);
    btn.type = 'button';
    btn.addEventListener('click', r.onClick);
    row.appendChild(btn);
    connectorsList.appendChild(row);
  });
  connBackdrop.hidden = false;
}
function closeConnectors() { connBackdrop.hidden = true; }
connClose.addEventListener('click', closeConnectors);
connBackdrop.addEventListener('click', (e) => { if (e.target === connBackdrop) closeConnectors(); });

function connectorIcon(name) {
  const map = {
    git:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M6 8.5v7M8.5 6H14a4 4 0 0 1 4 4v5.5"/></svg>',
    folder: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    web:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
    spark:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z"/></svg>',
    figma:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3h3v6H9a3 3 0 0 1 0-6zM12 3h3a3 3 0 1 1 0 6h-3V3zM9 9h3v6H9a3 3 0 0 1 0-6zM12 9a3 3 0 1 1 3 3 3 3 0 0 1-3-3zM9 15h3v3a3 3 0 1 1-3-3z"/></svg>',
  };
  return map[name] || '';
}

/* ---------- Utilities ---------- */
function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

/* ---------- View router (home ↔ project) ---------- */

const PROJECT_KEY = 'rockdesign:project';

function setView(view) {
  if (view === 'home') {
    homeEl.hidden = false;
    shellEl.hidden = true;
    document.title = 'rockdesign';
  } else {
    homeEl.hidden = true;
    shellEl.hidden = false;
  }
}

function projectIdFromPath() {
  const m = location.pathname.match(/^\/p\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : null;
}
function projectPath(id) {
  return '/p/' + encodeURIComponent(id);
}
function pushProjectUrl(id) {
  const target = projectPath(id);
  if (location.pathname !== target) history.pushState({ projectId: id }, '', target);
}
function pushHomeUrl() {
  if (location.pathname !== '/') history.pushState({ projectId: null }, '', '/');
}

async function fetchProjects() {
  try {
    const res = await fetch('/api/projects');
    const data = await res.json();
    projects = Array.isArray(data) ? data : [];
  } catch {
    projects = [];
  }
}

function fmtRelative(iso) {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  try {
    return new Date(t).toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
  } catch { return ''; }
}

function renderHome() {
  homeBodyEl.innerHTML = '';
  if (!projects.length) {
    const hero = makeEl('div', 'home-hero');
    hero.appendChild(makeEl('h2', null, 'No projects yet'));
    hero.appendChild(makeEl('p', null, 'Create a project to start designing. Each project keeps its own chat history and designs.'));
    const cta = makeEl('button', 'btn-primary', 'Create your first project');
    cta.type = 'button';
    cta.addEventListener('click', openCreateProject);
    hero.appendChild(cta);
    homeBodyEl.appendChild(hero);
    return;
  }

  const grid = makeEl('div', 'project-grid');
  projects.forEach((p) => grid.appendChild(buildProjectCard(p)));
  homeBodyEl.appendChild(grid);
}

function buildProjectCard(p) {
  const card = makeEl('article', 'project-card');
  card.dataset.id = p.id;

  // Thumbnail (iframe of latest design, or placeholder)
  const thumb = makeEl('div', 'project-thumb');
  if (p.lastDesignId) {
    const iframe = makeEl('iframe');
    iframe.src = `/preview/${encodeURIComponent(p.lastDesignId)}`;
    iframe.loading = 'lazy';
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.setAttribute('scrolling', 'no');
    iframe.title = p.name;
    thumb.appendChild(iframe);
  } else {
    const empty = makeEl('div', 'project-thumb-empty');
    empty.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 4h16v12H4z"/><path d="M4 20h16"/></svg>';
    empty.appendChild(makeEl('span', null, 'Empty'));
    thumb.appendChild(empty);
  }
  card.appendChild(thumb);

  // Body
  const body = makeEl('div', 'project-body');
  const titleRow = makeEl('div', 'project-title-row');
  const title = makeEl('h3', 'project-title', p.name);
  titleRow.appendChild(title);

  const menu = makeEl('button', 'project-menu');
  menu.type = 'button';
  menu.title = 'Project options';
  menu.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>';
  menu.addEventListener('click', (e) => {
    e.stopPropagation();
    openProjectMenu(p, menu);
  });
  titleRow.appendChild(menu);
  body.appendChild(titleRow);

  const meta = makeEl('div', 'project-meta');
  const count = p.designCount || 0;
  meta.textContent = `${count} ${count === 1 ? 'design' : 'designs'} · ${fmtRelative(p.lastDesignAt) || 'no activity'}` +
    (p.totalCost ? ` · $${p.totalCost.toFixed(2)}` : '');
  body.appendChild(meta);
  card.appendChild(body);

  card.addEventListener('click', () => enterProject(p.id));
  return card;
}

let openMenuEl = null;
function closeProjectMenu() {
  if (openMenuEl) { openMenuEl.remove(); openMenuEl = null; }
  document.removeEventListener('click', onDocClickMenu, true);
}
function onDocClickMenu(e) {
  if (openMenuEl && !openMenuEl.contains(e.target)) closeProjectMenu();
}
function openProjectMenu(p, anchor) {
  closeProjectMenu();
  const menu = makeEl('div', 'project-popmenu');
  const renameItem = makeEl('button', 'pm-item', 'Rename');
  renameItem.type = 'button';
  renameItem.addEventListener('click', () => { closeProjectMenu(); openRenameProject(p); });
  menu.appendChild(renameItem);

  const deleteItem = makeEl('button', 'pm-item danger', 'Delete project…');
  deleteItem.type = 'button';
  deleteItem.addEventListener('click', () => { closeProjectMenu(); openDeleteProject(p); });
  menu.appendChild(deleteItem);

  const rect = anchor.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 6}px`;
  menu.style.left = `${rect.right - 160}px`;
  document.body.appendChild(menu);
  openMenuEl = menu;
  setTimeout(() => document.addEventListener('click', onDocClickMenu, true), 0);
}

async function openCreateProject() {
  const values = await showInputModal({
    title: 'New project',
    description: 'Give this project a name and pick a platform. You can change it later.',
    submitLabel: 'Create',
    fields: [{
      name: 'name',
      label: 'Project name',
      placeholder: 'e.g. Mira AI Studio',
      autofocus: true,
    }, {
      name: 'platform',
      label: 'Platform',
      type: 'choice',
      value: 'web',
      options: [
        { value: 'web', label: 'Web' },
        { value: 'mobile', label: 'Mobile' },
      ],
    }],
  });
  if (!values || !values.name) return;
  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: values.name, platform: values.platform }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'create failed');
    await fetchProjects();
    renderHome();
    enterProject(data.id);
  } catch (err) {
    alert('Failed to create project: ' + (err?.message || err));
  }
}

async function openRenameProject(p) {
  const values = await showInputModal({
    title: 'Rename project',
    fields: [{
      name: 'name',
      label: 'New name',
      value: p.name,
      autofocus: true,
    }],
  });
  if (!values || !values.name || values.name === p.name) return;
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(p.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: values.name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'rename failed');
    await fetchProjects();
    renderHome();
    if (currentProjectId === p.id) projectNameEl.textContent = data.name;
  } catch (err) {
    alert('Rename failed: ' + (err?.message || err));
  }
}

async function openDeleteProject(p) {
  if (!confirm(`Delete "${p.name}" and all ${p.designCount || 0} designs in it?\n\nThis cannot be undone.`)) return;
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(p.id)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'delete failed');
    await fetchProjects();
    if (currentProjectId === p.id) {
      currentProjectId = null;
      localStorage.removeItem(PROJECT_KEY);
    }
    try { localStorage.removeItem(ctxKey(p.id)); } catch {}
    renderHome();
  } catch (err) {
    alert('Delete failed: ' + (err?.message || err));
  }
}

async function enterProject(id) {
  currentProjectId = id;
  localStorage.setItem(PROJECT_KEY, id);
  pushProjectUrl(id);
  const p = projects.find((x) => x.id === id);
  projectNameEl.textContent = p ? p.name : 'Project';
  document.title = `rockdesign · ${p ? p.name : 'Project'}`;

  // Per-project context. Precedence: user-saved → seeded → platform default.
  ctx = loadCtxForProject(id);
  if (Object.keys(ctx).length === 0 && p) {
    if (p.platform === 'mobile') ctx = { projectType: 'mobile', target: 'mobile' };
    else if (p.platform === 'web') ctx = { projectType: 'web', target: 'desktop' };
  }
  renderContextBar();
  setView('project');
  // Reset board state when switching projects
  openIds = [];
  saveOpenIds();
  activeId = null;
  await loadAll();
  if (items.length === 0 && typeof renderEmptyHero === 'function') renderEmptyHero();
  promptEl.focus();
}

function leaveProject() {
  currentProjectId = null;
  localStorage.removeItem(PROJECT_KEY);
  pushHomeUrl();
  activeId = null;
  items = [];
  ctx = {};
  renderContextBar();
  setView('home');
  fetchProjects().then(renderHome);
}

backHomeBtn.addEventListener('click', leaveProject);
homeNewProjectBtn.addEventListener('click', openCreateProject);

// Browser back/forward: sync the view to the URL without pushing new history.
window.addEventListener('popstate', async () => {
  const urlId = projectIdFromPath();
  if (urlId) {
    if (!projects.some((p) => p.id === urlId)) await fetchProjects();
    if (projects.some((p) => p.id === urlId)) {
      if (urlId !== currentProjectId) await enterProject(urlId);
      return;
    }
    // Unknown project — fall through to home and clean the URL.
    history.replaceState({ projectId: null }, '', '/');
  }
  if (currentProjectId !== null) {
    currentProjectId = null;
    localStorage.removeItem(PROJECT_KEY);
    activeId = null;
    items = [];
    ctx = {};
    renderContextBar();
    setView('home');
    await fetchProjects();
    renderHome();
  }
});

/* ---------- GitHub star count (best-effort, public API) ---------- */
async function fetchGhStars() {
  try {
    const res = await fetch('https://api.github.com/repos/utkurock/rockdesign', {
      headers: { 'Accept': 'application/vnd.github+json' },
    });
    if (!res.ok) return;
    const data = await res.json();
    const n = Number(data.stargazers_count);
    if (!Number.isFinite(n)) return;
    const label = n >= 1000 ? (n / 1000).toFixed(n < 10_000 ? 1 : 0) + 'k' : String(n);
    document.querySelectorAll('.gh-star .gh-count').forEach((el) => {
      el.textContent = label;
      el.hidden = false;
    });
  } catch { /* offline or rate-limited — leave the count hidden */ }
}

/* ---------- First-run ---------- */
autoSize(promptEl);
renderContextBar();
fetchGhStars();

(async function bootstrap() {
  // Show home immediately so we never paint a blank page even if a later
  // async step throws. enterProject() below will flip to the project view
  // when the URL points at one.
  setView('home');

  // One-time migration: remove the old global ctx key — it was leaking
  // preferences (e.g. "Mobile / Liquid glass") across unrelated projects.
  // Per-project keys are populated on first edit in each project; until then
  // each project shows its seeded context.
  try { localStorage.removeItem(CTX_LEGACY_KEY); } catch {}

  try {
    await fetchProjects();

    // URL is the source of truth: /p/<id> opens that project, otherwise home.
    const urlId = projectIdFromPath();
    if (urlId && projects.some((p) => p.id === urlId)) {
      await enterProject(urlId);
      return;
    }
    if (urlId) history.replaceState({ projectId: null }, '', '/');
    currentProjectId = null;
    localStorage.removeItem(PROJECT_KEY);
    renderHome();
  } catch (err) {
    console.error('bootstrap failed:', err);
    renderHome();
  }
})();
