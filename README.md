# Checklist Summarizer — Trello Power-Up

A modern Trello Power-Up built with Vite & React that analyzes card checklists, aggregates completion metrics across boards, detects overdue tasks, and generates one-click Markdown reports & card comments.

---

## 🚀 Key Features

1. **Card-Back Summary Widget (`card-back-section`)**:
   - Embedded directly on the back of cards alongside native checklists.
   - Live completion gauge ring, remaining task count, overdue alerts, and 1-click **Copy Markdown** / **Post Comment**.
2. **Card Badges & Detail Badges (`card-badges`, `card-detail-badges`)**:
   - Front-of-card checklist counter: e.g. `📋 7/10 (70%)` with color-coded health indicators (`green`, `yellow`, `red`).
3. **Board Checklists Overview (`board-buttons`)**:
   - Board header button opening a full audit dashboard showing checklist completion across all lists, cards needing urgent attention, and list filters.
4. **Interactive Modal Dialog (`card-buttons`)**:
   - Deep dive into checklists with task filtering (All Checklists vs Remaining Incomplete Tasks), real-time task checkoff, and formatted markdown report export.
5. **Zero-Server Auth Flow**:
   - Client-side OAuth 1.0a handshake stored inside Trello's member-private plugin storage (`t.set('member', 'private', 'token')`). No external database required.
6. **Built-in Local Dev Sandbox**:
   - Interactive multi-view simulator loaded with rich mock checklists so you can develop and test without needing a live Trello board.

---

## 🛠️ Project Structure

```
Checklist Summarizer/
├── package.json              # React 18, Vite 5
├── vite.config.js            # Multi-page build config (5 distinct HTML entries)
├── vercel.json               # Critical Trello CSP headers (frame-ancestors, connect-src)
├── .env / .env.example       # VITE_TRELLO_APP_KEY
├── index.html                # Local development sandbox / testing dashboard
├── powerup.html              # Main Power-Up connector iframe (registered in Trello)
├── auth.html                 # Authorization popup iframe
├── settings.html             # Board settings popup iframe
├── summarizer.html           # Main modal & card-back section app
├── public/
│   ├── authorized.html       # OAuth redirect receiver page
│   ├── authorized.js         # Token receiver & postMessage sender
│   ├── manifest.json         # PWA / web app manifest
│   └── icons/                # SVG icons for Trello buttons and badges
└── src/
    ├── powerup/
    │   └── main.js           # TrelloPowerUp.initialize({ ...capabilities })
    ├── auth/
    │   ├── main.jsx          # React root for auth popup
    │   ├── AuthPopup.jsx     # UI for OAuth connect button & status
    │   └── auth.css
    ├── settings/
    │   ├── main.jsx          # React root for settings popup
    │   ├── SettingsPopup.jsx # Member profile & Disconnect Account
    │   └── settings.css
    ├── summarizer/
    │   ├── main.jsx          # React root for summarizer app
    │   ├── SummarizerApp.jsx # Multi-view checklist engine, stats & export
    │   └── summarizer.css
    └── lib/
        ├── auth.js           # Token get/set/clear in Trello private storage
        ├── trelloApi.js      # Authenticated fetch wrapper for Trello REST API v1
        ├── trelloMock.js     # Dev mock fallback for window.TrelloPowerUp.iframe()
        ├── checklistService.js # Analytics, overdue calculation & markdown generator
        └── icons.jsx         # Reusable SVG icon set
```

---

## 💻 Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the local dev server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5174/` to view the interactive developer sandbox.

3. **Build production bundle**:
   ```bash
   npm run build
   ```

---

## 🌐 Deploying to Trello

1. **Deploy to Vercel, Netlify, or any static host**:
   - Ensure the CSP headers in `vercel.json` are applied so Trello can embed your iframes.
2. **Register in Trello Developer Portal**:
   - Go to [Trello Power-Up Admin](https://trello.com/power-ups/admin) &rarr; **New Power-Up**.
   - Set **Iframe connector URL** to:
     `https://<your-deployment-domain>/powerup.html`
   - Enable Capabilities:
     - Board buttons
     - Card buttons
     - Card badges
     - Card detail badges
     - Card back section
     - Authorization status & Show authorization
     - Show settings
3. **Set API Key**:
   - Copy your Trello API Key from the admin portal and update `VITE_TRELLO_APP_KEY` in `.env`.
