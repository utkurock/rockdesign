const $ = (sel) => document.querySelector(sel);

const promptEl = $('#prompt');
const composerEl = $('#composer');
const sendBtn = $('#generate');
const threadEl = $('#thread');
const boardEl = $('#board');
const tabBar = $('#tabBar');
const closeAllBtn = $('#closeAllBtn');
const lightbox = $('#lightbox');
const lightboxTitle = $('#lightboxTitle');
const lightboxStage = $('#lightboxStage');
const lbCopy = $('#lbCopy');
const lbPng = $('#lbPng');
const lbOpenTab = $('#lbOpenTab');
const lbReload = $('#lbReload');
const lbClose = $('#lbClose');
const newChatBtn = $('#newChat');
const attachBtn = $('#attachBtn');
const attachPop = $('#attachPop');
const attachChips = $('#attachChips');
const fileInput = $('#fileInput');
const figInput = $('#figInput');
const setupBtn = $('#setupBtn');
const setupBackdrop = $('#setupBackdrop');
const setupClose = $('#setupClose');
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

let items = [];
let activeId = null;
let pendingAttachments = []; // [{ id, filename, relPath, url, isImg }]
let openIds = loadOpenIds(); // ids currently on the board

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

function renderThread() {
  threadEl.innerHTML = '';
  const chrono = items
    .slice()
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

  let lastPrompt = null;
  chrono.forEach((it) => {
    if (it.prompt !== lastPrompt) {
      const u = makeEl('div', 'msg user');
      u.appendChild(makeEl('div', 'who', 'You'));
      u.appendChild(makeEl('div', 'body', it.prompt));
      const row = buildMiniAttachRow(it.attachments);
      if (row) u.appendChild(row);
      threadEl.appendChild(u);
      lastPrompt = it.prompt;
    }

    const a = makeEl('div', 'msg ai');
    a.appendChild(makeEl('div', 'who', 'rockdesign'));

    const card = makeEl('div', 'body' + (it.id === activeId ? ' active' : ''));
    card.addEventListener('click', () => selectItem(it.id));

    const thumb = makeEl('div', 'thumb');
    const f = makeEl('iframe');
    f.src = `/preview/${encodeURIComponent(it.id)}`;
    f.loading = 'lazy';
    f.title = it.prompt;
    f.setAttribute('sandbox', 'allow-scripts');
    thumb.appendChild(f);

    const meta = makeEl('div', 'meta');
    meta.appendChild(makeEl('span', null, fmtDate(it.createdAt)));
    meta.appendChild(makeEl('span', null, it.cost ? `$${Number(it.cost).toFixed(3)}` : ''));

    card.appendChild(thumb);
    card.appendChild(meta);
    a.appendChild(card);
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
}

function buildCard(item) {
  const card = makeEl('div', 'board-card' + (item.id === activeId ? ' active' : ''));
  card.dataset.id = item.id;

  // Head
  const head = makeEl('div', 'card-head');
  const prompt = makeEl('div', 'card-prompt', item.prompt);
  prompt.title = item.prompt;
  head.appendChild(prompt);
  const stamp = makeEl('div', 'card-stamp', fmtDate(item.createdAt));
  head.appendChild(stamp);
  const closeBtn = makeEl('button', 'card-close');
  closeBtn.type = 'button';
  closeBtn.title = 'Close (kept in chat history)';
  closeBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  closeBtn.addEventListener('click', (e) => { e.stopPropagation(); closeBoardItem(item.id); });
  head.appendChild(closeBtn);
  card.appendChild(head);

  // Frame (iframe preview, click → lightbox)
  const frame = makeEl('div', 'card-frame');
  frame.title = 'Click to open fullscreen';
  const iframe = makeEl('iframe');
  iframe.src = `/preview/${encodeURIComponent(item.id)}`;
  iframe.loading = 'lazy';
  iframe.setAttribute('scrolling', 'no');
  iframe.setAttribute('sandbox', 'allow-scripts');
  frame.appendChild(iframe);
  frame.addEventListener('click', () => openLightbox(item.id));
  card.appendChild(frame);

  // Foot — actions
  const foot = makeEl('div', 'card-foot');
  const copyBtn = makeEl('button', 'card-act');
  copyBtn.type = 'button';
  copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="3" width="13" height="13" rx="2"/><path d="M3 8h2v11a2 2 0 0 0 2 2h11v-2"/></svg> Copy code';
  copyBtn.addEventListener('click', (e) => { e.stopPropagation(); copyCode(item.id, copyBtn); });
  foot.appendChild(copyBtn);

  const pngBtn = makeEl('button', 'card-act');
  pngBtn.type = 'button';
  pngBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4v12M6 10l6 6 6-6M5 20h14"/></svg> PNG';
  pngBtn.addEventListener('click', (e) => { e.stopPropagation(); downloadPng(item.id, pngBtn); });
  foot.appendChild(pngBtn);

  const openBtn = makeEl('button', 'card-act primary');
  openBtn.type = 'button';
  openBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12l6-6M3 12l6 6M3 12h18"/></svg> Open';
  openBtn.style.transform = 'scaleX(-1)';
  // The above icon is "back-arrow"; replace with expand:
  openBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h6M4 4v6M20 20h-6M20 20v-6M4 4l6 6M20 20l-6-6"/></svg> Open';
  openBtn.style.transform = '';
  openBtn.addEventListener('click', (e) => { e.stopPropagation(); openLightbox(item.id); });
  foot.appendChild(openBtn);
  card.appendChild(foot);

  return card;
}

function selectItem(id) {
  // Click in the chat: ensure the design is on the board and scroll to it.
  ensureOnBoard(id);
  focusBoardItem(id);
}

function ensureOnBoard(id) {
  if (!openIds.includes(id)) {
    openIds.push(id);
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

function closeAllBoardItems() {
  openIds = [];
  activeId = null;
  saveOpenIds();
  renderBoard();
  renderTabs();
  renderThread();
}

closeAllBtn.addEventListener('click', closeAllBoardItems);

/* ---------- Lightbox ---------- */
let lbCurrentId = null;

function openLightbox(id) {
  const item = items.find((i) => i.id === id);
  if (!item) return;
  lbCurrentId = id;
  lightboxTitle.textContent = item.prompt;
  lightboxStage.innerHTML = '';
  const f = makeEl('iframe');
  f.src = `/preview/${encodeURIComponent(id)}`;
  f.title = item.prompt;
  f.setAttribute('sandbox', 'allow-scripts');
  lightboxStage.appendChild(f);
  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  lightbox.hidden = true;
  lightboxStage.innerHTML = '';
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
  if (e.key === 'Escape' && !lightbox.hidden) closeLightbox();
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
  body.appendChild(makeEl('span', null, 'Generating… takes 30–120 sec'));
  pend.appendChild(body);
  threadEl.appendChild(pend);
  threadEl.scrollTop = threadEl.scrollHeight;
  return pend;
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
  try {
    const res = await fetch('/api/generations');
    items = await res.json();
    if (!Array.isArray(items)) items = [];
    // Drop board ids that no longer exist (e.g., db.json wiped)
    const valid = openIds.filter((id) => items.some((i) => i.id === id));
    if (valid.length !== openIds.length) { openIds = valid; saveOpenIds(); }
    if (!activeId || !items.some((i) => i.id === activeId)) {
      activeId = openIds[openIds.length - 1] || null;
    }
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

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, attachments, context: ctx }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Generation failed');

    items.push(data);
    activeId = data.id;
    if (!openIds.includes(data.id)) openIds.push(data.id);
    saveOpenIds();
    pend.remove();
    pendingAttachments = [];
    renderChips();
    renderThread();
    renderBoard();
    renderTabs();
    // Smoothly scroll the new card into view
    requestAnimationFrame(() => focusBoardItem(data.id));
  } catch (err) {
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

/* ---------- Setup modal ---------- */
function openSetup() {
  setupBackdrop.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeSetup() {
  setupBackdrop.hidden = true;
  document.body.style.overflow = '';
}

setupBtn.addEventListener('click', openSetup);
setupClose.addEventListener('click', closeSetup);
setupBackdrop.addEventListener('click', (e) => {
  if (e.target === setupBackdrop) closeSetup();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !setupBackdrop.hidden) closeSetup();
});

document.querySelectorAll('.codeblock .copy').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const code = btn.parentElement.dataset.code
      || btn.parentElement.querySelector('code')?.textContent
      || '';
    try {
      await navigator.clipboard.writeText(code);
      const original = btn.textContent;
      btn.textContent = 'Copied';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('copied');
      }, 1200);
    } catch {
      btn.textContent = 'Press ⌘C';
    }
  });
});

composerEl.addEventListener('submit', generate);
promptEl.addEventListener('input', () => autoSize(promptEl));
promptEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    generate(e);
  }
});

newChatBtn.addEventListener('click', () => {
  activeId = null;
  renderTabs();
  renderThread();
  promptEl.focus();
});

/* ---------- Context state (persisted in localStorage) ---------- */
const CTX_KEY = 'rockdesign:ctx';
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

let ctx = loadCtx();

function loadCtx() {
  try {
    return JSON.parse(localStorage.getItem(CTX_KEY)) || {};
  } catch { return {}; }
}
function saveCtx() {
  try { localStorage.setItem(CTX_KEY, JSON.stringify(ctx)); } catch {}
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

  const more = makeEl('button', 'open-onboarding', 'More preferences →');
  more.type = 'button';
  more.addEventListener('click', openOnboarding);
  hero.appendChild(more);

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
      for (const [k, el] of Object.entries(inputs)) values[k] = el.value.trim();
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
      placeholder: 'e.g. fashai prototype',
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
    title: 'GitHub connected',
    description: 'Paste a repo URL or owner/repo. Claude will mention it as context.',
    fields: [{
      name: 'repo',
      label: 'Repository',
      placeholder: 'github.com/your-org/repo',
      value: ctx.github || '',
      autofocus: true,
    }],
    extraButton: ctx.github ? {
      label: 'Sign out',
      onClick: ({ close }) => { delete ctx.github; saveCtx(); close(null); },
    } : null,
  });
  if (values === null) return;
  if (values.repo) ctx.github = values.repo.replace(/^https?:\/\//, ''); else delete ctx.github;
  saveCtx();
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

/* ---------- First-run ---------- */
autoSize(promptEl);
renderContextBar();
loadAll().then(() => {
  if (items.length === 0) renderEmptyHero();
  if (!localStorage.getItem(ONB_KEY)) {
    setTimeout(openOnboarding, 300);
  }
});
