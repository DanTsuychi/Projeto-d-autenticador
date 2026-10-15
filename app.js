/* ========================================================
   PROJETO D — APLICAÇÃO PRINCIPAL (app.js)
   ======================================================== */

(function () {
  // 1. DADOS DE CONFIGURAÇÃO E INICIALIZAÇÃO
  const config = window.PROJETO_D_CONFIG || {};
  if (!config.supabaseUrl || !config.supabaseKey) {
    showGlobalError("Configure a Project URL e a chave pública em config.js antes de usar o site.");
    return;
  }

  // Inicializa o cliente do Supabase
  const supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);

  // 2. REFERÊNCIAS DO DOM
  const elements = {
    authSection: document.getElementById("auth-section"),
    dashboardSection: document.getElementById("dashboard-section"),
    loginForm: document.getElementById("login-form"),
    signupForm: document.getElementById("signup-form"),
    authError: document.getElementById("auth-error"),
    tabLogin: document.getElementById("tab-login"),
    tabSignup: document.getElementById("tab-signup"),
    
    // Views do Dashboard
    guestView: document.getElementById("guest-view"),
    adminView: document.getElementById("admin-view"),
    userDisplayName: document.getElementById("user-display-name"),
    logoutBtn: document.getElementById("logout-btn"),

    // Painel do Convidado
    claimForm: document.getElementById("claim-form"),
    claimCodeInput: document.getElementById("claim-code-input"),
    ticketContainer: document.getElementById("ticket-container"),
    qrCodeCanvas: document.getElementById("qrcode-canvas"),
    ticketStatusBadge: document.getElementById("ticket-status-badge"),
    guestNameDisplay: document.getElementById("guest-name-display"),

    // Painel do Admin
    createTicketForm: document.getElementById("create-ticket-form"),
    guestNameInput: document.getElementById("guest-name-input"),
    createdCodeDisplay: document.getElementById("created-code-display"),
    adminTicketsTable: document.getElementById("admin-tickets-table"),
    manualRedeemForm: document.getElementById("manual-redeem-form"),
    redeemInput: document.getElementById("redeem-input"),
    redeemResult: document.getElementById("redeem-result")
  };

  // 3. LISTENERS E INICIALIZAÇÃO
  document.addEventListener("DOMContentLoaded", initApp);

  async function initApp() {
    setupEventListeners();
    checkSession();
  }

  function setupEventListeners() {
    // Alternância entre as abas Entrar / Criar Conta
    if (elements.tabLogin && elements.tabSignup) {
      elements.tabLogin.addEventListener("click", () => switchAuthTab("login"));
      elements.tabSignup.addEventListener("click", () => switchAuthTab("signup"));
    }

    // Formulários de Autenticação
    if (elements.loginForm) elements.loginForm.addEventListener("submit", handleLogin);
    if (elements.signupForm) elements.signupForm.addEventListener("submit", handleSignup);
    if (elements.logoutBtn) elements.logoutBtn.addEventListener("click", handleLogout);

    // Ações do Convidado
    if (elements.claimForm) elements.claimForm.addEventListener("submit", handleClaimTicket);

    // Ações do Administrador
    if (elements.createTicketForm) elements.createTicketForm.addEventListener("submit", handleCreateTicket);
    if (elements.manualRedeemForm) elements.manualRedeemForm.addEventListener("submit", handleManualRedeem);

    // Escuta alterações de sessão no Supabase
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        loadUserProfile();
      } else {
        showAuthSection();
      }
    });
  }

  // 4. NAVEGAÇÃO E AUTENTICAÇÃO
  function switchAuthTab(tab) {
    if (tab === "login") {
      if (elements.tabLogin) elements.tabLogin.classList.add("active");
      if (elements.tabSignup) elements.tabSignup.classList.remove("active");
      if (elements.loginForm) elements.loginForm.style.display = "block";
      if (elements.signupForm) elements.signupForm.style.display = "none";
    } else {
      if (elements.tabSignup) elements.tabSignup.classList.add("active");
      if (elements.tabLogin) elements.tabLogin.classList.remove("active");
      if (elements.loginForm) elements.loginForm.style.display = "none";
      if (elements.signupForm) elements.signupForm.style.display = "block";
    }
    clearAuthError();
  }

  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await loadUserProfile();
    } else {
      showAuthSection();
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    clearAuthError();
    const email = e.target.email.value.trim();
    const password = e.target.password.value;

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      showAuthError(err.message || "Erro ao realizar login.");
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    clearAuthError();
    const name = e.target.name ? e.target.name.value.trim() : "";
    const email = e.target.email.value.trim();
    const password = e.target.password.value;

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name || email }
        }
      });
      if (error) throw error;
    } catch (err) {
      showAuthError(err.message || "Erro ao criar conta.");
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    showAuthSection();
  }

  // 5. CARREGAMENTO DO PERFIL
  async function loadUserProfile() {
    try {
      const { data, error } = await supabase.rpc("my_profile");
      if (error) throw error;

      const profile = data && data[0] ? data[0] : { display_name: "Usuário", user_role: "guest" };
      
      if (elements.userDisplayName) {
        elements.userDisplayName.textContent = profile.display_name || "Usuário";
      }

      showDashboardSection();

      if (profile.user_role === "admin") {
        showAdminPanel();
      } else {
        showGuestPanel();
      }
    } catch (err) {
      console.error("Erro ao carregar perfil:", err);
      showGuestPanel();
    }
  }

  // 6. PAINEL DO CONVIDADO (GUEST)
  async function showGuestPanel() {
    if (elements.guestView) elements.guestView.style.display = "block";
    if (elements.adminView) elements.adminView.style.display = "none";
    await loadMyTicket();
  }

  async function loadMyTicket() {
    try {
      const { data, error } = await supabase.rpc("my_ticket");
      if (error) throw error;

      if (data && data.length > 0) {
        renderTicket(data[0]);
      } else {
        renderNoTicket();
      }
    } catch (err) {
      console.error("Erro ao buscar ingresso:", err);
    }
  }

  function renderTicket(ticket) {
    if (elements.claimForm) elements.claimForm.style.display = "none";
    if (elements.ticketContainer) elements.ticketContainer.style.display = "block";

    if (elements.guestNameDisplay) elements.guestNameDisplay.textContent = ticket.guest_name;
    if (elements.ticketStatusBadge) {
      elements.ticketStatusBadge.textContent = ticket.ticket_status.toUpperCase();
      elements.ticketStatusBadge.className = `status-badge status-${ticket.ticket_status}`;
    }

    // Gera QR Code
    if (elements.qrCodeCanvas && window.QRCode) {
      const qrData = JSON.stringify({
        ticket_id: ticket.ticket_id,
        qr_token: ticket.qr_token
      });
      QRCode.toCanvas(elements.qrCodeCanvas, qrData, { width: 220 }, (err) => {
        if (err) console.error("Erro ao gerar QR Code:", err);
      });
    }
  }

  function renderNoTicket() {
    if (elements.claimForm) elements.claimForm.style.display = "block";
    if (elements.ticketContainer) elements.ticketContainer.style.display = "none";
  }

  async function handleClaimTicket(e) {
    e.preventDefault();
    const code = elements.claimCodeInput.value.trim();
    if (!code) return;

    try {
      const { error } = await supabase.rpc("claim_ticket", { p_code: code });
      if (error) throw error;
      alert("Ingresso resgatado com sucesso!");
      await loadMyTicket();
    } catch (err) {
      alert(err.message || "Não foi possível resgatar o ingresso.");
    }
  }

  // 7. PAINEL DO ADMINISTRADOR (ADMIN)
  async function showAdminPanel() {
    if (elements.adminView) elements.adminView.style.display = "block";
    if (elements.guestView) elements.guestView.style.display = "none";
    await loadAdminTicketList();
  }

  async function handleCreateTicket(e) {
    e.preventDefault();
    const guestName = elements.guestNameInput.value.trim();
    if (!guestName) return;

    try {
      const { data, error } = await supabase.rpc("create_ticket", { p_guest_name: guestName });
      if (error) throw error;

      const accessCode = data && data[0] ? data[0].access_code : "CÓDIGO GERADO";
      if (elements.createdCodeDisplay) {
        elements.createdCodeDisplay.style.display = "block";
        elements.createdCodeDisplay.innerHTML = `Código de <strong>${guestName}</strong>: <span class="code-highlight" style="font-size: 1.2rem; font-weight: bold; color: #00ffcc;">${accessCode}</span>`;
      }
      elements.guestNameInput.value = "";
      await loadAdminTicketList();
    } catch (err) {
      alert(err.message || "Erro ao gerar ingresso.");
    }
  }

  async function loadAdminTicketList() {
    if (!elements.adminTicketsTable) return;

    try {
      const { data, error } = await supabase.rpc("admin_ticket_list");
      if (error) throw error;

      if (!data || data.length === 0) {
        elements.adminTicketsTable.innerHTML = "<tr><td colspan='4'>Nenhum ingresso cadastrado.</td></tr>";
        return;
      }

      // Exibe a lista completa de ingressos COM O CÓDIGO DE ACESSO VISÍVEL
      const rowsHtml = data.map(t => {
        const dateStr = t.created_at ? new Date(t.created_at).toLocaleString("pt-BR") : "-";
        return `
          <tr>
            <td><strong>${t.guest_name || "-"}</strong></td>
            <td><code style="background: #111; padding: 4px 8px; border-radius: 4px; color: #00ffcc; font-weight: bold;">${t.access_code || "-"}</code></td>
            <td><span class="status-badge status-${t.ticket_status}">${t.ticket_status}</span></td>
            <td><small>${dateStr}</small></td>
          </tr>
        `;
      }).join("");

      elements.adminTicketsTable.innerHTML = `
        <thead>
          <tr>
            <th>Convidado</th>
            <th>Código de Acesso</th>
            <th>Status</th>
            <th>Criado em</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      `;
    } catch (err) {
      console.error("Erro ao listar ingressos:", err);
    }
  }

  async function handleManualRedeem(e) {
    e.preventDefault();
    const inputVal = elements.redeemInput.value.trim();
    if (!inputVal) return;

    try {
      let ticketId, qrToken;
      if (inputVal.startsWith("{")) {
        const parsed = JSON.parse(inputVal);
        ticketId = parsed.ticket_id;
        qrToken = parsed.qr_token;
      } else {
        alert("Cole os dados JSON válidos do QR Code.");
        return;
      }

      const { data, error } = await supabase.rpc("redeem_ticket", {
        p_ticket_id: ticketId,
        p_qr_token: qrToken
      });

      if (error) throw error;

      const res = data && data[0] ? data[0] : { result: "INVALID", guest_name: "" };
      if (res.result === "AUTHORIZED") {
        elements.redeemResult.innerHTML = `<div style="color: #00ffcc; font-weight: bold; margin-top: 10px;">✅ ENTRADA AUTORIZADA! Convidado: ${res.guest_name}</div>`;
      } else if (res.result === "ALREADY_USED") {
        elements.redeemResult.innerHTML = `<div style="color: #ffcc00; font-weight: bold; margin-top: 10px;">⚠️ INGRESSO JÁ UTILIZADO! Convidado: ${res.guest_name}</div>`;
      } else {
        elements.redeemResult.innerHTML = `<div style="color: #ff3366; font-weight: bold; margin-top: 10px;">❌ INGRESSO INVÁLIDO!</div>`;
      }

      elements.redeemInput.value = "";
      await loadAdminTicketList();
    } catch (err) {
      elements.redeemResult.innerHTML = `<div style="color: #ff3366; margin-top: 10px;">❌ Erro ao validar: ${err.message}</div>`;
    }
  }

  // 8. HELPERS DE INTERFACE
  function showAuthSection() {
    if (elements.authSection) elements.authSection.style.display = "block";
    if (elements.dashboardSection) elements.dashboardSection.style.display = "none";
  }

  function showDashboardSection() {
    if (elements.authSection) elements.authSection.style.display = "none";
    if (elements.dashboardSection) elements.dashboardSection.style.display = "block";
  }

  function showAuthError(msg) {
    if (elements.authError) {
      elements.authError.style.display = "block";
      elements.authError.textContent = msg;
    }
  }

  function clearAuthError() {
    if (elements.authError) {
      elements.authError.style.display = "none";
      elements.authError.textContent = "";
    }
  }

  function showGlobalError(msg) {
    const errDiv = document.createElement("div");
    errDiv.style.cssText = "background: #ff3366; color: white; padding: 12px; text-align: center; font-weight: bold;";
    errDiv.textContent = msg;
    document.body.prepend(errDiv);
  }
})();
        
