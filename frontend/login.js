document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const loginAlert = document.getElementById('loginAlert');
  const alertMessage = document.getElementById('alertMessage');
  const btnLogin = document.getElementById('btnLogin');
  const btnSpinner = document.getElementById('btnSpinner');
  const forgotPassword = document.getElementById('forgotPassword');

  // Define list of users for easy editing/addition
  const USERS_DB = [
    { username: 'admin', password: 'admin123', name: 'Nguyễn Văn An', role: 'Trưởng phòng Đào tạo' },
    { username: 'hieutruong', password: 'ht123', name: 'Trần Hoàng Nam', role: 'Hiệu trưởng' },
    { username: 'giaovu', password: 'gv123', name: 'Lê Thị Bình', role: 'Cán bộ Giáo vụ' }
  ];

  // Check if user is already logged in (redirect to dashboard immediately)
  if (sessionStorage.getItem('isLoggedIn') === 'true') {
    window.location.href = 'index.html';
    return;
  }

  // Handle Form Submit
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    // Reset alert
    loginAlert.style.display = 'none';
    loginAlert.classList.remove('shake');

    // Simulate authentication against our users list
    const matchedUser = USERS_DB.find(u => u.username === username && u.password === password);

    if (matchedUser) {
      // Success flow
      // Disable inputs and button
      usernameInput.disabled = true;
      passwordInput.disabled = true;
      btnLogin.disabled = true;
      
      // Show loading spinner
      btnSpinner.style.display = 'block';
      const btnText = btnLogin.querySelector('.btn-text');
      if (btnText) btnText.style.display = 'none';

      // Store matching user details in session storage
      sessionStorage.setItem('isLoggedIn', 'true');
      sessionStorage.setItem('username', matchedUser.name);
      sessionStorage.setItem('role', matchedUser.role);

      // Redirect after 1.2s to simulate network request
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1200);

    } else {
      // Failure flow
      showAlert('Tên đăng nhập hoặc mật khẩu không chính xác.');
      // Add a shake effect to the card/alert for extra polish
      loginAlert.classList.add('shake');
    }
  });

  // Handle Forgot Password Click
  if (forgotPassword) {
    forgotPassword.addEventListener('click', (e) => {
      e.preventDefault();
      alert('Vui lòng liên hệ Admin Phòng Công nghệ thông tin để được hỗ trợ cấp lại mật khẩu.');
    });
  }

  // Show customized alert
  function showAlert(msg) {
    alertMessage.innerText = msg;
    loginAlert.style.display = 'flex';
  }
});
