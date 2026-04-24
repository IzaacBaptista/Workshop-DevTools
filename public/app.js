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
 * Toggles the visibility of an answer section and marks the related card
 * as completed so the student can track progress across the workshop.
 */
function toggleAnswer(elementId) {
  const el = document.getElementById(elementId);
  el.classList.toggle('visible');

  // Mark the owning card as completed (only once).
  const card = el.closest('.card');
  if (card && card.dataset.cardId) {
    markCompleted(card.dataset.cardId);
  }
}

// ---------------------------------------------------------------------------
// Progress tracking (persisted in localStorage)
// ---------------------------------------------------------------------------

const PROGRESS_STORAGE_KEY = 'debugPlaygroundCompleted';
const TOTAL_CARDS = 11;

function loadCompletedSet() {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (_err) {
    return new Set();
  }
}

function saveCompletedSet(set) {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify([...set]));
  } catch (_err) {
    // Ignore quota / privacy mode errors — progress is best-effort.
  }
}

function refreshProgressUI(set) {
  const text = document.getElementById('progress-text');
  const fill = document.getElementById('progress-fill');
  if (!text || !fill) return;

  const count = set.size;
  text.textContent = `${count} de ${TOTAL_CARDS} cenários explorados`;
  const pct = Math.min(100, (count / TOTAL_CARDS) * 100);
  fill.style.width = `${pct}%`;
}

function markCompleted(cardId) {
  const set = loadCompletedSet();
  const isNew = !set.has(cardId);
  set.add(cardId);
  saveCompletedSet(set);

  const card = document.querySelector(`.card[data-card-id="${CSS.escape(cardId)}"]`);
  if (card) card.classList.add('completed');

  refreshProgressUI(set);
  return isNew;
}

function restoreProgress() {
  const set = loadCompletedSet();
  set.forEach((cardId) => {
    const card = document.querySelector(`.card[data-card-id="${CSS.escape(cardId)}"]`);
    if (card) card.classList.add('completed');
  });
  refreshProgressUI(set);
}

// ---------------------------------------------------------------------------
// Toast helper
// ---------------------------------------------------------------------------

function showToast(message, duration = 4500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ---------------------------------------------------------------------------
// Modal system — reusable, framework-free
// ---------------------------------------------------------------------------

/**
 * State for the currently open modal. Kept module-private so only one modal
 * can be open at a time (matches the workshop's one-scenario-at-a-time flow).
 */
let activeModal = null;

/**
 * Opens a modal with the given configuration.
 *
 * @param {object} config
 * @param {string} config.title                       Modal title.
 * @param {string} [config.tip]                       Optional DevTools hint (also shown as a toast).
 * @param {(body: HTMLElement) => void} config.buildBody  Populates the modal body with DOM nodes.
 * @param {string} [config.confirmText]               Primary button label.
 * @param {string} [config.cancelText]                Secondary button label. Pass null to hide it.
 * @param {string} [config.confirmClass]              Extra CSS class for the primary button.
 * @param {(body: HTMLElement, modal: object) => (void|Promise<{keepOpen?: boolean}|void>)} config.onConfirm
 *        Called when the user confirms. Return `{ keepOpen: true }` to keep the modal open.
 * @param {() => void} [config.onClose]               Called after the modal closes (for any reason).
 */
function openModal(config) {
  // If a modal is already open, close it first so state stays clean.
  if (activeModal) closeModal();

  const overlay = document.getElementById('modal-overlay');
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');
  const footerEl = document.getElementById('modal-footer');
  const tipEl = document.getElementById('modal-tip');
  const closeBtn = overlay.querySelector('.modal-close');

  // Reset contents from any previous use.
  titleEl.textContent = config.title || '';
  bodyEl.textContent = '';
  footerEl.textContent = '';
  tipEl.textContent = '';
  tipEl.hidden = true;

  if (config.tip) {
    tipEl.textContent = config.tip;
    tipEl.hidden = false;
    // Also surface as a toast so the hint stays visible if the modal is full.
    showToast(config.tip);
  }

  // Body
  if (typeof config.buildBody === 'function') {
    config.buildBody(bodyEl);
  }

  // Footer buttons
  if (config.cancelText !== null) {
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = config.cancelText || 'Cancelar';
    cancelBtn.addEventListener('click', () => closeModal());
    footerEl.appendChild(cancelBtn);
  }

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = `btn ${config.confirmClass || 'btn-primary'}`;
  confirmBtn.textContent = config.confirmText || 'Confirmar';
  footerEl.appendChild(confirmBtn);

  const state = {
    overlay,
    bodyEl,
    confirmBtn,
    onClose: config.onClose,
  };

  confirmBtn.addEventListener('click', async () => {
    if (typeof config.onConfirm !== 'function') {
      closeModal();
      return;
    }
    confirmBtn.disabled = true;
    try {
      const result = await config.onConfirm(bodyEl, state);
      if (!result || !result.keepOpen) {
        closeModal();
      }
    } finally {
      confirmBtn.disabled = false;
    }
  });

  // Close handlers
  const onOverlayClick = (e) => {
    if (e.target === overlay) closeModal();
  };
  const onKeyDown = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  overlay.addEventListener('click', onOverlayClick);
  document.addEventListener('keydown', onKeyDown);
  closeBtn.onclick = () => closeModal();

  state.cleanup = () => {
    overlay.removeEventListener('click', onOverlayClick);
    document.removeEventListener('keydown', onKeyDown);
    closeBtn.onclick = null;
  };

  overlay.hidden = false;
  overlay.setAttribute('aria-hidden', 'false');
  activeModal = state;

  // Focus the first interactive element inside the modal for accessibility.
  const focusable = bodyEl.querySelector('input, select, textarea, button') || confirmBtn;
  if (focusable) focusable.focus();
}

function closeModal() {
  if (!activeModal) return;
  const { overlay, cleanup, onClose } = activeModal;
  overlay.hidden = true;
  overlay.setAttribute('aria-hidden', 'true');
  if (typeof cleanup === 'function') cleanup();
  activeModal = null;
  if (typeof onClose === 'function') onClose();
}

// Small DOM helpers to keep scenarios concise and XSS-safe.
function createField({ label, type = 'text', name, value = '', placeholder = '', hint = '' }) {
  const wrap = document.createElement('div');
  wrap.className = 'form-field';

  const lbl = document.createElement('label');
  lbl.textContent = label;
  lbl.htmlFor = `field-${name}`;
  wrap.appendChild(lbl);

  const input = document.createElement('input');
  input.type = type;
  input.id = `field-${name}`;
  input.name = name;
  input.value = value;
  if (placeholder) input.placeholder = placeholder;
  wrap.appendChild(input);

  if (hint) {
    const h = document.createElement('p');
    h.className = 'form-hint';
    h.textContent = hint;
    wrap.appendChild(h);
  }
  return wrap;
}

function createSelect({ label, name, options, value, hint = '' }) {
  const wrap = document.createElement('div');
  wrap.className = 'form-field';

  const lbl = document.createElement('label');
  lbl.textContent = label;
  lbl.htmlFor = `field-${name}`;
  wrap.appendChild(lbl);

  const select = document.createElement('select');
  select.id = `field-${name}`;
  select.name = name;
  options.forEach((opt) => {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    if (opt.value === value) o.selected = true;
    select.appendChild(o);
  });
  wrap.appendChild(select);

  if (hint) {
    const h = document.createElement('p');
    h.className = 'form-hint';
    h.textContent = hint;
    wrap.appendChild(h);
  }
  return wrap;
}

function getFieldValue(bodyEl, name) {
  const el = bodyEl.querySelector(`[name="${name}"]`);
  return el ? el.value : '';
}

// ---------------------------------------------------------------------------
// Scenario 1 — 500 Internal Server Error
// POST /api/users — full "register user" form; server always crashes.
// ---------------------------------------------------------------------------
function scenario500() {
  openModal({
    title: 'Cadastrar novo cliente',
    tip: '💡 Abra a aba Network antes de clicar em "Salvar cadastro".',
    confirmText: 'Salvar cadastro',
    confirmClass: 'btn-danger',
    buildBody: (body) => {
      const intro = document.createElement('p');
      intro.textContent = 'Preencha os dados do cliente e salve.';
      body.appendChild(intro);

      body.appendChild(createField({
        label: 'Nome completo', name: 'name', value: 'João da Silva',
      }));
      body.appendChild(createField({
        label: 'E-mail', name: 'email', type: 'email', value: 'joao@empresa.com',
      }));
      body.appendChild(createField({
        label: 'Telefone', name: 'phone', value: '(11) 99999-0000',
      }));
    },
    onConfirm: async (body) => {
      const payload = {
        name: getFieldValue(body, 'name'),
        email: getFieldValue(body, 'email'),
        phone: getFieldValue(body, 'phone'),
      };

      const box = document.getElementById('res-500');
      box.textContent = 'Aguardando resposta…';
      box.classList.add('visible');

      try {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        showResponse('res-500', res.status, data);
      } catch (err) {
        showError('res-500', err.message);
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Scenario 2 — 422 Validation Error
// POST /api/users/validate — no frontend validation; blank email triggers 422.
// ---------------------------------------------------------------------------
function scenario422() {
  openModal({
    title: 'Cadastro simples',
    tip: '💡 Dica: deixe o campo "E-mail" em branco e confirme para ver o 422.',
    confirmText: 'Cadastrar',
    confirmClass: 'btn-warning',
    buildBody: (body) => {
      const intro = document.createElement('p');
      intro.textContent = 'Este formulário NÃO valida os campos no frontend — o backend é quem rejeita.';
      body.appendChild(intro);

      body.appendChild(createField({
        label: 'Nome', name: 'name', value: 'Maria Souza',
      }));
      body.appendChild(createField({
        label: 'E-mail', name: 'email', type: 'email', value: '',
        placeholder: 'deixe em branco para reproduzir o erro',
      }));
    },
    onConfirm: async (body) => {
      const payload = {
        name: getFieldValue(body, 'name'),
        email: getFieldValue(body, 'email'),
      };

      const box = document.getElementById('res-422');
      box.textContent = 'Enviando formulário…';
      box.classList.add('visible');

      try {
        // Bug injected: NO frontend validation — payload is sent as-is.
        const res = await fetch('/api/users/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        showResponse('res-422', res.status, data);
      } catch (err) {
        showError('res-422', err.message);
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Scenario 3 — 401 Unauthorized
// GET /api/profile with a visible, intentionally expired token.
// ---------------------------------------------------------------------------
function scenario401() {
  openModal({
    title: 'Meu perfil',
    tip: '💡 Abra Network → Headers para ver o Authorization que será enviado.',
    confirmText: 'Carregar meu perfil',
    confirmClass: 'btn-danger',
    buildBody: (body) => {
      const intro = document.createElement('p');
      intro.textContent = 'O app usará este token para autenticar sua requisição:';
      body.appendChild(intro);

      body.appendChild(createField({
        label: 'Token (Authorization header)',
        name: 'token',
        value: '******',
        hint: 'Este token está propositalmente inválido / expirado.',
      }));
      // Make the token read-only so students can't "fix" the bug by editing.
      const tokenInput = body.querySelector('[name="token"]');
      if (tokenInput) tokenInput.readOnly = true;
    },
    onConfirm: async (body) => {
      const token = getFieldValue(body, 'token');
      const box = document.getElementById('res-401');
      box.textContent = 'Carregando perfil…';
      box.classList.add('visible');

      try {
        const res = await fetch('/api/profile', {
          headers: { Authorization: token },
        });
        const data = await res.json();
        showResponse('res-401', res.status, data);
      } catch (err) {
        showError('res-401', err.message);
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Scenario 4 — 403 Forbidden
// DELETE /api/admin/action — always 403, regardless of selected role.
// ---------------------------------------------------------------------------
function scenario403() {
  openModal({
    title: 'Painel administrativo',
    tip: '💡 Observe: o status é 403 (sem permissão), não 401 (não autenticado).',
    confirmText: 'Excluir registro',
    confirmClass: 'btn-danger',
    buildBody: (body) => {
      const intro = document.createElement('p');
      intro.textContent = 'Escolha o perfil com o qual você quer executar a ação.';
      body.appendChild(intro);

      body.appendChild(createSelect({
        label: 'Perfil do usuário',
        name: 'role',
        value: 'user',
        options: [
          { value: 'user',    label: 'Usuário comum' },
          { value: 'manager', label: 'Gerente' },
          { value: 'admin',   label: 'Administrador' },
        ],
        hint: 'Independentemente do perfil escolhido, o backend negará a ação.',
      }));
    },
    onConfirm: async (body) => {
      const role = getFieldValue(body, 'role');
      const box = document.getElementById('res-403');
      box.textContent = `Executando ação administrativa como "${role}"…`;
      box.classList.add('visible');

      try {
        const res = await fetch('/api/admin/action', {
          method: 'DELETE',
          headers: { 'X-User-Role': role },
        });
        const data = await res.json();
        showResponse('res-403', res.status, data);
      } catch (err) {
        showError('res-403', err.message);
      }
    },
  });
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
// Interactive panel: student picks the cookie value, then checks the session.
// ---------------------------------------------------------------------------
function scenarioCookie() {
  // Helper to summarise the current state of the `session` cookie.
  function readSessionCookie() {
    const match = document.cookie.split('; ').find((c) => c.startsWith('session='));
    return match ? match.substring('session='.length) : '(ausente)';
  }

  openModal({
    title: 'Gerenciador de sessão',
    tip: '💡 Abra Application → Cookies para acompanhar as mudanças.',
    confirmText: 'Verificar sessão',
    cancelText: 'Fechar',
    confirmClass: 'btn-warning',
    buildBody: (body) => {
      const intro = document.createElement('p');
      intro.textContent = 'Manipule o cookie `session` e, em seguida, verifique a sessão no servidor.';
      body.appendChild(intro);

      // Current cookie state
      const state = document.createElement('div');
      state.className = 'modal-note';
      state.textContent = `session=${readSessionCookie()}`;
      body.appendChild(state);

      // Action buttons that mutate document.cookie
      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '0.5rem';
      actions.style.flexWrap = 'wrap';
      actions.style.marginTop = '0.8rem';

      const makeActionBtn = (label, className, onClick) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `btn ${className}`;
        btn.textContent = label;
        btn.addEventListener('click', () => {
          onClick();
          state.textContent = `session=${readSessionCookie()}`;
        });
        return btn;
      };

      actions.appendChild(makeActionBtn('Definir cookie inválido', 'btn-danger', () => {
        // Bug injected: write an invalid session cookie value.
        document.cookie = 'session=token-invalido-xyz; path=/';
      }));
      actions.appendChild(makeActionBtn('Definir cookie válido', 'btn-secondary', () => {
        document.cookie = 'session=valid; path=/';
      }));
      actions.appendChild(makeActionBtn('Apagar cookie', 'btn-secondary', () => {
        document.cookie = 'session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      }));

      body.appendChild(actions);
    },
    onConfirm: async () => {
      const box = document.getElementById('res-cookie');
      box.textContent = 'Verificando sessão no servidor…';
      box.classList.add('visible');

      try {
        const res = await fetch('/api/session-check');
        const data = await res.json();
        showResponse('res-cookie', res.status, data);
      } catch (err) {
        showError('res-cookie', err.message);
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Scenario 8 — localStorage Corruption
// Fake preferences editor with obviously-wrong defaults.
// ---------------------------------------------------------------------------
function scenarioLocalStorage() {
  openModal({
    title: 'Preferências do usuário',
    tip: '💡 Abra Application → Local Storage para inspecionar o dado salvo.',
    confirmText: 'Salvar preferências',
    confirmClass: 'btn-warning',
    buildBody: (body) => {
      const intro = document.createElement('p');
      intro.textContent = 'Confira os valores atuais e salve-os no localStorage.';
      body.appendChild(intro);

      body.appendChild(createField({
        label: 'Tema', name: 'theme', value: 'undefined',
        hint: 'Dica: este valor é a string "undefined" — é o bug!',
      }));
      body.appendChild(createField({
        label: 'Idioma', name: 'lang', value: 'null',
        hint: 'A string "null" será convertida em null ao salvar.',
      }));
      body.appendChild(createField({
        label: 'Tamanho da fonte', name: 'fontSize', value: 'NaN',
        hint: '"NaN" não é um número válido.',
      }));
    },
    onConfirm: (body) => {
      // Mimic what the real app would do: read inputs, build an object, save.
      const theme = getFieldValue(body, 'theme');
      const langRaw = getFieldValue(body, 'lang');
      const fontRaw = getFieldValue(body, 'fontSize');

      const corruptPrefs = {
        theme,                                   // string "undefined" by default
        lang: langRaw === 'null' ? null : langRaw,
        fontSize: Number(fontRaw),               // "NaN" → NaN
      };
      localStorage.setItem('userPrefs', JSON.stringify(corruptPrefs));

      const box = document.getElementById('res-ls');
      try {
        const raw = localStorage.getItem('userPrefs');
        const prefs = JSON.parse(raw);

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
    },
  });
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
// Modal login screen — every click makes a single POST; a visible counter
// shows how many attempts remain before the rate limit blocks the student.
// ---------------------------------------------------------------------------
function scenario429() {
  // Backend rate limit for /api/login-attempt is 3 requests per 60s.
  const MAX_ATTEMPTS = 3;
  let attempts = 0;
  let blocked = false;

  openModal({
    title: 'Entrar no sistema',
    tip: '💡 Clique em "Entrar" várias vezes rapidamente para acionar o 429.',
    confirmText: 'Entrar',
    cancelText: 'Fechar',
    confirmClass: 'btn-danger',
    buildBody: (body) => {
      body.appendChild(createField({
        label: 'E-mail', name: 'email', type: 'email', value: 'aluno@empresa.com',
      }));
      body.appendChild(createField({
        label: 'Senha', name: 'password', type: 'password', value: 'senha-incorreta',
      }));

      // Attempts counter + progress bar
      const counter = document.createElement('div');
      counter.className = 'attempts-counter';

      const label = document.createElement('span');
      label.id = 'attempts-label';
      label.textContent = `Tentativa 0 de ${MAX_ATTEMPTS} antes do bloqueio`;
      counter.appendChild(label);

      const bar = document.createElement('div');
      bar.className = 'attempts-bar';
      const fill = document.createElement('div');
      fill.className = 'attempts-fill';
      fill.id = 'attempts-fill';
      bar.appendChild(fill);
      counter.appendChild(bar);

      body.appendChild(counter);
    },
    onConfirm: async (body, state) => {
      if (blocked) {
        // Once blocked, keep showing the block state — no more requests.
        return { keepOpen: true };
      }
      attempts += 1;

      const res = await fetch('/api/login-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: getFieldValue(body, 'email'),
          password: getFieldValue(body, 'password'),
          attempt: attempts,
        }),
      });
      const data = await readResponseBody(res);

      const label = body.querySelector('#attempts-label');
      const fill = body.querySelector('#attempts-fill');
      const pct = Math.min(100, (attempts / MAX_ATTEMPTS) * 100);
      if (fill) fill.style.width = `${pct}%`;

      if (res.status === 429) {
        blocked = true;
        if (label) label.textContent = `🚫 Bloqueado após ${attempts} tentativa(s)`;
        if (fill) fill.classList.add('blocked');
        data._tentativa_bloqueada = attempts;
        state.confirmBtn.disabled = true;
      } else if (label) {
        label.textContent = `Tentativa ${attempts} de ${MAX_ATTEMPTS} antes do bloqueio`;
      }

      showResponse('res-429', res.status, data);
      return { keepOpen: true };
    },
  });
}

// ---------------------------------------------------------------------------
// Initialisation — restore progress once the DOM is ready.
// ---------------------------------------------------------------------------
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', restoreProgress);
} else {
  restoreProgress();
}
