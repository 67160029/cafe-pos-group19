const branchInput = document.querySelector('#branch-id');
const employeeInput = document.querySelector('#employee-id');
const menuGrid = document.querySelector('#menu-grid');
const categoryFilters = document.querySelector('#menu-categories');
const menuStatus = document.querySelector('#menu-status');
const orderStatus = document.querySelector('#order-status');
const cartItems = document.querySelector('#cart-items');
const orderTotal = document.querySelector('#order-total');
const itemCount = document.querySelector('#item-count');
const submitButton = document.querySelector('#submit-order');
const paymentMethod = document.querySelector('#payment-method');

let menu = [];
let categoryCatalog = [];
let selectedCategory = 'all';
let cart = new Map();
let requestVersion = 0;
const money = value => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(value);

function setMessage(element, message, type = '') {
  element.textContent = message;
  element.className = `status ${type}`.trim();
}

async function loadMenu() {
  const branchId = Number(branchInput.value);
  const version = ++requestVersion;
  if (!Number.isInteger(branchId) || branchId < 1) {
    menu = [];
    cart.clear();
    renderMenu();
    renderCart();
    setMessage(menuStatus, 'กรอกรหัสสาขาเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป', 'error');
    return;
  }
  setMessage(menuStatus, 'กำลังโหลดเมนู…');
  try {
    const [response, categoriesResponse] = await Promise.all([
      fetch(`/api/menu?branchId=${encodeURIComponent(branchId)}`),
      fetch('/api/menu/categories'),
    ]);
    const [body, categoriesBody] = await Promise.all([response.json(), categoriesResponse.json()]);
    if (version !== requestVersion) return;
    if (!response.ok) throw new Error(body.error || 'โหลดเมนูไม่สำเร็จ');
    if (!categoriesResponse.ok) throw new Error(categoriesBody.error || 'โหลดหมวดหมู่ไม่สำเร็จ');
    categoryCatalog = Array.isArray(categoriesBody) ? categoriesBody : [];
    const categoryNameById = new Map(categoryCatalog.map(category => [Number(category.categoryId), category.name]));
    menu = Array.isArray(body) ? body.map(item => ({
      ...item,
      categoryName: item.categoryName || categoryNameById.get(Number(item.categoryId)) || `หมวด ${item.categoryId}`,
    })) : [];
    const availableCategories = new Set(categoryCatalog.map(row => row.name));
    if (selectedCategory !== 'all' && !availableCategories.has(selectedCategory)) selectedCategory = 'all';
    // ป้องกันรายการในตะกร้าค้างจากสาขาก่อนหน้า และอัปเดตสต็อกล่าสุด
    for (const [id, item] of cart) {
      const latest = menu.find(row => row.menuId === id);
      if (!latest) cart.delete(id);
      else item.stockQuantity = latest.stockQuantity;
    }
    renderCategoryFilters();
    renderMenu();
    renderCart();
    setMessage(menuStatus, menu.length ? `เมนูสาขา ${branchId} · ${menu.length} รายการ` : 'ยังไม่มีเมนูในสาขานี้');
  } catch (error) {
    if (version !== requestVersion) return;
    menu = [];
    renderMenu();
    setMessage(menuStatus, error.message || 'เชื่อมต่อระบบไม่สำเร็จ ตรวจสอบว่าเซิร์ฟเวอร์ทำงานอยู่', 'error');
  }
}

function renderMenu() {
  menuGrid.replaceChildren();
  const visibleMenu = selectedCategory === 'all' ? menu : menu.filter(item => item.categoryName === selectedCategory);
  for (const item of visibleMenu) {
    const card = document.createElement('article');
    card.className = 'menu-card';
    const title = document.createElement('h3');
    title.textContent = item.name;
    const meta = document.createElement('div');
    meta.className = 'menu-meta';
    const stock = document.createElement('span');
    stock.className = Number(item.stockQuantity) > 0 ? '' : 'out-of-stock';
    stock.textContent = Number(item.stockQuantity) > 0 ? `คงเหลือ ${item.stockQuantity}` : 'สินค้าหมด';
    const category = document.createElement('span');
    category.textContent = item.categoryName || `หมวด ${item.categoryId}`;
    meta.append(stock, category);
    const price = document.createElement('div');
    price.className = 'menu-price';
    price.textContent = money(item.price);
    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'button';
    addButton.textContent = Number(item.stockQuantity) > 0 ? '＋ เพิ่มในออเดอร์' : 'สินค้าหมด';
    addButton.disabled = Number(item.stockQuantity) < 1;
    addButton.setAttribute('aria-label', `${addButton.textContent} ${item.name}`);
    addButton.addEventListener('click', () => addToCart(item));
    card.append(title, meta, price, addButton);
    menuGrid.append(card);
  }
  if (visibleMenu.length === 0 && menu.length > 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state category-empty';
    empty.textContent = 'ไม่มีเมนูในหมวดนี้';
    menuGrid.append(empty);
  }
}

function renderCategoryFilters() {
  categoryFilters.replaceChildren();
  const categories = categoryCatalog.length
    ? [...new Set(categoryCatalog.map(item => item.name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'))
    : [...new Set(menu.map(item => item.categoryName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'));
  const options = [{ value: 'all', label: 'ทั้งหมด' }, ...categories.map(name => ({ value: name, label: name }))];
  for (const option of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `category-chip${selectedCategory === option.value ? ' active' : ''}`;
    button.textContent = option.label;
    button.setAttribute('aria-pressed', selectedCategory === option.value ? 'true' : 'false');
    button.addEventListener('click', () => {
      selectedCategory = option.value;
      renderCategoryFilters();
      renderMenu();
    });
    categoryFilters.append(button);
  }
}

function addToCart(item) {
  const current = cart.get(item.menuId);
  if ((current?.quantity || 0) >= Number(item.stockQuantity)) {
    setMessage(orderStatus, 'จำนวนที่เลือกครบตามสต็อกแล้ว', 'error');
    return;
  }
  cart.set(item.menuId, { ...item, quantity: (current?.quantity || 0) + 1 });
  setMessage(orderStatus, 'เพิ่มเมนูในออเดอร์แล้ว', 'success');
  renderCart();
}

function adjustQuantity(id, delta) {
  const item = cart.get(id);
  if (!item) return;
  const quantity = item.quantity + delta;
  if (quantity < 1) cart.delete(id);
  else if (quantity <= Number(item.stockQuantity)) item.quantity = quantity;
  else setMessage(orderStatus, 'จำนวนที่เลือกเกินสต็อกคงเหลือ', 'error');
  renderCart();
}

function renderCart() {
  cartItems.replaceChildren();
  if (cart.size === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'เลือกเมนูเพื่อเริ่มออเดอร์';
    cartItems.append(empty);
  } else {
    for (const [id, item] of cart) {
      const row = document.createElement('div');
      row.className = 'cart-row';
      const info = document.createElement('div');
      const name = document.createElement('h3');
      name.textContent = item.name;
      const subtotal = document.createElement('small');
      subtotal.textContent = money(Number(item.price) * item.quantity);
      const remove = document.createElement('button');
      remove.className = 'remove-item';
      remove.type = 'button';
      remove.textContent = 'นำออก';
      remove.setAttribute('aria-label', `นำ ${item.name} ออกจากออเดอร์`);
      remove.addEventListener('click', () => {
        cart.delete(id);
        setMessage(orderStatus, 'นำเมนูออกจากออเดอร์แล้ว', 'success');
        renderCart();
      });
      info.append(name, subtotal, document.createElement('br'), remove);
      const controls = document.createElement('div');
      controls.className = 'cart-controls';
      const minus = document.createElement('button');
      minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', `ลดจำนวน ${item.name}`);
      minus.addEventListener('click', () => adjustQuantity(id, -1));
      const quantity = document.createElement('span');
      quantity.className = 'cart-qty'; quantity.textContent = item.quantity;
      const plus = document.createElement('button');
      plus.type = 'button'; plus.textContent = '+'; plus.disabled = item.quantity >= Number(item.stockQuantity);
      plus.setAttribute('aria-label', `เพิ่มจำนวน ${item.name}`);
      plus.addEventListener('click', () => adjustQuantity(id, 1));
      controls.append(minus, quantity, plus);
      row.append(info, controls);
      cartItems.append(row);
    }
  }
  const quantity = [...cart.values()].reduce((sum, item) => sum + item.quantity, 0);
  const total = [...cart.values()].reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  itemCount.textContent = `${quantity} รายการ`;
  orderTotal.textContent = money(total);
  submitButton.disabled = cart.size === 0;
}

async function submitOrder() {
  const branchId = Number(branchInput.value);
  const employeeId = Number(employeeInput.value);
  if (!Number.isInteger(branchId) || branchId < 1 || !Number.isInteger(employeeId) || employeeId < 1) {
    setMessage(orderStatus, 'กรอกรหัสสาขาและรหัสพนักงานให้ถูกต้อง', 'error');
    return;
  }
  const payload = {
    branchId,
    employeeId,
    paymentMethod: paymentMethod.value,
    items: [...cart.values()].map(item => ({ menuId: item.menuId, quantity: item.quantity }))
  };
  submitButton.disabled = true;
  setMessage(orderStatus, 'กำลังบันทึกออเดอร์…');
  try {
    const response = await fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'บันทึกออเดอร์ไม่สำเร็จ');
    cart.clear();
    renderCart();
    const lowStock = body.lowStockMenuIds?.length ? ` · มีเมนูใกล้หมด ${body.lowStockMenuIds.length} รายการ` : '';
    setMessage(orderStatus, `บันทึกออเดอร์ #${body.orderId} สำเร็จ · ${money(Number(body.totalAmount))}${lowStock}`, 'success');
    await loadMenu();
  } catch (error) {
    setMessage(orderStatus, error.message || 'เชื่อมต่อระบบไม่สำเร็จ ลองอีกครั้ง', 'error');
    submitButton.disabled = cart.size === 0;
  }
}

document.querySelector('#refresh-menu').addEventListener('click', loadMenu);
branchInput.addEventListener('change', async () => {
  cart.clear();
  setMessage(orderStatus, '');
  renderCart();
  await loadMenu();
});
submitButton.addEventListener('click', submitOrder);

async function initializePage() {
  const response = await fetch('/api/auth/session');
  if (!response.ok) {
    window.location.replace('/login.html');
    return;
  }
  const user = await response.json();
  branchInput.value = user.branchId;
  employeeInput.value = user.employeeId;
  document.querySelector('#nav-report').hidden = !['manager', 'admin'].includes(user.role);
  document.querySelector('#nav-menu').hidden = !['manager', 'admin'].includes(user.role);
  document.querySelector('#nav-kds').hidden = !['barista', 'manager', 'admin'].includes(user.role);
  document.querySelector('#nav-admin').hidden = user.role !== 'admin';
  branchInput.disabled = true;
  employeeInput.disabled = true;
  document.querySelector('#logout').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.replace('/login.html');
  });
  await loadMenu();
}

initializePage().catch(() => window.location.replace('/login.html'));
