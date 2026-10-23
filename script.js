/* ============================================================
   SCRIPT.JS — Customer Ticket Queue Visualizer
   ============================================================
   STRUCTURE (two clearly separated layers):
     1. CircularQueue class  — pure data-structure logic, no DOM.
     2. Logger class         — tracks operation history, no DOM.
     3. DOM / Rendering      — everything that touches HTML elements.
   ============================================================ */

'use strict';

/* ────────────────────────────────────────────────────────────
   SECTION 1 — CONSTANTS
   Change CAPACITY here to resize the queue (HTML must also be updated).
──────────────────────────────────────────────────────────────*/
const CAPACITY = 5; // Number of slots in the circular array

// Animation durations in milliseconds (keep in sync with CSS vars)
const ANIM_ENTER      = 350;  // ticket slide-in
const ANIM_STAMP      = 180;  // "SERVED!" stamp appearance
const ANIM_EXIT       = 270;  // ticket slide-out
const ANIM_PULSE      = 550;  // peek highlight ring
const ANIM_WRAP_BADGE = 2400; // wrap-around banner

// Demo speed map (milliseconds between auto steps)
const SPEED_MAP = { slow: 2000, normal: 1000, fast: 400 };

// Preset demo sequence (operations performed hands-free)
// Trace: EQ×3, DQ×1, EQ×3 (wrap on 3rd), DQ×5, DQ on empty
const DEMO_SEQUENCE = [
  'enqueue', 'enqueue', 'enqueue',  // T101, T102, T103
  'dequeue',                         // serve T101
  'enqueue', 'enqueue', 'enqueue',  // T104, T105, T106 (← rear wraps 4→0)
  'dequeue', 'dequeue', 'dequeue', 'dequeue', 'dequeue', // drain
  'dequeue',                         // ← underflow demonstration
];


/* ============================================================
   SECTION 2 — CircularQueue CLASS
   Pure data-structure logic — ZERO DOM references here.
   This is what you explain in the viva as the "ADT layer".
   ============================================================ */
class CircularQueue {
  /**
   * @param {number} capacity - Maximum number of elements.
   */
  constructor(capacity) {
    this.capacity        = capacity;
    this.array           = new Array(capacity).fill(null); // backing store
    this.front           = 0;   // index of oldest element
    this.rear            = -1;  // index of newest element (-1 = empty)
    this.count           = 0;   // number of elements currently stored
    this.nextTicketNumber = 101; // auto-increment ticket id (T101, T102, …)
  }

  /* --- Predicate helpers --- */
  isEmpty() { return this.count === 0; }
  isFull()  { return this.count === this.capacity; }

  /* --- ENQUEUE — add to rear — O(1) ---
     Returns { ok, ticket, slot, message }
  */
  enqueue() {
    if (this.isFull()) {
      return {
        ok: false,
        message: '⚠️ Queue is full — no new tickets accepted (overflow).'
      };
    }
    const ticket  = `T${this.nextTicketNumber++}`;
    this.rear     = (this.rear + 1) % this.capacity; // circular wrap
    this.array[this.rear] = ticket;
    this.count++;
    return {
      ok: true,
      ticket,
      slot: this.rear,
      message: `✅ ${ticket} enqueued at rear → slot [${this.rear}].`
    };
  }

  /* --- DEQUEUE — remove from front — O(1) ---
     Returns { ok, ticket, slot, message }
  */
  dequeue() {
    if (this.isEmpty()) {
      return {
        ok: false,
        message: '⚠️ Queue is empty — no tickets to serve (underflow).'
      };
    }
    const ticket       = this.array[this.front];
    const slot         = this.front;
    this.array[this.front] = null;           // clear the freed slot
    this.front         = (this.front + 1) % this.capacity; // circular wrap
    this.count--;
    return {
      ok: true,
      ticket,
      slot,
      message: `🎫 ${ticket} served and removed from slot [${slot}].`
    };
  }

  /* --- PEEK FRONT — O(1) */
  peekFront() {
    if (this.isEmpty()) return { ok: false, message: 'ℹ️ Queue is empty — no front ticket.' };
    return {
      ok: true,
      ticket: this.array[this.front],
      slot:   this.front,
      message: `👀 Front ticket is ${this.array[this.front]} at slot [${this.front}].`
    };
  }

  /* --- PEEK REAR — O(1) */
  peekRear() {
    if (this.isEmpty()) return { ok: false, message: 'ℹ️ Queue is empty — no rear ticket.' };
    return {
      ok: true,
      ticket: this.array[this.rear],
      slot:   this.rear,
      message: `👀 Rear ticket is ${this.array[this.rear]} at slot [${this.rear}].`
    };
  }

  /* --- CHECK EMPTY */
  checkEmpty() {
    return this.isEmpty()
      ? { ok: true,  message: '✅ Queue IS empty — no tickets waiting.' }
      : { ok: false, message: `❌ Queue is NOT empty — ${this.count} ticket(s) waiting.` };
  }

  /* --- RESET to initial state */
  reset() {
    this.array            = new Array(this.capacity).fill(null);
    this.front            = 0;
    this.rear             = -1;
    this.count            = 0;
    this.nextTicketNumber = 101;
  }

  /* --- Returns queue contents in logical FRONT→REAR order */
  getContents() {
    const result = [];
    for (let i = 0; i < this.count; i++) {
      result.push(this.array[(this.front + i) % this.capacity]);
    }
    return result;
  }

  /* --- Snapshot for rendering — immutable view of current state */
  getSnapshot() {
    const contents = this.getContents();
    return {
      array:       [...this.array],
      front:       this.front,
      rear:        this.rear,
      count:       this.count,
      capacity:    this.capacity,
      isEmpty:     this.isEmpty(),
      isFull:      this.isFull(),
      frontTicket: this.isEmpty() ? null : this.array[this.front],
      rearTicket:  this.isEmpty() ? null : this.array[this.rear],
      contents,    // ordered front→rear
      contentsStr: contents.length ? `[${contents.join(', ')}]` : '[]'
    };
  }
}


/* ============================================================
   SECTION 3 — Logger CLASS
   Tracks every operation — no DOM references here.
   ============================================================ */
class Logger {
  constructor() {
    this.entries   = [];
    this.stepCount = 0;
  }

  /**
   * Record one operation.
   * @param {string}  operation  Human-readable label, e.g. "Enqueue T103"
   * @param {boolean} success    Whether operation succeeded
   * @param {object}  snap       Queue snapshot (from getSnapshot)
   * @param {string}  [extraMsg] Extra note for failed ops, e.g. "Overflow"
   * @returns {object} The log entry (for immediate rendering)
   */
  log(operation, success, snap, extraMsg = '') {
    this.stepCount++;
    const entry = {
      step:     this.stepCount,
      operation,
      success,
      queue:    snap.contentsStr,
      front:    snap.frontTicket || '—',
      rear:     snap.rearTicket  || '—',
      frontIdx: snap.isEmpty ? '—' : String(snap.front),
      rearIdx:  snap.isEmpty ? '—' : String(snap.rear),
      size:     snap.count,
      extraMsg,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })
    };
    this.entries.push(entry);
    return entry;
  }

  clear() {
    this.entries   = [];
    this.stepCount = 0;
  }
}


/* ============================================================
   SECTION 4 — DOM / RENDERING LAYER
   Everything below this line is allowed to touch HTML.
   ============================================================ */

/* --- Instantiate data-structure objects --- */
const queue  = new CircularQueue(CAPACITY);
const logger = new Logger();

/* --- Animation / demo state --- */
let isAnimating = false;  // true while any slot animation is playing
let demoRunning = false;  // true while auto-demo is executing
let demoTimer   = null;   // setTimeout handle for demo stepping
let demoStep    = 0;      // current index into DEMO_SEQUENCE

/* --- Cache DOM handles (queried once at startup) --- */
const $ = id => document.getElementById(id);

const slotsContainer = $('slots-container');
const ptrBar         = $('ptr-bar');
const ptrFront       = $('ptr-front');
const ptrRear        = $('ptr-rear');
const wrapBadge      = $('wrap-badge');
const infoFront      = $('info-front');
const infoRear       = $('info-rear');
const infoSize       = $('info-size');
const infoStatus     = $('info-status');
const infoFrontIdx   = $('info-front-idx');
const infoRearIdx    = $('info-rear-idx');
const toastEl        = $('toast');
const opHistory      = $('op-history');
const opTableCont    = $('op-table-container');
const btnEnqueue     = $('btn-enqueue');
const btnDequeue     = $('btn-dequeue');
const btnFront       = $('btn-front');
const btnRear        = $('btn-rear');
const btnEmpty       = $('btn-empty');
const btnReset       = $('btn-reset');
const btnDemo        = $('btn-demo');
const speedSelect    = $('speed-select');

let toastTimer = null; // setTimeout handle for toast auto-dismiss


/* ────────────────────────────────────────────────────────────
   SLOT CONSTRUCTION
   Builds the 5 slot-wrapper elements dynamically so CAPACITY
   can be changed by editing only the constant above.
──────────────────────────────────────────────────────────────*/
function buildSlots() {
  slotsContainer.innerHTML = '';
  for (let i = 0; i < CAPACITY; i++) {
    // wrapper ─ flex-column: box + index label
    const wrapper = document.createElement('div');
    wrapper.className = 'slot-wrapper';
    wrapper.id        = `slot-wrapper-${i}`;
    wrapper.setAttribute('role', 'listitem');
    wrapper.setAttribute('aria-label', `Slot ${i}`);

    // the visual box
    const box = document.createElement('div');
    box.className = 'slot-box';
    box.id        = `slot-box-${i}`;

    // ticket label inside box
    const ticket = document.createElement('div');
    ticket.className = 'ticket-card';
    ticket.id        = `ticket-${i}`;
    box.appendChild(ticket);

    // "SERVED!" stamp overlay (shown during dequeue animation)
    const stamp = document.createElement('div');
    stamp.className = 'served-overlay';
    stamp.id        = `served-${i}`;
    stamp.setAttribute('aria-hidden', 'true');
    stamp.textContent = 'SERVED!';
    box.appendChild(stamp);

    wrapper.appendChild(box);

    // slot index label below the box
    const idx = document.createElement('div');
    idx.className   = 'slot-index';
    idx.textContent = `[${i}]`;
    wrapper.appendChild(idx);

    slotsContainer.appendChild(wrapper);
  }
}


/* ────────────────────────────────────────────────────────────
   RENDER — main DOM update (call after every state change)
──────────────────────────────────────────────────────────────*/
function render(snap) {
  /* Slot boxes */
  for (let i = 0; i < CAPACITY; i++) {
    const box    = $(`slot-box-${i}`);
    const ticket = $(`ticket-${i}`);

    if (snap.array[i] !== null) {
      box.classList.add('occupied');
      ticket.textContent = snap.array[i];
      ticket.classList.add('visible');
    } else {
      box.classList.remove('occupied', 'hl-green', 'hl-amber');
      ticket.textContent = '';
      ticket.classList.remove('visible', 'anim-enter');
    }
  }

  /* Info panel */
  infoFront.textContent    = snap.frontTicket || '—';
  infoRear.textContent     = snap.rearTicket  || '—';
  infoSize.textContent     = `${snap.count} / ${snap.capacity}`;
  infoFrontIdx.textContent = snap.isEmpty ? '—' : String(snap.front);
  infoRearIdx.textContent  = snap.isEmpty ? '—' : String(snap.rear);

  /* Status badge */
  infoStatus.className = 'status-badge';
  if (snap.isEmpty) {
    infoStatus.textContent = 'Empty';
    infoStatus.classList.add('badge-empty');
  } else if (snap.isFull) {
    infoStatus.textContent = 'Full';
    infoStatus.classList.add('badge-full');
  } else {
    infoStatus.textContent = 'Has Tickets';
    infoStatus.classList.add('badge-has');
  }

  updateButtonStates(snap);
  updatePointers(snap);
}


/* ────────────────────────────────────────────────────────────
   POINTER ANIMATION
   Absolutely-positioned FRONT / REAR labels slide between
   slots using CSS transition on the `left` property.
──────────────────────────────────────────────────────────────*/
function updatePointers(snap) {
  if (snap.isEmpty) {
    ptrFront.classList.remove('visible');
    ptrRear.classList.remove('visible');
    return;
  }

  // Use requestAnimationFrame so getBoundingClientRect is post-layout
  requestAnimationFrame(() => {
    const barRect = ptrBar.getBoundingClientRect();
    const fwRect  = $(`slot-wrapper-${snap.front}`).getBoundingClientRect();
    const rwRect  = $(`slot-wrapper-${snap.rear}`).getBoundingClientRect();

    // Center of each slot relative to pointer bar's left edge
    let fX = fwRect.left + fwRect.width / 2 - barRect.left;
    let rX = rwRect.left + rwRect.width / 2 - barRect.left;

    // When both pointers land on the same slot, offset them slightly
    if (snap.front === snap.rear) {
      fX -= 22;
      rX += 22;
    }

    // If pointer was hidden, suppress left transition so it fades in
    // at the correct position rather than animating from 0
    const fWasHidden = !ptrFront.classList.contains('visible');
    const rWasHidden = !ptrRear.classList.contains('visible');

    if (fWasHidden) ptrFront.classList.add('no-anim');
    if (rWasHidden) ptrRear.classList.add('no-anim');

    ptrFront.style.left = fX + 'px';
    ptrRear.style.left  = rX + 'px';

    ptrFront.classList.add('visible');
    ptrRear.classList.add('visible');

    // Re-enable left transition on the next frame (after position is painted)
    if (fWasHidden || rWasHidden) {
      requestAnimationFrame(() => {
        ptrFront.classList.remove('no-anim');
        ptrRear.classList.remove('no-anim');
      });
    }
  });
}


/* ────────────────────────────────────────────────────────────
   BUTTON STATE MANAGEMENT
──────────────────────────────────────────────────────────────*/
function updateButtonStates(snap) {
  snap = snap || queue.getSnapshot();
  const busy = isAnimating || demoRunning;

  btnEnqueue.disabled = snap.isFull  || busy;
  btnDequeue.disabled = snap.isEmpty || busy;
  btnFront.disabled   = snap.isEmpty || busy;
  btnRear.disabled    = snap.isEmpty || busy;
  btnEmpty.disabled   = busy;
  // Reset is ALWAYS enabled — it stops the demo and clears animation
  btnReset.disabled   = false;
  // Demo button: disabled only during animation (not during the demo itself)
  btnDemo.disabled    = isAnimating;
  btnDemo.textContent = demoRunning ? '⏹ Stop Demo' : '▶ Run Demo';
}


/* ────────────────────────────────────────────────────────────
   TOAST NOTIFICATION
──────────────────────────────────────────────────────────────*/
/**
 * @param {string} msg   - Message text
 * @param {'ok'|'err'|'info'} type
 */
function showToast(msg, type = 'info') {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.className   = `toast show toast-${type}`;
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3000);
}


/* ────────────────────────────────────────────────────────────
   WRAP-AROUND BADGE
──────────────────────────────────────────────────────────────*/
function showWrapBadge() {
  wrapBadge.classList.remove('show');
  void wrapBadge.offsetWidth; // force reflow to restart animation
  wrapBadge.classList.add('show');
  setTimeout(() => wrapBadge.classList.remove('show'), ANIM_WRAP_BADGE);
}


/* ────────────────────────────────────────────────────────────
   OPERATION LOG — list view
──────────────────────────────────────────────────────────────*/
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Format one log entry as an HTML string for the list view */
function formatListEntry(e) {
  const step = `<span class="log-step">Step ${e.step}</span>`;
  if (e.success) {
    return `${step} | <strong>${escHtml(e.operation)}</strong> | `
         + `Queue: <code>${escHtml(e.queue)}</code> | `
         + `Front: <code>${escHtml(e.front)}</code> | `
         + `Rear: <code>${escHtml(e.rear)}</code> | `
         + `front=${e.frontIdx}, rear=${e.rearIdx}, size=${e.size}`;
  }
  return `${step} | <strong>${escHtml(e.operation)}</strong> | `
       + `⚠️ ${escHtml(e.extraMsg || 'Failed')} | `
       + `Queue: <code>${escHtml(e.queue)}</code> | size=${e.size}`;
}

/** Append ONE new entry to the list (avoids full re-render flicker) */
function appendLogEntry(entry) {
  // Remove the placeholder hint if present
  const hint = opHistory.querySelector('.log-empty-hint');
  if (hint) hint.remove();

  const div = document.createElement('div');
  div.className   = `log-entry ${entry.success ? 'log-ok' : 'log-err'}`;
  div.innerHTML   = formatListEntry(entry);
  opHistory.appendChild(div);
  opHistory.scrollTop = opHistory.scrollHeight; // auto-scroll to bottom (newest)

  // Cap list at 60 entries to avoid DOM bloat during long demos
  while (opHistory.children.length > 60) {
    opHistory.removeChild(opHistory.firstChild);
  }

  // Keep table in sync if it's currently visible
  if ($('log-view-table').classList.contains('active')) {
    renderTable();
  }
}

/** Full re-render of list (used after clear / reset) */
function renderLogList() {
  if (logger.entries.length === 0) {
    opHistory.innerHTML = '<div class="log-empty-hint">Operations will appear here…</div>';
    return;
  }
  opHistory.innerHTML = '';
  logger.entries.forEach(e => {
    const div = document.createElement('div');
    div.className = `log-entry ${e.success ? 'log-ok' : 'log-err'}`;
    div.innerHTML = formatListEntry(e);
    opHistory.appendChild(div);
  });
  opHistory.scrollTop = opHistory.scrollHeight;
}


/* ────────────────────────────────────────────────────────────
   OPERATION LOG — table view
──────────────────────────────────────────────────────────────*/
function renderTable() {
  if (logger.entries.length === 0) {
    opTableCont.innerHTML = '<div class="log-empty-hint">No operations yet — perform some first.</div>';
    return;
  }

  let rows = '';
  for (const e of logger.entries) {
    rows += `<tr class="${e.success ? '' : 'row-err'}">
      <td class="cell-step">${e.step}</td>
      <td class="cell-op">${escHtml(e.operation)}</td>
      <td class="cell-queue"><code>${escHtml(e.queue)}</code></td>
      <td class="cell-mono"><code>${escHtml(e.front)}</code></td>
      <td class="cell-mono"><code>${escHtml(e.rear)}</code></td>
      <td class="cell-mono">${e.frontIdx}</td>
      <td class="cell-mono">${e.rearIdx}</td>
      <td class="cell-mono">${e.size}</td>
    </tr>`;
  }

  opTableCont.innerHTML = `
    <div class="table-scroll">
      <table class="op-table" aria-label="Operation history table">
        <thead>
          <tr>
            <th>Step</th>
            <th>Operation</th>
            <th>Queue (front→rear)</th>
            <th>Front</th>
            <th>Rear</th>
            <th>front idx</th>
            <th>rear idx</th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/** Switch between Log / Table tabs */
function switchLogTab(view) {
  ['log', 'table'].forEach(v => {
    $(`log-view-${v}`).classList.toggle('active', v === view);
    const btn = $(`tab-btn-${v}`);
    btn.classList.toggle('active', v === view);
    btn.setAttribute('aria-selected', String(v === view));
  });
  if (view === 'table') renderTable();
}


/* ════════════════════════════════════════════════════════════
   OPERATION FUNCTIONS
   Each function: validate → animate → update queue → render → log
   ════════════════════════════════════════════════════════════ */

/* ── ENQUEUE ── */
function doEnqueue() {
  if (isAnimating) return;

  // Check full BEFORE modifying queue
  if (queue.isFull()) {
    const result = queue.enqueue(); // returns ok:false immediately
    const snap   = queue.getSnapshot();
    showToast(result.message, 'err');
    appendLogEntry(logger.log('Enqueue (full — overflow)', false, snap, 'Queue is full'));
    return;
  }

  isAnimating = true;
  updateButtonStates();

  const prevRear = queue.rear; // capture before mutation
  const result   = queue.enqueue();
  const snap     = queue.getSnapshot();

  // Detect circular wrap: rear moved from last slot back to slot 0
  const wrapped = prevRear === CAPACITY - 1 && result.slot === 0;

  // Update DOM first, then layer entrance animation
  render(snap);

  // Slot highlight + ticket entrance animation
  const box      = $(`slot-box-${result.slot}`);
  const ticketEl = $(`ticket-${result.slot}`);
  box.classList.add('hl-green');
  ticketEl.classList.add('anim-enter');

  if (wrapped) showWrapBadge();

  showToast(result.message, 'ok');
  appendLogEntry(logger.log(`Enqueue ${result.ticket}`, true, snap,
    `${result.ticket} → slot [${result.slot}]${wrapped ? ' ↻ wrap!' : ''}`));

  setTimeout(() => {
    ticketEl.classList.remove('anim-enter');
    box.classList.remove('hl-green');
    isAnimating = false;
    updateButtonStates();
  }, ANIM_ENTER + 60);
}

/* ── DEQUEUE ── */
function doDequeue() {
  if (isAnimating) return;

  // Underflow — no animation needed
  if (queue.isEmpty()) {
    const result = queue.dequeue(); // returns ok:false immediately
    const snap   = queue.getSnapshot();
    showToast(result.message, 'err');
    appendLogEntry(logger.log('Dequeue (empty — underflow)', false, snap, 'Queue is empty'));
    return;
  }

  isAnimating = true;
  updateButtonStates();

  const frontSlot = queue.front; // capture before mutation
  const box       = $(`slot-box-${frontSlot}`);

  // Phase 1 — show SERVED stamp
  box.classList.add('anim-serve');

  setTimeout(() => {
    // Phase 2 — slide ticket out
    box.classList.remove('anim-serve');
    box.classList.add('anim-exit');

    setTimeout(() => {
      // Phase 3 — update data structure and re-render
      box.classList.remove('anim-exit');

      const result = queue.dequeue();
      const snap   = queue.getSnapshot();

      render(snap);
      showToast(result.message, 'ok');
      appendLogEntry(logger.log(`Dequeue ${result.ticket}`, true, snap,
        `Served ${result.ticket} from slot [${result.slot}]`));

      isAnimating = false;
      updateButtonStates();
    }, ANIM_EXIT + 30);
  }, ANIM_STAMP + 40);
}

/* ── PEEK FRONT ── */
function doPeekFront() {
  if (isAnimating) return;

  const result = queue.peekFront();
  const snap   = queue.getSnapshot();

  if (!result.ok) {
    showToast(result.message, 'err');
    appendLogEntry(logger.log('Peek Front (empty)', false, snap, 'Queue is empty'));
    return;
  }

  isAnimating = true;
  updateButtonStates();

  const box = $(`slot-box-${snap.front}`);
  box.classList.add('hl-amber', 'anim-pulse');

  showToast(result.message, 'info');
  appendLogEntry(logger.log(`Peek Front → ${result.ticket}`, true, snap, ''));

  setTimeout(() => {
    box.classList.remove('hl-amber', 'anim-pulse');
    isAnimating = false;
    updateButtonStates();
  }, ANIM_PULSE + 60);
}

/* ── PEEK REAR ── */
function doPeekRear() {
  if (isAnimating) return;

  const result = queue.peekRear();
  const snap   = queue.getSnapshot();

  if (!result.ok) {
    showToast(result.message, 'err');
    appendLogEntry(logger.log('Peek Rear (empty)', false, snap, 'Queue is empty'));
    return;
  }

  isAnimating = true;
  updateButtonStates();

  const box = $(`slot-box-${snap.rear}`);
  box.classList.add('hl-amber', 'anim-pulse');

  showToast(result.message, 'info');
  appendLogEntry(logger.log(`Peek Rear → ${result.ticket}`, true, snap, ''));

  setTimeout(() => {
    box.classList.remove('hl-amber', 'anim-pulse');
    isAnimating = false;
    updateButtonStates();
  }, ANIM_PULSE + 60);
}

/* ── CHECK EMPTY ── */
function doCheckEmpty() {
  if (isAnimating) return;

  const result = queue.checkEmpty();
  const snap   = queue.getSnapshot();

  showToast(result.message, result.ok ? 'info' : 'err');
  appendLogEntry(logger.log(
    `Check Empty → ${result.ok ? 'YES (empty)' : 'NO (has tickets)'}`,
    true, snap, ''
  ));
}

/* ── RESET ── */
function doReset() {
  stopDemo();         // always stop demo on reset
  isAnimating = false;

  // Strip all animation classes from every slot
  for (let i = 0; i < CAPACITY; i++) {
    const box = $(`slot-box-${i}`);
    if (box) box.className = 'slot-box';
    const t = $(`ticket-${i}`);
    if (t) t.className = 'ticket-card';
  }

  queue.reset();
  logger.clear();
  render(queue.getSnapshot());

  opHistory.innerHTML  = '<div class="log-empty-hint">Operations will appear here…</div>';
  opTableCont.innerHTML = '<div class="log-empty-hint">No operations yet — perform some operations first.</div>';

  showToast('🔄 Queue reset to initial empty state.', 'info');
}


/* ════════════════════════════════════════════════════════════
   DEMO RUNNER
   Plays DEMO_SEQUENCE automatically with configurable speed.
   ════════════════════════════════════════════════════════════ */

function runDemo() {
  if (demoRunning) { stopDemo(); return; }

  // Start fresh
  doReset();
  demoRunning = true;
  demoStep    = 0;
  updateButtonStates();
  showToast('▶ Demo started — watch the circular wrap!', 'info');

  scheduleNextDemoStep();
}

function scheduleNextDemoStep() {
  const delay = SPEED_MAP[speedSelect.value] || 1000;
  demoTimer = setTimeout(executeDemoStep, delay);
}

function executeDemoStep() {
  if (!demoRunning || demoStep >= DEMO_SEQUENCE.length) {
    stopDemo();
    showToast('✅ Demo complete!', 'ok');
    return;
  }

  const op = DEMO_SEQUENCE[demoStep++];

  // Dispatch the operation
  if (op === 'enqueue') doEnqueue();
  else                  doDequeue();

  // Wait for animation to finish, then schedule the next step
  const animDuration = (op === 'enqueue')
    ? ANIM_ENTER + 80
    : ANIM_STAMP + ANIM_EXIT + 90;

  setTimeout(scheduleNextDemoStep, animDuration);
}

function stopDemo() {
  if (demoTimer) { clearTimeout(demoTimer); demoTimer = null; }
  demoRunning = false;
  updateButtonStates();
}


/* ════════════════════════════════════════════════════════════
   EVENT LISTENERS — Buttons
   ════════════════════════════════════════════════════════════ */
btnEnqueue.addEventListener('click', doEnqueue);
btnDequeue.addEventListener('click', doDequeue);
btnFront.addEventListener('click',   doPeekFront);
btnRear.addEventListener('click',    doPeekRear);
btnEmpty.addEventListener('click',   doCheckEmpty);
btnReset.addEventListener('click',   doReset);
btnDemo.addEventListener('click',    runDemo);

// Log tab switching
document.querySelectorAll('.log-tab[data-view]').forEach(btn => {
  btn.addEventListener('click', () => switchLogTab(btn.dataset.view));
});

// Clear log button
$('btn-clear-log').addEventListener('click', () => {
  logger.clear();
  renderLogList();
  renderTable();
});


/* ════════════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
   E = Enqueue, D = Dequeue
   Ignored when a text input / select has focus.
   ════════════════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  // Don't fire if user is typing in a form element
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  switch (e.key.toLowerCase()) {
    case 'e': btnEnqueue.click(); break;
    case 'd': btnDequeue.click(); break;
  }
});


/* ════════════════════════════════════════════════════════════
   INITIALISATION
   ════════════════════════════════════════════════════════════ */
buildSlots();
render(queue.getSnapshot());
appendLogEntry(logger.log(
  `Visualizer initialized (capacity = ${CAPACITY})`,
  true,
  queue.getSnapshot(),
  'Ready'
));
