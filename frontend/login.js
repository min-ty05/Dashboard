const initLoginPage = () => {
  const loginForm = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const loginAlert = document.getElementById('loginAlert');
  const alertMessage = document.getElementById('alertMessage');
  const btnLogin = document.getElementById('btnLogin');
  const btnSpinner = document.getElementById('btnSpinner');
  const forgotPassword = document.getElementById('forgotPassword');

  const setLoading = (isLoading) => {
    usernameInput.disabled = isLoading;
    passwordInput.disabled = isLoading;
    btnLogin.disabled = isLoading;
    btnSpinner.style.display = isLoading ? 'block' : 'none';
    const btnText = btnLogin.querySelector('.btn-text');
    if (btnText) btnText.style.display = isLoading ? 'none' : 'inline';
  };

  const showAlert = (msg) => {
    alertMessage.innerText = msg;
    loginAlert.style.display = 'flex';
    loginAlert.classList.add('shake');
  };

  const checkExistingSession = async () => {
    const token = localStorage.getItem('session_token');
    if (!token) return;
    try {
      const resp = await fetch('/api/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resp.ok) {
        const result = await resp.json();
        if (result.ok) {
          window.location.replace('/frontend/index.html');
          return;
        }
      }
      // Phiên không hợp lệ -> xóa bỏ token cũ
      localStorage.removeItem('session_token');
    } catch (e) {
      // Bỏ qua lỗi kết nối ở bước kiểm tra tự động
    }
  };
  checkExistingSession();

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    loginAlert.style.display = 'none';
    loginAlert.classList.remove('shake');
    setLoading(true);

    try {
      const resp = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const result = await resp.json();

      if (resp.ok && result.ok) {
        if (result.token) {
          localStorage.setItem('session_token', result.token);
          document.cookie = `session_id=${result.token}; path=/; max-age=28800; SameSite=Lax`;
        }
        window.location.replace('/frontend/index.html');
        return;
      }

      showAlert(result.error || 'Tên đăng nhập hoặc mật khẩu không chính xác.');
      setLoading(false);
    } catch (err) {
      showAlert('Không thể kết nối tới máy chủ. Vui lòng thử lại.');
      setLoading(false);
    }
  });

  if (forgotPassword) {
    forgotPassword.addEventListener('click', (e) => {
      e.preventDefault();
      alert('Vui lòng liên hệ Admin Phòng Công nghệ thông tin để được hỗ trợ cấp lại mật khẩu.');
    });
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLoginPage);
} else {
  initLoginPage();
}
