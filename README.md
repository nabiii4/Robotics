# FDRHS Robotics Hub

The web app for the Franklin D. Roosevelt High School Cougars VEX V5 robotics club. Students describe a robot in plain English and the **AI Build Mentor** designs it. The app then gives you:

- a live 3D model
- real blueprints (PDF, SVG and PNG)
- step-by-step assembly instructions
- VEXcode V5 C++ that compiles
- printable STL parts

Around that, the team runs its print queue, parts inventory, task board, competitions and documents.

Both dashboard designs are built in. **Hub (B)** is the default; **Sidebar (A)** can be chosen per person in *Settings → Appearance* or from the avatar menu. **Auto** uses the Sidebar layout on screens 1600 px and wider.

## Quick start

You need **Node.js 20+** (22 recommended). `g++` is optional but recommended: with it, *Compile* runs a real C++ syntax check against the VEX V5 API.

```bash
npm install
cp .env.example .env          # then fill in the AI section (see below), or leave it empty for demo mode
npm run dev                   # creates data/fdrhs.db, seeds the team on first run, starts http://localhost:3000
```

On the first run, the seed writes **`data/seed-credentials.txt`**. It contains:

- the team join code;
- the admin login (`coach`, which must change its password at first sign-in);
- seven sample student accounts.

New students sign up at `/join` with the join code.

**To put it online for the team, see [DEPLOY.md](DEPLOY.md)**. It covers Render or Railway (about 10 minutes in the browser) and a free option on a school computer with Docker.

To run in production yourself:

```bash
npm run build
npm start                     # runs migrations/seed if needed, then next start
```

### Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | Set up the DB if needed, then the dev server |
| `npm run reset` | Delete the database and re-seed (scenario from `SEED_SCENARIO`) |
| `npm run seed:a` / `seed:b` | Re-seed with the Layout A or Layout B sample data |
| `npm test` | Unit tests (metrics golden values, rules, generator, codegen + g++, printing, compiler checks, auton, CSV) |
| `npm run typecheck` | TypeScript |
| `npm run backup` | Copy the SQLite database to `data/backups/` |

## Connecting the AI (GPT models)

All AI calls happen on the server. Keys live only in `.env`, which is git-ignored. Each request tries the configured targets **in order** and fails over automatically when a target is down, rate-limited or rejects a parameter:

1. **Azure OpenAI primary.** Set `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY` and `AZURE_OPENAI_DEPLOYMENT`, for example `gpt-5.4-nano`.
2. **Azure fallback deployment** on the same resource: `AZURE_OPENAI_FALLBACK_DEPLOYMENT`.
3. **Azure backup resource:** the `AZURE_OPENAI_BACKUP_*` settings.
4. **OpenAI:** `OPENAI_API_KEY`, with `OPENAI_MODEL`, for example `gpt-5-nano`.

You can use only Azure, only OpenAI, or both. Optional embedding models (`AZURE_OPENAI_EMBEDDING_MODEL` / `OPENAI_EMBEDDING_MODEL`) improve memory and rules search; without them, keyword search is used.

**Demo mode.** With `AI_MOCK="auto"` (the default) and no keys set, the mentor runs a built-in, rule-based demo. It still makes real design changes ("make it faster", "add a clamp"), writes code and remembers things. That way every feature works out of the box. Set `AI_MOCK="1"` to force demo mode, or `"0"` to require real keys.

Admins can see which targets are healthy, usage per student, limits and flagged answers in **Settings → AI & Usage**.

### Other settings

- `APP_ENCRYPTION_KEY`: 32 random bytes in base64. It encrypts printer API keys. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Set it in production.
- `DATABASE_URL`: SQLite file by default; a Turso `libsql://` URL also works.
- `GXX_PATH`: path to `g++`. Without it, *Compile* falls back to the built-in syntax and VEX-rules checker.

## What's inside

| Area | Highlights |
|---|---|
| **AI Build Mentor** | Drawer on every page plus a full `/mentor` page. It designs and edits robots (new versions, with Undo), and explains and fixes code. It proposes printed parts and can reserve or order inventory. It keeps per-student memory you can pin, edit or forget, and quotes team documents you mark *Use for AI* |
| **Builds** | Builds list with filters and blueprint thumbnails, plus a workspace per build: 3D (explode, pose, sizing box, measure, section, screenshot), blueprints (multi-sheet PDF/SVG/PNG, print), assembly player, specs and BOM vs. inventory, printed parts (parametric templates or your own STL), rules check, version history |
| **VEX Code** | Monaco editor (falls back to a plain editor if the CDN is blocked) with autosave, history, generated `robot-config`, *Check* (in the browser) and *Compile* (g++ with an include whitelist). Also Auton Preview on a 12 ft field, Web Serial console for the V5 Brain (Chrome/Edge), and project zip download |
| **3D Printer** | Simulated, OctoPrint or Moonraker printers, a drag-to-reorder queue, job drawer with 3D preview and history, and estimates. The legality badge follows the V5RC 3D-printing rules |
| **Parts & Inventory** | Virtualized table with ± steppers, low-stock alerts, orders (Requested → Ordered → Received adds stock), BOM compare, and CSV import with column mapping and export |
| **Team** | Roster with admin role management and password reset, a drag-and-drop task board that drives competition readiness, and the activity feed |
| **Competitions** | Countdown, a single ★ target event, readiness checklist, packing list, match notes, results |
| **Settings** | Profile, appearance (layout A/B/Auto), AI & memory, notifications, security. Admins also get team and join code, season rules, printers, AI usage, knowledge base, and data export/import/backup |

**Accuracy notes.** VEX part facts and season rules are summarized in the engine. Weights are estimates, and Auton Preview is approximate. Always confirm rules against the current Game Manual and Q&A; admins can edit and verify every rule value in *Settings → Season Rules*. Downloading programs to the Brain isn't possible from a browser: download the project and open it in VEXcode V5 or the VS Code VEX extension.
