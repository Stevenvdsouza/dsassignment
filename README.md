# Customer Ticket Queue Visualizer

An interactive, animated demo of an **array-based circular queue** (ring buffer) using customer support tickets. Built with plain HTML + CSS + vanilla JavaScript — no frameworks, no build step.

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | Semantic HTML structure, educational accordion |
| `style.css` | Premium design, keyframe animations, responsive layout |
| `script.js` | `CircularQueue` class, `Logger` class, DOM rendering, demo runner |
| `README.md` | This file |

---

## Running Locally

**Option 1 — Double-click** (simplest):  
Open File Explorer → navigate to the project folder → double-click `index.html`.  
It opens directly in your default browser. No server needed.

**Option 2 — VS Code Live Server**:  
Right-click `index.html` in the Explorer panel → *"Open with Live Server"*.  
Automatically refreshes on every save.

**Option 3 — PowerShell**:
```powershell
# Open in default browser
start C:\dsassignment\index.html

# Open in Edge specifically
start msedge "C:\dsassignment\index.html"
```

---

## Deploying to Netlify

1. Go to [netlify.com](https://netlify.com) and sign in.
2. Drag the entire **`dsassignment`** folder onto the Netlify dashboard drop zone.
3. Netlify auto-detects static files — your site is live in seconds with a free `*.netlify.app` URL.

Or via Netlify CLI:
```bash
npm install -g netlify-cli
netlify deploy --dir . --prod
```

---

## Deploying to Vercel

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```
2. In your project folder:
   ```bash
   vercel
   ```
3. Follow the prompts. Vercel detects a static site (no `package.json` needed) and deploys from the current directory.

Your site will get a `*.vercel.app` URL immediately.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `E` | Enqueue (add next ticket) |
| `D` | Dequeue (serve front ticket) |

---

## Code Structure (for Viva)

```
script.js
├── SECTION 1 — CONSTANTS         (CAPACITY, timings, demo sequence)
├── SECTION 2 — CircularQueue     (pure ADT: enqueue, dequeue, peek, reset, getSnapshot)
├── SECTION 3 — Logger            (records every operation with step number)
└── SECTION 4 — DOM / Rendering   (buildSlots, render, updatePointers, animations,
                                   operation functions, demo runner, event listeners)
```

The `CircularQueue` class has **no DOM references** — it is a clean, testable ADT.  
The rendering layer calls `queue.getSnapshot()` and updates the HTML accordingly.

---

## Sample Trace (verify in Operation Log)

| Step | Op | Rear | Front | Array (slot 0–4) |
|------|----|------|-------|-----------------|
| 1 | Enqueue T101 | 0 | 0 | T101, —, —, —, — |
| 2 | Enqueue T102 | 1 | 0 | T101, T102, —, —, — |
| 3 | Enqueue T103 | 2 | 0 | T101, T102, T103, —, — |
| 4 | Dequeue T101 | 2 | 1 | —, T102, T103, —, — |
| 5 | Enqueue T104 | 3 | 1 | —, T102, T103, T104, — |
| 6 | Enqueue T105 | 4 | 1 | —, T102, T103, T104, T105 |
| 7 | **Enqueue T106 ↻ WRAP** | **0** | 1 | T106, T102, T103, T104, T105 |
| 8–12 | Dequeue × 5 | 0 | 1→0→empty | queue drains in FIFO order |
| 13 | Dequeue on empty | — | — | **Underflow error** |

Click **▶ Run Demo** to watch this trace happen automatically.

---

## Queue Logic Summary

```
rear  = (rear  + 1) % capacity   // enqueue pointer advance (wraps 4 → 0)
front = (front + 1) % capacity   // dequeue pointer advance (wraps 4 → 0)
```

All operations are **O(1)** time, **O(n)** total space where n = capacity.
