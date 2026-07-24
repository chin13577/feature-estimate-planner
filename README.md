# Man-Day Estimator

A web app for estimating project effort in man-days, broken down by phase,
main feature, task, and role.

**If you just want to use it, you only need the website URL.** Everything below
is for whoever owns and deploys the site.

---

## Features

- Break a project into phases → main features → tasks
- Define your own roles (Developer, Artist, QA, …) as estimate columns
- Enter man-day estimates per task and role, including decimals like `0.25`
- Enable or disable any phase, feature, or task — disabled items keep their
  numbers but are excluded from every total
- Totals update instantly for each feature, phase, and the whole project
- Free-text note on every phase
- Project summary table showing each phase's status and totals
- Your project saved in this browser, restored when you come back
- Export and import projects as `.json`
- Light and dark themes
- Autosaves to browser storage as you type

---

## Requirements

Only needed by the person deploying the site:

- [Node.js](https://nodejs.org/) 20.13 or newer
- npm (included with Node.js)
- A free [Firebase](https://firebase.google.com/) account, for deployment

End users need nothing but a browser.

---

## Run Locally

```bash
npm install
npm run dev
```

Open the URL it prints, usually <http://localhost:5173>.

Other commands:

```bash
npm run build     # production build into dist/
npm run preview   # serve the production build locally
npm test          # run the unit tests
```

---

## Build for Production

```bash
npm run build
```

This type-checks the project and writes the finished site to `dist/`. That
folder is what gets deployed — it is plain HTML, CSS, and JavaScript with no
server component.

---

## Deploy to Firebase Hosting

### 1. Create a Firebase project

1. Go to <https://console.firebase.google.com/>
2. Click **Add project**
3. Give it a name — this becomes part of your URL, e.g. a project named
   `manday-estimator` is served at `https://manday-estimator.web.app`
4. Google Analytics is optional; you can decline it
5. Click **Create project**

You do **not** need to add Firestore, Authentication, or a billing account.
This app uses Hosting only, which is free.

### 2. Install the Firebase CLI

```bash
npm install -g firebase-tools
```

### 3. Log in

```bash
firebase login
```

A browser window opens for you to sign in with your Google account.

### 4. Connect this project to Firebase

```bash
firebase init hosting
```

Answer the prompts as follows:

| Prompt | Answer |
|---|---|
| Please select an option | **Use an existing project** |
| Select a default Firebase project | the project you created in step 1 |
| What do you want to use as your public directory? | `dist` |
| Configure as a single-page app? | **Yes** |
| Set up automatic builds and deploys with GitHub? | **No** (optional) |
| File dist/index.html already exists. Overwrite? | **No** |

> **Answering "No" to the overwrite question matters.** Saying yes replaces
> your built app with a Firebase placeholder page.

This creates a `.firebaserc` file holding your project ID. It is gitignored on
purpose, so your project ID is not committed. `.firebaserc.example` shows the
format.

### 5. Build and deploy

```bash
npm run build
firebase deploy
```

When it finishes, the CLI prints your **Hosting URL**. Open it — that is the
address to share.

---

## Update an Existing Deployment

After making changes:

```bash
npm run build
firebase deploy
```

The new version is live within seconds. There is no separate publish step.

To deploy from a machine that has never deployed before, run `firebase login`
first, and create `.firebaserc` from the example:

```json
{
  "projects": {
    "default": "your-actual-project-id"
  }
}
```

### Changing the Firebase project ID

Edit the `default` value in `.firebaserc`, or run `firebase use --add` to pick
a different project.

---

## Local Storage and Backups

> This version uses Firebase Hosting only.
>
> Project data is stored locally in each user's browser.
> No cloud database is required.

The app keeps **one project**, saved in the browser that created it. This has
consequences worth being explicit about:

- A project created in Chrome on one computer **will not** appear in Firefox,
  on another computer, or on a phone.
- Clearing browser data, or using "private"/"incognito" mode, **can
  permanently delete the saved project**.
- **New Project** and **Import JSON** replace what you are working on. Both
  ask for confirmation first.
- Nothing is synchronised to the cloud. Nobody else can see your estimates,
  and you cannot recover them if the browser data is lost.

**Export a JSON backup before clearing browser data, switching browsers, or
moving to another device.**

---

## Import and Export JSON

**Export** — click **Export JSON**. The file downloads as
`manday-estimate-<project-name>-<date>.json`.

**Import** — click **Import JSON**, then choose or drag in a `.json` file. You
will see a summary of what the file contains before anything is applied.
Importing **replaces** the project you are working on, so export a backup
first if you want to keep it.

Use these two together to move a project between browsers or devices, or to
keep a backup outside the browser.

---

## Project Structure

```
src/
├── domain/           Types, calculations, validation, import/export
│   ├── types.ts              The data model
│   ├── calculations.ts       All totals — pure functions, no React
│   ├── factories.ts          Creating and duplicating items
│   ├── enabledState.ts       Tri-state parent checkboxes
│   ├── schema.ts             Zod schema for stored/imported data
│   ├── validateImportedProject.ts
│   └── exportProject.ts
├── storage/          Persistence, behind an interface
│   ├── ProjectRepository.ts             The contract
│   ├── LocalStorageProjectRepository.ts The browser implementation
│   └── useAutosave.ts
├── state/            App state
│   ├── projectReducer.ts     Every edit, as pure (state, action)
│   ├── ProjectProvider.tsx   Wires reducer + repository + autosave
│   └── ThemeProvider.tsx
├── components/       UI
└── EstimatorPage.tsx Screen layout and dialog flow
```

Two deliberate boundaries:

- **All totals are derived, never stored.** Exported JSON contains only source
  data, so a file can never disagree with the numbers on screen.
- **All persistence goes through `ProjectRepository`.** No component touches
  `localStorage`. Adding cloud storage later means writing one new
  implementation of that interface, without changing the UI or the
  calculations.

---

## Troubleshooting

**`firebase: command not found`**
The CLI is not installed or not on your PATH. Run
`npm install -g firebase-tools`. On macOS or Linux you may need
`sudo npm install -g firebase-tools`.

**Deploy succeeds but the page is blank**
`dist/` was empty or stale. Run `npm run build` before `firebase deploy`, and
check that `firebase.json` has `"public": "dist"`.

**The site shows the Firebase welcome page**
You answered **Yes** to "Overwrite index.html" during `firebase init`. Rebuild
and redeploy: `npm run build && firebase deploy`.

**Refreshing a page gives a 404**
The single-page rewrite is missing. `firebase.json` must contain the
`rewrites` block pointing `**` at `/index.html` — it does in this repo, so
check the file was not overwritten by `firebase init`.

**`Error: Failed to get Firebase project`**
The project ID in `.firebaserc` is wrong, or you are logged in as the wrong
account. Run `firebase login --reauth`, then `firebase use --add`.

**`npm run build` fails with type errors**
Run `npm install` first. If it persists, delete `node_modules` and
`package-lock.json`, then `npm install` again.

**A user's projects vanished**
Browser data was cleared, or they are in a different browser or device. There
is no server-side copy — this is why the app recommends JSON backups.

**"Browser storage is unavailable" appears in the app**
The browser is blocking storage, usually in private mode or with cookies
disabled. The app still works for the session, but nothing is saved. Export a
backup before closing the tab.

---

## Costs

This app uses **Firebase Hosting only** — a static site with no database, no
Cloud Functions, and no server-side rendering. It fits comfortably in
Firebase's free Spark plan, and no billing account is required.

The app is also plain static output, so it can be deployed to Cloudflare
Pages, GitHub Pages, Netlify, or Vercel by pointing them at `dist/`.
