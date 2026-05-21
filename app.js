/* Mav — calming anxiety companion. Local-first, single-page. */
(() => {
  'use strict';

  // ---------- Storage ----------
  const STORAGE_KEY = 'mav.state.v1';

  const defaultState = () => ({
    checkIns: [],
    journalEntries: [],
    copingTools: [
      { id: 'breath',   name: 'Breathing',     useCount: 0, helpfulCount: 0 },
      { id: 'ground',   name: '5-4-3-2-1',     useCount: 0, helpfulCount: 0 },
      { id: 'coping',   name: 'Coping words',  useCount: 0, helpfulCount: 0 },
      { id: 'panic',    name: 'Panic flow',    useCount: 0, helpfulCount: 0 },
    ],
    comfortPlan: {
      reminders: [
        { id: uid(), text: "This feeling is temporary. It always passes." },
        { id: uid(), text: "I am safe in this moment." },
      ],
      contacts: [],
      activities: [
        { id: uid(), text: "Step outside and feel the air on my skin" },
        { id: uid(), text: "Make a warm drink, slowly" },
      ],
      emergencySteps: [
        { id: uid(), text: "Slow, long exhales — out longer than in" },
        { id: uid(), text: "Name 3 things I can see" },
        { id: uid(), text: "Reach out to someone I trust" },
      ],
    },
    triggers: [],
    routines: { morning: '', afternoon: '', evening: '' },
    preferences: { lastView: 'home' },
  });

  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      // Merge with defaults so new fields don't break older data.
      const base = defaultState();
      return {
        ...base,
        ...parsed,
        comfortPlan: { ...base.comfortPlan, ...(parsed.comfortPlan || {}) },
        routines: { ...base.routines, ...(parsed.routines || {}) },
        preferences: { ...base.preferences, ...(parsed.preferences || {}) },
        copingTools: parsed.copingTools && parsed.copingTools.length ? parsed.copingTools : base.copingTools,
      };
    } catch (err) {
      console.warn('Mav: failed to load state, starting fresh.', err);
      return defaultState();
    }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (err) { console.warn('Mav: failed to save state', err); }
  }

  let state = loadState();

  // ---------- Helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function escape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatDay(ts) {
    const d = new Date(ts);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const yest = new Date(now); yest.setDate(yest.getDate() - 1);
    if (sameDay) return 'Today, ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (d.toDateString() === yest.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function timeOfDay() {
    const h = new Date().getHours();
    if (h < 5) return 'late night';
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    if (h < 21) return 'evening';
    return 'night';
  }

  function greetingPhrase() {
    const tod = timeOfDay();
    if (tod === 'late night') return 'Soft hours.';
    if (tod === 'morning') return 'Good morning.';
    if (tod === 'afternoon') return 'Good afternoon.';
    if (tod === 'evening') return 'Good evening.';
    return 'You’re here.';
  }

  function toast(msg) {
    const root = $('#toast-root');
    const t = el(`<div class="toast">${escape(msg)}</div>`);
    root.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(6px)'; t.style.transition = 'opacity 0.3s, transform 0.3s'; }, 1700);
    setTimeout(() => t.remove(), 2100);
  }

  // ---------- Coping statements (gentle, non-judgmental) ----------
  const copingStatements = [
    "This feeling is uncomfortable, but it is not dangerous.",
    "I have felt this before, and it has always passed.",
    "I am allowed to slow down right now.",
    "My breath is here. It will carry me through this moment.",
    "I don’t need to fix anything right this second.",
    "Anxiety is my body trying to protect me. I can thank it and let it soften.",
    "I am safe enough to rest here for one more breath.",
    "Thoughts are not facts. I can notice them and let them pass.",
    "Whatever happens, I will meet it kindly.",
    "I am doing better than I think I am.",
    "This wave will rise and fall. I don’t have to push it.",
    "I can take this one small moment at a time.",
  ];

  // ---------- Journal prompts ----------
  const journalPrompts = [
    "What is my mind telling me right now?",
    "What is actually true in this moment?",
    "What would I say to a friend who felt like this?",
    "What part of me needs care today?",
    "Brain dump — just empty out the noise.",
    "What is one small thing that would help right now?",
    "What’s the worry, and what’s the fact?",
    "If this fear weren’t here, what would I want to do?",
  ];

  // ---------- Common trigger suggestions ----------
  const triggerSuggestions = [
    'Work', 'Sleep', 'Health', 'Money', 'Family', 'Conflict',
    'Future', 'Social', 'Caffeine', 'News', 'Alone', 'Crowds',
  ];

  // ---------- Router ----------
  const ROOT = $('#view-root');
  const TAB_BAR = $('#tab-bar');

  let currentView = state.preferences.lastView || 'home';
  let viewParams = {};

  function navigate(view, params = {}) {
    currentView = view;
    viewParams = params || {};
    state.preferences.lastView = ['home', 'calm', 'journal', 'more'].includes(view) ? view : state.preferences.lastView;
    saveState();
    render();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  TAB_BAR.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    const view = btn.dataset.view;
    if (view === 'panic') { openPanicFlow(); return; }
    navigate(view);
  });

  function updateTabs() {
    $$('.tab', TAB_BAR).forEach(t => t.classList.toggle('active', t.dataset.view === currentView));
  }

  // ---------- Render ----------
  function render() {
    ROOT.innerHTML = '';
    const view = currentView;
    if (view === 'home') renderHome();
    else if (view === 'calm') renderCalm();
    else if (view === 'journal') renderJournal();
    else if (view === 'journal-entry') renderJournalEntry();
    else if (view === 'patterns') renderPatterns();
    else if (view === 'comfort') renderComfortPlan();
    else if (view === 'routines') renderRoutines();
    else if (view === 'more') renderMore();
    else renderHome();
    updateTabs();
  }

  // ---------- HOME ----------
  function renderHome() {
    const lastCheckIn = state.checkIns[state.checkIns.length - 1];
    const today = new Date().toDateString();
    const checkedInToday = lastCheckIn && new Date(lastCheckIn.timestamp).toDateString() === today;

    const view = el(`
      <div>
        <div class="greeting">
          <div class="greeting-eyebrow">Mav · ${escape(greetingPhrase().replace('.', ''))}</div>
          <h1>How are <em>you</em> right now?</h1>
        </div>

        <div class="card">
          <h3>A quick check-in</h3>
          <p class="faint" style="margin-top:4px">Whatever the number, it’s welcome.</p>
          <div class="scale-row" id="scale-row">
            ${[1,2,3,4,5].map(n => `
              <button class="scale-btn" data-level="${n}" aria-label="Anxiety level ${n}">
                <span class="dot"></span>
                <span>${n}</span>
              </button>
            `).join('')}
          </div>
          <div class="scale-labels"><span>Calm</span><span>Steady</span><span>Tense</span></div>
          <div class="spacer"></div>
          <textarea class="note-input" id="checkin-note" rows="2" placeholder="A few words on what’s here… (optional)"></textarea>
          <div class="card-actions">
            <button class="btn btn-block" id="save-checkin">Save check-in</button>
          </div>
          ${checkedInToday ? `<p class="faint center" style="margin-top:14px">Last check-in · ${escape(formatDay(lastCheckIn.timestamp))} · level ${lastCheckIn.level}</p>` : ''}
        </div>

        <button class="panic-card" id="home-panic">
          <div class="panic-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.5-7-11a5 5 0 0 1 7-4.6A5 5 0 0 1 19 10c0 6.5-7 11-7 11z"/></svg>
          </div>
          <div class="panic-text">
            <strong>I need help right now</strong>
            <span>Fastest grounding flow. One tap.</span>
          </div>
        </button>

        <div class="section-title"><h3>Calm now</h3><button id="see-all-calm">All tools</button></div>
        <div class="grid-2">
          <button class="tool-card" data-tool="breath">
            <div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="9" opacity="0.4"/></svg></div>
            <div class="tool-title">60s Breathing</div>
            <div class="tool-meta">Slow inhale, longer exhale</div>
          </button>
          <button class="tool-card is-blue" data-tool="ground">
            <div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18"/></svg></div>
            <div class="tool-title">5-4-3-2-1</div>
            <div class="tool-meta">Senses grounding</div>
          </button>
          <button class="tool-card is-warm" data-tool="coping">
            <div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg></div>
            <div class="tool-title">Reassure me</div>
            <div class="tool-meta">Soft coping words</div>
          </button>
          <button class="tool-card is-sand" data-tool="journal-quick">
            <div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20l9-9-4-4-9 9-1 5z"/><path d="M14 6l4 4"/></svg></div>
            <div class="tool-title">Brain dump</div>
            <div class="tool-meta">Empty out the noise</div>
          </button>
        </div>

        <div class="section-title"><h3>Today</h3></div>
        <button class="row" id="open-routines" style="width:100%; text-align:left">
          <div class="row-main">
            <strong>Daily rhythm</strong>
            <span>${escape(routineHint())}</span>
          </div>
          <span class="row-end">›</span>
        </button>
      </div>
    `);

    // Anxiety scale
    let selectedLevel = null;
    view.querySelectorAll('.scale-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedLevel = parseInt(btn.dataset.level, 10);
        view.querySelectorAll('.scale-btn').forEach(b => b.classList.toggle('active', b === btn));
      });
    });

    view.querySelector('#save-checkin').addEventListener('click', () => {
      if (selectedLevel == null) {
        toast('Tap a number first — no rush');
        return;
      }
      const note = view.querySelector('#checkin-note').value.trim();
      state.checkIns.push({
        id: uid(),
        timestamp: Date.now(),
        level: selectedLevel,
        note,
      });
      // Heuristic trigger detection from note keywords (no penalty if absent).
      if (note) tagTriggers(note);
      saveState();
      toast('Check-in saved · you showed up');
      // If high (4-5), gently suggest a tool.
      if (selectedLevel >= 4) {
        setTimeout(() => navigate('calm'), 600);
      } else {
        setTimeout(render, 100);
      }
    });

    view.querySelector('#home-panic').addEventListener('click', openPanicFlow);
    view.querySelector('#see-all-calm').addEventListener('click', () => navigate('calm'));
    view.querySelector('#open-routines').addEventListener('click', () => navigate('routines'));
    view.querySelectorAll('[data-tool]').forEach(b => {
      b.addEventListener('click', () => launchTool(b.dataset.tool));
    });

    ROOT.appendChild(view);
  }

  function routineHint() {
    const h = new Date().getHours();
    if (h < 12) return state.routines.morning ? 'Morning intention set' : 'Set a morning intention';
    if (h < 17) return state.routines.afternoon ? 'Afternoon reset ready' : 'Plan an afternoon reset';
    return state.routines.evening ? 'Evening reflection waiting' : 'Add an evening reflection';
  }

  function tagTriggers(note) {
    const lower = note.toLowerCase();
    triggerSuggestions.forEach(t => {
      if (lower.includes(t.toLowerCase())) bumpTrigger(t);
    });
  }

  function bumpTrigger(name) {
    const existing = state.triggers.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (existing) existing.count += 1;
    else state.triggers.push({ name, count: 1 });
  }

  // ---------- Tool launcher ----------
  function launchTool(tool) {
    const t = state.copingTools.find(x => x.id === tool || x.id === toolMap(tool));
    if (t) t.useCount = (t.useCount || 0) + 1;
    saveState();
    if (tool === 'breath') openBreathing();
    else if (tool === 'ground') openGrounding();
    else if (tool === 'coping') openCopingCards();
    else if (tool === 'journal-quick') openJournalEditor({ promptIndex: 4 });
  }
  function toolMap(t) {
    return t === 'journal-quick' ? null : t;
  }

  // ---------- CALM NOW ----------
  function renderCalm() {
    const view = el(`
      <div>
        <div class="view-header">
          <h1>Calm now</h1>
          <p>A few quiet things, whenever you need them.</p>
        </div>

        <button class="panic-card" id="calm-panic" style="margin-bottom:18px">
          <div class="panic-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          </div>
          <div class="panic-text">
            <strong>Fast grounding</strong>
            <span>For when it’s a lot all at once.</span>
          </div>
        </button>

        <div class="grid-2">
          <button class="tool-card" data-tool="breath">
            <div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="9" opacity="0.4"/></svg></div>
            <div class="tool-title">60-second breath</div>
            <div class="tool-meta">Soft pacing, gentle visual</div>
          </button>
          <button class="tool-card is-blue" data-tool="ground">
            <div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18"/></svg></div>
            <div class="tool-title">5-4-3-2-1</div>
            <div class="tool-meta">Walk through the senses</div>
          </button>
          <button class="tool-card is-warm" data-tool="coping">
            <div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg></div>
            <div class="tool-title">Reassure me</div>
            <div class="tool-meta">Soft coping statements</div>
          </button>
          <button class="tool-card is-sand" data-tool="journal-quick">
            <div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20l9-9-4-4-9 9-1 5z"/></svg></div>
            <div class="tool-title">Brain dump</div>
            <div class="tool-meta">Write fast, unfiltered</div>
          </button>
        </div>

        <div class="section-title"><h3>Saved for you</h3><button id="edit-comfort">Edit</button></div>
        <div class="card card-soft">
          ${state.comfortPlan.reminders.length === 0
            ? `<p class="muted center">Save reminders that comfort you in the comfort plan.</p>`
            : state.comfortPlan.reminders.slice(0, 3).map((r, i, arr) => `
              <div style="padding:10px 0; ${i < arr.length - 1 ? 'border-bottom:1px solid var(--line);' : ''} font-size:15px; color:var(--ink); line-height:1.5">${escape(r.text)}</div>
            `).join('')}
        </div>
      </div>
    `);

    view.querySelector('#calm-panic').addEventListener('click', openPanicFlow);
    view.querySelector('#edit-comfort').addEventListener('click', () => navigate('comfort'));
    view.querySelectorAll('[data-tool]').forEach(b => {
      b.addEventListener('click', () => launchTool(b.dataset.tool));
    });

    ROOT.appendChild(view);
  }

  // ---------- Breathing ----------
  function openBreathing() {
    // 4-in, 2-hold, 6-out — gentler than 4-7-8 for beginners. Loop ~5 times = ~60s.
    const totalCycles = 5;
    let cycle = 0;
    const phases = [
      { name: 'inhale', cue: 'Breathe in', sub: 'Through the nose, slowly', dur: 4000, cls: 'inhale' },
      { name: 'hold',   cue: 'Hold',       sub: 'Soft and still',           dur: 2000, cls: 'hold' },
      { name: 'exhale', cue: 'Breathe out',sub: 'Long, gentle release',     dur: 6000, cls: 'exhale' },
      { name: 'rest',   cue: 'Rest',       sub: '—',                    dur: 1500, cls: 'rest' },
    ];

    const screen = el(`
      <div class="breath-screen">
        <button class="close-x" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6l-12 12"/></svg>
        </button>
        <div class="breath-circle"></div>
        <div class="breath-cue">Get comfortable</div>
        <div class="breath-sub">When you’re ready, the circle will move with you</div>
        <div class="breath-progress"><span style="width:0%"></span></div>
        <div class="breath-counter">Cycle 0 / ${totalCycles}</div>
      </div>
    `);
    document.body.appendChild(screen);

    const circle = $('.breath-circle', screen);
    const cueEl = $('.breath-cue', screen);
    const subEl = $('.breath-sub', screen);
    const progFill = $('.breath-progress > span', screen);
    const counterEl = $('.breath-counter', screen);

    let stopped = false;
    let phaseIdx = -1;
    const totalDur = phases.reduce((a, p) => a + p.dur, 0) * totalCycles;
    let elapsed = 0;

    function close() {
      stopped = true;
      screen.style.opacity = '0';
      screen.style.transition = 'opacity 0.3s ease';
      setTimeout(() => { screen.remove(); offerFeedback('breath'); }, 320);
    }
    $('.close-x', screen).addEventListener('click', close);

    // Begin after a short settle.
    setTimeout(nextPhase, 1400);

    function nextPhase() {
      if (stopped) return;
      phaseIdx = (phaseIdx + 1) % phases.length;
      if (phaseIdx === 0) {
        cycle += 1;
        if (cycle > totalCycles) {
          cueEl.textContent = 'Well done.';
          subEl.textContent = 'Notice how you feel now.';
          circle.className = 'breath-circle rest';
          progFill.style.width = '100%';
          counterEl.textContent = 'Complete';
          setTimeout(() => { if (!stopped) close(); }, 2400);
          return;
        }
        counterEl.textContent = `Cycle ${cycle} / ${totalCycles}`;
      }
      const p = phases[phaseIdx];
      circle.className = 'breath-circle ' + p.cls;
      cueEl.textContent = p.cue;
      subEl.textContent = p.sub;
      const before = elapsed;
      const after = elapsed + p.dur;
      // Animate progress bar smoothly during the phase.
      progFill.style.transition = `width ${p.dur}ms linear`;
      progFill.style.width = `${Math.min(100, (after / totalDur) * 100)}%`;
      elapsed = after;
      setTimeout(nextPhase, p.dur);
    }
  }

  // ---------- Grounding 5-4-3-2-1 ----------
  function openGrounding() {
    const steps = [
      { num: 5, sense: 'see',   prompt: 'Name 5 things you can see.',   hint: 'Look slowly. Notice colour, shape, light.' },
      { num: 4, sense: 'feel',  prompt: 'Notice 4 things you can feel.', hint: 'The chair. Your feet. Fabric. Air.' },
      { num: 3, sense: 'hear',  prompt: 'Listen for 3 things you can hear.', hint: 'Distant or close, just notice.' },
      { num: 2, sense: 'smell', prompt: 'Find 2 things you can smell.',  hint: 'Or two scents you remember well.' },
      { num: 1, sense: 'taste', prompt: 'Notice 1 thing you can taste.', hint: 'Your tea, the air, your last meal.' },
    ];
    let idx = 0;
    const screen = el(`
      <div class="ground-screen">
        <button class="close-x" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6l-12 12"/></svg>
        </button>
        <div class="ground-step" id="ground-step"></div>
        <div class="ground-progress" id="ground-progress">
          ${steps.map(() => `<span></span>`).join('')}
        </div>
      </div>
    `);
    document.body.appendChild(screen);

    function close() {
      screen.style.opacity = '0';
      screen.style.transition = 'opacity 0.3s ease';
      setTimeout(() => { screen.remove(); offerFeedback('ground'); }, 320);
    }
    $('.close-x', screen).addEventListener('click', close);

    function paint() {
      const step = steps[idx];
      const done = idx >= steps.length;
      const stepEl = $('#ground-step', screen);
      stepEl.classList.remove('fadeUp');
      // re-trigger fade
      void stepEl.offsetWidth;

      if (done) {
        stepEl.innerHTML = `
          <div class="ground-num">✓</div>
          <h2>You did that.</h2>
          <p>Notice your feet. You’re here.</p>
          <div class="ground-input">
            <button class="btn btn-block" id="ground-finish">I feel a little steadier</button>
            <div class="spacer"></div>
            <button class="btn btn-ghost btn-block" id="ground-again">Run it again</button>
          </div>
        `;
        $('#ground-finish', screen).addEventListener('click', close);
        $('#ground-again', screen).addEventListener('click', () => { idx = 0; paint(); });
      } else {
        stepEl.innerHTML = `
          <div class="ground-num">${step.num}</div>
          <h2>${step.prompt}</h2>
          <p>${step.hint}</p>
          <div class="ground-input">
            <textarea class="text-input" rows="2" placeholder="If it helps, type them here…"></textarea>
            <div class="spacer"></div>
            <button class="btn btn-block" id="ground-next">Done · next</button>
          </div>
        `;
        $('#ground-next', screen).addEventListener('click', () => { idx += 1; paint(); });
      }
      // progress dots
      $$('#ground-progress span', screen).forEach((dot, i) => {
        dot.classList.toggle('done', i < idx);
      });
    }
    paint();
  }

  // ---------- Coping cards ----------
  function openCopingCards() {
    let idx = Math.floor(Math.random() * copingStatements.length);
    const screen = el(`
      <div>
        <div class="back-row">
          <button id="coping-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>Calm</button>
        </div>
        <div class="view-header">
          <h1>Reassure me</h1>
          <p>Read it slowly. Try saying it aloud.</p>
        </div>
        <div class="coping-stack">
          <div class="coping-quote" id="coping-quote">${escape(copingStatements[idx])}</div>
          <div class="coping-controls">
            <button class="btn btn-ghost" id="coping-prev">← Prev</button>
            <button class="btn" id="coping-next">Another →</button>
          </div>
        </div>
        <div class="spacer-lg"></div>
        <button class="btn btn-soft btn-block" id="coping-save">Save this to my comfort plan</button>
        <div class="spacer"></div>
        <button class="btn btn-ghost btn-block" id="coping-done">I feel a little better</button>
      </div>
    `);
    ROOT.innerHTML = '';
    ROOT.appendChild(screen);

    const quote = $('#coping-quote', screen);
    function show() {
      quote.style.opacity = '0';
      setTimeout(() => {
        quote.textContent = copingStatements[idx];
        quote.style.transition = 'opacity 0.3s ease';
        quote.style.opacity = '1';
      }, 180);
    }
    quote.style.transition = 'opacity 0.3s ease';
    $('#coping-prev', screen).addEventListener('click', () => { idx = (idx - 1 + copingStatements.length) % copingStatements.length; show(); });
    $('#coping-next', screen).addEventListener('click', () => { idx = (idx + 1) % copingStatements.length; show(); });
    $('#coping-save', screen).addEventListener('click', () => {
      state.comfortPlan.reminders.push({ id: uid(), text: copingStatements[idx] });
      saveState();
      toast('Saved to comfort plan');
    });
    $('#coping-back', screen).addEventListener('click', () => navigate('calm'));
    $('#coping-done', screen).addEventListener('click', () => { offerFeedback('coping'); navigate('calm'); });
  }

  // ---------- Panic flow (fastest grounding) ----------
  function openPanicFlow() {
    // Step 1: long exhale breathing for 30s. Step 2: name 3 things. Step 3: a steady sentence.
    const screen = el(`
      <div class="breath-screen" style="background: linear-gradient(180deg, #F0DDD0 0%, #E4ECF2 100%)">
        <button class="close-x" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6l-12 12"/></svg>
        </button>
        <div class="breath-circle"></div>
        <div class="breath-cue" id="panic-cue">You’re okay.</div>
        <div class="breath-sub" id="panic-sub">I’m here. We’ll do this together.</div>
        <div class="breath-counter" id="panic-step"></div>
        <div class="spacer-lg"></div>
        <div id="panic-action" style="width:100%; max-width:340px"></div>
      </div>
    `);
    document.body.appendChild(screen);

    const circle = $('.breath-circle', screen);
    const cue = $('#panic-cue', screen);
    const sub = $('#panic-sub', screen);
    const stepEl = $('#panic-step', screen);
    const actionEl = $('#panic-action', screen);

    let stopped = false;
    function close() {
      if (stopped) return;
      stopped = true;
      screen.style.opacity = '0';
      screen.style.transition = 'opacity 0.3s ease';
      setTimeout(() => { screen.remove(); offerFeedback('panic'); }, 320);
    }
    $('.close-x', screen).addEventListener('click', close);

    // Phase 1 — guided extended exhale (4 in, 8 out) for 3 cycles.
    let cycles = 0;
    const totalCycles = 3;
    stepEl.textContent = 'Step 1 of 3 · long exhale';

    function inhale() {
      if (stopped) return;
      cue.textContent = 'Breathe in';
      sub.textContent = '4 … in slowly';
      circle.classList.remove('exhale', 'rest', 'hold');
      circle.classList.add('inhale');
      setTimeout(exhale, 4000);
    }
    function exhale() {
      if (stopped) return;
      cue.textContent = 'Breathe out';
      sub.textContent = '8 … long and gentle';
      circle.classList.remove('inhale', 'rest', 'hold');
      circle.classList.add('exhale');
      setTimeout(() => {
        cycles += 1;
        if (cycles >= totalCycles) phase2(); else inhale();
      }, 6000);
    }

    function phase2() {
      if (stopped) return;
      cue.textContent = 'Name 3 things';
      sub.textContent = 'Anywhere your eyes land. Out loud, if you can.';
      stepEl.textContent = 'Step 2 of 3 · grounding';
      actionEl.innerHTML = `
        <textarea class="text-input" rows="2" placeholder="Three things I see…"></textarea>
        <div class="spacer"></div>
        <button class="btn btn-block" id="panic-next">I’ve named them</button>
      `;
      $('#panic-next', screen).addEventListener('click', phase3);
    }

    function phase3() {
      if (stopped) return;
      stepEl.textContent = 'Step 3 of 3 · anchor';
      cue.textContent = 'Repeat with me:';
      sub.textContent = '"This will pass. I am safe enough right now."';
      actionEl.innerHTML = `
        <button class="btn btn-block" id="panic-done">I’m a little steadier</button>
        <div class="spacer"></div>
        <button class="btn btn-ghost btn-block" id="panic-call">Reach a trusted contact</button>
      `;
      $('#panic-done', screen).addEventListener('click', close);
      $('#panic-call', screen).addEventListener('click', () => {
        close();
        navigate('comfort');
        setTimeout(() => toast('Your trusted contacts are below'), 350);
      });
    }

    // start
    setTimeout(inhale, 800);
  }

  // ---------- Tool helpfulness feedback ----------
  function offerFeedback(toolId) {
    const t = state.copingTools.find(x => x.id === toolId);
    if (!t) return;
    const sheet = openSheet({
      title: 'Did that help, even a little?',
      body: `<p class="muted">No wrong answer. This just helps Mav notice what works for you.</p>`,
      footer: `
        <button class="btn btn-ghost flex-1" data-helped="0">Not really</button>
        <button class="btn flex-1" data-helped="1">A little · yes</button>
      `,
    });
    sheet.querySelectorAll('[data-helped]').forEach(b => {
      b.addEventListener('click', () => {
        if (b.dataset.helped === '1') t.helpfulCount = (t.helpfulCount || 0) + 1;
        saveState();
        closeSheet();
        if (b.dataset.helped === '1') toast('Noted · thank you');
      });
    });
  }

  // ---------- JOURNAL ----------
  function renderJournal() {
    const view = el(`
      <div>
        <div class="view-header">
          <h1>Journal</h1>
          <p>A quiet place to put what’s on your mind.</p>
        </div>
        <button class="btn btn-block" id="new-entry">+ New entry</button>
        <div class="spacer-lg"></div>
        <div id="entries"></div>
      </div>
    `);

    view.querySelector('#new-entry').addEventListener('click', () => openJournalEditor({}));

    const entries = view.querySelector('#entries');
    if (!state.journalEntries.length) {
      entries.appendChild(el(`
        <div class="empty">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h13a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>
          </div>
          <h3>Nothing here yet</h3>
          <p>When the noise gets loud, write it down. Even one sentence helps.</p>
        </div>
      `));
    } else {
      const list = el(`<div class="row-list"></div>`);
      [...state.journalEntries].reverse().forEach(entry => {
        const preview = (entry.content || '').replace(/\s+/g, ' ').slice(0, 80);
        const row = el(`
          <button class="row" style="text-align:left">
            <div class="row-main">
              <strong>${escape((entry.prompt || 'Brain dump').replace(/\?$/, ''))}</strong>
              <span>${escape(preview || '—')}</span>
            </div>
            <span class="row-end">${escape(formatDay(entry.timestamp))}</span>
          </button>
        `);
        row.addEventListener('click', () => navigate('journal-entry', { id: entry.id }));
        list.appendChild(row);
      });
      entries.appendChild(list);
    }

    ROOT.appendChild(view);
  }

  function renderJournalEntry() {
    const entry = state.journalEntries.find(e => e.id === viewParams.id);
    if (!entry) { navigate('journal'); return; }
    const view = el(`
      <div>
        <div class="back-row">
          <button id="back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>Journal</button>
        </div>
        <div class="entry-meta">${escape(formatDay(entry.timestamp))}</div>
        ${entry.prompt ? `<div class="entry-prompt">${escape(entry.prompt)}</div>` : ''}
        <textarea class="text-input" id="entry-content" rows="14">${escape(entry.content || '')}</textarea>
        <div class="card-actions">
          <button class="btn flex-1" id="save-entry">Save changes</button>
          <button class="btn btn-ghost" id="delete-entry" aria-label="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      </div>
    `);
    view.querySelector('#back').addEventListener('click', () => navigate('journal'));
    view.querySelector('#save-entry').addEventListener('click', () => {
      entry.content = view.querySelector('#entry-content').value.trim();
      saveState();
      toast('Saved');
      navigate('journal');
    });
    view.querySelector('#delete-entry').addEventListener('click', () => {
      if (confirm('Delete this entry?')) {
        state.journalEntries = state.journalEntries.filter(e => e.id !== entry.id);
        saveState();
        navigate('journal');
      }
    });
    ROOT.appendChild(view);
  }

  function openJournalEditor({ promptIndex } = {}) {
    let activePrompt = (typeof promptIndex === 'number') ? journalPrompts[promptIndex] : null;
    const sheet = openSheet({
      title: 'New entry',
      body: `
        <p class="muted">Pick a prompt, or just write what’s here.</p>
        <div class="prompt-pills" id="prompt-pills">
          ${journalPrompts.map((p, i) => `
            <button class="prompt-pill ${activePrompt === p ? 'active' : ''}" data-p="${i}">${escape(p)}</button>
          `).join('')}
        </div>
        <textarea class="text-input" id="entry-text" rows="8" placeholder="Let it out…"></textarea>
      `,
      footer: `
        <button class="btn btn-ghost flex-1" id="cancel">Close</button>
        <button class="btn flex-1" id="save">Save</button>
      `,
    });

    sheet.querySelectorAll('.prompt-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        activePrompt = journalPrompts[parseInt(btn.dataset.p, 10)];
        sheet.querySelectorAll('.prompt-pill').forEach(b => b.classList.toggle('active', b === btn));
      });
    });

    sheet.querySelector('#cancel').addEventListener('click', closeSheet);
    sheet.querySelector('#save').addEventListener('click', () => {
      const content = sheet.querySelector('#entry-text').value.trim();
      if (!content) { toast('Even one word counts — try a sentence'); return; }
      state.journalEntries.push({
        id: uid(),
        timestamp: Date.now(),
        prompt: activePrompt || '',
        content,
      });
      tagTriggers(content);
      saveState();
      closeSheet();
      toast('Saved · nice work');
      if (currentView === 'journal') render();
    });
  }

  // ---------- PATTERNS ----------
  function renderPatterns() {
    const last7 = lastNDaysCheckIns(7);
    const totalCheckIns = state.checkIns.length;
    const avg = totalCheckIns
      ? (state.checkIns.reduce((a, c) => a + c.level, 0) / totalCheckIns).toFixed(1)
      : '—';
    const streak = checkInStreak();

    const sortedTools = [...state.copingTools]
      .filter(t => t.useCount > 0)
      .sort((a, b) => (b.helpfulCount - a.helpfulCount) || (b.useCount - a.useCount));

    const sortedTriggers = [...state.triggers].sort((a, b) => b.count - a.count).slice(0, 8);

    const view = el(`
      <div>
        <div class="back-row">
          <button id="back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>More</button>
        </div>
        <div class="view-header">
          <h1>Patterns</h1>
          <p>Just observations — no scoring, no judgment.</p>
        </div>

        <div class="stat-grid">
          <div class="stat">
            <div class="stat-label">Check-ins</div>
            <div class="stat-value">${totalCheckIns}</div>
            <div class="stat-meta">all time</div>
          </div>
          <div class="stat">
            <div class="stat-label">Streak</div>
            <div class="stat-value">${streak}</div>
            <div class="stat-meta">day${streak === 1 ? '' : 's'} in a row</div>
          </div>
          <div class="stat">
            <div class="stat-label">Avg level</div>
            <div class="stat-value">${avg}</div>
            <div class="stat-meta">overall</div>
          </div>
          <div class="stat">
            <div class="stat-label">Journal</div>
            <div class="stat-value">${state.journalEntries.length}</div>
            <div class="stat-meta">entries</div>
          </div>
        </div>

        <div class="chart">
          <h3>Last 7 days</h3>
          <p class="faint" style="margin-top:4px">Average anxiety level per day. Empty days are faded.</p>
          <div class="chart-bars" id="bars">
            ${last7.map(d => {
              const lvl = d.avg;
              const cls = lvl == null ? 'empty' : (lvl >= 4 ? 'high' : lvl >= 3 ? 'med' : 'low');
              const h = lvl == null ? 6 : Math.max(8, Math.round((lvl / 5) * 110));
              return `<div class="${cls}" style="height:${h}px" title="${d.label}: ${lvl ?? '—'}"></div>`;
            }).join('')}
          </div>
          <div class="chart-x">
            ${last7.map(d => `<span>${escape(d.short)}</span>`).join('')}
          </div>
        </div>

        <div class="card">
          <h3>What helps you</h3>
          <p class="faint" style="margin-top:4px">Based on your own check-ins after each tool.</p>
          ${sortedTools.length === 0 ? `
            <div class="empty">
              <p>Try a tool from Calm Now and tell Mav whether it helped — patterns will show up here.</p>
            </div>
          ` : `
            <div class="row-list" style="margin-top:14px">
              ${sortedTools.map(t => `
                <div class="row">
                  <div class="row-main">
                    <strong>${escape(t.name)}</strong>
                    <span>${t.helpfulCount} helpful · ${t.useCount} use${t.useCount === 1 ? '' : 's'}</span>
                  </div>
                  <span class="row-end">${t.useCount > 0 ? Math.round((t.helpfulCount / t.useCount) * 100) + '%' : '—'}</span>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <div class="card">
          <h3>Common themes</h3>
          <p class="faint" style="margin-top:4px">Spotted in your notes. Tap to remove if it doesn’t fit.</p>
          ${sortedTriggers.length === 0 ? `
            <div class="empty">
              <p>Mention things in your check-ins or journal — themes will gather here over time.</p>
            </div>
          ` : `
            <div class="tag-list">
              ${sortedTriggers.map(t => `
                <button class="tag" data-trigger="${escape(t.name)}">
                  ${escape(t.name)} <span style="opacity:0.5">· ${t.count}</span>
                </button>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `);

    view.querySelector('#back').addEventListener('click', () => navigate('more'));
    view.querySelectorAll('[data-trigger]').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.trigger;
        if (confirm(`Remove "${name}" from your patterns?`)) {
          state.triggers = state.triggers.filter(t => t.name !== name);
          saveState();
          render();
        }
      });
    });

    ROOT.appendChild(view);
  }

  function lastNDaysCheckIns(n) {
    const out = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dayKey = d.toDateString();
      const items = state.checkIns.filter(c => new Date(c.timestamp).toDateString() === dayKey);
      const avg = items.length ? items.reduce((a, c) => a + c.level, 0) / items.length : null;
      out.push({
        label: d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
        short: d.toLocaleDateString([], { weekday: 'narrow' }),
        avg,
      });
    }
    return out;
  }

  function checkInStreak() {
    if (!state.checkIns.length) return 0;
    const days = new Set(state.checkIns.map(c => new Date(c.timestamp).toDateString()));
    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (days.has(cursor.toDateString())) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  // ---------- COMFORT PLAN ----------
  function renderComfortPlan() {
    const cp = state.comfortPlan;
    const view = el(`
      <div>
        <div class="back-row">
          <button id="back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>More</button>
        </div>
        <div class="view-header">
          <h1>Comfort plan</h1>
          <p>Your own toolkit, kept close.</p>
        </div>

        <div class="plan-section">
          <div class="plan-head">
            <h3>Reminders</h3>
            <button class="add-btn" data-add="reminders" aria-label="Add reminder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          </div>
          ${cp.reminders.length ? cp.reminders.map(r => itemRow('reminders', r, r.text)).join('') : `<p class="muted">Soft truths to come back to.</p>`}
        </div>

        <div class="plan-section">
          <div class="plan-head">
            <h3>Trusted contacts</h3>
            <button class="add-btn" data-add="contacts" aria-label="Add contact">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          </div>
          ${cp.contacts.length ? cp.contacts.map(c => `
            <div class="plan-item">
              <div class="item-main">
                <strong>${escape(c.name)}</strong>
                <span>${escape(c.detail || '')}</span>
              </div>
              ${c.phone ? `<a class="btn btn-soft" style="padding:8px 14px;min-height:auto" href="tel:${escape(c.phone)}">Call</a>` : ''}
              <button class="delete" data-del="contacts" data-id="${c.id}" aria-label="Remove">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6 6l12 12M18 6l-12 12"/></svg>
              </button>
            </div>
          `).join('') : `<p class="muted">People who feel safe. A name and a number is enough.</p>`}
        </div>

        <div class="plan-section">
          <div class="plan-head">
            <h3>Calming activities</h3>
            <button class="add-btn" data-add="activities" aria-label="Add activity">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          </div>
          ${cp.activities.length ? cp.activities.map(a => itemRow('activities', a, a.text)).join('') : `<p class="muted">Tiny things that work. Walking, tea, a song.</p>`}
        </div>

        <div class="plan-section">
          <div class="plan-head">
            <h3>If it gets really hard</h3>
            <button class="add-btn" data-add="emergencySteps" aria-label="Add step">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          </div>
          ${cp.emergencySteps.length ? cp.emergencySteps.map(s => itemRow('emergencySteps', s, s.text)).join('') : `<p class="muted">A few steps to take when everything feels loud.</p>`}
          <div class="spacer"></div>
          <p class="faint center">If you’re in crisis, call or text a local crisis line. In the US: 988. You don’t have to go through it alone.</p>
        </div>
      </div>
    `);

    function itemRow(section, item, text) {
      return `
        <div class="plan-item">
          <div class="item-main">
            <strong style="font-weight:400">${escape(text)}</strong>
          </div>
          <button class="delete" data-del="${section}" data-id="${item.id}" aria-label="Remove">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6 6l12 12M18 6l-12 12"/></svg>
          </button>
        </div>`;
    }

    view.querySelector('#back').addEventListener('click', () => navigate('more'));
    view.querySelectorAll('[data-add]').forEach(btn => {
      btn.addEventListener('click', () => openAddItem(btn.dataset.add));
    });
    view.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sec = btn.dataset.del;
        const id = btn.dataset.id;
        cp[sec] = cp[sec].filter(x => x.id !== id);
        saveState();
        render();
      });
    });

    ROOT.appendChild(view);
  }

  function openAddItem(section) {
    const cfg = {
      reminders:       { title: 'Add a reminder',     placeholder: 'Something to come back to…', kind: 'text' },
      activities:      { title: 'Add a calming activity', placeholder: 'A small thing that helps…', kind: 'text' },
      emergencySteps:  { title: 'Add an emergency step',  placeholder: 'A step to take when it’s loud…', kind: 'text' },
      contacts:        { title: 'Add a trusted contact',  placeholder: 'Name', kind: 'contact' },
    }[section];

    const body = cfg.kind === 'contact' ? `
      <input class="text-input" id="c-name" placeholder="Name" />
      <div class="spacer-sm"></div>
      <input class="text-input" id="c-phone" type="tel" placeholder="Phone (optional)" />
      <div class="spacer-sm"></div>
      <input class="text-input" id="c-detail" placeholder="What they’re good for, e.g. just listens" />
    ` : `
      <textarea class="text-input" id="t-content" rows="3" placeholder="${escape(cfg.placeholder)}"></textarea>
    `;

    const sheet = openSheet({
      title: cfg.title,
      body,
      footer: `
        <button class="btn btn-ghost flex-1" id="cancel">Cancel</button>
        <button class="btn flex-1" id="save">Save</button>
      `,
    });

    sheet.querySelector('#cancel').addEventListener('click', closeSheet);
    sheet.querySelector('#save').addEventListener('click', () => {
      if (cfg.kind === 'contact') {
        const name = sheet.querySelector('#c-name').value.trim();
        if (!name) { toast('Add a name'); return; }
        const phone = sheet.querySelector('#c-phone').value.trim();
        const detail = sheet.querySelector('#c-detail').value.trim();
        state.comfortPlan.contacts.push({ id: uid(), name, phone, detail });
      } else {
        const text = sheet.querySelector('#t-content').value.trim();
        if (!text) { toast('Type something kind to your future self'); return; }
        state.comfortPlan[section].push({ id: uid(), text });
      }
      saveState();
      closeSheet();
      render();
    });
  }

  // ---------- ROUTINES ----------
  function renderRoutines() {
    const r = state.routines;
    const view = el(`
      <div>
        <div class="back-row">
          <button id="back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>Back</button>
        </div>
        <div class="view-header">
          <h1>Daily rhythm</h1>
          <p>Three soft anchors. Skip any of them, any day.</p>
        </div>

        <div class="routine-card morning">
          <div class="ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>
          </div>
          <h3>Morning intention</h3>
          <p>One small thing to carry into the day.</p>
          <div class="routine-text ${r.morning ? '' : 'empty'}" id="rt-morning">${escape(r.morning) || 'Tap to set…'}</div>
          <div class="card-actions"><button class="btn btn-soft" data-edit="morning">Edit</button></div>
        </div>

        <div class="routine-card afternoon">
          <div class="ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 7v5l3 2"/></svg>
          </div>
          <h3>Afternoon reset</h3>
          <p>A pause that takes 60 seconds.</p>
          <div class="routine-text ${r.afternoon ? '' : 'empty'}" id="rt-afternoon">${escape(r.afternoon) || 'Tap to set…'}</div>
          <div class="card-actions"><button class="btn btn-soft" data-edit="afternoon">Edit</button></div>
        </div>

        <div class="routine-card evening">
          <div class="ico">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
          </div>
          <h3>Evening reflection</h3>
          <p>One thing to set down before sleep.</p>
          <div class="routine-text ${r.evening ? '' : 'empty'}" id="rt-evening">${escape(r.evening) || 'Tap to set…'}</div>
          <div class="card-actions"><button class="btn btn-soft" data-edit="evening">Edit</button></div>
        </div>
      </div>
    `);

    view.querySelector('#back').addEventListener('click', () => navigate('home'));
    view.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => editRoutine(btn.dataset.edit));
    });

    ROOT.appendChild(view);
  }

  function editRoutine(slot) {
    const labels = {
      morning:   { title: 'Morning intention',   prompts: ['One thing I want to bring with me today…', 'A word for today…', 'A kind sentence to start with…'] },
      afternoon: { title: 'Afternoon reset',     prompts: ['A 60-second reset I can do…', 'How I want to feel by evening…', 'One thing to soften…'] },
      evening:   { title: 'Evening reflection',  prompts: ['One thing to set down tonight…', 'Something I’m grateful for…', 'A note to my morning self…'] },
    }[slot];

    const sheet = openSheet({
      title: labels.title,
      body: `
        <div class="prompt-pills">
          ${labels.prompts.map((p, i) => `<button class="prompt-pill" data-p="${i}">${escape(p)}</button>`).join('')}
        </div>
        <textarea class="text-input" id="rt-text" rows="6">${escape(state.routines[slot] || '')}</textarea>
      `,
      footer: `
        <button class="btn btn-ghost flex-1" id="cancel">Cancel</button>
        <button class="btn flex-1" id="save">Save</button>
      `,
    });
    sheet.querySelectorAll('.prompt-pill').forEach((b, i) => {
      b.addEventListener('click', () => {
        const ta = sheet.querySelector('#rt-text');
        ta.value = (ta.value ? ta.value + '\n' : '') + labels.prompts[i].replace(/…$/, ' ');
        ta.focus();
      });
    });
    sheet.querySelector('#cancel').addEventListener('click', closeSheet);
    sheet.querySelector('#save').addEventListener('click', () => {
      state.routines[slot] = sheet.querySelector('#rt-text').value.trim();
      saveState();
      closeSheet();
      render();
      toast('Saved');
    });
  }

  // ---------- MORE ----------
  function renderMore() {
    const view = el(`
      <div>
        <div class="view-header">
          <h1>More</h1>
          <p>Your patterns, your plan, your rhythm.</p>
        </div>
        <div class="menu-list">
          <button class="menu-item" data-go="patterns">
            <span class="menu-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg></span>
            <span class="menu-main"><strong>Patterns</strong><span>What you’ve noticed lately</span></span>
            <span class="chev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg></span>
          </button>
          <button class="menu-item" data-go="comfort">
            <span class="menu-ico is-warm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.5-7-11a5 5 0 0 1 7-4.6A5 5 0 0 1 19 10c0 6.5-7 11-7 11z"/></svg></span>
            <span class="menu-main"><strong>Comfort plan</strong><span>Reminders, contacts, activities</span></span>
            <span class="chev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg></span>
          </button>
          <button class="menu-item" data-go="routines">
            <span class="menu-ico is-blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span>
            <span class="menu-main"><strong>Daily rhythm</strong><span>Morning, afternoon, evening</span></span>
            <span class="chev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg></span>
          </button>
        </div>

        <div class="card card-soft">
          <h3>About Mav</h3>
          <p style="margin-top:8px">Mav is a quiet companion for anxious moments. Everything you write stays on this device — nothing leaves, nothing is shared.</p>
        </div>

        <div class="card">
          <h3>Your data</h3>
          <p style="margin-top:8px">Local-first. Always.</p>
          <div class="card-actions">
            <button class="btn btn-soft" id="export">Export</button>
            <button class="btn btn-ghost" id="reset">Reset</button>
          </div>
        </div>

        <p class="faint center" style="margin-top:24px">Mav is a self-help companion, not a substitute for care.<br/>If you’re in crisis, please reach out — 988 (US) or your local crisis line.</p>
      </div>
    `);
    view.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => navigate(b.dataset.go)));
    view.querySelector('#export').addEventListener('click', exportData);
    view.querySelector('#reset').addEventListener('click', () => {
      if (confirm('Clear all of your Mav data? This cannot be undone.')) {
        localStorage.removeItem(STORAGE_KEY);
        state = loadState();
        toast('Reset · fresh start');
        navigate('home');
      }
    });
    ROOT.appendChild(view);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mav-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Downloaded a copy');
  }

  // ---------- Modal sheet ----------
  const MODAL = $('#modal-root');
  function openSheet({ title, body, footer }) {
    MODAL.innerHTML = '';
    const wrap = el(`
      <div>
        <div class="modal-backdrop"></div>
        <div class="modal-sheet" role="dialog" aria-modal="true">
          <div class="modal-handle"></div>
          <h2>${escape(title || '')}</h2>
          <div class="modal-body">${body || ''}</div>
          <div class="modal-actions">${footer || ''}</div>
        </div>
      </div>
    `);
    MODAL.appendChild(wrap);
    MODAL.classList.add('is-open');
    MODAL.setAttribute('aria-hidden', 'false');
    wrap.querySelector('.modal-backdrop').addEventListener('click', closeSheet);
    return wrap.querySelector('.modal-sheet');
  }
  function closeSheet() {
    MODAL.classList.remove('is-open');
    MODAL.setAttribute('aria-hidden', 'true');
    MODAL.innerHTML = '';
  }

  // ---------- Init ----------
  // First render.
  if (!['home', 'calm', 'journal', 'more'].includes(currentView)) currentView = 'home';
  render();

  // Expose for debugging.
  window.__mav = { state: () => state, reset: () => { localStorage.removeItem(STORAGE_KEY); location.reload(); } };
})();
