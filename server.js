import express from 'express';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const GEN_DIR = path.join(ROOT, 'generations');
const ATTACH_DIR = path.join(GEN_DIR, '_attachments');
const DESIGN_SYSTEM_PATH = path.join(GEN_DIR, 'CLAUDE.md');
const DB_PATH = path.join(ROOT, 'db.json');

const PORT = process.env.PORT || 4173;
const CLAUDE_TIMEOUT_MS = 180_000;
const MAX_UPLOAD_BYTES = 120 * 1024 * 1024;
const WEB_FETCH_TIMEOUT_MS = 15_000;
const MAX_WEB_BYTES = 5 * 1024 * 1024;

const app = express();
app.use(express.json({ limit: '200mb' }));
app.use(express.static(PUBLIC_DIR));

// JSON-only error handler for /api/* routes (avoids HTML default error page
// breaking the client JSON parser when payload too large, etc.)
app.use('/api', (err, _req, res, _next) => {
  const status = err?.status || err?.statusCode || 500;
  const msg = err?.type === 'entity.too.large'
    ? 'payload too large (server limit is 200MB)'
    : (err?.message || 'server error');
  res.status(status).json({ error: msg });
});

// --- db.json helpers ---
async function readDb() {
  try {
    const raw = await fs.readFile(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeDb(items) {
  await fs.writeFile(DB_PATH, JSON.stringify(items, null, 2));
}

async function ensureDirs() {
  await fs.mkdir(GEN_DIR, { recursive: true });
  await fs.mkdir(ATTACH_DIR, { recursive: true });
  await fs.mkdir(PUBLIC_DIR, { recursive: true });
}

function sanitizeFilename(name) {
  return String(name || '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 180);
}

// --- routes ---
app.get('/api/generations', async (_req, res) => {
  try {
    const items = await readDb();
    items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.post('/api/upload', async (req, res) => {
  try {
    const { filename, dataBase64 } = req.body || {};
    if (!filename || typeof dataBase64 !== 'string') {
      return res.status(400).json({ error: 'filename and dataBase64 are required' });
    }
    const safe = sanitizeFilename(filename);
    if (!safe) return res.status(400).json({ error: 'invalid filename' });

    const b64 = dataBase64.replace(/^data:[^;]+;base64,/, '');
    const buf = Buffer.from(b64, 'base64');
    if (!buf.length) return res.status(400).json({ error: 'empty file' });
    if (buf.length > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ error: 'file exceeds 120MB' });
    }

    const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const dir = path.join(ATTACH_DIR, id);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, safe), buf);

    res.json({
      id,
      filename: safe,
      relPath: `_attachments/${id}/${safe}`,
      url: `/attachments/${id}/${safe}`,
      size: buf.length,
    });
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.get('/attachments/:id/:file', async (req, res) => {
  const id = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '');
  const file = sanitizeFilename(req.params.file);
  if (!id || !file) return res.status(400).send('Bad request');
  const p = path.join(ATTACH_DIR, id, file);
  try {
    const data = await fs.readFile(p);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(data);
  } catch {
    res.status(404).send('Not found');
  }
});

app.post('/api/check-path', async (req, res) => {
  try {
    const target = (req.body?.path || '').toString().trim();
    if (!target) return res.status(400).json({ error: 'path required' });
    if (!path.isAbsolute(target)) {
      return res.status(400).json({ error: 'absolute path required' });
    }
    const stat = await fs.stat(target);
    let summary = null;
    if (stat.isDirectory()) {
      const entries = (await fs.readdir(target, { withFileTypes: true })).slice(0, 12);
      summary = entries.map((e) => e.name + (e.isDirectory() ? '/' : ''));
    }
    res.json({
      exists: true,
      kind: stat.isDirectory() ? 'dir' : 'file',
      sizeBytes: stat.size,
      sample: summary,
    });
  } catch (err) {
    res.status(404).json({ exists: false, error: String(err?.message || err) });
  }
});

function isPrivateHost(host) {
  return /^(localhost|127\.|10\.|192\.168\.|169\.254\.|::1$|0\.0\.0\.0$)/i.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}

app.post('/api/grab-web', async (req, res) => {
  try {
    const url = (req.body?.url || '').toString().trim();
    if (!url) return res.status(400).json({ error: 'url required' });
    let u;
    try { u = new URL(url); } catch { return res.status(400).json({ error: 'invalid url' }); }
    if (!/^https?:$/.test(u.protocol)) {
      return res.status(400).json({ error: 'only http(s) URLs are allowed' });
    }
    if (isPrivateHost(u.hostname)) {
      return res.status(400).json({ error: 'private/internal hosts are not allowed' });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WEB_FETCH_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(u.toString(), {
        signal: controller.signal,
        headers: { 'User-Agent': 'rockdesign-grab/1.0' },
        redirect: 'follow',
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) {
      return res.status(502).json({ error: `upstream ${response.status}` });
    }
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.length > MAX_WEB_BYTES) {
      return res.status(413).json({ error: 'page exceeds 5MB' });
    }

    const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const dir = path.join(ATTACH_DIR, id);
    await fs.mkdir(dir, { recursive: true });
    const filename = `web_${u.hostname.replace(/[^a-zA-Z0-9.-]/g, '_')}.html`;
    await fs.writeFile(path.join(dir, filename), buf);

    res.json({
      id,
      filename,
      relPath: `_attachments/${id}/${filename}`,
      url: `/attachments/${id}/${filename}`,
      sourceUrl: u.toString(),
      sourceHost: u.hostname,
      size: buf.length,
    });
  } catch (err) {
    const aborted = err?.name === 'AbortError';
    res.status(aborted ? 504 : 500).json({
      error: aborted ? 'fetch timed out' : String(err?.message || err),
    });
  }
});

app.get('/api/design-system', async (_req, res) => {
  try {
    const content = await fs.readFile(DESIGN_SYSTEM_PATH, 'utf8');
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.put('/api/design-system', async (req, res) => {
  try {
    const content = (req.body?.content || '').toString();
    if (!content.trim()) return res.status(400).json({ error: 'content required' });
    if (content.length > 200_000) return res.status(413).json({ error: 'content too large' });
    await fs.writeFile(DESIGN_SYSTEM_PATH, content);
    res.json({ ok: true, bytes: content.length });
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.get('/api/raw/:id', async (req, res) => {
  const id = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!id) return res.status(400).send('Bad id');
  try {
    const html = await fs.readFile(path.join(GEN_DIR, `${id}.html`), 'utf8');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(html);
  } catch { res.status(404).send('Not found'); }
});

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
];
let cachedChrome = null;
async function findChrome() {
  if (cachedChrome) return cachedChrome;
  for (const c of CHROME_CANDIDATES) {
    try { await fs.access(c); cachedChrome = c; return c; } catch {}
  }
  return null;
}

app.get('/api/png/:id', async (req, res) => {
  const id = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!id) return res.status(400).json({ error: 'bad id' });
  const w = Math.min(Math.max(parseInt(req.query.w, 10) || 1280, 320), 2400);
  const h = Math.min(Math.max(parseInt(req.query.h, 10) || 800,  240), 4000);
  const file = path.join(GEN_DIR, `${id}.html`);
  try { await fs.access(file); }
  catch { return res.status(404).json({ error: 'design not found' }); }

  const chrome = await findChrome();
  if (!chrome) {
    return res.status(503).json({
      error: 'Chrome / Chromium not found. Install Google Chrome to enable PNG download.',
    });
  }

  const tmp = path.join(ATTACH_DIR, `_tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.png`);
  await fs.mkdir(ATTACH_DIR, { recursive: true });
  const fileUrl = 'file://' + file;

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(chrome, [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--no-sandbox',
        `--window-size=${w},${h}`,
        `--screenshot=${tmp}`,
        '--virtual-time-budget=2000',
        fileUrl,
      ], { stdio: 'ignore' });
      const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} ; reject(new Error('chrome timed out')); }, 30_000);
      child.on('close', (code) => {
        clearTimeout(timer);
        code === 0 ? resolve() : reject(new Error('chrome exit ' + code));
      });
      child.on('error', (e) => { clearTimeout(timer); reject(e); });
    });

    const buf = await fs.readFile(tmp);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="rockdesign-${id}.png"`);
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  } finally {
    fs.unlink(tmp).catch(() => {});
  }
});

app.get('/preview/:id', async (req, res) => {
  const id = req.params.id.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!id) return res.status(400).send('Invalid id');
  const file = path.join(GEN_DIR, `${id}.html`);
  try {
    const html = await fs.readFile(file, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(html);
  } catch (err) {
    res.status(404).send('Not found');
  }
});

app.post('/api/generate', async (req, res) => {
  const prompt = (req.body?.prompt || '').toString().trim();
  if (!prompt) {
    return res.status(400).json({ error: 'prompt cannot be empty' });
  }
  if (prompt.length > 4000) {
    return res.status(400).json({ error: 'prompt too long (max 4000)' });
  }

  const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments : [];
  const validAttachments = [];
  for (const a of attachments) {
    if (!a || typeof a.relPath !== 'string') continue;
    if (!a.relPath.startsWith('_attachments/')) continue;
    const fp = path.join(GEN_DIR, a.relPath);
    try {
      await fs.access(fp);
      validAttachments.push(a);
    } catch { /* skip missing */ }
  }

  const context = (req.body?.context && typeof req.body.context === 'object') ? req.body.context : {};
  const contextLines = [];
  const TARGET_HINTS = {
    mobile: 'Mobile (design at 390–430px width, mobile-first)',
    tablet: 'Tablet (design at 768–1024px width)',
    desktop: 'Desktop (design at 1280px width, mouse + keyboard)',
    responsive: 'Responsive (must look great on mobile, tablet, and desktop)',
  };
  const STYLE_HINTS = {
    'liquid-glass': 'Liquid glass — follow the glass surface rules in CLAUDE.md',
    minimal: 'Minimal — drop glass, keep hairlines and generous whitespace',
    brutalist: 'Brutalist — high-contrast blocks, hard shadows, monospace accents',
    editorial: 'Editorial — wider measure, system serif headings, asymmetric layout',
  };
  if (context.projectType) contextLines.push(`- Project type: ${context.projectType}`);
  if (context.target && TARGET_HINTS[context.target]) {
    contextLines.push(`- Target platform: ${TARGET_HINTS[context.target]}`);
  }
  if (context.style && STYLE_HINTS[context.style]) {
    contextLines.push(`- Style direction: ${STYLE_HINTS[context.style]}`);
  }
  if (context.github) contextLines.push(`- GitHub reference: ${context.github}`);
  if (context.projectRef) contextLines.push(`- Style reference: previously created project "${context.projectRef}"`);
  if (context.localCode) contextLines.push(`- Local code base: ${context.localCode} (you may Read key files for context)`);

  const id = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const targetFile = `${id}.html`;

  const attachLines = validAttachments.map((a) => {
    const isFig = /\.fig$/i.test(a.filename);
    const isImg = /\.(png|jpe?g|gif|webp|svg|avif|heic)$/i.test(a.filename);
    const isWeb = /^web_/.test(a.filename) && /\.html$/i.test(a.filename);
    let note = '';
    if (isFig) note = ' (Figma binary — open with Read to understand the structure, and focus on the parts the user describes)';
    else if (isImg) note = ' (visual reference — inspect with Read and stay faithful to its style/composition)';
    else if (isWeb) note = ' (snapshot of a web page — open with Read to extract layout/color/style cues, not exact markup)';
    return `- ${a.relPath}${note}`;
  });

  const instruction = [
    `Create a single self-contained HTML design at generations/${targetFile}.`,
    `All CSS and JS must be inline; no external dependencies.`,
    `Strictly follow the design system in CLAUDE.md (read it first if needed).`,
    contextLines.length ? '' : null,
    contextLines.length ? 'Project context:' : null,
    ...contextLines,
    attachLines.length ? '' : null,
    attachLines.length ? 'Reference files (open with the Read tool):' : null,
    ...attachLines,
    ``,
    `Requested design: ${prompt}`,
  ].filter((line) => line !== null).join('\n');

  try {
    const result = await runClaude(instruction);

    const filePath = path.join(GEN_DIR, targetFile);
    try {
      await fs.access(filePath);
    } catch {
      return res.status(500).json({
        error: 'Claude did not create the HTML file.',
        detail: result.stderr || result.result || '',
      });
    }

    const record = {
      id,
      prompt,
      file: targetFile,
      createdAt: new Date().toISOString(),
      cost: typeof result.total_cost_usd === 'number' ? result.total_cost_usd : null,
      sessionId: result.session_id || null,
      attachments: validAttachments.map((a) => ({
        filename: a.filename,
        relPath: a.relPath,
        url: a.url || `/attachments/${a.relPath.split('/')[1]}/${a.filename}`,
      })),
      context: contextLines.length ? context : null,
    };

    const items = await readDb();
    items.push(record);
    await writeDb(items);

    res.json(record);
  } catch (err) {
    res.status(500).json({
      error: err?.message || 'Generation error',
      detail: err?.detail || null,
    });
  }
});

// --- claude bridge ---
function runClaude(instruction) {
  return new Promise((resolve, reject) => {
    const args = [
      '-p', instruction,
      '--output-format', 'json',
      '--allowedTools', 'Write,Read',
    ];

    const child = spawn('claude', args, {
      cwd: GEN_DIR,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5_000);
    }, CLAUDE_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    child.on('error', (err) => {
      clearTimeout(timer);
      if (err.code === 'ENOENT') {
        const e = new Error('claude command not found. Is Claude Code installed?');
        e.detail = String(err);
        return reject(e);
      }
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (killed) {
        const e = new Error(`Generation did not finish in ${CLAUDE_TIMEOUT_MS / 1000}s — cancelled.`);
        e.detail = stderr.slice(-2000);
        return reject(e);
      }
      if (code !== 0) {
        const e = new Error(`claude exit ${code}`);
        e.detail = (stderr || stdout).slice(-2000);
        return reject(e);
      }
      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed);
      } catch {
        // claude may emit multiple JSON lines; try the last one
        const lines = stdout.trim().split('\n').filter(Boolean);
        try {
          resolve(JSON.parse(lines[lines.length - 1]));
        } catch {
          resolve({ result: stdout, total_cost_usd: null, session_id: null });
        }
      }
    });
  });
}

// --- start ---
await ensureDirs();
app.listen(PORT, () => {
  console.log(`rockdesign ready → http://localhost:${PORT}`);
});
