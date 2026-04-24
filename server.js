/**
 * server.js — Debug Playground Backend
 *
 * Each route intentionally returns a specific error or delay
 * so students can practice identifying issues in DevTools.
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Parse JSON request bodies
app.use(express.json());

// Serve static frontend files from /public
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Scenario 1 — 500 Internal Server Error
// POST /api/users
// Simulates a server crash when trying to save a new user.
// ---------------------------------------------------------------------------
app.post('/api/users', (req, res) => {
  // Bug injected: server always crashes here
  res.status(500).json({
    error: 'Erro interno ao salvar cliente',
    detail: 'Database connection lost',
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Scenario 2 — 422 Unprocessable Entity (Validation Error)
// POST /api/users/validate
// Simulates missing required field (email).
// ---------------------------------------------------------------------------
app.post('/api/users/validate', (req, res) => {
  const { name, email } = req.body;

  // Bug injected: email is intentionally left empty on the frontend
  if (!email || email.trim() === '') {
    return res.status(422).json({
      error: 'Email is required',
      field: 'email',
      message: 'O campo e-mail não pode estar vazio',
    });
  }

  res.status(201).json({ message: 'Usuário criado com sucesso', name, email });
});

// ---------------------------------------------------------------------------
// Scenario 3 — 401 Unauthorized
// GET /api/profile
// Simulates an expired authentication token.
// ---------------------------------------------------------------------------
app.get('/api/profile', (req, res) => {
  const authHeader = req.headers['authorization'];

  // Bug injected: token is always treated as expired/invalid
  if (!authHeader || authHeader !== 'Bearer valid-token-xyz') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Sessão expirada. Faça login novamente.',
    });
  }

  res.json({ name: 'Maria Silva', email: 'maria@empresa.com', role: 'user' });
});

// ---------------------------------------------------------------------------
// Scenario 4 — 403 Forbidden
// DELETE /api/admin/action
// Simulates a user without permission trying to perform an admin action.
// ---------------------------------------------------------------------------
app.delete('/api/admin/action', (req, res) => {
  // Bug injected: endpoint always returns 403 (user never has permission)
  res.status(403).json({
    error: 'Forbidden',
    message: 'Você não tem permissão para realizar esta ação.',
  });
});

// ---------------------------------------------------------------------------
// Scenario 6 — Slow Request / Timeout
// GET /api/slow
// Simulates a slow database query or overloaded server (8 second delay).
// ---------------------------------------------------------------------------
app.get('/api/slow', (req, res) => {
  // Bug injected: response is intentionally delayed by 8 seconds
  setTimeout(() => {
    res.json({
      message: 'Resposta demorada',
      data: [1, 2, 3, 4, 5],
      duration_ms: 8000,
    });
  }, 8000);
});

// ---------------------------------------------------------------------------
// Scenario 7 — Session / Cookie Issue
// GET /api/session-check
// Returns the current cookie state so the frontend can show "logged out".
// ---------------------------------------------------------------------------
app.get('/api/session-check', (req, res) => {
  const sessionCookie = req.headers['cookie'];

  if (!sessionCookie || !sessionCookie.includes('session=valid')) {
    return res.status(401).json({
      authenticated: false,
      message: 'Sessão inválida ou ausente. Verifique a aba Application > Cookies.',
    });
  }

  res.json({ authenticated: true, user: 'joao@empresa.com' });
});

// ---------------------------------------------------------------------------
// Scenario 9 — Console Warning (non-breaking)
// GET /api/config
// Returns a successful response, but the frontend will emit a console.warn.
// ---------------------------------------------------------------------------
app.get('/api/config', (req, res) => {
  res.json({
    theme: 'light',
    version: '1.0.0',
    deprecated_flag: true, // frontend will warn about this
  });
});

// ---------------------------------------------------------------------------
// Catch-all: serve the SPA index for any unknown routes
// ---------------------------------------------------------------------------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Debug Playground rodando em http://localhost:${PORT}`);
  console.log('   Pressione Ctrl+C para parar o servidor.\n');
});
