const form = document.querySelector('#report-filter');
const branchInput = document.querySelector('#report-branch');
const fromInput = document.querySelector('#report-from');
const toInput = document.querySelector('#report-to');
const status = document.querySelector('#report-status');
const rowsElement = document.querySelector('#report-rows');
const quantityElement = document.querySelector('#total-quantity');
const salesElement = document.querySelector('#total-sales');
const money = value => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(value);

function setStatus(message, type = '') {
  status.textContent = message;
  status.className = `status ${type}`.trim();
}

async function loadReport(event) {
  event?.preventDefault();
  const branchId = branchInput.value;
  if (!branchId) {
    setStatus('กรอกรหัสสาขาเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป', 'error');
    return;
  }
  setStatus('กำลังโหลดรายงาน…');
  try {
    const params = new URLSearchParams({ branchId });
    if (fromInput.value && toInput.value) { params.set('fromDate', fromInput.value); params.set('toDate', toInput.value); }
    const response = await fetch(`/api/reports/sales?${params}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'โหลดรายงานไม่สำเร็จ');
    rowsElement.replaceChildren();
    const totalQuantity = data.reduce((sum, row) => sum + row.totalQuantity, 0);
    const totalSales = data.reduce((sum, row) => sum + row.totalSales, 0);
    quantityElement.textContent = totalQuantity.toLocaleString('th-TH');
    salesElement.textContent = money(totalSales);
    if (data.length === 0) {
      const empty = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 4;
      cell.textContent = 'ยังไม่มีรายการขายในสาขานี้';
      empty.append(cell);
      rowsElement.append(empty);
      setStatus(`รายงานสาขา ${branchId} ไม่มีรายการขาย`);
      return;
    }
    for (const item of data) {
      const row = document.createElement('tr');
      for (const value of [item.menuId, item.name, item.totalQuantity.toLocaleString('th-TH'), money(item.totalSales)]) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      }
      rowsElement.append(row);
    }
    setStatus(`รายงานยอดขายสาขา ${branchId} · ${data.length} เมนู`);
  } catch (error) {
    rowsElement.replaceChildren();
    quantityElement.textContent = '0';
    salesElement.textContent = money(0);
    setStatus(error.message || 'เชื่อมต่อระบบไม่สำเร็จ', 'error');
  }
}

form.addEventListener('submit', loadReport);

async function initializeReportPage() {
  const response = await fetch('/api/auth/session');
  if (!response.ok) {
    window.location.replace('/login.html');
    return;
  }
  const user = await response.json();
  if (!['manager', 'admin'].includes(user.role)) {
    window.location.replace('/');
    return;
  }
  if (user.role === 'admin') {
    const branchResponse = await fetch('/api/admin/branches');
    const branches = await branchResponse.json();
    if (!branchResponse.ok) throw new Error(branches.error || 'โหลดสาขาไม่สำเร็จ');
    branchInput.replaceChildren();
    for (const branch of branches) { const option = document.createElement('option'); option.value = branch.branchId; option.textContent = `${branch.name} (#${branch.branchId})`; branchInput.append(option); }
  } else {
    const option = document.createElement('option'); option.value = user.branchId; option.textContent = `สาขา ${user.branchId}`; branchInput.append(option);
    branchInput.disabled = true;
  }
  document.querySelector('#logout').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.replace('/login.html');
  });
  await loadReport();
}

function setPreset(start) {
  const today = new Date();
  const localDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const to = localDate(today);
  const fromDate = localDate(start(today));
  fromInput.value = fromDate; toInput.value = to; loadReport();
}
document.querySelector('#preset-today').addEventListener('click', () => setPreset(date => new Date(date.getFullYear(), date.getMonth(), date.getDate())));
document.querySelector('#preset-week').addEventListener('click', () => setPreset(date => new Date(date.getTime() - 6 * 86400000)));
document.querySelector('#preset-month').addEventListener('click', () => setPreset(date => new Date(date.getFullYear(), date.getMonth(), 1)));

initializeReportPage().catch(() => window.location.replace('/login.html'));
