# Deploying FDRHS Robotics Hub

On its first start, a fresh deployment creates:
- the team;
- one admin account (`coach`);
- the season rules;
- a practice (simulated) printer.

It creates no fake students or sample data. (Set `SEED_SCENARIO=B` if you want the demo data instead.)

| Option | Cost | Card needed? | Notes |
|---|---|---|---|
| **Free: Vercel + Turso** (start here) | $0 | No | Always on. Uploads are limited to 4 MB each, and *Compile* uses the built-in checker instead of g++ |
| **A. Render** | Paid instance + disk | Yes | One Docker container with its own disk; g++ compile; 20 MB uploads |
| **B. Railway** | Hobby plan, usage-based | Yes | Same as Render |
| **C. A school computer with Docker** | Free | No | Needs a terminal; the only option that can control real printers on the school network |

**First, put the app on `main`:** merge [pull request #1](https://github.com/nabiii4/Robotics/pull/1) (the green **Merge pull request** button). Every host deploys `main`, and each later merge then updates the site automatically.

---

## Free: Vercel + Turso (no credit card)

Vercel runs the website and Turso stores the data. Both have free plans that don't ask for a card ([Vercel limits](https://vercel.com/docs/functions/limitations), [Turso pricing](https://turso.tech/pricing)).

### 1. Make the free database (Turso, about 3 minutes)

1. Go to **[turso.tech](https://turso.tech)**, click **Sign up**, and continue with **GitHub**.
2. Click **Create Database**. Name it `fdrhs`, and pick a location in the **US East (Virginia)** area, which is closest to Vercel's default servers.
3. Open the database and copy its **URL**. It starts with `libsql://` and ends in `.turso.io`.
4. Click **Create Token** (also called *Generate token*). Allow read & write, choose no expiration, and copy the token. Keep it secret.

### 2. Put the website online (Vercel, about 5 minutes)

1. Go to **[vercel.com/signup](https://vercel.com/signup)**, choose **Hobby**, and continue with **GitHub**.
2. Click **Add New… → Project**. Under *Import Git Repository*, find **Robotics** and click **Import**. If you don't see it, click *Adjust GitHub App Permissions* and allow the repo.
3. Optionally, change **Project Name** to `fdrhs-robotics-hub`; that name becomes your web address. Leave everything else as it is: Vercel detects Next.js, and `vercel.json` sets the build command.
4. Open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the `libsql://…turso.io` URL from Turso |
   | `DATABASE_AUTH_TOKEN` | the token from Turso |
   | `ADMIN_INITIAL_PASSWORD` | the coach account's first password (at least 10 characters) |
   | `TEAM_JOIN_CODE` | for example `COUGAR-2026` (students need it to sign up) |
   | `APP_ENCRYPTION_KEY` | any long random text (protects saved printer keys) |

5. Click **Deploy**. After about 3 minutes you'll see *Congratulations*. Click the preview, or copy the **Domains** address (for example `https://fdrhs-robotics-hub.vercel.app`). **That is your website.**
6. Sign in as **`coach`** with the password you set. Then share the link and join code with the team; students sign up at **`/join`**.

To turn on the GPT mentor later, open the project, go to **Settings → Environment Variables**, and add `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY` and `AZURE_OPENAI_DEPLOYMENT` (or just `OPENAI_API_KEY`). Then use **Deployments → ⋯ → Redeploy**. Until then, the built-in demo mentor answers.

### If something goes wrong

- **The build failed with "No database configured":** `DATABASE_URL` is missing or blank. Add it, then redeploy.
- **The build failed with an authentication error:** the Turso token was copied wrong or expired. Create a new token, update `DATABASE_AUTH_TOKEN`, then redeploy.
- **"That file is too big for this server":** the free plan accepts uploads up to 4 MB each. Split large PDFs, or link to them under Resources instead.
- **Backups:** use **Settings → Data → Export JSON**. Turso also keeps 1 day of point-in-time restore. (*Download backup* only works with a local SQLite file.)

---

## A. Render (paid)

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
