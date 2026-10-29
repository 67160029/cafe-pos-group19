const queueGrid = document.querySelector('#queue-grid');
const queueStatus = document.querySelector('#queue-status');
let loading = false;
const nextStage = { pending: ['preparing', 'เริ่มชง'], preparing: ['ready', 'พร้อมเสิร์ฟ'], ready: ['completed', 'เสร็จแล้ว'] };
const thaiStatus = { pending: 'รอชง', preparing: 'กำลังชง', ready: 'พร้อมเสิร์ฟ' };

function setStatus(message, type = '') { queueStatus.textContent = message; queueStatus.className = `status ${type}`.trim(); }

async function loadQueue() {
  if (loading) return;
  loading = true;
  try {
    const response = await fetch('/api/orders/queue');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'โหลดคิวไม่สำเร็จ');
    queueGrid.replaceChildren();
    for (const order of data) {
      const card = document.createElement('article'); card.className = 'queue-card';
      const header = document.createElement('div'); header.className = 'queue-card-heading';
      const title = document.createElement('h2'); title.textContent = `ออเดอร์ #${order.orderId}`;
      const badge = document.createElement('span'); badge.className = `queue-badge status-${order.status}`; badge.textContent = thaiStatus[order.status] || order.status;
      header.append(title, badge);
      const time = document.createElement('p'); time.className = 'eyebrow'; time.textContent = new Date(order.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      const list = document.createElement('ul'); list.className = 'queue-items';
      for (const item of order.items) { const row = document.createElement('li'); row.textContent = `${item.name} × ${item.quantity}`; list.append(row); }
      const button = document.createElement('button'); button.className = 'button button-primary'; button.type = 'button';
      button.textContent = nextStage[order.status]?.[1] || ''; button.disabled = !nextStage[order.status];
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          const update = await fetch(`/api/orders/${order.orderId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStage[order.status][0] }) });
          const result = await update.json(); if (!update.ok) throw new Error(result.error || 'อัปเดตสถานะไม่สำเร็จ');
          setStatus(`อัปเดตออเดอร์ #${order.orderId} แล้ว`, 'success'); await loadQueue();
        } catch (error) { setStatus(error.message, 'error'); button.disabled = false; }
      });
      card.append(header, time, list, button); queueGrid.append(card);
    }
    setStatus(data.length ? `มี ${data.length} ออเดอร์ในคิว` : 'ไม่มีออเดอร์ที่กำลังเตรียม');
  } catch (error) { setStatus(error.message || 'โหลดคิวไม่สำเร็จ', 'error'); }
  finally { loading = false; }
}

document.querySelector('#queue-refresh').addEventListener('click', loadQueue);

async function initialize() {
  const response = await fetch('/api/auth/session');
  if (!response.ok) { window.location.replace('/login.html'); return; }
  const user = await response.json();
  if (!['barista', 'manager', 'admin'].includes(user.role)) { window.location.replace('/'); return; }
  document.querySelector('#barista-branch').textContent = `สาขา ${user.branchId}`;
  document.querySelector('#barista-logout').addEventListener('click', async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.replace('/login.html'); });
  await loadQueue();
  window.setInterval(loadQueue, 5000);
}

initialize().catch(error => setStatus(error.message || 'เริ่มหน้าคิวไม่สำเร็จ', 'error'));
