/* ========================================================
   PROJETO D — APLICAÇÃO PRINCIPAL (app.js)
   ======================================================== */

(function () {
  const config = window.PROJETO_D_CONFIG || {};
  if (!config.supabaseUrl || !config.supabaseKey) {
    showAuthMessage("Erro: configure a URL e a chave pública em config.js.");
    return;
  }

  const supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);

  let authMode = "login";
  let html5QrcodeScanner = null;
  let isProcessingScan = false;
  let elements = {};

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }

  async function initApp() {
    bindElements();
    setupEventListeners();
    await checkSession();
  }

  function bindElements() {
    elements = {
      authView: document.getElementById("authView"),
      appView: document.getElementById("appView"),
      loginTab: document.getElementById("loginTab"),
      signupTab: document.getElementById("signupTab"),
      authForm: document.getElementById("authForm"),
      displayName: document.getElementById("displayName"),
      displayNameLabel: document.getElementById("displayNameLabel"),
      email: document.getElementById("email"),
      password: document.getElementById("password"),
      authSubmit: document.getElementById("authSubmit"),
      authMessage: document.getElementById("authMessage"),
      welcomeTitle: document.getElementById("welcomeTitle"),
      roleCaption: document.getElementById("roleCaption"),
      logoutButton: document.getElementById("logoutButton"),
      guestPanel: document.getElementById("guestPanel"),
      guestStatus: document.getElementById("guestStatus"),
      noTicketCard: document.getElementById("noTicketCard"),
      buyPixBtn: document.getElementById("buyPixBtn"),
      pixPaymentCard: document.getElementById("pixPaymentCard"),
      hasCodeBtn: document.getElementById("hasCodeBtn"),
      ticketCard: document.getElementById("ticketCard"),
      claimForm: document.getElementById("claimForm"),
      ticketCode: document.getElementById("ticketCode"),
      ticketGuestName: document.getElementById("ticketGuestName"),
      ticketIdLabel: document.getElementById("ticketIdLabel"),
      ticketUsedNotice: document.getElementById("ticketUsedNotice"),
      qrCode: document.getElementById("qrCode"),
      adminPanel: document.getElementById("adminPanel"),
      createTicketForm: document.getElementById("createTicketForm"),
      guestName: document.getElementById("guestName"),
      newCodeResult: document.getElementById("newCodeResult"),
      newCode: document.getElementById("newCode"),
      copyCodeButton: document.getElementById("copyCodeButton"),
      startScannerButton: document.getElementById("startScannerButton"),
      stopScannerButton: document.getElementById("stopScannerButton"),
      scanResult: document.getElementById("scanResult"),
      refreshTicketsButton: document.getElementById("refreshTicketsButton"),
      ticketsTableBody: document.getElementById("ticketsTableBody"),
      appMessage: document.getElementById("appMessage"),
      cyberOverlay: document.getElementById("cyberOverlay"),
      cyberCard: document.getElementById("cyberCard"),
      cyberIcon: document.getElementById("cyberIcon"),
      cyberTitle: document.getElementById("cyberTitle"),
      cyberSubtitle: document.getElementById("cyberSubtitle"),
      cyberProgress: document.getElementById("cyberProgress")
    };
  }

  function setupEventListeners() {
    if (elements.loginTab) {
      elements.loginTab.addEventListener("click", (e) => {
        e.preventDefault();
        switchAuthTab("login");
      });
    }
    if (elements.signupTab) {
      elements.signupTab.addEventListener("click", (e) => {
        e.preventDefault();
        switchAuthTab("signup");
      });
    }

    if (elements.authForm) elements.authForm.addEventListener("submit", handleAuthSubmit);
    if (elements.logoutButton) elements.logoutButton.addEventListener("click", handleLogout);

    // Fluxo do Pix e Resgate
    if (elements.buyPixBtn) elements.buyPixBtn.addEventListener("click", handleBuyPix);
    if (elements.hasCodeBtn) elements.hasCodeBtn.addEventListener("click", handleShowClaimForm);
    if (elements.claimForm) elements.claimForm.addEventListener("submit", handleClaimTicket);

    // Admin
    if (elements.createTicketForm) elements.createTicketForm.addEventListener("submit", handleCreateTicket);
    if (elements.copyCodeButton) elements.copyCodeButton.addEventListener("click", handleCopyCode);
    if (elements.refreshTicketsButton) elements.refreshTicketsButton.addEventListener("click", loadAdminTicketList);

    // Câmera / Leitor QR Code
    if (elements.startScannerButton) elements.startScannerButton.addEventListener("click", startCameraScanner);
    if (elements.stopScannerButton) elements.stopScannerButton.addEventListener("click", stopCameraScanner);

    supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        loadUserProfile();
      } else {
        showAuthView();
      }
    });
  }

  function switchAuthTab(mode) {
    authMode = mode;
    clearAuthMessage();

    if (mode === "login") {
      if (elements.loginTab) elements.loginTab.classList.add("active");
      if (elements.signupTab) elements.signupTab.classList.remove("active");
      if (elements.displayName) elements.displayName.classList.add("hidden");
      if (elements.displayNameLabel) elements.displayNameLabel.classList.add("hidden");
      if (elements.displayName) elements.displayName.required = false;
      if (elements.authSubmit) elements.authSubmit.innerHTML = 'ENTRAR NO SISTEMA <span>↗</span>';
    } else {
      if (elements.signupTab) elements.signupTab.classList.add("active");
      if (elements.loginTab) elements.loginTab.classList.remove("active");
      if (elements.displayName) elements.displayName.classList.remove("hidden");
      if (elements.displayNameLabel) elements.displayNameLabel.classList.remove("hidden");
      if (elements.displayName) elements.displayName.required = true;
      if (elements.authSubmit) elements.authSubmit.innerHTML = 'CRIAR CONTA <span>↗</span>';
    }
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    clearAuthMessage();

    const emailVal = elements.email ? elements.email.value.trim() : "";
    const passVal = elements.password ? elements.password.value : "";
    const nameVal = elements.displayName ? elements.displayName.value.trim() : "";

    if (elements.authSubmit) elements.authSubmit.disabled = true;

    try {
      if (authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailVal,
          password: passVal
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: emailVal,
          password: passVal,
          options: {
            data: { display_name: nameVal || emailVal }
          }
        });
        if (error) throw error;
      }
    } catch (err) {
      showAuthMessage(err.message || "Erro na autenticação.");
    } finally {
      if (elements.authSubmit) elements.authSubmit.disabled = false;
    }
  }

  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await loadUserProfile();
    } else {
      showAuthView();
    }
  }

  async function handleLogout() {
    await stopCameraScanner();
    await supabase.auth.signOut();
    showAuthView();
  }

  function showAuthView() {
    if (elements.authView) elements.authView.classList.remove("hidden");
    if (elements.appView) elements.appView.classList.add("hidden");
  }

  function showAppView() {
    if (elements.authView) elements.authView.classList.add("hidden");
    if (elements.appView) elements.appView.classList.remove("hidden");
  }

  async function loadUserProfile() {
    try {
      showAppView();
      const { data, error } = await supabase.rpc("my_profile");
      if (error) throw error;

      const profile = data && data[0] ? data[0] : { display_name: "Convidado", user_role: "guest" };

      if (elements.welcomeTitle) {
        elements.welcomeTitle.textContent = `BEM-VINDO, ${profile.display_name.toUpperCase()}.`;
      }
      if (elements.roleCaption) {
        elements.roleCaption.textContent = `Acesso autenticado // Nível: ${profile.user_role.toUpperCase()}`;
      }

      if (profile.user_role === "admin") {
        if (elements.adminPanel) elements.adminPanel.classList.remove("hidden");
        if (elements.guestPanel) elements.guestPanel.classList.add("hidden");
        await loadAdminTicketList();
      } else {
        if (elements.guestPanel) elements.guestPanel.classList.remove("hidden");
        if (elements.adminPanel) elements.adminPanel.classList.add("hidden");
        await loadMyTicket();
      }
    } catch (err) {
      console.error("Erro ao carregar perfil:", err);
      if (elements.guestPanel) elements.guestPanel.classList.remove("hidden");
      if (elements.adminPanel) elements.adminPanel.classList.add("hidden");
    }
  }

  // CÓPIA AUTOMÁTICA DA CHAVE PIX E MUDANÇA DE TELA
  function handleBuyPix() {
    const pixKey = "98984650323";

    navigator.clipboard.writeText(pixKey).then(() => {
      if (elements.noTicketCard) elements.noTicketCard.classList.add("hidden");
      if (elements.pixPaymentCard) elements.pixPaymentCard.classList.remove("hidden");
    }).catch(() => {
      if (elements.noTicketCard) elements.noTicketCard.classList.add("hidden");
      if (elements.pixPaymentCard) elements.pixPaymentCard.classList.remove("hidden");
    });
  }

  function handleShowClaimForm() {
    if (elements.pixPaymentCard) elements.pixPaymentCard.classList.add("hidden");
    if (elements.noTicketCard) elements.noTicketCard.classList.remove("hidden");
    if (elements.ticketCode) elements.ticketCode.focus();
  }

  async function loadMyTicket() {
    try {
      const { data, error } = await supabase.rpc("my_ticket");
      if (error) throw error;

      if (data && data.length > 0) {
        renderTicketCard(data[0]);
      } else {
        renderNoTicketCard();
      }
    } catch (err) {
      console.error("Erro ao carregar ingresso:", err);
    }
  }

  function renderTicketCard(ticket) {
    if (elements.noTicketCard) elements.noTicketCard.classList.add("hidden");
    if (elements.pixPaymentCard) elements.pixPaymentCard.classList.add("hidden");
    if (elements.ticketCard) elements.ticketCard.classList.remove("hidden");

    if (elements.ticketGuestName) elements.ticketGuestName.textContent = ticket.guest_name;
    if (elements.guestStatus) elements.guestStatus.textContent = ticket.ticket_status.toUpperCase();
    if (elements.ticketIdLabel) elements.ticketIdLabel.textContent = `ID: ${ticket.ticket_id.slice(0, 8)}...`;

    if (ticket.ticket_status === "used") {
      if (elements.ticketUsedNotice) elements.ticketUsedNotice.classList.remove("hidden");
    } else {
      if (elements.ticketUsedNotice) elements.ticketUsedNotice.classList.add("hidden");
    }

    if (elements.qrCode && window.QRCode) {
      elements.qrCode.innerHTML = "";
      const qrData = JSON.stringify({
        ticket_id: ticket.ticket_id,
        qr_token: ticket.qr_token
      });
      new window.QRCode(elements.qrCode, {
        text: qrData,
        width: 220,
        height: 220,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.M
      });
    }
  }

  function renderNoTicketCard() {
    if (elements.noTicketCard) elements.noTicketCard.classList.remove("hidden");
    if (elements.pixPaymentCard) elements.pixPaymentCard.classList.add("hidden");
    if (elements.ticketCard) elements.ticketCard.classList.add("hidden");
    if (elements.guestStatus) elements.guestStatus.textContent = "AGUARDANDO";
  }

  async function handleClaimTicket(e) {
    e.preventDefault();
    const code = elements.ticketCode ? elements.ticketCode.value.trim() : "";
    if (!code) return;

    try {
      const { error } = await supabase.rpc("claim_ticket", { p_code: code });
      if (error) throw error;
      alert("Ingresso resgatado com sucesso!");
      if (elements.ticketCode) elements.ticketCode.value = "";
      await loadMyTicket();
    } catch (err) {
      alert(err.message || "Código inválido ou já resgatado.");
    }
  }

  // PAINEL DO ADMINISTRADOR
  async function handleCreateTicket(e) {
    e.preventDefault();
    const name = elements.guestName ? elements.guestName.value.trim() : "";
    if (!name) return;

    try {
      const { data, error } = await supabase.rpc("create_ticket", { p_guest_name: name });
      if (error) throw error;

      const code = data && data[0] ? data[0].access_code : "CÓDIGO GERADO";
      if (elements.newCode) elements.newCode.textContent = code;
      if (elements.newCodeResult) elements.newCodeResult.classList.remove("hidden");

      if (elements.guestName) elements.guestName.value = "";
      await loadAdminTicketList();
    } catch (err) {
      alert(err.message || "Erro ao gerar ingresso.");
    }
  }

  function handleCopyCode() {
    if (elements.newCode && elements.newCode.textContent) {
      navigator.clipboard.writeText(elements.newCode.textContent).then(() => {
        if (elements.copyCodeButton) {
          elements.copyCodeButton.textContent = "COPIADO! ✓";
          setTimeout(() => {
            elements.copyCodeButton.textContent = "COPIAR CÓDIGO";
          }, 2000);
        }
      });
    }
  }

  async function loadAdminTicketList() {
    if (!elements.ticketsTableBody) return;

    try {
      const { data, error } = await supabase.rpc("admin_ticket_list");
      if (error) throw error;

      const table = elements.ticketsTableBody.closest("table");
      if (table) {
        const thead = table.querySelector("thead");
        if (thead) {
          thead.innerHTML = "<tr><th>CONVIDADO</th><th>CÓDIGO</th><th>STATUS</th><th>CRIADO EM</th><th>UTILIZADO EM</th></tr>";
        }
      }

      if (!data || data.length === 0) {
        elements.ticketsTableBody.innerHTML = '<tr><td colspan="5" class="muted">Nenhum ingresso cadastrado.</td></tr>';
        return;
      }

      const rows = data.map(t => {
        const createdStr = t.created_at ? new Date(t.created_at).toLocaleString("pt-BR") : "-";
        const usedStr = t.used_at ? new Date(t.used_at).toLocaleString("pt-BR") : "-";
        return '<tr>' +
          '<td><strong>' + (t.guest_name || "-") + '</strong></td>' +
          '<td><code style="background: #111; padding: 4px 8px; border-radius: 4px; color: #ff0055; font-weight: bold; letter-spacing: 1px;">' + (t.access_code || "-") + '</code></td>' +
          '<td><span class="status-pill">' + t.ticket_status + '</span></td>' +
          '<td><small>' + createdStr + '</small></td>' +
          '<td><small>' + usedStr + '</small></td>' +
        '</tr>';
      }).join("");

      elements.ticketsTableBody.innerHTML = rows;
    } catch (err) {
      console.error("Erro ao listar ingressos:", err);
      elements.ticketsTableBody.innerHTML = '<tr><td colspan="5" style="color: #ff3366;">Erro ao carregar dados.</td></tr>';
    }
  }

  // LEITOR DE QR CODE COM CÂMERA E OVERLAY CYBERPUNK
  async function startCameraScanner() {
    if (typeof Html5Qrcode === "undefined") {
      if (elements.scanResult) elements.scanResult.textContent = "BIBLIOTECA DE CÂMERA NÃO CARREGADA";
      return;
    }

    try {
      if (!html5QrcodeScanner) {
        html5QrcodeScanner = new Html5Qrcode("reader");
      }

      const config = {
        fps: 15,
        qrbox: function (viewfinderWidth, viewfinderHeight) {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const edgeSize = Math.floor(minEdge * 0.7);
          return { width: edgeSize, height: edgeSize };
        },
        aspectRatio: 1.0,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      };

      try {
        await html5QrcodeScanner.start(
          { facingMode: { exact: "environment" } },
          config,
          async (decodedText) => {
            await processScannedQrData(decodedText);
          },
          () => {}
        );
      } catch (fallbackErr) {
        await html5QrcodeScanner.start(
          { facingMode: "environment" },
          config,
          async (decodedText) => {
            await processScannedQrData(decodedText);
          },
          () => {}
        );
      }

      if (elements.startScannerButton) elements.startScannerButton.disabled = true;
      if (elements.stopScannerButton) elements.stopScannerButton.disabled = false;
      if (elements.scanResult) elements.scanResult.textContent = "CÂMERA ATIVA // APONTE PARA O QR CODE";
    } catch (err) {
      if (elements.scanResult) elements.scanResult.textContent = "ERRO AO ACESSAR CÂMERA: " + (err.message || err);
    }
  }

  async function stopCameraScanner() {
    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
      try {
        await html5QrcodeScanner.stop();
        if (elements.startScannerButton) elements.startScannerButton.disabled = false;
        if (elements.stopScannerButton) elements.stopScannerButton.disabled = true;
        if (elements.scanResult) elements.scanResult.textContent = "LEITOR DESATIVADO";
      } catch (err) {
        console.error("Erro ao parar leitor:", err);
      }
    }
  }

  async function processScannedQrData(qrData) {
    if (isProcessingScan) return;
    isProcessingScan = true;

    try {
      const parsed = JSON.parse(qrData);
      if (!parsed.ticket_id || !parsed.qr_token) {
        triggerCyberModal("warning", "❌ ERRO DE LEITURA", "DADOS DO QR CODE INVÁLIDOS");
        return;
      }

      const { data, error } = await supabase.rpc("redeem_ticket", {
        p_ticket_id: parsed.ticket_id,
        p_qr_token: parsed.qr_token
      });

      if (error) throw error;

      const res = data && data[0] ? data[0] : { result: "INVALID", guest_name: "" };

      if (res.result === "AUTHORIZED") {
        triggerCyberModal(
          "success", 
          "Ingresso validado, boa festa!", 
          `CONVIDADO: ${res.guest_name.toUpperCase()}`
        );
      } else if (res.result === "ALREADY_USED") {
        triggerCyberModal(
          "warning", 
          "ingresso já resgatado, próximo?", 
          `TITULAR: ${res.guest_name.toUpperCase()}`
        );
      } else {
        triggerCyberModal("warning", "Ingresso Inválido", "CÓDIGO NÃO LOCALIZADO NO SISTEMA");
      }

      await loadAdminTicketList();
    } catch (err) {
      triggerCyberModal("warning", "Erro no Sistema", err.message || "Tente novamente.");
    }
  }

  function triggerCyberModal(type, title, subtitle) {
    if (!elements.cyberOverlay) return;

    // Bipe tático sintetizado via Web Audio API
    playCyberBeep(type === "success" ? 880 : 330);

    // Feedback de Vibração no celular
    if ("vibrate" in navigator) {
      if (type === "success") {
        navigator.vibrate([100, 50, 100]); // Pulsos curtos para Sucesso
      } else {
        navigator.vibrate([300, 100, 300]); // Vibração mais longa para Alerta
      }
    }

    elements.cyberCard.className = `cyber-card ${type}`;
    elements.cyberIcon.textContent = type === "success" ? "⚡" : "⚠️";
    elements.cyberTitle.textContent = title;
    elements.cyberSubtitle.textContent = subtitle;

    if (elements.cyberProgress) {
      elements.cyberProgress.style.animation = 'none';
      elements.cyberProgress.offsetHeight;
      elements.cyberProgress.style.animation = 'cyberTimer 3s linear forwards';
    }

    elements.cyberOverlay.classList.remove("hidden");

    setTimeout(() => {
      elements.cyberOverlay.classList.add("hidden");
      isProcessingScan = false;
    }, 3000);
  }

  function playCyberBeep(freq) {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch (e) {
      // Ignora caso permissão de áudio esteja desativada
    }
  }

  function showAuthMessage(msg) {
    if (elements.authMessage) {
      elements.authMessage.textContent = msg;
      elements.authMessage.style.color = "#ff3366";
    }
  }

  function clearAuthMessage() {
    if (elements.authMessage) {
      elements.authMessage.textContent = "";
    }
  }
})();
