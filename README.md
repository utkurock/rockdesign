# rockdesign

A local-first design generator. Describe a UI in plain English and rockdesign
spins up a self-contained HTML mockup — driven by Claude Code under the hood,
guided by an opinionated, editable design system.

> _Screenshot placeholder — add `docs/screenshot.png` once captured._

## What it does

- **Chat-style prompt** for new designs ("a settings page for a calendar app",
  "pricing section in a brutalist style", etc.).
- **Context controls** for project type, target platform (mobile / tablet /
  desktop / responsive), and style direction (liquid glass / minimal /
  brutalist / editorial).
- **Attachments** as design references: drop in images, Figma files, snapshot a
  public web page by URL, or point at a local code directory / GitHub repo for
  Claude to read from.
- **Single-file HTML output** — every generation is one inline-CSS/JS `.html`
  file, no external dependencies, viewable in any browser.
- **Editable design system** at `generations/CLAUDE.md` — the contract every
  design must follow. Tweak it from the UI to steer Claude's taste.
- **PNG export** via headless Chrome / Chromium, with adjustable viewport.
- **Persistent gallery** of past generations, stored in `db.json`, browsable
  and re-openable.

## How it works

```
Browser UI (public/)
   │  prompt + context + attachments
   ▼
Express server (server.js)
   │  spawn `claude -p "<instruction>" --allowedTools Write,Read`
   ▼
Claude Code CLI
   │  reads CLAUDE.md, writes generations/gen_*.html
   ▼
Server returns the generation record → UI renders preview + PNG button
```

Each generation lives at `generations/<id>.html` and is served at
`/preview/<id>` (live HTML) and `/api/png/<id>?w=1280&h=800` (PNG via headless
Chrome).

## Requirements

- **Node.js 18+** (uses native `fetch`)
- **Claude Code CLI** installed and authenticated — `claude` must be on PATH.
  See <https://docs.claude.com/claude-code>.
- **Google Chrome / Chromium** (only required for PNG export)

## Install & run

```bash
npm install
npm start
# → rockdesign ready → http://localhost:4173
```

Open <http://localhost:4173> and start prompting. Override the port with
`PORT=5000 npm start`.

## Project layout

```
server.js              Express server + Claude bridge
public/                Frontend (index.html, app.js, style.css)
generations/           Generated HTML files + design-system contract
  CLAUDE.md            The design system Claude follows on every generation
  _attachments/        Uploaded references (images, .fig, fetched web pages)
db.json                Generation history (id, prompt, file, context, cost)
```

## API

| Method | Path                  | Purpose                                                 |
| ------ | --------------------- | ------------------------------------------------------- |
| GET    | `/api/generations`    | List past generations (newest first)                    |
| POST   | `/api/generate`       | Run a generation with `{ prompt, context, attachments }`|
| POST   | `/api/upload`         | Upload an attachment as base64                          |
| POST   | `/api/grab-web`       | Snapshot a public URL into an attachment                |
| POST   | `/api/check-path`     | Validate a local code path before linking it            |
| GET/PUT| `/api/design-system`  | Read / replace `generations/CLAUDE.md`                  |
| GET    | `/preview/:id`        | Render a generation as live HTML                        |
| GET    | `/api/raw/:id`        | View a generation's HTML source                         |
| GET    | `/api/png/:id`        | Export a generation as PNG (headless Chrome)            |

## Limits

- Upload: 120 MB per file, JSON body capped at 200 MB.
- Web snapshot: 5 MB page size, 15 s fetch timeout, public hosts only.
- Generation: 180 s Claude timeout, 4000-char prompt cap.

## Notes

rockdesign is intentionally a single local server with no auth — it's meant to
run on your own machine and talk to your own Claude Code session. Don't expose
it to the public internet without putting a real auth layer in front of it.
