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
    if (theme === 'amber') {
      root.style.setProperty('--term-fg', getComputedStyle(root).getPropertyValue('--term-amber-fg'));
      root.style.setProperty('--term-dim', '#b98a4a');
      root.style.setProperty('--glow', '0 0 6px rgba(255, 191, 102, 0.6), 0 0 24px rgba(255, 191, 102, 0.2)');
    }
  }
  applyTheme(cfg.THEME);

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
    println('Transmitting…', 'system');
    const payload = {
      submissionId: cryptoRandomId(),
      timestamp: new Date().toISOString(),
      answers: Object.entries(answers).map(([id, value]) => ({ id, value })),
      meta: {
        userAgent: navigator.userAgent,
        theme: cfg.THEME,
        title: flowSpec.title || 'Form'
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
    }).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      println('Transmission acknowledged.', 'success');
    }).catch(err => {
      println('Transmission failed. Buffered locally for retry.', 'error');
      try {
        const key = `redacted_form_buffer_${Date.now()}`;
        localStorage.setItem(key, JSON.stringify(payload));
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

