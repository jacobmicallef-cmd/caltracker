# Cal Tracker

A calorie and macro tracker that runs on your own phone. Photograph a meal, or describe it
out loud, and a vision model works out the calories, protein, carbs and fat.

It exists so you don't have to pay a subscription for the same thing. You bring your own
Google Gemini API key, which has a free tier that comfortably covers personal use.

## What it does

- **Photo logging** — point the camera at a plate, get an itemised macro breakdown
- **Text and voice logging** — "a large bowl of pasta bolognese and a glass of milk"
- **Daily rings** — calories, protein, carbs and fat against targets worked out from your profile
- **Date strip** — scroll back through previous days; logged days are ringed
- **Streak** — consecutive days logged
- **Weight tracking** — log weigh-ins, see the trend and 3/7/14/30/90 day changes
- **14-day calorie history** — bar chart with your target marked, days over target in red
- **Works offline** — the app shell is cached; only the AI calls need a connection
- **Backup and restore** — export your whole log to a JSON file

## Your data

Everything is stored in IndexedDB **on your phone**. There is no server, no account, and
no sync. Nothing leaves the device except the food photo or description you send to Google
when you ask for an estimate.

Your API key is stored on the device too. It is never committed to this repository and
never included in a backup export.

Because the data is local, **clearing your browser data will erase your log**. Export a
backup from Settings now and then and keep it in Drive.

## Setting it up

### 1. Get a Gemini API key

Go to [aistudio.google.com](https://aistudio.google.com) → **Get API key**. It's free and
doesn't need a card. Copy the key, which starts with `AIza`.

### 2. Put the app somewhere you can reach it

The app is a static site, so anything that serves files over HTTPS works. The simplest
option is GitHub Pages, which this repo is already set up for:

1. Push this repo to GitHub.
2. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds and publishes it.
4. Your URL will be `https://<your-username>.github.io/<repo-name>/`.

A service worker and the camera both need HTTPS, which Pages provides. `http://` on a
plain IP will not work properly.

### 3. Install it on your phone

Open the URL in Chrome on Android, then **⋮ → Add to Home screen**. It gets an icon and
opens fullscreen with no browser bars.

### 4. Add your key

Open the app → **Settings** → paste your key → **Test key**. It will confirm the key works
and tell you which model it picked.

Leave **Model** on `auto`. The app asks your key which models it can use and picks the best
one for reading photos. Google renames and retires models fairly often, so this avoids the
app breaking when that happens.

## Running it locally

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # production build into dist/
npm run preview  # serve the production build
```

## What it costs

A food photo is a small image plus a short reply — on the order of a thousand tokens.
On Gemini's free tier that is free, within the daily request limit. If you ever exceed the
free tier, the paid rate works out to a fraction of a cent per photo.

## How the estimates work

Your calorie target comes from the Mifflin-St Jeor equation: it estimates your resting
metabolic rate from your sex, age, height and weight, multiplies it by an activity factor,
and then adds or subtracts for your goal. Protein is set per kilo of bodyweight, fat as a
share of calories, and carbohydrate takes the rest.

Portion estimates from a photo are genuinely estimates. The model can't see under the top
layer of a plate, can't tell how much oil a pan held, and will be wrong sometimes. It's
good enough to track a trend over weeks, which is what matters, but don't treat any single
number as exact. Tap a logged meal to see the per-item breakdown and what portion was
assumed, and use the **half** / **double** buttons on the review screen to correct it.

These targets are a standard formula, not medical advice. If you're under 18, training
hard, or have any health condition, it's worth running them past a doctor or dietitian.

## Turning it into an installed Android app

The PWA is enough for most uses. If you want a real APK:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Cal Tracker" com.example.caltracker --web-dir=dist
npm run build && npx cap add android && npx cap sync
cd android && ./gradlew assembleDebug
```

The APK lands in `android/app/build/outputs/apk/debug/`. This needs the Android SDK and a
JDK installed. No rewrite is involved — Capacitor wraps the same build.

## Tech

React 19, TypeScript, Vite, Tailwind 4, IndexedDB via `idb`. No backend.
