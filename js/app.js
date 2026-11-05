(() => {
  "use strict";

  const VIEW_LABELS = {
    dashboard: "Panel General",
    alerts: "Alertas y Eventos",
    states: "Auditoría 5 Estados"
  };

  let servers = [
    { id: "srv-01", name: "srv-prod-api-01", ip: "10.24.1.10", region: "us-east-1", cpu: 46, ram: 62, status: "online", date: "2026-11-18", failover: true, notes: "Balanceador primario REST." },
    { id: "srv-02", name: "srv-db-replica-02", ip: "10.24.1.24", region: "us-east-1", cpu: 88, ram: 81, status: "warning", date: "2026-11-12", failover: true, notes: "Revisar pico de IOPS nocturno." },
    { id: "srv-03", name: "srv-cache-redis-01", ip: "10.24.2.09", region: "mx-central-1", cpu: 31, ram: 48, status: "online", date: "2026-11-25", failover: true, notes: "Clúster de sesiones en memoria." },
    { id: "srv-04", name: "srv-worker-queue-04", ip: "172.16.8.14", region: "eu-west-1", cpu: 54, ram: 67, status: "online", date: "2026-12-01", failover: false, notes: "Procesamiento asíncrono de lotes." },
    { id: "srv-05", name: "srv-edge-proxy-mx", ip: "10.24.2.50", region: "mx-central-1", cpu: 19, ram: 35, status: "maintenance", date: "2026-11-08", failover: true, notes: "En rotación de certificados TLS." },
    { id: "srv-06", name: "srv-k8s-node-07", ip: "172.16.8.99", region: "eu-west-1", cpu: 63, ram: 72, status: "online", date: "2026-11-29", failover: true, notes: "Nodo de contenedores stateless." },
    { id: "srv-07", name: "srv-auth-sso-01", ip: "10.24.1.77", region: "us-east-1", cpu: 39, ram: 51, status: "online", date: "2026-12-04", failover: true, notes: "Servicio crítico OAuth2 / JWT." }
  ];

  const state = {
    currentView: "dashboard",
    previousView: "Inicio de sesión",
    search: "",
    statusFilter: "all",
    page: 1,
    perPage: 4,
    pendingDeleteId: null,
    lastFocused: null
  };

  // Referencias al DOM
  const tbody = document.getElementById("server-tbody");
  const searchInput = document.getElementById("search-server");
  const filterSelect = document.getElementById("filter-status");
  const prevBtn = document.getElementById("prev-page");
  const nextBtn = document.getElementById("next-page");
  const pageIndicator = document.getElementById("page-indicator");
  const paginationSummary = document.getElementById("pagination-summary");
  const activeKpi = document.getElementById("kpi-active-count");

  const sidebar = document.getElementById("sidebar");
  const sidebarBackdrop = document.getElementById("sidebar-backdrop");
  const menuToggle = document.getElementById("menu-toggle");

  const drawer = document.getElementById("config-drawer");
  const drawerBackdrop = document.getElementById("drawer-backdrop");
  const configForm = document.getElementById("config-form");
  const drawerSaveBtn = document.getElementById("drawer-save");

  const modal = document.getElementById("confirm-modal");
  const modalBackdrop = document.getElementById("modal-backdrop");
  const modalConfirmBtn = document.getElementById("modal-confirm");
  const modalServerName = document.getElementById("modal-server-name");
  const toastEl = document.getElementById("toast");

  /* ==================== UTILIDADES UX (LOADING & TOAST) ==================== */
  function setButtonLoading(button, isLoading, loadingLabel, defaultLabel) {
    const textSpan = button.querySelector(".btn-text");
    button.classList.toggle("is-loading", isLoading);
    button.disabled = isLoading;
    button.setAttribute("aria-busy", String(isLoading));
    if (textSpan) {
      textSpan.textContent = isLoading ? loadingLabel : defaultLabel;
    }
  }

  let toastTimer = null;
  function showToast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, 3000);
  }

  /* ==================== MODO OSCURO NATIVO + TOGGLE ==================== */
  const themeToggle = document.getElementById("theme-toggle");
  const themeLabel = document.getElementById("theme-label");
  const savedTheme = localStorage.getItem("cloudpulse-theme");

  if (savedTheme) {
    document.documentElement.setAttribute("data-theme", savedTheme);
  }

  function isDarkActive() {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr) return attr === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function syncThemeLabel() {
    themeLabel.textContent = isDarkActive() ? "Modo Claro" : "Modo Oscuro";
  }
  syncThemeLabel();

  themeToggle.addEventListener("click", () => {
    const nextTheme = isDarkActive() ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("cloudpulse-theme", nextTheme);
    syncThemeLabel();
  });

  /* ==================== ZONA 1: NAVEGACIÓN SPA Y BREADCRUMBS ==================== */
  function switchView(targetView) {
    if (!VIEW_LABELS[targetView] || targetView === state.currentView) return;

    state.previousView = VIEW_LABELS[state.currentView];
    state.currentView = targetView;

    document.querySelectorAll(".spa-view").forEach((sec) => {
      sec.hidden = sec.id !== `view-${targetView}`;
    });

    document.querySelectorAll(".nav-link").forEach((btn) => {
      const active = btn.dataset.view === targetView;
      btn.classList.toggle("is-active", active);
      if (active) {
        btn.setAttribute("aria-current", "page");
      } else {
        btn.removeAttribute("aria-current");
      }
    });

    document.getElementById("breadcrumb-current").textContent = VIEW_LABELS[targetView];
    document.getElementById("breadcrumb-origin").textContent = `Vienes de: ${state.previousView}`;
    closeMobileSidebar();
  }

  document.querySelectorAll(".nav-link").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  document.querySelector("[data-nav='dashboard']").addEventListener("click", (e) => {
    e.preventDefault();
    switchView("dashboard");
  });

  document.querySelector(".jump-to-dashboard").addEventListener("click", () => {
    switchView("dashboard");
  });

  function openMobileSidebar() {
    sidebar.classList.add("is-open");
    sidebarBackdrop.hidden = false;
    requestAnimationFrame(() => sidebarBackdrop.classList.add("is-active"));
    menuToggle.setAttribute("aria-expanded", "true");
  }

  function closeMobileSidebar() {
    sidebar.classList.remove("is-open");
    sidebarBackdrop.classList.remove("is-active");
    menuToggle.setAttribute("aria-expanded", "false");
    setTimeout(() => { sidebarBackdrop.hidden = true; }, 220);
  }

  menuToggle.addEventListener("click", () => {
    const expanded = menuToggle.getAttribute("aria-expanded") === "true";
    expanded ? closeMobileSidebar() : openMobileSidebar();
  });
  sidebarBackdrop.addEventListener("click", closeMobileSidebar);

  /* ==================== ZONA 2: TABLA, FILTROS Y PAGINACIÓN ==================== */
  function getStatusBadge(status) {
    const map = {
      online: { cls: "badge-ok", text: "Operativo" },
      warning: { cls: "badge-warn", text: "Degradado" },
      maintenance: { cls: "badge-danger", text: "Mantenimiento" }
    };
    const item = map[status] || map.online;
    return `<span class="badge ${item.cls}">${item.text}</span>`;
  }

  function renderTable() {
    const filtered = servers.filter((srv) => {
      const matchesQuery =
        srv.name.toLowerCase().includes(state.search) ||
        srv.ip.toLowerCase().includes(state.search);
      const matchesStatus = state.statusFilter === "all" || srv.status === state.statusFilter;
      return matchesQuery && matchesStatus;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / state.perPage));
    if (state.page > totalPages) state.page = totalPages;

    const start = (state.page - 1) * state.perPage;
    const pageItems = filtered.slice(start, start + state.perPage);

    tbody.innerHTML = pageItems.length
      ? pageItems.map((srv) => `
        <tr>
          <td><strong>${srv.name}</strong></td>
          <td><code>${srv.ip}</code></td>
          <td>${srv.region}</td>
          <td>CPU ${srv.cpu}% · RAM ${srv.ram}%</td>
          <td>${getStatusBadge(srv.status)}</td>
          <td>
            <div class="action-cell">
              <button type="button" class="btn btn-ghost btn-config" data-id="${srv.id}" aria-label="Configurar ${srv.name}">Configurar</button>
              <button type="button" class="btn btn-danger btn-delete" data-id="${srv.id}" aria-label="Eliminar ${srv.name}">Eliminar</button>
            </div>
          </td>
        </tr>
      `).join("")
      : `<tr><td colspan="6">No se encontraron instancias con los criterios seleccionados.</td></tr>`;

    pageIndicator.textContent = `Página ${state.page} de ${totalPages}`;
    paginationSummary.textContent = `${filtered.length} instancia(s) encontrada(s)`;
    prevBtn.disabled = state.page <= 1;
    nextBtn.disabled = state.page >= totalPages;

    const onlineCount = servers.filter((s) => s.status !== "maintenance").length;
    activeKpi.textContent = `${onlineCount} / ${servers.length}`;
  }

  searchInput.addEventListener("input", (e) => {
    state.search = e.target.value.trim().toLowerCase();
    state.page = 1;
    renderTable();
  });

  filterSelect.addEventListener("change", (e) => {
    state.statusFilter = e.target.value;
    state.page = 1;
    renderTable();
  });

  prevBtn.addEventListener("click", () => {
    if (state.page > 1) { state.page--; renderTable(); }
  });

  nextBtn.addEventListener("click", () => {
    state.page++;
    renderTable();
  });

  tbody.addEventListener("click", (e) => {
    const configBtn = e.target.closest(".btn-config");
    const deleteBtn = e.target.closest(".btn-delete");
    if (configBtn) openDrawer(configBtn.dataset.id, configBtn);
    if (deleteBtn) openModal(deleteBtn.dataset.id, deleteBtn);
  });

  /* ==================== ZONA 3: DRAWER DE CONFIGURACIÓN ==================== */
  function openDrawer(serverId, triggerEl) {
    const srv = servers.find((s) => s.id === serverId);
    if (!srv) return;
    state.lastFocused = triggerEl;

    document.getElementById("cfg-id").value = srv.id;
    document.getElementById("cfg-name").value = srv.name;
    document.getElementById("cfg-region").value = srv.region;
    document.getElementById("cfg-date").value = srv.date;
    document.getElementById("cfg-failover").checked = srv.failover;
    document.getElementById("cfg-notes").value = srv.notes;
    document.getElementById("drawer-subtitle").textContent = `Editando nodo ${srv.ip}`;

    drawer.hidden = false;
    drawerBackdrop.hidden = false;
    requestAnimationFrame(() => {
      drawer.classList.add("is-open");
      drawerBackdrop.classList.add("is-active");
      document.getElementById("cfg-name").focus();
    });
  }

  function closeDrawer() {
    if (drawer.hidden) return;
    drawer.classList.remove("is-open");
    drawerBackdrop.classList.remove("is-active");
    setTimeout(() => {
      drawer.hidden = true;
      drawerBackdrop.hidden = true;
      if (state.lastFocused) state.lastFocused.focus();
    }, 300);
  }

  document.getElementById("drawer-close").addEventListener("click", closeDrawer);
  document.getElementById("drawer-cancel").addEventListener("click", closeDrawer);
  drawerBackdrop.addEventListener("click", closeDrawer);

  configForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (drawerSaveBtn.disabled) return;

    setButtonLoading(drawerSaveBtn, true, "Guardando...", "Guardar configuración");

    setTimeout(() => {
      const id = document.getElementById("cfg-id").value;
      const target = servers.find((s) => s.id === id);
      if (target) {
        target.name = document.getElementById("cfg-name").value.trim();
        target.region = document.getElementById("cfg-region").value;
        target.date = document.getElementById("cfg-date").value;
        target.failover = document.getElementById("cfg-failover").checked;
        target.notes = document.getElementById("cfg-notes").value.trim();
      }
      setButtonLoading(drawerSaveBtn, false, "Guardando...", "Guardar configuración");
      renderTable();
      closeDrawer();
      showToast("Parámetros actualizados correctamente.");
    }, 900);
  });

  /* ==================== ZONA 3: MODAL DESTRUCTIVO ==================== */
  function openModal(serverId, triggerEl) {
    const srv = servers.find((s) => s.id === serverId);
    if (!srv) return;
    state.pendingDeleteId = srv.id;
    state.lastFocused = triggerEl;
    modalServerName.textContent = `${srv.name} (${srv.ip})`;

    modal.hidden = false;
    modalBackdrop.hidden = false;
    requestAnimationFrame(() => {
      modal.classList.add("is-open");
      modalBackdrop.classList.add("is-active");
      document.getElementById("modal-cancel").focus();
    });
  }

  function closeModal() {
    if (modal.hidden) return;
    modal.classList.remove("is-open");
    modalBackdrop.classList.remove("is-active");
    setTimeout(() => {
      modal.hidden = true;
      modalBackdrop.hidden = true;
      state.pendingDeleteId = null;
      if (state.lastFocused) state.lastFocused.focus();
    }, 220);
  }

  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", closeModal);

  modalConfirmBtn.addEventListener("click", () => {
    if (!state.pendingDeleteId || modalConfirmBtn.disabled) return;

    setButtonLoading(modalConfirmBtn, true, "Eliminando...", "Sí, eliminar instancia");

    setTimeout(() => {
      const deleted = servers.find((s) => s.id === state.pendingDeleteId);
      servers = servers.filter((s) => s.id !== state.pendingDeleteId);
      setButtonLoading(modalConfirmBtn, false, "Eliminando...", "Sí, eliminar instancia");
      renderTable();
      closeModal();
      showToast(`Instancia ${deleted ? deleted.name : ""} eliminada.`);
    }, 950);
  });

  /* ==================== TELEMETRÍA Y DEMO ASÍNCRONO ==================== */
  const refreshBtn = document.getElementById("refresh-metrics");
  refreshBtn.addEventListener("click", () => {
    setButtonLoading(refreshBtn, true, "Sincronizando...", "Actualizar telemetría");
    setTimeout(() => {
      document.querySelectorAll("#cpu-chart .bar-fill").forEach((bar) => {
        const val = Math.floor(Math.random() * 55) + 30;
        bar.style.height = `${val}%`;
        bar.classList.toggle("is-high", val >= 72);
      });
      setButtonLoading(refreshBtn, false, "Sincronizando...", "Actualizar telemetría");
      showToast("Métricas del clúster sincronizadas.");
    }, 800);
  });

  const asyncDemoBtn = document.getElementById("trigger-async-demo");
  asyncDemoBtn.addEventListener("click", () => {
    setButtonLoading(asyncDemoBtn, true, "Procesando...", "Probar carga de 1.5s");
    setTimeout(() => {
      setButtonLoading(asyncDemoBtn, false, "Procesando...", "Probar carga de 1.5s");
      showToast("Prueba de estado Loading completada.");
    }, 1500);
  });

  /* ==================== 5D COMPORTAMIENTO: TECLA ESCAPE ==================== */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!modal.hidden) closeModal();
      else if (!drawer.hidden) closeDrawer();
      else if (sidebar.classList.contains("is-open")) closeMobileSidebar();
    }
  });

  renderTable();
})();