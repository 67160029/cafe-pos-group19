const branchSelect = document.querySelector('#manage-branch');
const categoriesSelect = document.querySelector('#new-category');
const rows = document.querySelector('#menu-manage-rows');
const statusNode = document.querySelector('#manage-status');
const kpis = document.querySelector('#menu-manage-kpis');
let user;
let categories = [];

function setStatus(message, type = '') { statusNode.textContent = message; statusNode.className = `status ${type}`.trim(); }
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.error || 'ทำรายการไม่สำเร็จ');
  return body;
}

async function loadBranches() {
  if (user.role === 'admin') {
    const values = await api('/api/admin/branches');
    for (const branch of values) { const option = document.createElement('option'); option.value = branch.branchId; option.textContent = `${branch.name} (#${branch.branchId})`; branchSelect.append(option); }
  } else {
    const option = document.createElement('option'); option.value = user.branchId; option.textContent = `สาขาของฉัน (#${user.branchId})`; branchSelect.append(option);
    branchSelect.disabled = true;
  }
}

async function loadMenu() {
  const branchId = Number(branchSelect.value);
  const [menu, categoryList] = await Promise.all([
    api(`/api/menu?branchId=${branchId}`), api('/api/menu/categories'),
  ]);
  categories = categoryList;
  categoriesSelect.replaceChildren();
  for (const category of categories) { const option = document.createElement('option'); option.value = category.categoryId; option.textContent = category.name; categoriesSelect.append(option); }
  rows.replaceChildren();
  for (const item of menu) {
    const tr = document.createElement('tr');
    for (const value of [item.name, categories.find(category => category.categoryId === item.categoryId)?.name || item.categoryId, `฿${Number(item.price).toFixed(2)}`, item.stockQuantity]) { const td = document.createElement('td'); td.textContent = value; tr.append(td); }
    const actions = document.createElement('td');
    const stock = document.createElement('button'); stock.type = 'button'; stock.className = 'button button-quiet button-small'; stock.textContent = 'ปรับสต็อก';
    stock.addEventListener('click', async () => { const value = window.prompt('สต็อกคงเหลือใหม่', item.stockQuantity); if (value === null) return; const stockQuantity = Number(value); try { await api(`/api/menu/${item.menuId}`, { method: 'PATCH', body: JSON.stringify({ branchId, stockQuantity }) }); await loadMenu(); setStatus('อัปเดตสต็อกแล้ว', 'success'); } catch (error) { setStatus(error.message, 'error'); } });
    const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'button button-quiet button-small'; edit.textContent = 'แก้ไข';
    edit.addEventListener('click', async () => { const name = window.prompt('ชื่อเมนู', item.name); if (name === null) return; const price = Number(window.prompt('ราคา', item.price)); if (!Number.isFinite(price)) return; try { await api(`/api/menu/${item.menuId}`, { method: 'PATCH', body: JSON.stringify({ branchId, name, price }) }); await loadMenu(); setStatus('บันทึกเมนูแล้ว', 'success'); } catch (error) { setStatus(error.message, 'error'); } });
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'button button-danger button-small'; remove.textContent = 'ลบ';
    remove.addEventListener('click', async () => { if (!window.confirm(`ยืนยันลบ ${item.name}?`)) return; try { await api(`/api/menu/${item.menuId}?branchId=${branchId}`, { method: 'DELETE' }); await loadMenu(); setStatus('ลบเมนูแล้ว', 'success'); } catch (error) { setStatus(error.message, 'error'); } });
    actions.append(stock, edit, remove); tr.append(actions); rows.append(tr);
  }
  const values = [ ['เมนูทั้งหมด', menu.length], ['พร้อมขาย', menu.filter(item => item.stockQuantity > 0).length], ['สต็อกต่ำ (<10)', menu.filter(item => item.stockQuantity > 0 && item.stockQuantity < 10).length], ['สินค้าหมด', menu.filter(item => item.stockQuantity === 0).length] ];
  kpis.replaceChildren();
  for (const [label, value] of values) { const card = document.createElement('div'); const title = document.createElement('span'); title.textContent = label; const count = document.createElement('strong'); count.textContent = value; card.append(title, count); kpis.append(card); }
}

document.querySelector('#new-menu-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button'); button.disabled = true;
  try { await api('/api/menu', { method: 'POST', body: JSON.stringify({ branchId: Number(branchSelect.value), categoryId: Number(categoriesSelect.value), name: document.querySelector('#new-name').value, price: Number(document.querySelector('#new-price').value), stockQuantity: Number(document.querySelector('#new-stock').value) }) }); form.reset(); await loadMenu(); setStatus('เพิ่มเมนูแล้ว', 'success'); }
  catch (error) { setStatus(error.message, 'error'); }
  finally { button.disabled = false; }
});
branchSelect.addEventListener('change', () => loadMenu().catch(error => setStatus(error.message, 'error')));

async function initialize() {
  const response = await fetch('/api/auth/session'); if (!response.ok) { window.location.replace('/login.html'); return; }
  user = await response.json(); if (!['manager', 'admin'].includes(user.role)) { window.location.replace('/'); return; }
  document.querySelector('#menu-logout').addEventListener('click', async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.replace('/login.html'); });
  await loadBranches(); await loadMenu();
}
initialize().catch(error => setStatus(error.message, 'error'));
