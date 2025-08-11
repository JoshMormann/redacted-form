/* Asset Intake Terminal logic */
(function () {
  const cfg = Object.assign({
    WEBHOOK_URL: null,
    AUTH_HEADER: null,
    THEME: 'green',
  }, (window.REDACTED_FORM_CONFIG || {}));

  const qs = (sel) => document.querySelector(sel);
  const output = qs('#output');
  const input = qs('#cli-input');
  const hint = qs('#hint');

  // Update header alt from config if provided
  const headerImg = document.getElementById('header-img');
  if (headerImg && cfg.HEADER_ALT) headerImg.alt = cfg.HEADER_ALT;

  // Theme support: green or amber
  function applyTheme(theme) {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    if (theme === 'amber') {
      const styles = getComputedStyle(root);
      root.style.setProperty('--term-fg', styles.getPropertyValue('--term-amber-fg'));
      root.style.setProperty('--term-dim', styles.getPropertyValue('--term-amber-dim') || '#b3752a');
      root.style.setProperty('--glow', '0 0 6px rgba(255, 183, 77, 0.6), 0 0 24px rgba(255, 183, 77, 0.25)');
    } else {
      // reset to green defaults
      root.style.removeProperty('--term-fg');
      root.style.removeProperty('--term-dim');
      root.style.removeProperty('--glow');
    }
  }
  applyTheme(cfg.THEME);

  // Theme toggle via 't'
  document.addEventListener('keydown', (e) => {
    // Require Alt/Option as a modifier to avoid toggles while typing
    if (!e.altKey) return;
    if (e.key.toLowerCase() === 't') {
      e.preventDefault();
      cfg.THEME = cfg.THEME === 'amber' ? 'green' : 'amber';
      applyTheme(cfg.THEME);
      println(`Theme switched to ${cfg.THEME}.`, 'system');
    }
  });

  // Load questions
  let flowSpec = null;
  fetch('questions.json', { cache: 'no-store' })
    .then(r => r.json())
    .then(spec => { flowSpec = spec; boot(); })
    .catch(err => {
      println('Failed to load questions.');
      println(String(err), 'error');
    });

  // State
  const answers = {}; // { id: value }
  const history = []; // stack of step indices asked
  let steps = [];
  let currentIndex = -1; // index into steps

  // Capture hidden fields from query string (fn, ln, email)
  const urlParams = new URLSearchParams(window.location.search);
  const userMeta = {
    firstName: urlParams.get('fn') || null,
    lastName: urlParams.get('ln') || null,
    email: urlParams.get('email') || null
  };

  function boot() {
    steps = computeSteps(flowSpec.flow, answers);
    println('Initializing secure link…', 'system');
    setTimeout(() => {
      println('Link established. Handler online.');
      nextStep();
    }, 500);

    input.addEventListener('keydown', onKey);
    input.focus();

    // Accessibility: respect reduced motion (just for potential future use)
  }

  function computeSteps(flow, ans) {
    return flow.filter(node => {
      if (!node.conditions || node.conditions.length === 0) return true;
      return node.conditions.some(cond => matches(cond.if, ans));
    });
  }

  function matches(cond, ans) {
    return Object.entries(cond || {}).every(([k, v]) => ans[k] === v);
  }

  function println(text, cls = 'line') {
    const div = document.createElement('div');
    div.className = cls + ' ' + (cls === 'line' ? '' : '');
    div.textContent = text;
    output.appendChild(div);
    output.scrollTop = output.scrollHeight;
  }

  let isTyping = false;
  let currentTyper = null;
  let submitted = false; // lock after submission

  // Sound manager (subtle beep)
  const Sound = (() => {
    let ctx = null;
    let enabled = !!cfg.SOUND_ENABLED;
    let unlocked = false;

    function ensure() {
      if (!enabled) return null;
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      return ctx;
    }
    function unlock() {
      if (ctx && ctx.state === 'suspended') ctx.resume();
      unlocked = true;
    }
    function beep(durationMs = 15, freq = 850, gain = 0.02) {
      const c = ensure();
      if (!c || !unlocked) return; // require user interaction first
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      g.gain.value = gain;
      o.connect(g);
      g.connect(c.destination);
      const now = c.currentTime;
      o.start(now);
      o.stop(now + durationMs / 1000);
    }
    function setEnabled(v) { enabled = v; }
    return { beep, setEnabled, unlock };
  })();
  // Unlock audio on first user interaction
  ['keydown', 'pointerdown'].forEach(evt => document.addEventListener(evt, () => Sound.unlock(), { once: true }));

  function typeLine(text, cls, done) {
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      println(text, cls);
      done && done();
      return;
    }
    isTyping = true;
    input.disabled = true;

    const line = document.createElement('div');
    line.className = cls || 'line';
    const span = document.createElement('span');
    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    line.appendChild(span);
    line.appendChild(cursor);
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;

    const chars = Array.from(text);
    let i = 0;
    let skipped = false;

    function finish() {
      cursor.remove();
      isTyping = false;
      input.disabled = false;
      done && done();
    }

    function tick() {
      if (skipped) {
        span.textContent = text;
        output.scrollTop = output.scrollHeight;
        finish();
        return;
      }
      if (i >= chars.length) {
        finish();
        return;
      }
      span.textContent += chars[i++];
      output.scrollTop = output.scrollHeight;
      Sound.beep();
      const variance = Math.floor((Math.random() * 2 - 1) * (cfg.TYPE_VARIANCE || 0));
      const delay = Math.max(0, (cfg.TYPE_SPEED || 20) + variance);
      setTimeout(tick, delay);
    }

    currentTyper = { skip: () => { skipped = true; } };
    setTimeout(tick, cfg.TYPE_PAUSE_MS || 500);
  }

  function printQuestion(node) {
    let q = node.prompt;
    if (node.type === 'boolean') {
      q = q.replace(/\[Y\/?N\]?/i, '') + ' [Y/N]';
      hint.textContent = 'Enter Y or N. Commands: back, help';
    } else if (node.type === 'textarea' || node.type === 'text') {
      const max = node.maxLength || 1000;
      hint.textContent = `Max ${max} chars. Commands: back, help`;
    } else if (node.type === 'system') {
      hint.textContent = '';
    }
    typeLine(q, 'question', () => { input.focus(); });
  }

  function onKey(e) {
    if (submitted) {
      e.preventDefault();
      return; // ignore all keys after submission
    }
    // Mute/unmute requires Alt+M to avoid interfering with typing
    if (e.altKey && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      cfg.SOUND_ENABLED = !cfg.SOUND_ENABLED;
      println(`Sound ${cfg.SOUND_ENABLED ? 'enabled' : 'muted'}.`, 'system');
      return;
    }
    if (e.key === 'Enter') {
      if (isTyping && (cfg.ALLOW_TYPE_SKIP !== false) && currentTyper) {
        // Skip typing animation
        currentTyper.skip();
        e.preventDefault();
        return;
      }
      const raw = input.value.trim();
      handleInput(raw);
      input.value = '';
    } else {
      // live count for textarea/text
      const node = steps[currentIndex];
      if (node && (node.type === 'textarea' || node.type === 'text')) {
        const max = node.maxLength || 1000;
        const len = input.value.length;
        hint.textContent = `Max ${max} chars. Remaining: ${Math.max(0, max - len)}. Commands: back, help`;
      }
    }
  }

  function handleInput(raw) {
    if (submitted) return; // guard
    const node = steps[currentIndex];

    // Global commands
    const cmd = raw.toLowerCase();
    if (cmd === 'help') {
      println('Available commands: back, help. Answer the question as prompted.');
      return;
    }
    if (cmd === 'back') {
      goBack();
      return;
    }

    if (!node) return;

    if (node.type === 'boolean') {
      if (!/^y(es)?|n(o)?$/i.test(raw)) {
        println('Please answer Y or N.', 'error');
        return;
      }
      const val = /^y/i.test(raw);
      answers[node.id] = val;
      history.push(currentIndex);
      advance();
      return;
    }

    if (node.type === 'textarea' || node.type === 'text') {
      const max = node.maxLength || 1000;
      if (raw.length === 0 && node.required) {
        println('A response is required.', 'error');
        return;
      }
      if (raw.length > max) {
        println(`Response exceeds ${max} characters.`, 'error');
        return;
      }
      answers[node.id] = raw;
      history.push(currentIndex);
      advance();
      return;
    }

    if (node.type === 'system') {
      // move on immediately
      history.push(currentIndex);
      advance();
      return;
    }

    println('Unhandled node type: ' + node.type, 'error');
  }

  function nextStep() {
    // recompute steps since answers changed and conditions may have unlocked/removed steps
    steps = computeSteps(flowSpec.flow, answers);

    // find the next step after currentIndex that has not been answered or is system end
    let next = currentIndex + 1;
    while (next < steps.length && answers.hasOwnProperty(steps[next].id) && steps[next].type !== 'system') {
      next++;
    }
    currentIndex = next;

    if (currentIndex >= steps.length) {
      // done
      submit();
      return;
    }

    const node = steps[currentIndex];
    if (node.type === 'system') {
      // Type out system message too
      typeLine(node.message, 'system', () => {
        if (node.end) {
          submit();
          return;
        }
        // otherwise continue to next
        history.push(currentIndex);
        advance();
      });
      return;
    }

    printQuestion(node);
    input.focus();
  }

  function advance() {
    // After answering, re-evaluate flow and move forward
    nextStep();
  }

  function goBack() {
    if (history.length === 0) {
      println('No previous question.', 'system');
      return;
    }
    // pop last asked index and clear its answer if any
    const lastIndex = history.pop();
    const node = steps[lastIndex];
    if (node && answers.hasOwnProperty(node.id)) {
      delete answers[node.id];
    }
    currentIndex = Math.max(-1, lastIndex - 1);
    nextStep();
  }

  function submit() {
    if (submitted) {
      println('Session already submitted. Input is locked.', 'system');
      return;
    }
    submitted = true;
    // lock UI
    input.disabled = true;
    hint.textContent = 'Session locked. Refresh to start a new session.';

    println('Transmitting…', 'system');
    const payload = {
      submissionId: cryptoRandomId(),
      timestamp: new Date().toISOString(),
      answers: Object.entries(answers).map(([id, value]) => ({ id, value })),
      meta: {
        userAgent: navigator.userAgent,
        theme: cfg.THEME,
        title: flowSpec.title || 'Form',
        user: userMeta
      }
    };

    if (!cfg.WEBHOOK_URL) {
      println('No webhook configured. Submission stored locally.', 'system');
      try {
        const key = `redacted_form_${payload.submissionId}`;
        localStorage.setItem(key, JSON.stringify(payload));
        println('Session saved locally. You may now close this window.', 'success');
      } catch (e) {
        println('Local storage failed: ' + String(e), 'error');
      }
      return;
    }

    const headers = {
      'Content-Type': 'application/json'
    };
    if (cfg.AUTH_HEADER && cfg.AUTH_HEADER.name && cfg.AUTH_HEADER.value) {
      headers[cfg.AUTH_HEADER.name] = cfg.AUTH_HEADER.value;
    }

    fetch(cfg.WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    }).then(async r => {
      if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
      println('Transmission acknowledged.', 'success');
    }).catch(err => {
      println(`Transmission failed: ${String(err)}.`, 'error');
      println(`Check WEBHOOK_URL and CORS settings on the webhook. URL: ${cfg.WEBHOOK_URL || 'unset'}`, 'system');
      try {
        const key = `redacted_form_buffer_${Date.now()}`;
        localStorage.setItem(key, JSON.stringify(payload));
        println('Buffered locally for retry.', 'system');
      } catch {}
    });
  }

  function cryptoRandomId() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    const arr = new Uint8Array(16);
    (crypto.getRandomValues || function(a){ for (let i=0;i<a.length;i++) a[i]=Math.floor(Math.random()*256); })(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }
})();

