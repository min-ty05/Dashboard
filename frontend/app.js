document.addEventListener('DOMContentLoaded', () => {
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
  const menuSpreadsheet = document.getElementById('menu-spreadsheet');

  const liDashboard = document.getElementById('li-dashboard');
  const liKhoa = document.getElementById('li-khoa');
  const liSpreadsheet = document.getElementById('li-spreadsheet');

  const viewDashboard = document.getElementById('view-dashboard');
  const viewKhoa = document.getElementById('view-khoa');
  const viewSpreadsheet = document.getElementById('view-spreadsheet');

  // Spreadsheet Specific Elements
  const spreadsheetTableBody = document.getElementById('spreadsheet-table-body');
  const btnAddRow = document.getElementById('btn-add-row');
  const btnSaveSpreadsheet = document.getElementById('btn-save-spreadsheet');
  const spreadsheetStatus = document.getElementById('spreadsheet-status');
  const dsSelect = document.getElementById('ds-select');

  // ── Dataset Registry ────────────────────────────────────────────────────────
  // To add a new sheet in the future: add one entry here, add a matching JSON
  // file under /data, and a matching branch in server.py's /api/save_data route.
  // Everything else (rendering, validation, save flow) works off this config.
  const DATASETS = {
    khoa: {
      jsonFile: 'student_statistics.json',
      colName: 'Tên khoa',
      colB: 'Đăng ký đầu kỳ (A)',
      colC: 'Còn học (B)',
      colD: 'Thôi học (A - B)',
      colE: 'Tỷ lệ còn học %',
      mode: 'ratio', // colD = colB - colC, colE = % of colC over colB
      kpi1: 'Tỉ lệ học sinh còn học',
      kpi2: 'Tổng đăng ký đầu kỳ',
      kpi3: 'Tổng số còn học',
      kpi4: 'Tổng thôi học (Dự tính)',
      toRows: (data) => (data.departments || []).map(d => [d.name, d.registered, d.active])
    },
    nhansu: {
      jsonFile: 'staff_statistics.json',
      colName: 'Bộ phận',
      colB: 'Nam',
      colC: 'Nữ',
      colD: 'Tổng số',
      colE: null, // hidden for this dataset
      mode: 'sum', // colD = colB + colC
      kpi1: 'Tổng nhân sự',
      kpi2: 'Tổng Nam',
      kpi3: 'Tổng Nữ',
      kpi4: 'Tổng cộng nhân sự',
      toRows: (data) => (data.departments || []).map(d => [d.name, d.male, d.female])
    }
  };
  let currentDataset = 'khoa';

  // Profile Header Elements
  const sessionName = sessionStorage.getItem('username') || 'Khách';
  const sessionRole = sessionStorage.getItem('role') || 'Người xem';
  const headerUserName = document.getElementById('headerUserName');
  const headerUserRole = document.getElementById('headerUserRole');
  const headerUserAvatar = document.getElementById('headerUserAvatar');

  if (headerUserName) headerUserName.innerText = sessionName;
  if (headerUserRole) headerUserRole.innerText = sessionRole;

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

  // ── State Variables ────────────────────────────────────────────────────────
  let studentChart = null;
  let genderChart = null;
  let isFetching = false;
  let currentData = null;
  let lastDataString = ""; 

  // ── Helper Functions ───────────────────────────────────────────────────────
  const formatNum = (num) => num.toLocaleString('vi-VN');

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

  // Handle Logout
  if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
      e.preventDefault();
      sessionStorage.removeItem('isLoggedIn');
      sessionStorage.removeItem('username');
      sessionStorage.removeItem('role');
      window.location.href = 'login.html';
    });
  }

  // ── Chart.js Setup ─────────────────────────────────────────────────────────
  const updateChart = (active, dropped, percent) => {
    const ctxEl = document.getElementById('studentChart');
    if (!ctxEl) return;
    const ctx = ctxEl.getContext('2d');
    
    chartPercentage.innerText = `${percent}%`;
    legendActiveVal.innerText = formatNum(active);
    legendDroppedVal.innerText = formatNum(dropped);

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

  const initGenderChart = (male = 9, female = 10) => {
    const ctxEl = document.getElementById('genderChart');
    if (!ctxEl) return;
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

  // ── Tab Navigation Switching ───────────────────────────────────────────────
  const switchTab = (tab) => {
    [liDashboard, liKhoa, liSpreadsheet].forEach(li => {
      if (li) li.classList.remove('active');
    });
    [viewDashboard, viewKhoa, viewSpreadsheet].forEach(v => {
      if (v) v.style.display = 'none';
    });

    if (tab === 'dashboard') {
      if (liDashboard) liDashboard.classList.add('active');
      if (viewDashboard) viewDashboard.style.display = 'block';
    } else if (tab === 'khoa') {
      if (liKhoa) liKhoa.classList.add('active');
      if (viewKhoa) viewKhoa.style.display = 'block';
      setTimeout(() => loadKhoaData(), 50);
    } else if (tab === 'spreadsheet') {
      if (liSpreadsheet) liSpreadsheet.classList.add('active');
      if (viewSpreadsheet) viewSpreadsheet.style.display = 'block';
      loadSpreadsheetData();
    }
  };

  // ── Spreadsheet Operations & Calculation Formulas ──────────────────────────

  // Apply a dataset's column labels / KPI labels to the DOM and show/hide the
  // ratio column (colE) depending on whether the dataset uses it.
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

    const colE = document.getElementById('col-th-e');
    if (colE) colE.style.display = cfg.colE ? '' : 'none';

    setText('calc-kpi1-label', cfg.kpi1);
    setText('calc-kpi2-label', cfg.kpi2);
    setText('calc-kpi3-label', cfg.kpi3);
    setText('calc-kpi4-label', cfg.kpi4);
  };

  // Returns true if all rows pass validation, false otherwise
  const calculateSpreadsheetSummary = () => {
    if (!spreadsheetTableBody) return true;
    const cfg = DATASETS[currentDataset];
    let totalB = 0;
    let totalC = 0;
    let totalD = 0;
    let hasError = false;

    // Only select actual data rows (not error message rows)
    const rows = spreadsheetTableBody.querySelectorAll('tr[data-data-row]');
    rows.forEach(row => {
      const bInput = row.querySelector('.spreadsheet-input-registered');
      const cInput = row.querySelector('.spreadsheet-input-active');
      const dText = row.querySelector('.spreadsheet-dropped-text');
      const pctText = row.querySelector('.spreadsheet-pct-text');
      // Error span is in the linked error row
      const errorMsg = row._errorRow ? row._errorRow.querySelector('.row-error-msg') : null;

      if (!bInput || !cInput) return;

      const bVal = parseInt(bInput.value) || 0;
      const cVal = parseInt(cInput.value) || 0;

      // ── Validation only applies in "ratio" mode (col C can't exceed col B) ──
      const ERR_BORDER = '2px solid var(--color-danger)';
      const OK_BORDER = '1px solid var(--border-color)';

      if (cfg.mode === 'ratio' && cVal > bVal) {
        bInput.style.border = ERR_BORDER;
        cInput.style.border = ERR_BORDER;
        if (errorMsg) {
          errorMsg.innerText = '⚠ Số còn học (' + cVal.toLocaleString('vi-VN') + ') không được lớn hơn số đăng ký (' + bVal.toLocaleString('vi-VN') + ')';
          errorMsg.style.display = 'block';
        }
        dText.innerText = '—';
        if (pctText) pctText.innerText = '—';
        hasError = true;
        return;
      } else {
        bInput.style.border = OK_BORDER;
        cInput.style.border = OK_BORDER;
        if (errorMsg) errorMsg.style.display = 'none';
      }

      const dVal = cfg.mode === 'ratio' ? (bVal - cVal) : (bVal + cVal);
      dText.innerText = formatNum(dVal);
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

    return !hasError;
  };

  const populateSpreadsheet = (data) => {
    if (!spreadsheetTableBody) return;
    spreadsheetTableBody.innerHTML = '';

    const cfg = DATASETS[currentDataset];
    const rows = cfg.toRows(data);
    rows.forEach(([name, b, c]) => {
      createSpreadsheetRow(name, b, c);
    });

    calculateSpreadsheetSummary();
  };

  const createSpreadsheetRow = (name = '', registered = 0, active = 0) => {
    if (!spreadsheetTableBody) return;

    const cfg = DATASETS[currentDataset];
    let dropped = cfg.mode === 'ratio' ? (registered - active) : (registered + active);
    if (cfg.mode === 'ratio' && dropped < 0) dropped = 0;
    const pct = registered > 0 ? Math.round((active / registered) * 100) : 0;

    // ── Data row (marked with data-data-row so querySelectorAll picks exactly these) ──
    const dataRow = document.createElement('tr');
    dataRow.setAttribute('data-data-row', 'true');
    dataRow.innerHTML = `
      <td style="padding: 6px 8px;">
        <input type="text" class="spreadsheet-input-name"
          style="width: 90%; padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 6px; outline: none; font-family: inherit; font-size: inherit;"
          value="${name}" placeholder="Tên khoa...">
      </td>
      <td style="padding: 6px 8px;">
        <input type="number" class="spreadsheet-input-registered"
          style="width: 130px; padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 6px; outline: none; font-family: inherit; font-size: inherit;"
          value="${registered}" min="0">
      </td>
      <td style="padding: 6px 8px;">
        <input type="number" class="spreadsheet-input-active"
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
          style="background: none; border: none; color: var(--color-danger); cursor: pointer; padding: 4px;"
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

    // ── Error row (shown below the data row when validation fails) ──
    const errorRow = document.createElement('tr');
    errorRow.setAttribute('data-error-row', 'true');
    errorRow.innerHTML = `
      <td colspan="6" style="padding: 0 8px 6px 8px;">
        <span class="row-error-msg"
          style="display: none; font-size: 12px; color: var(--color-danger); font-weight: 500;">
        </span>
      </td>
    `;

    // Link error elements to the data row for easy access
    dataRow._errorRow = errorRow;

    // Real-time recalculation on input change
    const regInput = dataRow.querySelector('.spreadsheet-input-registered');
    const actInput = dataRow.querySelector('.spreadsheet-input-active');

    [regInput, actInput].forEach(input => {
      input.addEventListener('input', () => calculateSpreadsheetSummary());
    });

    // Delete both rows together
    dataRow.querySelector('.btn-delete-row').addEventListener('click', () => {
      errorRow.remove();
      dataRow.remove();
      calculateSpreadsheetSummary();
    });

    spreadsheetTableBody.appendChild(dataRow);
    spreadsheetTableBody.appendChild(errorRow);
  };

  const showSpreadsheetStatus = (msg, styleStr) => {
    if (!spreadsheetStatus) return;
    spreadsheetStatus.innerText = msg;
    spreadsheetStatus.style = styleStr;
    spreadsheetStatus.style.display = 'inline';
    setTimeout(() => {
      spreadsheetStatus.style.display = 'none';
    }, 4000);
  };

  // ── Save Spreadsheet Data ─────────────────────────────────────────────────
  if (btnSaveSpreadsheet) {
    btnSaveSpreadsheet.addEventListener('click', async () => {
      // Run validation first — block save if any row is invalid
      const isValid = calculateSpreadsheetSummary();
      if (!isValid) {
        showSpreadsheetStatus('❌ Vui lòng sửa các ô lỗi trước khi lưu!', 'color: var(--color-danger);');
        return;
      }

      btnSaveSpreadsheet.disabled = true;
      btnSaveSpreadsheet.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Đang lưu…';

      const departments = [];
      const dataRows = spreadsheetTableBody.querySelectorAll('tr[data-data-row]');
      dataRows.forEach(row => {
        const nameInput = row.querySelector('.spreadsheet-input-name');
        const regInput  = row.querySelector('.spreadsheet-input-registered');
        const actInput  = row.querySelector('.spreadsheet-input-active');

        if (!nameInput || !regInput || !actInput) return;

        const name = nameInput.value.trim();
        if (!name) return;

        departments.push({
          name: name,
          registered: parseInt(regInput.value) || 0,
          active: parseInt(actInput.value) || 0
        });
      });

      try {
        const resp = await fetch('/api/save_data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataset: currentDataset, departments: departments })
        });
        const json = await resp.json();

        if (json.ok) {
          showSpreadsheetStatus('✔ Đã lưu thành công!', 'color: var(--color-success);');
          loadSpreadsheetData(true);
          if (currentDataset === 'nhansu') loadKhoaData();
          if (currentDataset === 'khoa') loadData(true);
        } else {
          showSpreadsheetStatus('❌ Lỗi: ' + json.error, 'color: var(--color-danger);');
        }
      } catch (err) {
        showSpreadsheetStatus('❌ Lỗi kết nối máy chủ', 'color: var(--color-danger);');
      } finally {
        btnSaveSpreadsheet.disabled = false;
        btnSaveSpreadsheet.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Lưu thay đổi
        `;
      }
    });
  }

  // ── Render Dashboard DOM ───────────────────────────────────────────────────
  const renderDashboard = (data) => {
    const { summary, departments } = data;
    
    const active = summary.active;
    const registered = summary.registered;
    const dropped = summary.dropped || (registered - active);
    const activePercent = Math.round((active / registered) * 100);

    // 1. KPI Card
    kpiValue.innerText = `${formatNum(active)} / ${formatNum(registered)}`;
    kpiBadge.innerText = `${activePercent}%`;
    kpiBadge.className = 'kpi-card-badge';
    kpiBadge.classList.add(getColorClass(activePercent));

    // 2. Chart
    updateChart(active, dropped, activePercent);

    // 3. Table
    tableBody.innerHTML = '';
    
    if (departments && departments.length > 0) {
      departments.forEach(dept => {
        const deptActive = dept.active;
        const deptReg = dept.registered;
        const deptDropped = dept.dropped !== undefined ? dept.dropped : (deptReg - deptActive);
        const deptPercent = Math.round((deptActive / deptReg) * 100);
        
        const row = document.createElement('tr');
        const deptRateClass = getColorClass(deptPercent);
        let badgeColor = '';
        if (deptRateClass === 'badge-success') badgeColor = 'color: var(--color-success); background-color: var(--color-success-bg);';
        else if (deptRateClass === 'badge-warning') badgeColor = 'color: var(--color-warning); background-color: var(--color-warning-bg);';
        else badgeColor = 'color: var(--color-danger); background-color: var(--color-danger-bg);';

        row.innerHTML = `
          <td><span class="dept-name">${dept.name}</span></td>
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
  };

  // ── Fetch/Load Data ────────────────────────────────────────────────────────
  const loadData = async (isManual = false) => {
    if (isFetching) return;
    isFetching = true;
    
    if (btnRefresh) btnRefresh.classList.add('spinning');

    try {
      const response = await fetch(`../data/student_statistics.json?t=${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      const dataString = JSON.stringify(data);
      const dataChanged = dataString !== lastDataString;
      
      if (dataChanged || isManual) {
        lastDataString = dataString;
        currentData = data;
        renderDashboard(data);
        // Keep the spreadsheet tab in sync only while it's showing the same
        // dataset as the dashboard (khoa). Other datasets load independently.
        if (currentDataset === 'khoa') populateSpreadsheet(data);
      }
      
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      if (syncTime) syncTime.innerText = timeStr;
      
      const syncDot = document.querySelector('.sync-dot');
      if (syncDot) syncDot.style.backgroundColor = 'var(--color-success)';

    } catch (error) {
      console.error('Failed to load student statistics:', error);
      if (syncTime) syncTime.innerText = 'Lỗi đồng bộ';
      const syncDot = document.querySelector('.sync-dot');
      if (syncDot) syncDot.style.backgroundColor = 'var(--color-danger)';
    } finally {
      setTimeout(() => {
        if (btnRefresh) btnRefresh.classList.remove('spinning');
        isFetching = false;
      }, 500);
    }
  };

  // ── Load data for the currently selected spreadsheet dataset ───────────────
  const loadSpreadsheetData = async (isManual = false) => {
    const cfg = DATASETS[currentDataset];
    if (!cfg) return;

    // The 'khoa' dataset shares data with the dashboard, so reuse it instead
    // of fetching twice.
    if (currentDataset === 'khoa' && currentData) {
      populateSpreadsheet(currentData);
      return;
    }

    try {
      const response = await fetch(`../data/${cfg.jsonFile}?t=${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      populateSpreadsheet(data);
    } catch (error) {
      console.error(`Failed to load ${cfg.jsonFile}:`, error);
      if (spreadsheetTableBody) {
        spreadsheetTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--color-danger); padding:24px;">
          Không tải được file data/${cfg.jsonFile}. Kiểm tra file này đã tồn tại trong thư mục data/ chưa.
        </td></tr>`;
      }
      showSpreadsheetStatus(`❌ Không tải được data/${cfg.jsonFile}`, 'color: var(--color-danger);');
    }
  };

  // ── Dataset Selector ─────────────────────────────────────────────────────────
  if (dsSelect) {
    dsSelect.addEventListener('change', () => {
      currentDataset = dsSelect.value;
      applyDatasetLabels(currentDataset);
      loadSpreadsheetData(true);
    });
    applyDatasetLabels(currentDataset);
  }

  // ── Render Khoa Tab (staff/gender view) from staff_statistics.json ─────────
  let lastStaffDataString = "";

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
              <td><span class="dept-name">${d.name}</span></td>
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

  const loadKhoaData = async () => {
    try {
      const response = await fetch(`../data/staff_statistics.json?t=${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      const dataString = JSON.stringify(data);
      if (dataString !== lastStaffDataString) {
        lastStaffDataString = dataString;
        renderKhoaView(data);
      }
    } catch (error) {
      console.error('Failed to load staff statistics:', error);
      const tbody = document.getElementById('khoaStaffTableBody');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--color-danger); padding:24px;">Không tải được data/staff_statistics.json</td></tr>`;
      }
    }
  };

  // ── Trigger Click Events & Init ────────────────────────────────────────────
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => loadData(true));
  }

  if (btnAddRow) {
    btnAddRow.addEventListener('click', () => {
      createSpreadsheetRow('', 0, 0);
      calculateSpreadsheetSummary();
    });
  }

  if (menuDashboard) {
    menuDashboard.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('dashboard');
    });
  }

  if (menuKhoa) {
    menuKhoa.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('khoa');
    });
  }

  if (menuSpreadsheet) {
    menuSpreadsheet.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('spreadsheet');
    });
  }

  // Run initial data load
  loadData();

  // Auto-sync polling every 10 seconds to reduce server load
  setInterval(() => {
    loadData();
  }, 10000);
});