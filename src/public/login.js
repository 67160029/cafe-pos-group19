const form = document.querySelector('#login-form');
const status = document.querySelector('#login-status');
const submit = document.querySelector('#login-submit');

form.addEventListener('submit', async event => {
  event.preventDefault();
  const employeeId = Number(document.querySelector('#login-employee').value);
  const password = document.querySelector('#login-password').value;
  submit.disabled = true;
  status.className = 'status';
  status.textContent = 'กำลังเข้าสู่ระบบ…';
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, password }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'เข้าสู่ระบบไม่สำเร็จ');
    window.location.replace('/');
  } catch (error) {
    status.className = 'status error';
    status.textContent = error.message || 'เชื่อมต่อระบบไม่สำเร็จ';
    submit.disabled = false;
  }
});
