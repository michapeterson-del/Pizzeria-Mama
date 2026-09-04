const fs = require('fs');
const path = require('path');

// DATA_DIR zeigt bei Render auf eine dauerhafte Festplatte (Persistent Disk),
// damit Bestellungen einen Server-Neustart überstehen. Lokal/ohne DATA_DIR
// wird einfach der data/-Ordner im Projekt verwendet.
const DATA_DIR = process.env.DATA_DIR || __dirname;
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

function load() {
  if (!fs.existsSync(ORDERS_FILE)) {
    return { nextOrderNumber: 1001, orders: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  } catch {
    return { nextOrderNumber: 1001, orders: [] };
  }
}

function save(data) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function randomCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function createOrder({ items, customerName, phone, note, wishTime }) {
  const data = load();
  const total = items.reduce((sum, it) => sum + it.price * it.qty, 0);
  const order = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    orderNumber: data.nextOrderNumber,
    code: randomCode(),
    items,
    total: Math.round(total * 100) / 100,
    customerName,
    phone,
    note: note || '',
    wishTime: wishTime || '',
    status: 'neu',
    pickupTime: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  data.nextOrderNumber += 1;
  data.orders.push(order);
  save(data);
  return order;
}

function getAllOrders() {
  return load().orders.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function findOrder(orderNumber, code) {
  const data = load();
  return data.orders.find(
    (o) => String(o.orderNumber) === String(orderNumber) && o.code === code
  );
}

function findById(id) {
  const data = load();
  return data.orders.find((o) => o.id === id);
}

function updateOrder(id, patch) {
  const data = load();
  const idx = data.orders.findIndex((o) => o.id === id);
  if (idx === -1) return null;
  data.orders[idx] = { ...data.orders[idx], ...patch, updatedAt: new Date().toISOString() };
  save(data);
  return data.orders[idx];
}

module.exports = { createOrder, getAllOrders, findOrder, findById, updateOrder };
