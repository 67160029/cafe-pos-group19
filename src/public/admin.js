const statusNode = document.querySelector('#admin-status');
const staffRows = document.querySelector('#staff-rows');
const branchRows = document.querySelector('#branch-rows');
const branchSelect = document.querySelector('#staff-branch');
let branches = [];

function setStatus(message, type = '') {
  statusNode.textContent = message;
  statusNode.className = `status ${type}`.trim();
}

function cell(row, value) {
  const node = document.createElement('td');
  node.textContent = value ?? '';
  row.append(node);
  return node;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.error || 'ทำรายการไม่สำเร็จ');
  return body;
}

async function loadBranches() {
  branches = await api('/api/admin/branches');
  branchSelect.replaceChildren();
  for (const branch of branches) {
    const option = document.createElement('option');
    option.value = branch.branchId;
    option.textContent = `${branch.name} (#${branch.branchId})`;
    branchSelect.append(option);
  }
  branchRows.replaceChildren();
  for (const branch of branches) {
    const row = document.createElement('tr');
    cell(row, branch.branchId); cell(row, branch.name); cell(row, branch.address || '—');
    cell(row, branch.employeeCount); cell(row, branch.menuCount);
    const actions = document.createElement('td');
    const edit = document.createElement('button');
    edit.className = 'button button-quiet button-small'; edit.type = 'button'; edit.textContent = 'แก้ไข';
    edit.addEventListener('click', async () => {
      const name = window.prompt('ชื่อสาขา', branch.name);
      if (name === null) return;
      const address = window.prompt('ที่อยู่สาขา', branch.address || '');
      if (address === null) return;
      try { await api(`/api/admin/branches/${branch.branchId}`, { method: 'PATCH', body: JSON.stringify({ name, address }) }); await refresh(); setStatus('บันทึกข้อมูลสาขาแล้ว', 'success'); }
      catch (error) { setStatus(error.message, 'error'); }
    });
    actions.append(edit); row.append(actions); branchRows.append(row);
  }
}

async function loadStaff() {
  const staff = await api('/api/admin/staff');
  staffRows.replaceChildren();
  for (const person of staff) {
    const row = document.createElement('tr');
    cell(row, person.employeeId); cell(row, person.name); cell(row, person.role);
    cell(row, `${person.branchName} (#${person.branchId})`); cell(row, person.loginReady ? 'พร้อม' : 'ยังไม่ตั้งรหัส');
    const actions = document.createElement('td');
    const edit = document.createElement('button');
    edit.className = 'button button-quiet button-small'; edit.type = 'button'; edit.textContent = 'แก้ไข';
    edit.addEventListener('click', async () => {
      const name = window.prompt('ชื่อพนักงาน', person.name);
      if (name === null) return;
      const role = window.prompt('บทบาท: cashier หรือ barista', String(person.role).toLowerCase());
      if (role === null) return;
      const branchText = window.prompt('รหัสสาขา', String(person.branchId));
      if (branchText === null) return;
      try { await api(`/api/admin/staff/${person.employeeId}`, { method: 'PATCH', body: JSON.stringify({ name, role, branchId: Number(branchText) }) }); await refresh(); setStatus('บันทึกข้อมูลพนักงานแล้ว ต้องเข้าสู่ระบบใหม่', 'success'); }
      catch (error) { setStatus(error.message, 'error'); }
    });
    const remove = document.createElement('button');
    remove.className = 'button button-danger button-small'; remove.type = 'button'; remove.textContent = 'ลบ';
    remove.addEventListener('click', async () => {
      if (!window.confirm(`ยืนยันลบพนักงาน ${person.name}?`)) return;
      try { await api(`/api/admin/staff/${person.employeeId}`, { method: 'DELETE' }); await refresh(); setStatus('ลบพนักงานแล้ว', 'success'); }
      catch (error) { setStatus(error.message, 'error'); }
    });
    if (['cashier', 'barista'].includes(String(person.role).toLowerCase())) actions.append(edit, remove);
    else actions.textContent = 'จำกัดการจัดการ role นี้';
    row.append(actions); staffRows.append(row);
  }
}

async function refresh() { await loadBranches(); await loadStaff(); }

document.querySelector('#staff-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const result = await api('/api/admin/staff', { method: 'POST', body: JSON.stringify({
      name: document.querySelector('#staff-name').value,
      branchId: Number(branchSelect.value), role: document.querySelector('#staff-role').value,
      password: document.querySelector('#staff-password').value,
    }) });
    form.reset();
    await refresh();
    setStatus(`เพิ่มพนักงานแล้ว Employee ID: ${result.employeeId}`, 'success');
  } catch (error) { setStatus(error.message, 'error'); }
  finally { button.disabled = false; }
});

document.querySelector('#branch-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]'); button.disabled = true;
  try {
    const result = await api('/api/admin/branches', { method: 'POST', body: JSON.stringify({
      name: document.querySelector('#branch-name').value, address: document.querySelector('#branch-address').value,
    }) });
    form.reset(); await refresh(); setStatus(`เพิ่มสาขาแล้ว ID: ${result.branchId}`, 'success');
  } catch (error) { setStatus(error.message, 'error'); }
  finally { button.disabled = false; }
});

async function initialize() {
  const session = await fetch('/api/auth/session');
  if (!session.ok) { window.location.replace('/login.html'); return; }
  const user = await session.json();
  if (user.role !== 'admin') { window.location.replace('/'); return; }
  document.querySelector('#admin-logout').addEventListener('click', async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.replace('/login.html'); });
  await refresh();
}

initialize().catch(error => setStatus(error.message || 'โหลดข้อมูลไม่สำเร็จ', 'error'));
