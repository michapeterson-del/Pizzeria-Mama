const state = {
  menu: [],
  cart: new Map(), // cartKey(name, sauce, note) -> { name, price, qty, note, sauce }
  itemModal: { item: null, qty: 1, sauce: '', note: '' }
};

function cartKey(name, sauce, note) {
  return `${name}__${sauce || ''}__${note || ''}`;
}

function addToCart(item, sauce, qty, note) {
  const key = cartKey(item.name, sauce, note);
  const existing = state.cart.get(key);
  if (existing) {
    existing.qty += qty;
  } else {
    state.cart.set(key, { name: item.name, price: item.price, qty, note: note || '', sauce: sauce || '' });
  }
}

const CATEGORY_ICONS = {
  'Vorspeisen': '🧆',
  'Salate': '🥗',
  'Pizza Klassiker (Ø 20/26 cm)': '🍕',
  'Pizza Spezialitäten (Ø 25/30 cm)': '🍕',
  'Türkische Pizza': '🫓',
  'Drehspießfleisch': '🥙',
  'Drehspießfleisch-Teller': '🍽️',
  'Drehspieß überbacken & Kartoffelauflauf': '🧀',
  'Imbiss Gerichte': '🍟'
};

function money(n) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function escapeAttr(s) {
  return s.replace(/"/g, '&quot;');
}

async function loadMenu() {
  const res = await fetch('/api/menu');
  state.menu = await res.json();
  renderPopular();
  renderMenu();
}

function renderPopular() {
  const popularItems = [];
  state.menu.forEach((cat) => {
    cat.items.forEach((item) => {
      item._category = cat.category;
      if (item.popular) popularItems.push(item);
    });
  });

  const existing = document.getElementById('popularSection');
  if (existing) existing.remove();
  if (popularItems.length === 0) return;

  const section = document.createElement('section');
  section.className = 'popular-section';
  section.id = 'popularSection';
  section.innerHTML = `
    <h2>⭐ Beliebte Gerichte</h2>
    <p class="sub">Das bestellen unsere Kunden am liebsten</p>
    <div class="popular-scroll"></div>
  `;
  const scroll = section.querySelector('.popular-scroll');

  popularItems.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'popular-card';
    const imgTag = item.img
      ? `<img class="thumb" src="/img/${escapeAttr(item.img)}" alt="${escapeAttr(item.name)}" onerror="this.remove()">`
      : '';
    card.innerHTML = `
      <div class="thumb-wrap">
        ${imgTag}
        <div class="thumb-fallback">${CATEGORY_ICONS[item._category] || '🍴'}</div>
        <span class="badge">Beliebt</span>
      </div>
      <div class="body">
        <div class="pname">${item.name}</div>
        <div class="pprice">${money(item.price)}</div>
        <button class="btn-add-mini">Zum Warenkorb hinzufügen</button>
      </div>
    `;
    if (item.img) {
      const img = card.querySelector('.thumb');
      const fallback = card.querySelector('.thumb-fallback');
      img.addEventListener('load', () => fallback.remove());
      img.addEventListener('error', () => img.remove());
    }
    card.querySelector('.btn-add-mini').onclick = () => openItemModal(item);
    scroll.appendChild(card);
  });

  document.getElementById('menu').before(section);
}

function renderMenu() {
  const main = document.getElementById('menu');
  main.innerHTML = '';
  state.menu.forEach((cat) => {
    const section = document.createElement('section');
    section.className = 'category';
    const h2 = document.createElement('h2');
    h2.innerHTML = `<span class="cat-icon">${CATEGORY_ICONS[cat.category] || '🍴'}</span> ${cat.category}`;
    section.appendChild(h2);

    cat.items.forEach((item) => {
      item._category = cat.category;
      const row = document.createElement('div');
      row.className = 'item';
      row.innerHTML = `
        <div>
          <div class="name">${item.name}</div>
          <span class="price">${money(item.price)}</span>
        </div>
        <div class="controls"></div>
      `;
      row.querySelector('.controls').innerHTML = `<button class="btn-add-full">Zum Warenkorb hinzufügen</button>`;
      row.querySelector('.btn-add-full').onclick = () => openItemModal(item);
      section.appendChild(row);
    });

    main.appendChild(section);
  });
}

// ---------- Artikel-Bottom-Sheet (Menge, Soße, Notiz) ----------

function openItemModal(item) {
  state.itemModal = {
    item,
    qty: 1,
    sauce: item.sauceOptions ? item.sauceOptions[0] : '',
    note: ''
  };
  renderItemModal();
  document.getElementById('itemModal').classList.remove('hidden');
}

function closeItemModal() {
  document.getElementById('itemModal').classList.add('hidden');
}

function renderItemModal() {
  const { item, qty, sauce, note } = state.itemModal;
  document.getElementById('itemModalName').textContent = item.name;
  document.getElementById('itemModalPrice').textContent = money(item.price);
  document.getElementById('itemModalQty').textContent = qty;
  document.getElementById('itemModalNote').value = note;

  const sauceWrap = document.getElementById('itemModalSauceWrap');
  const sauceGroup = document.getElementById('itemModalSauces');
  if (item.sauceOptions) {
    sauceWrap.classList.remove('hidden');
    sauceGroup.innerHTML = item.sauceOptions
      .map(
        (s) =>
          `<button type="button" class="sauce-chip${s === sauce ? ' selected' : ''}" data-sauce="${escapeAttr(s)}">${s}</button>`
      )
      .join('');
    sauceGroup.querySelectorAll('.sauce-chip').forEach((chip) => {
      chip.onclick = () => {
        state.itemModal.sauce = chip.dataset.sauce;
        renderItemModal();
      };
    });
  } else {
    sauceWrap.classList.add('hidden');
    sauceGroup.innerHTML = '';
  }
}

document.getElementById('itemModalPlus').onclick = () => {
  state.itemModal.qty += 1;
  renderItemModal();
};
document.getElementById('itemModalMinus').onclick = () => {
  if (state.itemModal.qty > 1) state.itemModal.qty -= 1;
  renderItemModal();
};
document.getElementById('itemModalNote').oninput = (e) => {
  state.itemModal.note = e.target.value;
};
document.getElementById('itemModalCancel').onclick = closeItemModal;
document.getElementById('itemModal').onclick = (e) => {
  if (e.target.id === 'itemModal') closeItemModal();
};
document.getElementById('itemModalConfirm').onclick = () => {
  const { item, qty, sauce, note } = state.itemModal;
  addToCart(item, sauce, qty, note.trim());
  updateCartBar();
  closeItemModal();
};

function cartTotal() {
  let total = 0;
  state.cart.forEach((it) => (total += it.price * it.qty));
  return total;
}

function cartCount() {
  let count = 0;
  state.cart.forEach((it) => (count += it.qty));
  return count;
}

function updateCartBar() {
  const bar = document.getElementById('cartBar');
  const count = cartCount();
  if (count === 0) {
    bar.classList.add('hidden');
  } else {
    bar.classList.remove('hidden');
    document.getElementById('cartCount').textContent = count;
    document.getElementById('cartTotal').textContent = money(cartTotal());
  }
  renderCartLines();
}

function renderCartLines() {
  const container = document.getElementById('cartLines');
  container.innerHTML = '';
  if (state.cart.size === 0) {
    container.innerHTML = '<p style="color:#888">Dein Warenkorb ist leer.</p>';
  }
  state.cart.forEach((it, key) => {
    const line = document.createElement('div');
    line.className = 'cart-line-block';
    const sauceTag = it.sauce ? ` <span class="sauce-tag">🥫 ${it.sauce}</span>` : '';
    line.innerHTML = `
      <div class="cart-line">
        <span class="name">${it.qty} × ${it.name}${sauceTag}</span>
        <span class="line-total">${money(it.price * it.qty)}</span>
        <button class="remove" aria-label="Entfernen">×</button>
      </div>
      <input type="text" class="line-note" maxlength="120" placeholder="Notiz zu diesem Artikel, z. B. ohne Zwiebeln" value="${escapeAttr(it.note || '')}">
    `;
    line.querySelector('.remove').onclick = () => {
      state.cart.delete(key);
      updateCartBar();
    };
    line.querySelector('.line-note').oninput = (e) => {
      it.note = e.target.value;
    };
    container.appendChild(line);
  });
  document.getElementById('modalTotal').textContent = money(cartTotal());
}

function openCart() {
  document.getElementById('cartModal').classList.remove('hidden');
}
function closeCart() {
  document.getElementById('cartModal').classList.add('hidden');
}

function showError(msg) {
  const box = document.getElementById('errorBox');
  box.textContent = msg;
  box.classList.add('show');
}
function hideError() {
  document.getElementById('errorBox').classList.remove('show');
}

async function submitOrder(e) {
  e.preventDefault();
  hideError();

  if (state.cart.size === 0) {
    showError('Dein Warenkorb ist leer.');
    return;
  }

  const customerName = document.getElementById('customerName').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const wishTime = document.getElementById('wishTime').value;
  const note = document.getElementById('note').value.trim();

  const items = Array.from(state.cart.values()).map((it) => ({
    name: it.name,
    qty: it.qty,
    note: (it.note || '').trim(),
    sauce: it.sauce || ''
  }));

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = 'Wird gesendet …';

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, customerName, phone, wishTime, note })
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.error || 'Etwas ist schiefgelaufen.');
      btn.disabled = false;
      btn.textContent = 'Verbindlich bestellen';
      return;
    }

    localStorage.setItem(
      'lastOrder',
      JSON.stringify({ orderNumber: data.orderNumber, code: data.code })
    );
    window.location.href = `status.html?nr=${data.orderNumber}&code=${data.code}`;
  } catch (err) {
    showError('Verbindung fehlgeschlagen. Bitte versuche es erneut.');
    btn.disabled = false;
    btn.textContent = 'Verbindlich bestellen';
  }
}

document.getElementById('openCartBtn').onclick = openCart;
document.getElementById('closeCartBtn').onclick = closeCart;
document.getElementById('checkoutForm').onsubmit = submitOrder;

loadMenu();
