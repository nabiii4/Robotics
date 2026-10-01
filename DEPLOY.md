# Deploying FDRHS Robotics Hub

The Hub is one Docker container: the website, the API, a SQLite database and uploaded files. The only hard requirement is a **persistent disk mounted at `/app/data`**. Without it, every redeploy wipes the team's builds, accounts and files.

On its first start, a fresh deployment creates:
- the team;
- one admin account (`coach`);
- the season rules;
- a practice (simulated) printer.

It creates no fake students or sample data. (Set `SEED_SCENARIO=B` if you want the demo data instead.)

| Option | Cost | Effort | Good for |
|---|---|---|---|
| **A. Render** (recommended) | Paid instance + disk ([pricing](https://render.com/pricing)) | ~10 min, all in the browser | The whole team, from anywhere, over HTTPS |
| **B. Railway** | Hobby plan, usage-based | ~10 min, all in the browser | Same as Render |
| **C. A school computer with Docker** | Free | Needs someone comfortable with a terminal | Free hosting; controlling real printers on the school network |

> **Not Vercel or Netlify.** They have no persistent disk for the database and uploads, and no `g++` for code compiles.

Before you start, decide which branch to deploy. The easiest option is to merge the pull request into `main` and deploy `main`, so every later merge auto-deploys.

---

## A. Render (recommended)

**One click:** [Deploy to Render](https://render.com/deploy?repo=https://github.com/nabiii4/Robotics). This deploys the default branch (`main`). To deploy a different branch, add `/tree/<branch>` to the end of the `repo=` value. The button opens the same Blueprint form as step 2 below.

1. Go to [render.com](https://render.com) and sign up with your GitHub account. Allow access to the `Robotics` repository.
2. Click **New → Blueprint** and pick the `nabiii4/Robotics` repo and your branch. Render reads `render.yaml` and sets up the following for you:
   - a web service built from the `Dockerfile`, with health checks on `/api/health`;
   - a 1 GB persistent disk at `/app/data`;
   - a generated `APP_ENCRYPTION_KEY`.
3. Render asks for these values:
   - **ADMIN_INITIAL_PASSWORD**: the coach's first password, at least 10 characters. If you leave it blank, a random one is printed in the service **Logs** on the first start.
   - **TEAM_JOIN_CODE**: for example `COUGAR-2026`. Students need it to sign up. Leave it blank to have one generated and shown in the logs.
   - **AI keys** (optional; see "Turn on the AI" below). Leave them blank to start with the built-in demo mentor.
4. Click **Apply**. The first build takes about 5 minutes. When the service shows **Live**, open its URL (for example `https://fdrhs-robotics-hub.onrender.com`).
5. Sign in as `coach`, then go to **Settings → Security** if you need to change the password. Then:
   - set the team number in **Settings → Team**;
   - share the site URL and join code with the team. Students sign up at `/join`.

The service plan must stay a paid type, because Render only attaches disks to paid services. Keep it at **one instance**; SQLite on a disk can't be shared across instances.

## B. Railway

1. Go to [railway.com](https://railway.com) and choose **New Project → Deploy from GitHub repo → nabiii4/Robotics**. Railway finds the `Dockerfile` and `railway.json`.
2. Add persistent storage: in the project, add a **Volume** to the service (for example from the command palette or by right-clicking the service) and set its **mount path** to `/app/data`.
3. Under **Variables**, add:
   - `SEED_SCENARIO` = `clean`
   - `APP_ENCRYPTION_KEY` = the output of `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`, or any long random string
   - `ADMIN_INITIAL_PASSWORD` and `TEAM_JOIN_CODE`
   - optionally, the AI keys below
4. In **Settings → Networking**, click **Generate Domain**, then open the URL and sign in as `coach`.

## C. A school computer (free)

You need an always-on computer with [Docker](https://docs.docker.com/get-docker/) installed.

```bash
git clone https://github.com/nabiii4/Robotics.git && cd Robotics
cp .env.example .env          # set SEED_SCENARIO="clean", ADMIN_INITIAL_PASSWORD, TEAM_JOIN_CODE, APP_ENCRYPTION_KEY, AI keys
docker compose up -d --build  # → http://localhost:3000   (data lives in the "hub-data" Docker volume)
```

- **Updating:** `git pull && docker compose up -d --build`
- **Reaching it from outside the building:** use a free [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/), or ask school IT. A tunnel also gives you **HTTPS**. Chrome only allows the "Connect VEX Brain" USB feature on HTTPS pages or on `localhost`.
- **Real printers:** this is the only option where the Hub can control OctoPrint/Moonraker printers on the school network. A cloud server can't reach printers on school Wi-Fi.

---

## Turn on the AI

Add these as environment variables on your host (Render: **Environment**; Railway: **Variables**; school computer: `.env`). Then redeploy or restart.

- **Azure OpenAI:** `AZURE_OPENAI_ENDPOINT` (`https://<resource>.openai.azure.com/`), `AZURE_OPENAI_API_KEY` and `AZURE_OPENAI_DEPLOYMENT` (your deployment name). Optionally add `AZURE_OPENAI_FALLBACK_DEPLOYMENT` and the `AZURE_OPENAI_BACKUP_*` settings.
- **OpenAI:** `OPENAI_API_KEY`, and optionally `OPENAI_MODEL`.

If both are set, Azure is tried first and OpenAI is the fallback. To check that it works, sign in as an admin and go to **Settings → AI & Usage → Test now**. You can also set per-student hourly and daily limits there.

## After the first deploy (checklist)

- [ ] Sign in as `coach`; set the team name and number in **Settings → Team**.
- [ ] Students join at `/join` with the join code. Promote captains under **Team → ⋯ → Access: captain**.
- [ ] Upload the Game Manual PDF in **Resources**, then switch on **Use for AI** so the mentor can quote the rules.
- [ ] Check the numbers in **Settings → Season Rules** against the current manual and tick **Verified**.
- [ ] Printers: keep the practice printer, or (self-hosted only) add your OctoPrint/Moonraker printer under **Settings → Printers**.
- [ ] Download a backup in **Settings → Data** before competitions.

## Updates, backups, troubleshooting

- **Updates:** Render and Railway redeploy automatically when the deployed branch changes. Data on the disk is kept. Database migrations run automatically on every start.
- **Backups:**
  - **Settings → Data → Download backup** gives you the whole SQLite file.
  - **Export JSON** gives you a readable export (passwords excluded).
- **Lost the admin password?** Another admin can reset it under **Team**. If you have no other admin, look at the first-start logs, or redeploy with a fresh disk.
- **"Cross-site request blocked" on a custom domain:** set `APP_URL` to your domain, for example `https://hub.fdrhsrobotics.org`. On Render and Railway the default URL is detected automatically.
- **Code compile says "Checked (syntax + VEX rules)":** `g++` isn't in the image. Leave the `INSTALL_GXX` build argument at its default (`1`); the cloud builds include `g++`.
