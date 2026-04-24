/**
 * app.js — Debug Playground Frontend Logic
 *
 * Each function below triggers one intentional bug scenario.
 * Students should observe the effects in DevTools (Network, Console, Application).
 */

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Shows a formatted response inside a card's response box.
 * Uses DOM APIs (not innerHTML) to avoid XSS.
 * @param {string} elementId - The id of the response-box div.
 * @param {number} status    - HTTP status code.
 * @param {object} body      - Parsed response JSON.
 */
function showResponse(elementId, status, body) {
  const box = document.getElementById(elementId);
  const statusClass = status >= 500 ? 'status-5xx' : status >= 400 ? 'status-4xx' : 'status-200';

  box.textContent = '';

  const statusSpan = document.createElement('span');
  statusSpan.className = statusClass;
  statusSpan.textContent = `HTTP ${status}`;
  box.appendChild(statusSpan);
  box.appendChild(document.createTextNode('\n' + JSON.stringify(body, null, 2)));

  box.classList.add('visible');
}

/**
 * Shows an error message directly from a caught exception.
 * Uses textContent to avoid XSS.
 */
function showError(elementId, message) {
  const box = document.getElementById(elementId);

  box.textContent = '';

  const span = document.createElement('span');
  span.className = 'status-5xx';
  span.textContent = `Erro: ${message}`;
  box.appendChild(span);

  box.classList.add('visible');
}

/**
 * Reads a response as JSON when possible, or returns a text preview.
 * This keeps the card useful if the server returns HTML/plain text by mistake.
 */
async function readResponseBody(res) {
  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return res.json();
  }

  const text = await res.text();
  return {
    error: 'Resposta não JSON',
    content_type: contentType || 'não informado',
    body_preview: text.slice(0, 160),
  };
}

/**
 * Toggles the visibility of an answer section.
 */
function toggleAnswer(elementId) {
  const el = document.getElementById(elementId);
  el.classList.toggle('visible');
}

// ---------------------------------------------------------------------------
// Scenario 1 — 500 Internal Server Error
// POST /api/users
// ---------------------------------------------------------------------------
async function scenario500() {
  const box = document.getElementById('res-500');
  box.textContent = 'Aguardando resposta…';
  box.classList.add('visible');

  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'João da Silva', email: 'joao@empresa.com' }),
    });
    const data = await res.json();
    showResponse('res-500', res.status, data);
  } catch (err) {
    showError('res-500', err.message);
  }
}

// ---------------------------------------------------------------------------
// Scenario 2 — 422 Validation Error
// POST /api/users/validate (email intentionally left empty)
// ---------------------------------------------------------------------------
async function scenario422() {
  const box = document.getElementById('res-422');
  box.textContent = 'Enviando formulário…';
  box.classList.add('visible');

  try {
    // Bug injected: email is intentionally empty
    const res = await fetch('/api/users/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Maria Souza', email: '' }),
    });
    const data = await res.json();
    showResponse('res-422', res.status, data);
  } catch (err) {
    showError('res-422', err.message);
  }
}

// ---------------------------------------------------------------------------
// Scenario 3 — 401 Unauthorized
// GET /api/profile with an expired/fake token
// ---------------------------------------------------------------------------
async function scenario401() {
  const box = document.getElementById('res-401');
  box.textContent = 'Carregando perfil…';
  box.classList.add('visible');

  try {
    // Bug injected: token is fake/expired
    const res = await fetch('/api/profile', {
      headers: { Authorization: 'Bearer token-expirado-abc123' },
    });
    const data = await res.json();
    showResponse('res-401', res.status, data);
  } catch (err) {
    showError('res-401', err.message);
  }
}

// ---------------------------------------------------------------------------
// Scenario 4 — 403 Forbidden
// DELETE /api/admin/action
// ---------------------------------------------------------------------------
async function scenario403() {
  const box = document.getElementById('res-403');
  box.textContent = 'Executando ação administrativa…';
  box.classList.add('visible');

  try {
    const res = await fetch('/api/admin/action', { method: 'DELETE' });
    const data = await res.json();
    showResponse('res-403', res.status, data);
  } catch (err) {
    showError('res-403', err.message);
  }
}

// ---------------------------------------------------------------------------
// Scenario 5 — JavaScript TypeError (no network request)
// Bug: accessing property of undefined
// ---------------------------------------------------------------------------
function scenarioJSError() {
  const box = document.getElementById('res-js');

  try {
    // Bug injected: `usuario` is undefined — accessing `.nome` throws TypeError
    const usuario = undefined;

    // The next line will throw: TypeError: Cannot read properties of undefined
    console.log('Tentando acessar usuário:', usuario.nome);

    box.textContent = 'Dados carregados!';
    box.classList.add('visible');
  } catch (err) {
    // The error is intentionally re-thrown to the console so students can see it
    console.error(err);

    box.textContent = '';
    const span = document.createElement('span');
    span.className = 'status-5xx';
    span.textContent =
      'TypeError capturado!\nVeja o Console do DevTools para o stack trace completo.\n\n' +
      err.message;
    box.appendChild(span);
    box.classList.add('visible');
  }
}

// ---------------------------------------------------------------------------
// Scenario 6 — Slow Request (~8 seconds)
// GET /api/slow
// ---------------------------------------------------------------------------
async function scenarioSlow() {
  const btn = document.getElementById('btn-slow');
  const box = document.getElementById('res-slow');

  btn.textContent = '';
  const spinner = document.createElement('span');
  spinner.className = 'spinner';
  btn.appendChild(spinner);
  btn.appendChild(document.createTextNode('Aguardando resposta… (~8s)'));
  btn.disabled = true;
  box.textContent = '⏳ Aguardando o servidor responder… observe a coluna "Time" na aba Network.';
  box.classList.add('visible');

  try {
    const start = Date.now();
    const res = await fetch('/api/slow');
    const data = await res.json();
    const elapsed = Date.now() - start;

    data._tempo_real_ms = elapsed;
    showResponse('res-slow', res.status, data);
  } catch (err) {
    showError('res-slow', err.message);
  } finally {
    btn.textContent = '▶ Reproduzir';
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Scenario 7 — Cookie / Session Issue
// Sets an invalid cookie, then checks session with the backend
// ---------------------------------------------------------------------------
async function scenarioCookie() {
  const box = document.getElementById('res-cookie');

  // Bug injected: write an invalid session cookie value
  document.cookie = 'session=token-invalido-xyz; path=/';

  box.textContent = 'Verificando sessão… (cookie inválido foi definido)';
  box.classList.add('visible');

  try {
    const res = await fetch('/api/session-check');
    const data = await res.json();
    showResponse('res-cookie', res.status, data);
  } catch (err) {
    showError('res-cookie', err.message);
  }
}

// ---------------------------------------------------------------------------
// Scenario 8 — localStorage Corruption
// Saves invalid JSON-like data into localStorage
// ---------------------------------------------------------------------------
function scenarioLocalStorage() {
  const box = document.getElementById('res-ls');

  // Bug injected: save invalid/corrupt preferences
  const corruptPrefs = { theme: 'undefined', lang: null, fontSize: NaN };
  localStorage.setItem('userPrefs', JSON.stringify(corruptPrefs));

  // Simulate the app trying to read and use those preferences
  try {
    const raw = localStorage.getItem('userPrefs');
    const prefs = JSON.parse(raw);

    // Bug: theme is the string "undefined" — app tries to apply it
    if (prefs.theme === 'undefined') {
      console.warn(
        '[Debug Playground] userPrefs.theme é a string "undefined" — dado inválido no localStorage!'
      );
    }

    box.textContent = '';
    const span = document.createElement('span');
    span.className = 'status-warn';
    span.textContent =
      '⚠ localStorage corrompido!\n\n' +
      'Chave: userPrefs\nValor salvo:\n' +
      JSON.stringify(prefs, null, 2) +
      '\n\nAbra Application → Local Storage para ver e limpar o dado.';
    box.appendChild(span);
    box.classList.add('visible');
  } catch (err) {
    showError('res-ls', err.message);
  }
}

// ---------------------------------------------------------------------------
// Scenario 9 — Console Warning (non-breaking)
// GET /api/config — app works but emits a warning about deprecated_flag
// ---------------------------------------------------------------------------
async function scenarioWarning() {
  const box = document.getElementById('res-warn');
  box.textContent = 'Carregando configurações…';
  box.classList.add('visible');

  try {
    const res = await fetch('/api/config');
    const data = await res.json();

    // Bug injected: backend signals a deprecated feature flag
    if (data.deprecated_flag) {
      console.warn(
        '[Debug Playground] A flag "deprecated_flag" está ativa. ' +
        'Este recurso será removido na próxima versão. ' +
        'Avise a equipe de desenvolvimento.'
      );
    }

    // App still works fine — just logs the warning
    console.info('[Debug Playground] Configurações carregadas com sucesso:', data);

    box.textContent = '';
    const span = document.createElement('span');
    span.className = 'status-warn';
    span.textContent =
      '⚠ Warning emitido no Console (app ainda funciona)!\n\n' +
      'Abra a aba Console e filtre por "Warnings" para ver a mensagem em amarelo.\n\n' +
      'Resposta da API:\n' + JSON.stringify(data, null, 2);
    box.appendChild(span);
    box.classList.add('visible');
  } catch (err) {
    showError('res-warn', err.message);
  }
}

// ---------------------------------------------------------------------------
// Scenario 10 — 404 Not Found
// GET /api/legacy-users — route does not exist anymore
// ---------------------------------------------------------------------------
async function scenario404() {
  const box = document.getElementById('res-404');
  box.textContent = 'Chamando endpoint antigo…';
  box.classList.add('visible');

  try {
    const res = await fetch('/api/legacy-users');
    const data = await readResponseBody(res);
    showResponse('res-404', res.status, data);
  } catch (err) {
    showError('res-404', err.message);
  }
}

// ---------------------------------------------------------------------------
// Scenario 11 — 429 Too Many Requests
// POST /api/login-attempt repeatedly until rate limit blocks the request
// ---------------------------------------------------------------------------
async function scenario429() {
  const box = document.getElementById('res-429');
  const btn = document.getElementById('btn-429');

  btn.disabled = true;
  box.textContent = 'Enviando várias tentativas rapidamente…';
  box.classList.add('visible');

  try {
    let lastStatus = 0;
    let lastData = {};

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const res = await fetch('/api/login-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'aluno@empresa.com', attempt }),
      });

      lastStatus = res.status;
      lastData = await readResponseBody(res);

      if (res.status === 429) {
        lastData._tentativa_bloqueada = attempt;
        break;
      }
    }

    showResponse('res-429', lastStatus, lastData);
  } catch (err) {
    showError('res-429', err.message);
  } finally {
    btn.disabled = false;
  }
}
