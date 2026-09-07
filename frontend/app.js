const initDashboardApp = () => {
  // ── DOM Elements ──────────────────────────────────────────────────────────
  const kpiValue = document.getElementById('kpiValue');
  const kpiBadge = document.getElementById('kpiBadge');
  const syncTime = document.getElementById('syncTime');
  const btnRefresh = document.getElementById('btnRefresh');
  const chartPercentage = document.getElementById('chartPercentage');
  const legendActiveVal = document.getElementById('legendActiveVal');
  const legendDroppedVal = document.getElementById('legendDroppedVal');
  const tableBody = document.getElementById('tableBody');

  // Mobile Sidebar and Logout elements
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const btnLogout = document.getElementById('btnLogout');

  // Navigation Links
  const menuDashboard = document.getElementById('menu-dashboard');
  const menuKhoa = document.getElementById('menu-khoa');
  const menuCsvc = document.getElementById('menu-csvc');
  const menuSpreadsheetKhoa = document.getElementById('menu-spreadsheet-khoa');
  const menuSpreadsheetNhansu = document.getElementById('menu-spreadsheet-nhansu');
  const menuSpreadsheetCsvc = document.getElementById('menu-spreadsheet-csvc');

  // Header nav tabs
  const headerTabThongKe = document.getElementById('headerTabThongKe');
  const headerTabNhapLieu = document.getElementById('headerTabNhapLieu');
  let lastDashboardTab = 'dashboard';
  let lastSpreadsheetTab = 'spreadsheet-khoa';

  const liDashboard = document.getElementById('li-dashboard');
  const liKhoa = document.getElementById('li-khoa');
  const liCsvc = document.getElementById('li-csvc');
  const liSpreadsheetKhoa = document.getElementById('li-spreadsheet-khoa');
  const liSpreadsheetNhansu = document.getElementById('li-spreadsheet-nhansu');
  const liSpreadsheetCsvc = document.getElementById('li-spreadsheet-csvc');

  const viewDashboard = document.getElementById('view-dashboard');
  const viewKhoa = document.getElementById('view-khoa');
  const viewCsvc = document.getElementById('view-csvc');
  const viewSpreadsheet = document.getElementById('view-spreadsheet');
  const viewSpreadsheetCsvc = document.getElementById('view-spreadsheet-csvc');

  // Spreadsheet Specific Elements
  const spreadsheetTableBody = document.getElementById('spreadsheet-table-body');
  const btnAddRow = document.getElementById('btn-add-row');
  const spreadsheetStatus = document.getElementById('spreadsheet-status');

  // CSVC Specific Elements
  const csvcSpreadsheetStatus = document.getElementById('csvc-spreadsheet-status');
  const csvcDisplayContainer = document.getElementById('csvc-display-container');
  const csvcSpreadsheetContainer = document.getElementById('csvc-spreadsheet-container');
  const csvcSearchInput = document.getElementById('csvc-search-input');
  const csvcFloorFilterBtns = document.getElementById('csvc-floor-filter-btns');

  let csvcData = null;
  let activeCsvcFloorFilter = "all";
  let csvcSearchQuery = "";

  // ── Dataset Registry ────────────────────────────────────────────────────────
  // apiKey trỏ tới các route mới: /api/data/<apiKey>, /api/row/<apiKey>, /api/row/<apiKey>/delete
  const DATASETS = {
    khoa: {
      apiKey: 'khoa',
      pageTitle: 'Nhập Liệu Sinh Viên Cao Đẳng',
      pageSubtitle: 'Cập nhật số liệu đầu kỳ, sinh viên đang học và thôi học hệ Cao đẳng',
      colName: 'Tên khoa',
      colB: 'Đăng ký đầu kỳ (A)',
      colC: 'Còn học (B)',
      colD: 'Thôi học (A - B)',
      colE: 'Tỷ lệ còn học %',
      fieldB: 'registered',
      fieldC: 'active',
      mode: 'ratio',
      kpi1: 'Tỷ lệ duy trì sĩ số',
      kpi2: 'Tổng đăng ký đầu kỳ',
      kpi3: 'Tổng số còn học',
      kpi4: 'Số lượng thôi học',
    },
    hoc_sinh_9plus: {
      apiKey: 'hoc_sinh_9plus',
      pageTitle: 'Nhập Liệu Học Sinh 9+',
      pageSubtitle: 'Cập nhật số liệu đầu kỳ, học sinh đang học và thôi học hệ 9+',
      colName: 'Tên khoa 9+',
      colB: 'Đăng ký đầu kỳ (A)',
      colC: 'Còn học (B)',
      colD: 'Thôi học (A - B)',
      colE: 'Tỷ lệ còn học %',
      fieldB: 'registered',
      fieldC: 'active',
      mode: 'ratio',
      kpi1: 'Tỷ lệ duy trì sĩ số 9+',
      kpi2: 'Tổng đăng ký đầu kỳ',
      kpi3: 'Tổng số còn học',
      kpi4: 'Số lượng thôi học',
    },
    nhansu: {
      apiKey: 'nhansu',
      pageTitle: 'Nhập Liệu Nhân Sự & Đào Tạo',
      pageSubtitle: 'Cập nhật số lượng cán bộ nam / nữ theo từng đơn vị',
      colName: 'Bộ phận',
      colB: 'Nam',
      colC: 'Nữ',
      colD: 'Tổng số',
      colE: null,
      fieldB: 'male',
      fieldC: 'female',
      mode: 'sum',
      kpi1: 'Tổng nhân sự',
      kpi2: 'Tổng Nam',
      kpi3: 'Tổng Nữ',
      kpi4: 'Tổng cộng nhân sự',
    },
  };
  let currentDataset = 'khoa';
  let currentDashboardDataset = 'khoa';

  // ── Helper: xử lý khi phiên đăng nhập hết hạn giữa chừng ───────────────────
  const getAuthHeaders = (customHeaders = {}) => {
    const headers = { ...customHeaders };
    const token = localStorage.getItem('session_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  const redirectingToLogin = { value: false };
  const handleAuthFailure = (response) => {
    if (response && response.status === 401 && !redirectingToLogin.value) {
      redirectingToLogin.value = true;
      localStorage.removeItem('session_token');
      window.location.replace('/frontend/login.html');
      return true;
    }
    return false;
  };

  // ── Profile Header ──────────────────────────────────────────────────────
  const headerUserName = document.getElementById('headerUserName');
  const headerUserRole = document.getElementById('headerUserRole');
  const headerUserAvatar = document.getElementById('headerUserAvatar');

  let currentUserReadOnly = false;

  const initUserProfile = async () => {
    try {
      const resp = await fetch('/api/me', { headers: getAuthHeaders() });
      // Nếu server trả 401 -> phiên không hợp lệ -> về trang đăng nhập
      if (resp.status === 401) {
        localStorage.removeItem('session_token');
        window.location.replace('/frontend/login.html');
        return false;
      }
      const result = await resp.json();
      if (!resp.ok || !result.ok) {
        localStorage.removeItem('session_token');
        window.location.replace('/frontend/login.html');
        return false;
      }

      currentUserReadOnly = !!result.read_only;
      const sessionName = result.name || 'Khách';
      const sessionRole = result.role || 'Người xem';

      if (headerUserName) headerUserName.innerText = sessionName;
      if (headerUserRole) {
        headerUserRole.innerText = currentUserReadOnly ? `${sessionRole} ` : sessionRole;
      }

      if (headerUserAvatar && sessionName) {
        const nameParts = sessionName.trim().split(' ');
        let initials = '';
        if (nameParts.length >= 2) {
          initials = (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
        } else if (nameParts.length === 1) {
          initials = nameParts[0].substring(0, 2).toUpperCase();
        }
        headerUserAvatar.innerText = initials || 'US';
      }
      return true;
    } catch (err) {
      console.error('Không thể kiểm tra thông tin tài khoản:', err);
      // Lỗi mạng tạm thời -> vẫn cho phép load trang, không đẩy về login
      return true;
    }
  };

  // ── State Variables ────────────────────────────────────────────────────────
  let studentChart = null;
  let genderChart = null;
  let isFetching = false;

  // ── Helper Functions ───────────────────────────────────────────────────────
  const formatNum = (num) => (num || 0).toLocaleString('vi-VN');

  const escapeHtml = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const getColorClass = (percent) => {
    if (percent >= 90) return 'badge-success';
    if (percent >= 80) return 'badge-warning';
    return 'badge-danger';
  };

  // ── Sidebar Toggle Mobile ──────────────────────────────────────────────────
  if (menuToggle && sidebar && sidebarOverlay) {
    const toggleSidebar = () => {
      sidebar.classList.toggle('open');
      sidebarOverlay.classList.toggle('open');
    };

    menuToggle.addEventListener('click', toggleSidebar);
    sidebarOverlay.addEventListener('click', toggleSidebar);

    const menuLinks = document.querySelectorAll('.sidebar-menu .menu-item a');
    menuLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (sidebar.classList.contains('open')) {
          toggleSidebar();
        }
      });
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await fetch('/api/logout', { method: 'POST', headers: getAuthHeaders() });
      } catch (err) {
        // Dù API lỗi mạng, vẫn chuyển về trang login để an toàn.
      }
      localStorage.removeItem('session_token');
      window.location.href = '/frontend/login.html';
    });
  }

  // ── Chart.js Setup ─────────────────────────────────────────────────────────
  const updateChart = (active, dropped, percent) => {
    const ctxEl = document.getElementById('studentChart');
    if (!ctxEl) return;
    if (chartPercentage) chartPercentage.innerText = `${percent}%`;
    if (legendActiveVal) legendActiveVal.innerText = formatNum(active);
    if (legendDroppedVal) legendDroppedVal.innerText = formatNum(dropped);

    if (typeof Chart === 'undefined') return;
    const ctx = ctxEl.getContext('2d');

    if (studentChart) {
      studentChart.data.datasets[0].data = [active, dropped];
      studentChart.update('active');
    } else {
      studentChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Còn học', 'Thôi học'],
          datasets: [{
            data: [active, dropped],
            backgroundColor: ['#1565C0', '#E2E8F0'],
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '80%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function(context) {
                  let label = context.label || '';
                  if (label) label += ': ';
                  if (context.parsed !== null) {
                    label += formatNum(context.parsed) + ' sinh viên';
                  }
                  return label;
                }
              }
            }
          }
        }
      });
    }
  };

  const initGenderChart = (male = 0, female = 0) => {
    const ctxEl = document.getElementById('genderChart');
    if (!ctxEl) return;
    if (typeof Chart === 'undefined') return;
    const yMax = Math.max(12, Math.ceil((Math.max(male, female) + 2) / 2) * 2);
    if (genderChart) {
      genderChart.data.datasets[0].data = [male, female];
      genderChart.options.scales.y.max = yMax;
      genderChart.update('active');
      return;
    }
    const ctx = ctxEl.getContext('2d');
    genderChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Nam', 'Nữ'],
        datasets: [{
          data: [male, female],
          backgroundColor: ['#1565C0', '#64B5F6'],
          borderRadius: 6,
          borderWidth: 0,
          barPercentage: 0.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                return ` ${context.parsed.y} người`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: yMax,
            ticks: { stepSize: 2, color: 'var(--text-muted)' },
            grid: { color: 'var(--border-color)', drawBorder: false }
          },
          x: {
            ticks: { color: 'var(--text-muted)', font: { weight: '600' } },
            grid: { display: false }
          }
        }
      }
    });
  };

  // ── Helpers Cập Nhật Trạng Thái Nút Chuyển Đổi (Toggle State UI) ───────────
  const setDashboardToggleState = (key) => {
    const btnCaoDang = document.getElementById('btnDashboardCaoDang');
    const btn9Plus = document.getElementById('btnDashboard9Plus');
    if (!btnCaoDang || !btn9Plus) return;
    if (key === 'hoc_sinh_9plus') {
      btn9Plus.classList.add('active');
      btn9Plus.style.background = 'var(--primary-color, #1565C0)';
      btn9Plus.style.color = 'white';
      btnCaoDang.classList.remove('active');
      btnCaoDang.style.background = 'transparent';
      btnCaoDang.style.color = 'var(--text-muted, #64748b)';
    } else {
      btnCaoDang.classList.add('active');
      btnCaoDang.style.background = 'var(--primary-color, #1565C0)';
      btnCaoDang.style.color = 'white';
      btn9Plus.classList.remove('active');
      btn9Plus.style.background = 'transparent';
      btn9Plus.style.color = 'var(--text-muted, #64748b)';
    }
  };

  const setSpreadsheetToggleState = (key) => {
    const subTabs = document.getElementById('spreadsheet-sub-tabs');
    const btnCaoDang = document.getElementById('btnSpreadsheetCaoDang');
    const btn9Plus = document.getElementById('btnSpreadsheet9Plus');

    if (key === 'nhansu') {
      if (subTabs) subTabs.style.display = 'none';
      return;
    }

    if (subTabs) subTabs.style.display = 'flex';
    if (!btnCaoDang || !btn9Plus) return;

    if (key === 'hoc_sinh_9plus') {
      btn9Plus.classList.add('active');
      btn9Plus.style.background = 'var(--primary-color, #1565C0)';
      btn9Plus.style.color = 'white';
      btnCaoDang.classList.remove('active');
      btnCaoDang.style.background = 'var(--bg-hover, #f1f5f9)';
      btnCaoDang.style.color = 'var(--text-muted, #64748b)';
    } else {
      btnCaoDang.classList.add('active');
      btnCaoDang.style.background = 'var(--primary-color, #1565C0)';
      btnCaoDang.style.color = 'white';
      btn9Plus.classList.remove('active');
      btn9Plus.style.background = 'var(--bg-hover, #f1f5f9)';
      btn9Plus.style.color = 'var(--text-muted, #64748b)';
    }
  };

  // ── Tab Navigation Switching ───────────────────────────────────────────────
  const switchTab = (tab) => {
    const isSpreadsheetTab = tab === 'spreadsheet-khoa' || tab === 'spreadsheet-nhansu' || tab === 'spreadsheet-csvc';

    [liDashboard, liKhoa, liCsvc, liSpreadsheetKhoa, liSpreadsheetNhansu, liSpreadsheetCsvc].forEach(li => {
      if (li) li.classList.remove('active');
    });
    [viewDashboard, viewKhoa, viewCsvc, viewSpreadsheet, viewSpreadsheetCsvc].forEach(v => {
      if (v) v.style.display = 'none';
    });

    if (tab === 'dashboard') {
      if (liDashboard) liDashboard.classList.add('active');
      if (viewDashboard) viewDashboard.style.display = 'block';
      lastDashboardTab = 'dashboard';
      setDashboardToggleState(currentDashboardDataset);
      loadDashboardData(true);
    } else if (tab === 'khoa') {
      if (liKhoa) liKhoa.classList.add('active');
      if (viewKhoa) viewKhoa.style.display = 'block';
      loadKhoaGenderView();
      lastDashboardTab = 'khoa';
    } else if (tab === 'csvc') {
      if (liCsvc) liCsvc.classList.add('active');
      if (viewCsvc) viewCsvc.style.display = 'block';
      loadCsvcData(true);
      lastDashboardTab = 'csvc';
    } else if (tab === 'spreadsheet-csvc') {
      if (liSpreadsheetCsvc) liSpreadsheetCsvc.classList.add('active');
      if (viewSpreadsheetCsvc) viewSpreadsheetCsvc.style.display = 'block';
      loadCsvcData(true);
      lastSpreadsheetTab = 'spreadsheet-csvc';
    } else if (tab === 'spreadsheet-khoa' || tab === 'spreadsheet-nhansu') {
      if (tab === 'spreadsheet-nhansu') {
        currentDataset = 'nhansu';
      } else {
        if (currentDataset !== 'hoc_sinh_9plus' && currentDataset !== 'khoa') {
          currentDataset = 'khoa';
        }
      }
      applyDatasetLabels(currentDataset);
      setSpreadsheetToggleState(currentDataset);
      if (tab === 'spreadsheet-khoa' && liSpreadsheetKhoa) liSpreadsheetKhoa.classList.add('active');
      if (tab === 'spreadsheet-nhansu' && liSpreadsheetNhansu) liSpreadsheetNhansu.classList.add('active');
      if (viewSpreadsheet) viewSpreadsheet.style.display = 'block';
      loadSpreadsheetData();
      lastSpreadsheetTab = tab;
    }

    if (liDashboard) liDashboard.style.display = isSpreadsheetTab ? 'none' : '';
    if (liKhoa) liKhoa.style.display = isSpreadsheetTab ? 'none' : '';
    if (liCsvc) liCsvc.style.display = isSpreadsheetTab ? 'none' : '';
    if (liSpreadsheetKhoa) liSpreadsheetKhoa.style.display = isSpreadsheetTab ? '' : 'none';
    if (liSpreadsheetNhansu) liSpreadsheetNhansu.style.display = isSpreadsheetTab ? '' : 'none';
    if (liSpreadsheetCsvc) liSpreadsheetCsvc.style.display = isSpreadsheetTab ? '' : 'none';

    if (headerTabThongKe && headerTabNhapLieu) {
      headerTabThongKe.classList.toggle('active', !isSpreadsheetTab);
      headerTabNhapLieu.classList.toggle('active', isSpreadsheetTab);
    }
  };

  // ── Nhãn cột theo dataset ────────────────────────────────────────────────
  const applyDatasetLabels = (key) => {
    const cfg = DATASETS[key];
    if (!cfg) return;

    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.innerText = text;
    };

    setText('col-th-name', cfg.colName);
    setText('col-th-b', cfg.colB);
    setText('col-th-c', cfg.colC);
    setText('col-th-d', cfg.colD);
    setText('spreadsheet-page-title', cfg.pageTitle);
    setText('spreadsheet-page-subtitle', cfg.pageSubtitle);

    const colE = document.getElementById('col-th-e');
    if (colE) colE.style.display = cfg.colE ? '' : 'none';

    setText('calc-kpi1-label', cfg.kpi1);
    setText('calc-kpi2-label', cfg.kpi2);
    setText('calc-kpi3-label', cfg.kpi3);
    setText('calc-kpi4-label', cfg.kpi4);
  };

  // ── Tính tổng KPI hiển thị trên trang tính (không gửi API, chỉ tính lại UI) ─
  const calculateSpreadsheetSummary = () => {
    if (!spreadsheetTableBody) return;
    const cfg = DATASETS[currentDataset];
    let totalB = 0;
    let totalC = 0;
    let totalD = 0;

    const rows = spreadsheetTableBody.querySelectorAll('tr[data-data-row]');
    rows.forEach(row => {
      const bInput = row.querySelector('.spreadsheet-input-registered');
      const cInput = row.querySelector('.spreadsheet-input-active');
      const dText = row.querySelector('.spreadsheet-dropped-text');
      const pctText = row.querySelector('.spreadsheet-pct-text');
      if (!bInput || !cInput) return;

      const bVal = parseInt(bInput.value) || 0;
      const cVal = parseInt(cInput.value) || 0;
      const dVal = cfg.mode === 'ratio' ? Math.max(0, bVal - cVal) : (bVal + cVal);

      if (dText) dText.innerText = formatNum(dVal);
      if (pctText) {
        const pct = cfg.mode === 'ratio' && bVal > 0 ? Math.round((cVal / bVal) * 100) : 0;
        pctText.innerText = `${pct}%`;
      }

      totalB += bVal;
      totalC += cVal;
      totalD += dVal;
    });

    const calcRatioPct = document.getElementById('calc-ratio-pct');
    const calcRatioFraction = document.getElementById('calc-ratio-fraction');
    const calcTotalRegistered = document.getElementById('calc-total-registered');
    const calcTotalActive = document.getElementById('calc-total-active');
    const calcTotalDropped = document.getElementById('calc-total-dropped');

    if (cfg.mode === 'ratio') {
      const totalPct = totalB > 0 ? Math.round((totalC / totalB) * 100) : 0;
      if (calcRatioPct) calcRatioPct.innerText = `${totalPct}%`;
      if (calcRatioFraction) calcRatioFraction.innerText = `${formatNum(totalC)} / ${formatNum(totalB)}`;
    } else {
      if (calcRatioPct) calcRatioPct.innerText = formatNum(totalB + totalC);
      if (calcRatioFraction) calcRatioFraction.innerText = `${formatNum(totalB)} / ${formatNum(totalC)}`;
    }
    if (calcTotalRegistered) calcTotalRegistered.innerText = formatNum(totalB);
    if (calcTotalActive) calcTotalActive.innerText = formatNum(totalC);
    if (calcTotalDropped) calcTotalDropped.innerText = formatNum(totalD);
  };

  // ── Lưu 1 DÒNG (không gửi cả bảng) — có kiểm tra version để tránh mất
  //    dữ liệu khi 2 người cùng sửa cùng lúc qua LAN ───────────────────────
  const saveRow = async (rowEl) => {
    const cfg = DATASETS[currentDataset];
    const nameInput = rowEl.querySelector('.spreadsheet-input-name');
    const bInput = rowEl.querySelector('.spreadsheet-input-registered');
    const cInput = rowEl.querySelector('.spreadsheet-input-active');
    const errorMsg = rowEl._errorRow ? rowEl._errorRow.querySelector('.row-error-msg') : null;

    const name = nameInput.value.trim();
    if (!name) return; // chưa nhập tên thì chưa lưu

    const idAttr = rowEl.getAttribute('data-id');
    const versionAttr = rowEl.getAttribute('data-version');

    const payload = {
      id: idAttr ? parseInt(idAttr) : null,
      name: name,
      b: parseInt(bInput.value) || 0,
      c: parseInt(cInput.value) || 0,
      version: versionAttr ? parseInt(versionAttr) : null,
    };

    setRowStatus(rowEl, 'saving');

    try {
      const resp = await fetch(`/api/row/${cfg.apiKey}`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });

      if (handleAuthFailure(resp)) return;

      const result = await resp.json();

      if (resp.status === 409 || result.error === 'conflict') {
        // Có người khác đã sửa dòng này trước -> KHÔNG ghi đè.
        if (errorMsg) {
          errorMsg.innerText = '⚠ Dòng này vừa được người khác cập nhật. Bấm "Tải lại" để lấy dữ liệu mới nhất trước khi sửa tiếp.';
          errorMsg.style.display = 'block';
        }
        setRowStatus(rowEl, 'conflict');
        showSpreadsheetStatus('⚠ Có xung đột dữ liệu ở 1 dòng - xem chi tiết trong bảng', 'color: var(--color-danger);');
        return;
      }

      if (result.ok) {
        rowEl.setAttribute('data-id', result.row.id);
        rowEl.setAttribute('data-version', result.row.version);
        if (errorMsg) errorMsg.style.display = 'none';
        setRowStatus(rowEl, 'saved');
        showSpreadsheetStatus('<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Đã tự động lưu', 'color: var(--color-success);');
        if (currentDataset === 'nhansu') loadKhoaGenderView();
      } else {
        setRowStatus(rowEl, 'error');
        showSpreadsheetStatus('❌ Lỗi khi lưu dòng này', 'color: var(--color-danger);');
      }
    } catch (err) {
      setRowStatus(rowEl, 'error');
      showSpreadsheetStatus('❌ Lỗi kết nối tới máy chủ', 'color: var(--color-danger);');
    }
  };

  const setRowStatus = (rowEl, status) => {
    const bInput = rowEl.querySelector('.spreadsheet-input-registered');
    const cInput = rowEl.querySelector('.spreadsheet-input-active');
    const OK_BORDER = '1px solid var(--border-color)';
    const CONFLICT_BORDER = '2px solid var(--color-warning)';
    const ERROR_BORDER = '2px solid var(--color-danger)';
    let border = OK_BORDER;
    if (status === 'conflict') border = CONFLICT_BORDER;
    if (status === 'error') border = ERROR_BORDER;
    if (bInput) bInput.style.border = border;
    if (cInput) cInput.style.border = border;
  };

  const deleteRow = async (rowEl) => {
    const cfg = DATASETS[currentDataset];
    const idAttr = rowEl.getAttribute('data-id');
    const versionAttr = rowEl.getAttribute('data-version');

    if (rowEl._errorRow) rowEl._errorRow.remove();

    if (!idAttr) {
      // Dòng mới thêm, chưa từng lưu -> chỉ cần xoá khỏi giao diện
      rowEl.remove();
      calculateSpreadsheetSummary();
      return;
    }

    try {
      const resp = await fetch(`/api/row/${cfg.apiKey}/delete`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id: parseInt(idAttr), version: parseInt(versionAttr) }),
      });
      if (handleAuthFailure(resp)) return;
      const result = await resp.json();

      if (!result.ok && result.error === 'conflict') {
        showSpreadsheetStatus('⚠ Dòng vừa bị người khác sửa, đã tải lại dữ liệu mới nhất', 'color: var(--color-warning);');
        loadSpreadsheetData();
        return;
      }

      rowEl.remove();
      calculateSpreadsheetSummary();
      if (currentDataset === 'nhansu') loadKhoaGenderView();
    } catch (err) {
      showSpreadsheetStatus('❌ Không xoá được - lỗi kết nối', 'color: var(--color-danger);');
    }
  };

  let saveTimers = new WeakMap();
  const scheduleSaveRow = (rowEl) => {
    calculateSpreadsheetSummary();
    if (saveTimers.has(rowEl)) clearTimeout(saveTimers.get(rowEl));
    showSpreadsheetStatus('⚡ Đang tự động lưu...', 'color: var(--text-muted);');
    saveTimers.set(rowEl, setTimeout(() => saveRow(rowEl), 500));
  };

  const createSpreadsheetRow = (id, name = '', registered = 0, active = 0, version = null) => {
    if (!spreadsheetTableBody) return;

    const cfg = DATASETS[currentDataset];
    let dropped = cfg.mode === 'ratio' ? Math.max(0, registered - active) : (registered + active);
    const pct = registered > 0 ? Math.round((active / registered) * 100) : 0;

    const dataRow = document.createElement('tr');
    dataRow.setAttribute('data-data-row', 'true');
    if (id !== null && id !== undefined) dataRow.setAttribute('data-id', id);
    if (version !== null && version !== undefined) dataRow.setAttribute('data-version', version);

    const disAttr = currentUserReadOnly ? 'disabled' : '';
    const delStyle = currentUserReadOnly ? 'display: none;' : '';

    dataRow.innerHTML = `
      <td style="padding: 6px 8px;">
        <input type="text" class="spreadsheet-input-name" ${disAttr}
          style="width: 90%; padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 6px; outline: none; font-family: inherit; font-size: inherit;"
          value="${escapeHtml(name)}" placeholder="Tên khoa...">
      </td>
      <td style="padding: 6px 8px;">
        <input type="number" class="spreadsheet-input-registered" ${disAttr}
          style="width: 130px; padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 6px; outline: none; font-family: inherit; font-size: inherit;"
          value="${registered}" min="0">
      </td>
      <td style="padding: 6px 8px;">
        <input type="number" class="spreadsheet-input-active" ${disAttr}
          style="width: 130px; padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 6px; outline: none; font-family: inherit; font-size: inherit;"
          value="${active}" min="0">
      </td>
      <td style="padding: 6px 8px;">
        <span class="spreadsheet-dropped-text" style="font-weight: 500; color: var(--text-muted);">${formatNum(dropped)}</span>
      </td>
      <td style="padding: 6px 8px; ${cfg.colE ? '' : 'display:none;'}" class="spreadsheet-pct-cell">
        <span class="spreadsheet-pct-text" style="font-weight: 600; color: var(--primary-color);">${pct}%</span>
      </td>
      <td style="padding: 6px 8px; text-align: center;">
        <button class="btn-delete-row"
          style="background: none; border: none; color: var(--color-danger); cursor: pointer; padding: 4px; ${delStyle}"
          title="Xóa hàng">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </button>
      </td>
    `;

    const errorRow = document.createElement('tr');
    errorRow.setAttribute('data-error-row', 'true');
    errorRow.innerHTML = `
      <td colspan="6" style="padding: 0 8px 6px 8px;">
        <span class="row-error-msg"
          style="display: none; font-size: 12px; color: var(--color-warning); font-weight: 500;">
        </span>
      </td>
    `;

    dataRow._errorRow = errorRow;

    if (!currentUserReadOnly) {
      const nameInput = dataRow.querySelector('.spreadsheet-input-name');
      const regInput  = dataRow.querySelector('.spreadsheet-input-registered');
      const actInput  = dataRow.querySelector('.spreadsheet-input-active');

      [nameInput, regInput, actInput].forEach(input => {
        if (input) {
          input.addEventListener('input', () => scheduleSaveRow(dataRow));
        }
      });

      dataRow.querySelector('.btn-delete-row').addEventListener('click', () => {
        if (saveTimers.has(dataRow)) clearTimeout(saveTimers.get(dataRow));
        deleteRow(dataRow);
      });
    }

    spreadsheetTableBody.appendChild(dataRow);
    spreadsheetTableBody.appendChild(errorRow);
    return dataRow;
  };

  const populateSpreadsheet = (data) => {
    if (!spreadsheetTableBody) return;
    spreadsheetTableBody.innerHTML = '';
    const cfg = DATASETS[currentDataset];

    (data.departments || []).forEach(d => {
      createSpreadsheetRow(d.id, d.name, d[cfg.fieldB], d[cfg.fieldC], d.version);
    });

    calculateSpreadsheetSummary();

    if (currentUserReadOnly) {
      if (btnAddRow) btnAddRow.style.display = 'none';
      showSpreadsheetStatus('🔒 Chế độ chỉ đọc (Tài khoản Demo) — Không thể chỉnh sửa', 'color: var(--text-muted); font-weight: 600;');
    } else {
      if (btnAddRow) btnAddRow.style.display = '';
    }
  };

  const showSpreadsheetStatus = (msg, styleStr = 'color: var(--color-success);') => {
    if (!spreadsheetStatus) return;
    spreadsheetStatus.innerHTML = msg;
    spreadsheetStatus.style = styleStr;
    spreadsheetStatus.style.display = 'inline-flex';
  };

  // ── Render Dashboard DOM ───────────────────────────────────────────────────
  const renderDashboard = (data) => {
    const { summary, departments } = data;

    if (kpiValue && summary) {
      const active = summary.active || 0;
      const registered = summary.registered || 0;
      const activePercent = registered > 0 ? Math.round((active / registered) * 100) : 0;
      kpiValue.innerText = `${formatNum(active)} / ${formatNum(registered)}`;
      if (kpiBadge) {
        kpiBadge.innerText = `${activePercent}%`;
        kpiBadge.className = 'kpi-card-badge';
        kpiBadge.classList.add(getColorClass(activePercent));
      }
    }

    const titleText = document.getElementById('dashboard-table-title-text');
    if (titleText) {
      titleText.innerText = currentDashboardDataset === 'hoc_sinh_9plus'
        ? 'Thống Kê Sĩ Số — Học Sinh 9+'
        : 'Thống Kê Sĩ Số — Hệ Cao Đẳng';
    }
    setDashboardToggleState(currentDashboardDataset);

    if (tableBody) {
      tableBody.innerHTML = '';

      if (departments && departments.length > 0) {
        departments.forEach(dept => {
          const deptActive = dept.active;
          const deptReg = dept.registered;
          const deptDropped = dept.dropped !== undefined ? dept.dropped : Math.max(0, deptReg - deptActive);
          const deptPercent = deptReg > 0 ? Math.round((deptActive / deptReg) * 100) : 0;

          const row = document.createElement('tr');
          const deptRateClass = getColorClass(deptPercent);
          let badgeColor = '';
          if (deptRateClass === 'badge-success') badgeColor = 'color: var(--color-success); background-color: var(--color-success-bg);';
          else if (deptRateClass === 'badge-warning') badgeColor = 'color: var(--color-warning); background-color: var(--color-warning-bg);';
          else badgeColor = 'color: var(--color-danger); background-color: var(--color-danger-bg);';

          row.innerHTML = `
            <td><span class="dept-name">${escapeHtml(dept.name)}</span></td>
            <td>${formatNum(deptReg)}</td>
            <td>${formatNum(deptActive)}</td>
            <td>${formatNum(deptDropped)}</td>
            <td>
              <span class="badge-rate" style="${badgeColor}">
                ${deptPercent}%
              </span>
            </td>
          `;

          tableBody.appendChild(row);
        });
      } else {
        tableBody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 32px;">Không có dữ liệu khoa</td>
          </tr>
        `;
      }
    }
  };

  // ── Fetch/Load Data (Dashboard) ─────────────────────────────────────────────
  const loadDashboardData = async (isManual = false) => {
    if (isFetching && !isManual) return;
    isFetching = true;

    if (btnRefresh) btnRefresh.classList.add('spinning');

    try {
      const response = await fetch(`/api/data/${currentDashboardDataset}?t=${Date.now()}`, { headers: getAuthHeaders() });
      if (handleAuthFailure(response)) return;
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      renderDashboard(data);

      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      if (syncTime) syncTime.innerText = timeStr;

      const syncDot = document.querySelector('.sync-dot');
      if (syncDot) syncDot.style.backgroundColor = 'var(--color-success)';

    } catch (error) {
      console.error('Failed to load student statistics:', error);
      if (tableBody) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; color: var(--color-danger); padding: 32px;">
              ❌ Không tải được số liệu. Vui lòng kiểm tra kết nối.
            </td>
          </tr>
        `;
      }
      if (syncTime) syncTime.innerText = 'Lỗi đồng bộ';
      const syncDot = document.querySelector('.sync-dot');
      if (syncDot) syncDot.style.backgroundColor = 'var(--color-danger)';
    } finally {
      if (btnRefresh) btnRefresh.classList.remove('spinning');
      isFetching = false;
    }
  };

  // Tab "Trang tính" tự tải dữ liệu riêng của nó, KHÔNG bị ghi đè bởi vòng
  // polling của Dashboard (tránh mất con trỏ/nội dung đang gõ dở).
  const loadSpreadsheetData = async () => {
    const cfg = DATASETS[currentDataset];
    if (!cfg) return;
    setSpreadsheetToggleState(currentDataset);
    applyDatasetLabels(currentDataset);
    try {
      const response = await fetch(`/api/data/${cfg.apiKey}?t=${Date.now()}`, { headers: getAuthHeaders() });
      if (handleAuthFailure(response)) return;
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      populateSpreadsheet(data);
    } catch (error) {
      console.error(`Failed to load /api/data/${cfg.apiKey}:`, error);
      if (spreadsheetTableBody) {
        spreadsheetTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--color-danger); padding:24px;">
          Không tải được dữ liệu từ máy chủ. Kiểm tra kết nối và thử lại.
        </td></tr>`;
      }
      showSpreadsheetStatus(`❌ Không tải được dữ liệu`, 'color: var(--color-danger);');
    }
  };

  applyDatasetLabels(currentDataset);

  // ── Render Khoa Tab (staff/gender view) ─────────────────────────────────
  const renderKhoaView = (data) => {
    const summary = data.summary || {};
    const depts = data.departments || [];

    const male = summary.male ?? depts.reduce((s, d) => s + (d.male || 0), 0);
    const female = summary.female ?? depts.reduce((s, d) => s + (d.female || 0), 0);
    const total = summary.total ?? (male + female);

    const subtitle = document.getElementById('khoaGenderSubtitle');
    if (subtitle) subtitle.innerText = `Tổng số: ${formatNum(total)} nhân sự (Nam: ${formatNum(male)}, Nữ: ${formatNum(female)})`;

    initGenderChart(male, female);

    const tbody = document.getElementById('khoaStaffTableBody');
    if (tbody) {
      if (depts.length > 0) {
        let rows = '';
        depts.forEach(d => {
          const rowTotal = (d.male || 0) + (d.female || 0);
          rows += `
            <tr>
              <td><span class="dept-name">${escapeHtml(d.name)}</span></td>
              <td>${formatNum(d.male || 0)}</td>
              <td>${formatNum(d.female || 0)}</td>
              <td style="text-align: center; font-weight: 600;">${formatNum(rowTotal)}</td>
            </tr>`;
        });
        rows += `
          <tr style="font-weight: bold; background-color: #F8FAFC; border-top: 2px solid var(--border-color);">
            <td>Tổng số nhân sự</td>
            <td>${formatNum(male)}</td>
            <td>${formatNum(female)}</td>
            <td style="text-align: center; color: var(--primary-color);">${formatNum(total)}</td>
          </tr>`;
        tbody.innerHTML = rows;
      } else {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:24px;">Không có dữ liệu</td></tr>`;
      }
    }
  };

  const loadKhoaGenderView = async () => {
    try {
      const response = await fetch(`/api/data/nhansu?t=${Date.now()}`, { headers: getAuthHeaders() });
      if (handleAuthFailure(response)) return;
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      renderKhoaView(data);
    } catch (error) {
      console.error('Failed to load staff statistics:', error);
      const tbody = document.getElementById('khoaStaffTableBody');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--color-danger); padding:24px;">Không tải được dữ liệu nhân sự</td></tr>`;
      }
    }
  };

  // ── CSVC (Cơ Sở Vật Chất) — hiển thị (Thống kê) ─────────────────────────
  const loadCsvcData = async (isManual = false) => {
    try {
      const response = await fetch(`/api/data/csvc?t=${Date.now()}`, { headers: getAuthHeaders() });
      if (handleAuthFailure(response)) return;
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      csvcData = data;
      renderCsvcDisplay(data);
      populateCsvcSpreadsheet(data);
    } catch (error) {
      console.error('Failed to load facilities statistics:', error);
    }
  };

  const renderCsvcDisplay = (data) => {
    if (!csvcDisplayContainer) return;
    const floors = data.floors || [];

    let totalQty = 0;
    let totalRoomsCount = 0;
    let tretQty = 0;
    let lau1Qty = 0;

    floors.forEach(floor => {
      (floor.rooms || []).forEach(room => {
        totalRoomsCount++;
        (room.items || []).forEach(item => {
          const qty = parseInt(item.quantity) || 0;
          totalQty += qty;
          if ((floor.name || '').includes('TRỆT')) {
            tretQty += qty;
          } else {
            lau1Qty += qty;
          }
        });
      });
    });

    const setElText = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = formatNum(val);
    };

    setElText('csvc-kpi-total-qty', totalQty);
    setElText('csvc-kpi-total-rooms', totalRoomsCount);
    setElText('csvc-kpi-tret-qty', tretQty);
    setElText('csvc-kpi-lau1-qty', lau1Qty);

    let filteredFloors = floors;
    if (activeCsvcFloorFilter !== 'all') {
      filteredFloors = floors.filter(f => String(f.id) === String(activeCsvcFloorFilter));
    }

    const query = (csvcSearchQuery || '').toLowerCase().trim();

    let html = '';
    filteredFloors.forEach(floor => {
      let floorTotalQty = 0;
      let roomBlocksHtml = '';

      (floor.rooms || []).forEach(room => {
        let itemsHtml = '';
        let roomItemCount = 0;
        let roomTotalQty = 0;

        (room.items || []).forEach(item => {
          const name = item.name || '';
          const model = item.model || '';
          const notes = item.notes || '';
          const roomName = room.room_name || '';

          if (query) {
            const match = name.toLowerCase().includes(query) ||
                          model.toLowerCase().includes(query) ||
                          notes.toLowerCase().includes(query) ||
                          roomName.toLowerCase().includes(query);
            if (!match) return;
          }

          const qty = parseInt(item.quantity) || 0;
          roomItemCount++;
          roomTotalQty += qty;

          itemsHtml += `
            <tr>
              <td style="text-align: center; color: var(--text-muted); font-size: 13px;">${roomItemCount}</td>
              <td><strong style="color: var(--text-main);">${escapeHtml(name)}</strong></td>
              <td><span style="font-family: monospace; font-size: 12px; color: var(--text-muted);">${escapeHtml(model || '—')}</span></td>
              <td style="text-align: center; font-weight: 700; color: var(--primary-color); font-size: 15px;">${formatNum(qty)}</td>
              <td style="text-align: center; font-size: 13px; color: var(--text-muted);">${escapeHtml(item.unit || 'Cái')}</td>
              <td style="font-size: 13px; color: var(--text-muted);">${escapeHtml(notes || '—')}</td>
            </tr>
          `;
        });

        if (roomItemCount > 0 || !query) {
          floorTotalQty += roomTotalQty;

          roomBlocksHtml += `
            <div class="room-block" style="margin-bottom: 24px; background: var(--card-bg); border-radius: 10px; padding: 18px; border: 1px solid var(--border-color); box-shadow: var(--shadow-sm);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
                <h4 style="font-size: 16px; font-weight: 700; color: var(--primary-color); display: flex; align-items: center; gap: 8px; margin: 0;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                  ${escapeHtml(room.room_name)}
                </h4>
                <span class="badge" style="background: var(--primary-light); color: var(--primary-dark); padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600;">
                  ${roomItemCount} loại thiết bị / ${formatNum(roomTotalQty)} số lượng
                </span>
              </div>
              <div class="table-wrapper">
                <table class="data-table" style="width: 100%;">
                  <thead>
                    <tr>
                      <th style="width: 50px; text-align: center;">STT</th>
                      <th>Tên tài sản / thiết bị</th>
                      <th style="width: 140px;">Ký hiệu / Model</th>
                      <th style="width: 110px; text-align: center;">Số lượng</th>
                      <th style="width: 100px; text-align: center;">ĐVT</th>
                      <th>Ghi chú / Thông số</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml || '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 16px;">Không có thiết bị phù hợp</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>
          `;
        }
      });

      html += `
        <div class="floor-section" style="margin-bottom: 32px;">
          <div style="background: linear-gradient(135deg, var(--primary-color), var(--primary-dark)); color: white; padding: 16px 20px; border-radius: 12px 12px 0 0; display: flex; align-items: center; justify-content: space-between; box-shadow: var(--shadow-md);">
            <h2 style="font-size: 18px; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 10px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/></svg>
              ${escapeHtml(floor.name)}
            </h2>
            <span style="background: rgba(255,255,255,0.2); padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600;">
              Tổng: ${formatNum(floorTotalQty)} thiết bị
            </span>
          </div>
          <div style="background: var(--bg-color); padding: 20px; border: 1px solid var(--border-color); border-top: none; border-radius: 0 0 12px 12px;">
            ${roomBlocksHtml || '<div style="text-align: center; padding: 24px; color: var(--text-muted);">Không tìm thấy thiết bị nào phù hợp trong tầng này</div>'}
          </div>
        </div>
      `;
    });

    csvcDisplayContainer.innerHTML = html || '<div class="dashboard-panel" style="text-align: center; padding: 40px; color: var(--text-muted);">Không có dữ liệu cơ sở vật chất</div>';

    // Cập nhật danh sách nút lọc theo tầng thực tế trong DB
    if (csvcFloorFilterBtns) {
      const existingIds = Array.from(csvcFloorFilterBtns.querySelectorAll('button')).map(b => b.getAttribute('data-floor'));
      floors.forEach(floor => {
        if (!existingIds.includes(String(floor.id))) {
          const btn = document.createElement('button');
          btn.setAttribute('data-floor', floor.id);
          btn.style.cssText = 'padding:6px 16px;border-radius:20px;border:1px solid var(--border-color);background:var(--card-bg);color:var(--text-main);font-weight:600;font-size:13px;cursor:pointer;';
          btn.innerText = floor.name;
          btn.addEventListener('click', () => selectCsvcFloorFilter(btn));
          csvcFloorFilterBtns.appendChild(btn);
        }
      });
    }
  };

  const selectCsvcFloorFilter = (btn) => {
    csvcFloorFilterBtns.querySelectorAll('button').forEach(b => {
      b.style.background = 'var(--card-bg)';
      b.style.color = 'var(--text-main)';
    });
    btn.style.background = 'var(--primary-color)';
    btn.style.color = 'white';
    activeCsvcFloorFilter = btn.getAttribute('data-floor') || 'all';
    if (csvcData) renderCsvcDisplay(csvcData);
  };

  // ── CSVC — Trang tính (nhập liệu), lưu theo TỪNG mục (item), có version ──
  const csvcSaveTimers = new WeakMap();
  const scheduleCsvcSave = (fn, key) => {
    if (csvcSaveTimers.has(key)) clearTimeout(csvcSaveTimers.get(key));
    if (csvcSpreadsheetStatus) {
      csvcSpreadsheetStatus.innerText = '⚡ Đang tự động lưu...';
      csvcSpreadsheetStatus.style.color = 'var(--text-muted)';
    }
    csvcSaveTimers.set(key, setTimeout(fn, 500));
  };

  const setCsvcStatus = (msg, color) => {
    if (!csvcSpreadsheetStatus) return;
    csvcSpreadsheetStatus.innerHTML = msg;
    csvcSpreadsheetStatus.style.color = color;
  };

  
  const calculateRoomTotalQty = (items) => {
    if (!Array.isArray(items)) return 0;
    return items.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
  };

  const recalculateCsvcRoomTotal = (roomBlock) => {
    if (!roomBlock) return;
    const qtyInputs = roomBlock.querySelectorAll('.csvc-input-item-qty');
    let total = 0;
    qtyInputs.forEach(input => {
      total += parseInt(input.value) || 0;
    });
    const badge = roomBlock.querySelector('.csvc-room-total-badge');
    if (badge) {
      badge.innerText = `Tổng: ${formatNum(total)} thiết bị`;
    }
  };

  const attachCsvcItemRowEvents = (rowEl, roomBlock) => {
    if (currentUserReadOnly) return;

    const inputs = rowEl.querySelectorAll('input');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        recalculateCsvcRoomTotal(roomBlock);
        scheduleCsvcSave(() => saveCsvcItemRow(rowEl, roomBlock), rowEl);
      });
    });

    const btnDelete = rowEl.querySelector('.btn-delete-csvc-item');
    if (btnDelete) {
      btnDelete.addEventListener('click', async () => {
        const idAttr = rowEl.getAttribute('data-id');
        const versionAttr = rowEl.getAttribute('data-version');
        if (!idAttr) {
          rowEl.remove();
          recalculateCsvcRoomTotal(roomBlock);
          return;
        }

        try {
          const resp = await fetch('/api/csvc/item/delete', {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ id: parseInt(idAttr), version: parseInt(versionAttr) }),
          });
          if (handleAuthFailure(resp)) return;
          const result = await resp.json();
          if (!result.ok && result.error === 'conflict') {
            setCsvcStatus('⚠ Thiết bị vừa bị người khác sửa - đang tải lại...', 'var(--color-warning)');
            loadCsvcData(true);
            return;
          }
          rowEl.remove();
          recalculateCsvcRoomTotal(roomBlock);
          setCsvcStatus('✔ Đã xóa thiết bị', 'var(--color-success)');
        } catch (err) {
          setCsvcStatus('❌ Không xoá được - lỗi kết nối', 'var(--color-danger)');
        }
      });
    }
  };

  const saveCsvcItemRow = async (rowEl, roomBlock) => {
    const nameInput = rowEl.querySelector('.csvc-input-item-name');
    const modelInput = rowEl.querySelector('.csvc-input-item-model');
    const qtyInput = rowEl.querySelector('.csvc-input-item-qty');
    const unitInput = rowEl.querySelector('.csvc-input-item-unit');
    const notesInput = rowEl.querySelector('.csvc-input-item-notes');

    const name = nameInput.value.trim();
    if (!name) return;

    const roomId = roomBlock.getAttribute('data-room-id');
    if (!roomId) return; // phòng chưa được lưu (chưa có id) thì chưa lưu item

    const idAttr = rowEl.getAttribute('data-id');
    const versionAttr = rowEl.getAttribute('data-version');

    const payload = {
      id: idAttr ? parseInt(idAttr) : null,
      room_id: parseInt(roomId),
      name,
      model: modelInput.value.trim(),
      quantity: parseInt(qtyInput.value) || 0,
      unit: unitInput.value.trim() || 'Cái',
      notes: notesInput.value.trim(),
      version: versionAttr ? parseInt(versionAttr) : null,
    };

    try {
      const resp = await fetch('/api/csvc/item', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      if (handleAuthFailure(resp)) return;
      const result = await resp.json();

      if (resp.status === 409 || result.error === 'conflict') {
        setCsvcStatus('⚠ 1 thiết bị vừa bị người khác sửa - đang tải lại...', 'var(--color-warning)');
        loadCsvcData(true);
        return;
      }

      if (result.ok) {
        rowEl.setAttribute('data-id', result.row.id);
        rowEl.setAttribute('data-version', result.row.version);
        recalculateCsvcRoomTotal(roomBlock);
        setCsvcStatus('✔ Đã tự động lưu', 'var(--color-success)');
      } else {
        setCsvcStatus('❌ Lỗi tự động lưu', 'var(--color-danger)');
      }
    } catch (err) {
      setCsvcStatus('❌ Lỗi kết nối', 'var(--color-danger)');
    }
  };

  const saveCsvcRoomName = async (roomBlock) => {
    const nameInput = roomBlock.querySelector('.csvc-input-room-name');
    const roomName = nameInput.value.trim();
    if (!roomName) return;

    const floorCard = roomBlock.closest('.csvc-floor-editor-card');
    const floorId = floorCard ? floorCard.getAttribute('data-floor-id') : null;
    if (!floorId) return; // tầng chưa được lưu thì chưa lưu phòng

    const idAttr = roomBlock.getAttribute('data-room-id');
    const versionAttr = roomBlock.getAttribute('data-room-version');

    try {
      const resp = await fetch('/api/csvc/room', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          id: idAttr ? parseInt(idAttr) : null,
          floor_id: parseInt(floorId),
          room_name: roomName,
          version: versionAttr ? parseInt(versionAttr) : null,
        }),
      });
      if (handleAuthFailure(resp)) return;
      const result = await resp.json();

      if (resp.status === 409 || result.error === 'conflict') {
        setCsvcStatus('⚠ Tên phòng vừa bị người khác sửa - đang tải lại...', 'var(--color-warning)');
        loadCsvcData(true);
        return;
      }

      if (result.ok) {
        roomBlock.setAttribute('data-room-id', result.row.id);
        roomBlock.setAttribute('data-room-version', result.row.version);
        setCsvcStatus('✔ Đã tự động lưu', 'var(--color-success)');
      }
    } catch (err) {
      setCsvcStatus('❌ Lỗi kết nối', 'var(--color-danger)');
    }
  };

  const saveCsvcFloorName = async (floorCard) => {
    const nameInput = floorCard.querySelector('.csvc-input-floor-name');
    const name = nameInput ? nameInput.value.trim() : floorCard.getAttribute('data-floor-name');
    if (!name) return;

    const idAttr = floorCard.getAttribute('data-floor-id');
    const versionAttr = floorCard.getAttribute('data-floor-version');

    try {
      const resp = await fetch('/api/csvc/floor', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          id: idAttr ? parseInt(idAttr) : null,
          name,
          version: versionAttr ? parseInt(versionAttr) : null,
        }),
      });
      if (handleAuthFailure(resp)) return;
      const result = await resp.json();

      if (resp.status === 409 || result.error === 'conflict') {
        setCsvcStatus('⚠ Tên khu vực vừa bị người khác sửa - đang tải lại...', 'var(--color-warning)');
        loadCsvcData(true);
        return;
      }

      if (result.ok) {
        floorCard.setAttribute('data-floor-id', result.row.id);
        floorCard.setAttribute('data-floor-version', result.row.version);
        setCsvcStatus('✔ Đã tự động lưu', 'var(--color-success)');
        // Nếu tầng vừa được tạo (trước đó chưa có id), thử lưu các phòng đang chờ
        floorCard.querySelectorAll('.csvc-room-editor-block').forEach(rb => {
          if (!rb.getAttribute('data-room-id')) saveCsvcRoomName(rb);
        });
      }
    } catch (err) {
      setCsvcStatus('❌ Lỗi kết nối', 'var(--color-danger)');
    }
  };

  const createCsvcItemRowHtml = (id, version, name = '', model = '', qty = 0, unit = 'Cái', notes = '') => {
    const disAttr = currentUserReadOnly ? 'disabled' : '';
    const btnStyle = currentUserReadOnly ? 'display: none;' : '';
    return `
      <tr class="csvc-item-row" ${id ? `data-id="${id}"` : ''} ${version ? `data-version="${version}"` : ''}>
        <td>
          <input type="text" class="csvc-input-item-name" ${disAttr} style="width: 95%; padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 6px; outline: none; font-size: 14px;" value="${escapeHtml(name)}" placeholder="Tên thiết bị...">
        </td>
        <td>
          <input type="text" class="csvc-input-item-model" ${disAttr} style="width: 95%; padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 6px; outline: none; font-size: 13px; font-family: monospace;" value="${escapeHtml(model)}" placeholder="Model/Ký hiệu">
        </td>
        <td>
          <input type="number" class="csvc-input-item-qty" ${disAttr} style="width: 90px; padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 6px; outline: none; font-size: 14px; font-weight: 700; text-align: center;" value="${qty}" min="0">
        </td>
        <td>
          <input type="text" class="csvc-input-item-unit" ${disAttr} style="width: 80px; padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 6px; outline: none; font-size: 13px; text-align: center;" value="${escapeHtml(unit)}" placeholder="ĐVT">
        </td>
        <td>
          <input type="text" class="csvc-input-item-notes" ${disAttr} style="width: 95%; padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 6px; outline: none; font-size: 13px;" value="${escapeHtml(notes)}" placeholder="Ghi chú / Kích thước...">
        </td>
        <td style="text-align: center;">
          <button type="button" class="btn-delete-csvc-item" style="background: none; border: none; color: var(--color-danger); cursor: pointer; padding: 4px; ${btnStyle}" title="Xóa thiết bị này">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </td>
      </tr>
    `;
  };

  const buildRoomBlockHtml = (room) => {
    let itemRowsHtml = '';
    (room.items || []).forEach(item => {
      itemRowsHtml += createCsvcItemRowHtml(item.id, item.version, item.name, item.model, item.quantity, item.unit, item.notes);
    });

    const disAttr = currentUserReadOnly ? 'disabled' : '';
    const btnStyle = currentUserReadOnly ? 'display: none;' : '';

    return `
      <div class="csvc-room-editor-block" data-room-id="${room.id || ''}" data-room-version="${room.version || ''}" style="margin-bottom: 24px; background: var(--card-bg); border-radius: 10px; padding: 18px; border: 1px solid var(--border-color); box-shadow: var(--shadow-sm);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
          <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
            <span style="font-weight: 700; color: var(--primary-color);">Phòng/Khu vực:</span>
            <input type="text" class="csvc-input-room-name" ${disAttr} value="${escapeHtml(room.room_name || '')}" style="font-weight: 700; font-size: 15px; width: 300px; padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 6px; outline: none;">
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <span class="badge csvc-room-total-badge" style="background: var(--primary-light); color: var(--primary-dark); padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600;">
              Tổng: ${formatNum(calculateRoomTotalQty(room.items))} thiết bị
            </span>
            <button type="button" class="btn-delete-csvc-room" style="background: none; border: none; color: var(--color-danger); cursor: pointer; padding: 4px; ${btnStyle}" title="Xóa phòng này">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>

        <div class="table-wrapper">
          <table class="data-table" style="width: 100%;">
            <thead>
              <tr>
                <th>Tên tài sản / thiết bị</th>
                <th style="width: 130px;">Ký hiệu / Model</th>
                <th style="width: 110px;">Số lượng</th>
                <th style="width: 100px;">ĐVT</th>
                <th>Ghi chú / Thông số</th>
                <th style="width: 70px; text-align: center; ${btnStyle}">Xóa</th>
              </tr>
            </thead>
            <tbody class="csvc-items-tbody">
              ${itemRowsHtml}
            </tbody>
          </table>
        </div>

        <div style="margin-top: 12px; text-align: left; ${btnStyle}">
          <button type="button" class="btn-csvc-add-item" style="background: var(--bg-color); border: 1px solid var(--border-color); color: var(--text-main); font-weight: 600; font-size: 13px; padding: 6px 14px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Thêm thiết bị vào phòng này
          </button>
        </div>
      </div>
    `;
  };

  const attachRoomBlockEvents = (roomBlock) => {
    if (currentUserReadOnly) return;
    const nameInput = roomBlock.querySelector('.csvc-input-room-name');
    if (nameInput) {
      nameInput.addEventListener('input', () => {
        scheduleCsvcSave(() => saveCsvcRoomName(roomBlock), roomBlock);
      });
    }

    roomBlock.querySelectorAll('.csvc-item-row').forEach(rowEl => attachCsvcItemRowEvents(rowEl, roomBlock));

    const btnDeleteRoom = roomBlock.querySelector('.btn-delete-csvc-room');
    if (btnDeleteRoom) {
      btnDeleteRoom.addEventListener('click', async () => {
        const idAttr = roomBlock.getAttribute('data-room-id');
        const versionAttr = roomBlock.getAttribute('data-room-version');
        if (!idAttr) { roomBlock.remove(); return; }
        try {
          const resp = await fetch('/api/csvc/room/delete', {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ id: parseInt(idAttr), version: parseInt(versionAttr) }),
          });
          if (handleAuthFailure(resp)) return;
          const result = await resp.json();
          if (!result.ok && result.error === 'conflict') {
            setCsvcStatus('⚠ Phòng vừa bị người khác sửa - đang tải lại...', 'var(--color-warning)');
            loadCsvcData(true);
            return;
          }
          roomBlock.remove();
        } catch (err) {
          setCsvcStatus('❌ Không xoá được - lỗi kết nối', 'var(--color-danger)');
        }
      });
    }

    const btnAddItem = roomBlock.querySelector('.btn-csvc-add-item');
    if (btnAddItem) {
      btnAddItem.addEventListener('click', () => {
        const tbody = roomBlock.querySelector('.csvc-items-tbody');
        const newRowHtml = createCsvcItemRowHtml(null, null, '', '', 1, 'Cái', '');
        tbody.insertAdjacentHTML('beforeend', newRowHtml);
        const newRow = tbody.lastElementChild;
        attachCsvcItemRowEvents(newRow, roomBlock);
        recalculateCsvcRoomTotal(roomBlock);
      });
    }
  };

  const populateCsvcSpreadsheet = (data) => {
    if (!csvcSpreadsheetContainer) return;
    const floors = data.floors || [];

    const disAttr = currentUserReadOnly ? 'disabled' : '';
    const btnStyle = currentUserReadOnly ? 'display: none;' : '';

    let html = '';
    floors.forEach(floor => {
      let roomBlocksHtml = '';
      (floor.rooms || []).forEach(room => { roomBlocksHtml += buildRoomBlockHtml(room); });

      html += `
        <div class="csvc-floor-editor-card" data-floor-id="${floor.id}" data-floor-version="${floor.version}" style="margin-bottom: 32px;">
          <div style="background: linear-gradient(135deg, var(--primary-color), var(--primary-dark)); color: white; padding: 16px 20px; border-radius: 12px 12px 0 0; display: flex; align-items: center; justify-content: space-between; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/></svg>
              <input type="text" class="csvc-input-floor-name" ${disAttr} value="${escapeHtml(floor.name)}" placeholder="Tên khu vực..."
                style="font-size: 17px; font-weight: 700; color: white; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.35); border-radius: 6px; padding: 6px 12px; outline: none; flex: 1; min-width: 0; max-width: 420px;">
            </div>
            <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; ${btnStyle}">
              <button type="button" class="btn-csvc-add-room" style="background: rgba(255,255,255,0.25); color: white; border: 1px solid rgba(255,255,255,0.4); padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Thêm phòng mới
              </button>
              <button type="button" class="btn-delete-csvc-floor" style="background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.35); padding: 7px 10px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center;" title="Xóa khu vực này">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
          <div style="background: var(--bg-color); padding: 20px; border: 1px solid var(--border-color); border-top: none; border-radius: 0 0 12px 12px;">
            <div class="csvc-rooms-container">
              ${roomBlocksHtml}
            </div>
          </div>
        </div>
      `;
    });

    csvcSpreadsheetContainer.innerHTML = html;

    if (currentUserReadOnly) {
      if (btnCsvcAddArea) btnCsvcAddArea.style.display = 'none';
      setCsvcStatus('🔒 Chế độ chỉ đọc (Tài khoản Demo) — Không thể chỉnh sửa', 'var(--text-muted)');
      return;
    } else {
      if (btnCsvcAddArea) btnCsvcAddArea.style.display = '';
    }

    // Dùng querySelectorAll trả về mảng tĩnh các thẻ khu vực hiện có tại thời
    // điểm render này. Mỗi vòng lặp có biến `floorCard` RIÊNG (đóng gói qua
    // closure của forEach) nên nút "Thêm phòng" của khu vực nào chỉ thao tác
    // đúng .csvc-rooms-container của khu vực đó, không lẫn sang khu vực khác.
    csvcSpreadsheetContainer.querySelectorAll('.csvc-floor-editor-card').forEach(floorCard => {
      const floorNameInput = floorCard.querySelector('.csvc-input-floor-name');
      if (floorNameInput) {
        floorNameInput.addEventListener('input', () => {
          scheduleCsvcSave(() => saveCsvcFloorName(floorCard), floorCard);
        });
      }

      floorCard.querySelectorAll('.csvc-room-editor-block').forEach(rb => attachRoomBlockEvents(rb));

      const addRoomBtn = floorCard.querySelector('.btn-csvc-add-room');
      addRoomBtn.addEventListener('click', async () => {
        // Khoá nút trong lúc đang lưu -> bấm nhanh/bấm đúp không tạo ra
        // nhiều phòng cùng lúc (mỗi click chỉ tạo đúng 1 phòng).
        if (addRoomBtn.dataset.busy === '1') return;
        addRoomBtn.dataset.busy = '1';
        addRoomBtn.disabled = true;
        addRoomBtn.style.opacity = '0.6';
        addRoomBtn.style.cursor = 'not-allowed';
        try {
          const roomsContainer = floorCard.querySelector('.csvc-rooms-container');
          const newRoomHtml = buildRoomBlockHtml({ id: null, version: null, room_name: 'Phòng mới', items: [] });
          roomsContainer.insertAdjacentHTML('beforeend', newRoomHtml);
          const newRoomBlock = roomsContainer.lastElementChild;
          attachRoomBlockEvents(newRoomBlock);
          // Lưu ngay để có id thật (phòng trống vẫn cần id để sau này thêm thiết bị)
          await saveCsvcRoomName(newRoomBlock);
          // Đưa phòng mới vào tầm nhìn + focus vào ô tên để người dùng đặt tên ngay.
          // scrollIntoView không tồn tại ở mọi môi trường trình duyệt/webview
          // -> bọc an toàn để lỗi ở đây (nếu có) không làm mất tác dụng focus().
          if (typeof newRoomBlock.scrollIntoView === 'function') {
            try { newRoomBlock.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { /* bỏ qua */ }
          }
          const newRoomNameInput = newRoomBlock.querySelector('.csvc-input-room-name');
          if (newRoomNameInput) { newRoomNameInput.focus(); newRoomNameInput.select(); }
        } finally {
          addRoomBtn.dataset.busy = '0';
          addRoomBtn.disabled = false;
          addRoomBtn.style.opacity = '1';
          addRoomBtn.style.cursor = 'pointer';
        }
      });

      // ── Xóa khu vực: xóa cả phòng + thiết bị bên trong (CASCADE ở DB) nên
      //    luôn hỏi xác nhận trước, tránh xóa nhầm mất dữ liệu hàng loạt.
      const deleteFloorBtn = floorCard.querySelector('.btn-delete-csvc-floor');
      deleteFloorBtn.addEventListener('click', async () => {
        if (deleteFloorBtn.dataset.busy === '1') return;

        const idAttr = floorCard.getAttribute('data-floor-id');
        const versionAttr = floorCard.getAttribute('data-floor-version');
        if (!idAttr) { floorCard.remove(); return; }

        const floorNameNow = floorNameInput ? floorNameInput.value.trim() : 'khu vực này';
        const roomCount = floorCard.querySelectorAll('.csvc-room-editor-block').length;
        const itemCount = floorCard.querySelectorAll('.csvc-item-row').length;
        const confirmMsg = `Xóa khu vực "${floorNameNow}" sẽ xóa toàn bộ ${roomCount} phòng và ${itemCount} thiết bị bên trong.\n\nBạn có chắc chắn muốn xóa?`;
        if (!window.confirm(confirmMsg)) return;

        deleteFloorBtn.dataset.busy = '1';
        deleteFloorBtn.disabled = true;
        deleteFloorBtn.style.opacity = '0.6';
        try {
          const resp = await fetch('/api/csvc/floor/delete', {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ id: parseInt(idAttr), version: parseInt(versionAttr) }),
          });
          if (handleAuthFailure(resp)) return;
          const result = await resp.json();

          if (!result.ok && result.error === 'conflict') {
            setCsvcStatus('⚠ Khu vực vừa bị người khác sửa - đang tải lại...', 'var(--color-warning)');
            loadCsvcData(true);
            return;
          }

          floorCard.remove();
          setCsvcStatus('✔ Đã xóa khu vực', 'var(--color-success)');
          // Xóa xong ở tab Trang tính -> đồng bộ lại tab Thống kê CSVC luôn
          loadCsvcData(false).catch(() => {});
        } catch (err) {
          setCsvcStatus('❌ Không xoá được - lỗi kết nối', 'var(--color-danger)');
        } finally {
          deleteFloorBtn.dataset.busy = '0';
          deleteFloorBtn.disabled = false;
          deleteFloorBtn.style.opacity = '1';
        }
      });
    });
  };

  // ── Thêm khu vực (tầng) mới ──────────────────────────────────────────────
  const btnCsvcAddArea = document.getElementById('btn-csvc-add-area');
  if (btnCsvcAddArea) {
    btnCsvcAddArea.addEventListener('click', async () => {
      if (!csvcSpreadsheetContainer) return;
      // Khoá nút trong lúc đang tạo -> bấm nhanh/bấm đúp không tạo ra
      // nhiều khu vực cùng lúc (mỗi click chỉ tạo đúng 1 khu vực).
      if (btnCsvcAddArea.dataset.busy === '1') return;
      btnCsvcAddArea.dataset.busy = '1';
      btnCsvcAddArea.disabled = true;
      btnCsvcAddArea.style.opacity = '0.6';
      btnCsvcAddArea.style.cursor = 'not-allowed';

      try {
        const currentAreaCards = csvcSpreadsheetContainer.querySelectorAll('.csvc-floor-editor-card');
        const newAreaIndex = currentAreaCards.length + 1;
        const newAreaName = `Khu vực mới ${newAreaIndex}`;

        const resp = await fetch('/api/csvc/floor', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ id: null, name: newAreaName, version: null }),
        });
        if (handleAuthFailure(resp)) return;
        const result = await resp.json();
        if (result.ok) {
          await loadCsvcData(true);
          // Đưa khu vực mới vào tầm nhìn + focus + chọn sẵn tên mặc định để
          // người dùng gõ đè tên thật ngay, không cần tìm và bấm vào ô tên.
          const newFloorId = result.row.id;
          const newCard = csvcSpreadsheetContainer.querySelector(
            `.csvc-floor-editor-card[data-floor-id="${newFloorId}"]`
          );
          if (newCard) {
            if (typeof newCard.scrollIntoView === 'function') {
              try { newCard.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { /* bỏ qua */ }
            }
            const input = newCard.querySelector('.csvc-input-floor-name');
            if (input) { input.focus(); input.select(); }
          }
        } else {
          setCsvcStatus('❌ Không tạo được khu vực mới', 'var(--color-danger)');
        }
      } catch (err) {
        setCsvcStatus('❌ Lỗi kết nối', 'var(--color-danger)');
      } finally {
        btnCsvcAddArea.dataset.busy = '0';
        btnCsvcAddArea.disabled = false;
        btnCsvcAddArea.style.opacity = '1';
        btnCsvcAddArea.style.cursor = 'pointer';
      }
    });
  }

  // ── Trigger Click Events & Init ────────────────────────────────────────────
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => loadDashboardData(true));
  }

  if (btnAddRow) {
    btnAddRow.addEventListener('click', () => {
      createSpreadsheetRow(null, '', 0, 0, null);
    });
  }

  if (menuDashboard) {
    menuDashboard.addEventListener('click', (e) => { e.preventDefault(); switchTab('dashboard'); });
  }
  if (menuKhoa) {
    menuKhoa.addEventListener('click', (e) => { e.preventDefault(); switchTab('khoa'); });
  }
  if (menuCsvc) {
    menuCsvc.addEventListener('click', (e) => { e.preventDefault(); switchTab('csvc'); });
  }
  if (menuSpreadsheetKhoa) {
    menuSpreadsheetKhoa.addEventListener('click', (e) => { e.preventDefault(); switchTab('spreadsheet-khoa'); });
  }
  if (menuSpreadsheetNhansu) {
    menuSpreadsheetNhansu.addEventListener('click', (e) => { e.preventDefault(); switchTab('spreadsheet-nhansu'); });
  }
  if (menuSpreadsheetCsvc) {
    menuSpreadsheetCsvc.addEventListener('click', (e) => { e.preventDefault(); switchTab('spreadsheet-csvc'); });
  }

  if (csvcSearchInput) {
    csvcSearchInput.addEventListener('input', (e) => {
      csvcSearchQuery = e.target.value;
      if (csvcData) renderCsvcDisplay(csvcData);
    });
  }

  if (csvcFloorFilterBtns) {
    csvcFloorFilterBtns.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => selectCsvcFloorFilter(btn));
    });
  }

  if (headerTabThongKe) {
    headerTabThongKe.addEventListener('click', () => switchTab(lastDashboardTab));
  }
  if (headerTabNhapLieu) {
    headerTabNhapLieu.addEventListener('click', () => switchTab(lastSpreadsheetTab));
  }

  // ── Handlers chuyển đổi tab hệ đào tạo (Sinh viên Cao đẳng <-> Học sinh 9+) ──
  const btnDashboardCaoDang = document.getElementById('btnDashboardCaoDang');
  const btnDashboard9Plus = document.getElementById('btnDashboard9Plus');
  if (btnDashboardCaoDang && btnDashboard9Plus) {
    btnDashboardCaoDang.addEventListener('click', (e) => {
      e.preventDefault();
      currentDashboardDataset = 'khoa';
      setDashboardToggleState('khoa');
      isFetching = false;
      loadDashboardData(true);
    });
    btnDashboard9Plus.addEventListener('click', (e) => {
      e.preventDefault();
      currentDashboardDataset = 'hoc_sinh_9plus';
      setDashboardToggleState('hoc_sinh_9plus');
      isFetching = false;
      loadDashboardData(true);
    });
  }

  const btnSpreadsheetCaoDang = document.getElementById('btnSpreadsheetCaoDang');
  const btnSpreadsheet9Plus = document.getElementById('btnSpreadsheet9Plus');
  if (btnSpreadsheetCaoDang && btnSpreadsheet9Plus) {
    btnSpreadsheetCaoDang.addEventListener('click', (e) => {
      e.preventDefault();
      currentDataset = 'khoa';
      setSpreadsheetToggleState('khoa');
      applyDatasetLabels('khoa');
      loadSpreadsheetData();
    });
    btnSpreadsheet9Plus.addEventListener('click', (e) => {
      e.preventDefault();
      currentDataset = 'hoc_sinh_9plus';
      setSpreadsheetToggleState('hoc_sinh_9plus');
      applyDatasetLabels('hoc_sinh_9plus');
      loadSpreadsheetData();
    });
  }

  // Khoi dong ung dung: kiem tra phien truoc, sau do moi tai du lieu
    (async () => {
    const profileOk = await initUserProfile();
    if (!profileOk) return;

    // Tải dữ liệu ban đầu cho Dashboard
    loadDashboardData();

    // Polling định kỳ chỉ cập nhật Dashboard
    setInterval(() => {
      if (lastDashboardTab === 'dashboard' && viewDashboard.style.display !== 'none') {
        loadDashboardData();
      }
    }, 10000);
  })();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboardApp);
} else {
  initDashboardApp();
}
