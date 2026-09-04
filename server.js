require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const store = require('./data/store');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'pizzeria2024';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-.env';
const AUTH_COOKIE = 'admin_auth';
const AUTH_MAX_AGE = 1000 * 60 * 60 * 24 * 30; // 30 Tage

const menu = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'menu.json'), 'utf8'));
const menuByName = new Map();
const sauceOptionsByName = new Map();
menu.forEach((cat) =>
  cat.items.forEach((it) => {
    menuByName.set(it.name, it.price);
    if (it.sauceOptions) sauceOptionsByName.set(it.name, it.sauceOptions);
  })
);

app.use(express.json());

// Anmeldung als signiertes Cookie statt Server-Sitzung: übersteht Neustarts
// des Servers (z. B. bei jedem Deploy oder wenn der Free-Plan aus Inaktivität
// aufwacht), ohne dass Admins ständig neu ausgeloggt werden.
function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
}

function createAuthToken() {
  const value = `admin.${Date.now() + AUTH_MAX_AGE}`;
  return `${value}.${sign(value)}`;
}

function verifyAuthToken(token) {
  if (!token) return false;
  const lastDot = token.lastIndexOf('.');
  if (lastDot === -1) return false;
  const value = token.slice(0, lastDot);
  const signature = token.slice(lastDot + 1);
  const expected = sign(value);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }
  const [role, expiresStr] = value.split('.');
  return role === 'admin' && Date.now() <= parseInt(expiresStr, 10);
}

function parseCookies(req) {
  const cookies = {};
  const header = req.headers.cookie;
  if (!header) return cookies;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    cookies[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return cookies;
}

// ---------- Public API ----------

app.get('/api/menu', (req, res) => {
  res.json(menu);
});

app.post('/api/orders', (req, res) => {
  const { items, customerName, phone, note, wishTime } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Der Warenkorb ist leer.' });
  }
  if (!customerName || !customerName.trim()) {
    return res.status(400).json({ error: 'Bitte gib deinen Namen an.' });
  }
  if (!phone || !phone.trim()) {
    return res.status(400).json({ error: 'Bitte gib eine Telefonnummer an.' });
  }

  // Validate items against the real menu and trust only server-side prices.
  const cleanItems = [];
  for (const raw of items) {
    const price = menuByName.get(raw.name);
    const qty = Math.max(1, Math.min(20, parseInt(raw.qty, 10) || 1));
    if (price === undefined) {
      return res.status(400).json({ error: `Unbekannter Artikel: ${raw.name}` });
    }
    const sauce = (raw.sauce || '').trim().slice(0, 40);
    const allowedSauces = sauceOptionsByName.get(raw.name);
    if (sauce && (!allowedSauces || !allowedSauces.includes(sauce))) {
      return res.status(400).json({ error: `Ungültige Soße für ${raw.name}` });
    }
    cleanItems.push({ name: raw.name, price, qty, note: (raw.note || '').trim().slice(0, 120), sauce });
  }

  const order = store.createOrder({
    items: cleanItems,
    customerName: customerName.trim().slice(0, 100),
    phone: phone.trim().slice(0, 40),
    note: (note || '').trim().slice(0, 300),
    wishTime: (wishTime || '').trim().slice(0, 20)
  });

  res.json({
    orderNumber: order.orderNumber,
    code: order.code,
    total: order.total
  });
});

app.get('/api/orders/lookup', (req, res) => {
  const { orderNumber, code } = req.query;
  if (!orderNumber || !code) {
    return res.status(400).json({ error: 'Bestellnummer und Code erforderlich.' });
  }
  const order = store.findOrder(orderNumber, code);
  if (!order) {
    return res.status(404).json({ error: 'Bestellung nicht gefunden.' });
  }
  res.json(order);
});

app.post('/api/orders/cancel', (req, res) => {
  const { orderNumber, code } = req.body || {};
  if (!orderNumber || !code) {
    return res.status(400).json({ error: 'Bestellnummer und Code erforderlich.' });
  }
  const order = store.findOrder(orderNumber, code);
  if (!order) {
    return res.status(404).json({ error: 'Bestellung nicht gefunden.' });
  }
  if (order.status !== 'neu' && order.status !== 'bestaetigt') {
    return res.status(400).json({
      error: 'Diese Bestellung kann nicht mehr storniert werden. Bitte ruf uns an.'
    });
  }
  const updated = store.updateOrder(order.id, { status: 'storniert' });
  res.json(updated);
});

// ---------- Admin auth ----------

function requireAuth(req, res, next) {
  const cookies = parseCookies(req);
  if (verifyAuthToken(cookies[AUTH_COOKIE])) return next();
  res.status(401).json({ error: 'Nicht angemeldet.' });
}

app.post('/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (password && password === ADMIN_PASSWORD) {
    res.cookie(AUTH_COOKIE, createAuthToken(), {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: AUTH_MAX_AGE
    });
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Falsches Passwort.' });
});

app.post('/admin/logout', (req, res) => {
  res.clearCookie(AUTH_COOKIE);
  res.json({ ok: true });
});

app.get('/admin/api/session', (req, res) => {
  const cookies = parseCookies(req);
  res.json({ isAdmin: verifyAuthToken(cookies[AUTH_COOKIE]) });
});

// ---------- Admin API ----------

app.get('/admin/api/orders', requireAuth, (req, res) => {
  res.json(store.getAllOrders());
});

app.post('/admin/api/orders/:id/confirm', requireAuth, (req, res) => {
  const { pickupTime } = req.body || {};
  // Leere Abholzeit ist erlaubt -> Kunde sieht "So schnell wie möglich".
  const order = store.updateOrder(req.params.id, {
    status: 'bestaetigt',
    pickupTime: (pickupTime || '').trim()
  });
  if (!order) return res.status(404).json({ error: 'Bestellung nicht gefunden.' });
  res.json(order);
});

app.post('/admin/api/orders/:id/status', requireAuth, (req, res) => {
  const { status } = req.body || {};
  const allowed = ['neu', 'bestaetigt', 'fertig', 'abgeholt', 'storniert'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Ungültiger Status.' });
  }
  const order = store.updateOrder(req.params.id, { status });
  if (!order) return res.status(404).json({ error: 'Bestellung nicht gefunden.' });
  res.json(order);
});

// ---------- Static files ----------

app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Pizzeria Mama Bestellsystem läuft auf http://localhost:${PORT}`);
  if (ADMIN_PASSWORD === 'pizzeria2024') {
    console.log('WARNUNG: Bitte ADMIN_PASSWORD in .env setzen, bevor die Seite online geht!');
  }
});
