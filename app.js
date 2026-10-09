(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const config = window.PROJETO_D_CONFIG || {};
  const authView = $("authView");
  const appView = $("appView");
  const authForm = $("authForm");
  const authMessage = $("authMessage");
  const appMessage = $("appMessage");
  const loginTab = $("loginTab");
  const signupTab = $("signupTab");
  const displayName = $("displayName");
  const displayNameLabel = $("displayNameLabel");
  const authSubmit = $("authSubmit");
  let supabase = null;
  let authMode = "login";
  let currentUser = null;
  let currentProfile = null;
  let scanner = null;
  let scannerRunning = false;
  let processingScan = false;
  let lastCreatedCode = "";

  function setMessage(element, message, kind = "") {
    element.textContent = message || "";
    element.className = `message ${kind}`.trim();
  }
  function setScanResult(message, kind = "") {
    const el = $("scanResult");
    el.textContent = message;
    el.className = `scan-result ${kind}`.trim();
  }
  function setAuthMode(mode) {
    authMode = mode;
    const isSignup = mode === "signup";
    loginTab.classList.toggle("active", !isSignup);
    signupTab.classList.toggle("active", isSignup);
    displayName.classList.toggle("hidden", !isSignup);
    displayNameLabel.classList.toggle("hidden", !isSignup);
    displayName.required = isSignup;
    $("password").autocomplete = isSignup ? "new-password" : "current-password";
    authSubmit.innerHTML = isSignup ? "CRIAR CONTA <span>↗</span>" : "ENTRAR NO SISTEMA <span>↗</span>";
    setMessage(authMessage, "");
  }
  function configIsReady() {
    return config.supabaseUrl && config.supabaseKey &&
      !config.supabaseUrl.includes("COLE_AQUI") &&
      !config.supabaseKey.includes("COLE_AQUI");
  }
  function showAuth() {
    authView.classList.remove("hidden");
    appView.classList.add("hidden");
    $("guestPanel").classList.add("hidden");
    $("adminPanel").classList.add("hidden");
  }
  function showApp() {
    authView.classList.add("hidden");
    appView.classList.remove("hidden");
  }
  function niceDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pt-BR");
  }
  function statusLabel(status) {
    return ({ available: "DISPONÍVEL", issued: "EMITIDO", used: "UTILIZADO" })[status] || String(status || "—").toUpperCase();
  }
  function escapeText(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  async function loadProfileAndRender() {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      currentUser = null;
      currentProfile = null;
      showAuth();
      return;
    }
    currentUser = userData.user;
    const { data, error } = await supabase.rpc("my_profile");
    if (error) throw error;
    currentProfile = Array.isArray(data) ? data[0] : data;
    if (!currentProfile) throw new Error("Perfil não encontrado. Saia e entre novamente.");
    showApp();
    const name = currentProfile.display_name || currentUser.email || "CONVIDADO";
    $("welcomeTitle").textContent = `OLÁ, ${name.split(/\s+/)[0].toUpperCase()}.`;
    $("roleCaption").textContent = currentProfile.user_role === "admin"
      ? "Acesso administrativo autorizado."
      : "Seu ingresso e seu acesso em um só lugar.";
    const isAdmin = currentProfile.user_role === "admin";
    $("adminPanel").classList.toggle("hidden", !isAdmin);
    $("guestPanel").classList.toggle("hidden", isAdmin);
    if (isAdmin) await loadAdminTickets();
    else await loadGuestTicket();
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setMessage(authMessage, "");
    if (!configIsReady()) {
      setMessage(authMessage, "Configure a Project URL e a chave pública em config.js antes de usar o site.");
      return;
    }
    authSubmit.disabled = true;
    try {
      const email = $("email").value.trim();
      const password = $("password").value;
      if (authMode === "signup") {
        const name = displayName.value.trim();
        if (name.length < 2) throw new Error("Informe seu nome completo.");
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { data: { display_name: name } }
        });
        if (error) throw error;
        if (data.session) {
          setMessage(authMessage, "Conta criada. Abrindo seu painel…", "success");
          await loadProfileAndRender();
        } else {
          setMessage(authMessage, "Conta criada. Confira seu e-mail para confirmar o cadastro e depois entre no site.", "success");
          setAuthMode("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await loadProfileAndRender();
      }
    } catch (error) {
      setMessage(authMessage, error.message || "Não foi possível autenticar.");
    } finally {
      authSubmit.disabled = false;
    }
  }

  async function loadGuestTicket() {
    const { data, error } = await supabase.rpc("my_ticket");
    if (error) throw error;
    const ticket = Array.isArray(data) ? data[0] : data;
    const hasTicket = Boolean(ticket);
    $("noTicketCard").classList.toggle("hidden", hasTicket);
    $("ticketCard").classList.toggle("hidden", !hasTicket);
    $("guestStatus").textContent = hasTicket ? statusLabel(ticket.ticket_status) : "SEM INGRESSO";
    if (!hasTicket) return;
    $("ticketGuestName").textContent = ticket.guest_name || "CONVIDADO";
    $("ticketIdLabel").textContent = `ID: ${ticket.ticket_id}`;
    $("ticketUsedNotice").classList.toggle("hidden", ticket.ticket_status !== "used");
    const qr = $("qrCode");
    qr.replaceChildren();
    if (typeof QRCode === "undefined") throw new Error("A biblioteca de QR Code não carregou. Verifique sua conexão.");
    new QRCode(qr, {
      text: JSON.stringify({ ticket_id: ticket.ticket_id, qr_token: ticket.qr_token }),
      width: 220, height: 220, colorDark: "#050505", colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  async function handleClaim(event) {
    event.preventDefault();
    setMessage(appMessage, "");
    const code = $("ticketCode").value.replace(/\s/g, "");
    if (!/^\d{9}$/.test(code)) {
      setMessage(appMessage, "O código precisa conter exatamente 9 dígitos.");
      return;
    }
    const button = $("claimForm").querySelector("button");
    button.disabled = true;
    try {
      const { error } = await supabase.rpc("claim_ticket", { p_code: code });
      if (error) throw error;
      $("ticketCode").value = "";
      setMessage(appMessage, "Ingresso resgatado. Seu QR Code está pronto.", "success");
      await loadGuestTicket();
    } catch (error) {
      setMessage(appMessage, error.message || "Não foi possível resgatar o código.");
    } finally {
      button.disabled = false;
    }
  }

  async function handleCreateTicket(event) {
    event.preventDefault();
    setMessage(appMessage, "");
    const name = $("guestName").value.trim();
    const button = $("createTicketForm").querySelector("button");
    button.disabled = true;
    $("newCodeResult").classList.add("hidden");
    try {
      const { data, error } = await supabase.rpc("create_ticket", { p_guest_name: name });
      if (error) throw error;
      const ticket = Array.isArray(data) ? data[0] : data;
      if (!ticket || !ticket.access_code) throw new Error("O banco não retornou o código do ingresso.");
      lastCreatedCode = String(ticket.access_code);
      $("newCode").textContent = lastCreatedCode;
      $("newCodeResult").classList.remove("hidden");
      $("guestName").value = "";
      setMessage(appMessage, "Ingresso criado. Copie e entregue o código ao convidado.", "success");
      await loadAdminTickets();
    } catch (error) {
      setMessage(appMessage, error.message || "Não foi possível criar o ingresso.");
    } finally {
      button.disabled = false;
    }
  }

  async function loadAdminTickets() {
    const tbody = $("ticketsTableBody");
    tbody.innerHTML = '<tr><td colspan="4" class="muted">Carregando registros…</td></tr>';
    const { data, error } = await supabase.rpc("admin_ticket_list");
    if (error) {
      tbody.innerHTML = `<tr><td colspan="4">${escapeText(error.message)}</td></tr>`;
      return;
    }
    if (!data || !data.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="muted">Nenhum ingresso cadastrado.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map((ticket) => {
      const statusClass = ["available", "issued", "used"].includes(ticket.ticket_status) ? ticket.ticket_status : "";
      return `<tr><td>${escapeText(ticket.guest_name)}</td><td><span class="table-status ${statusClass}">${escapeText(statusLabel(ticket.ticket_status))}</span></td><td>${escapeText(niceDate(ticket.created_at))}</td><td>${escapeText(niceDate(ticket.used_at))}</td></tr>`;
    }).join("");
  }

  async function validateScannedText(decodedText) {
    if (processingScan) return;
    processingScan = true;
    try {
      let payload;
      try { payload = JSON.parse(decodedText); }
      catch { throw new Error("QR Code não reconhecido. Use um ingresso do Projeto D."); }
      if (!payload || typeof payload.ticket_id !== "string" || typeof payload.qr_token !== "string") {
        throw new Error("Formato de QR Code inválido.");
      }
      setScanResult("VALIDANDO INGRESSO NO SERVIDOR…");
      const { data, error } = await supabase.rpc("redeem_ticket", {
        p_ticket_id: payload.ticket_id,
        p_qr_token: payload.qr_token
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      if (result?.result === "AUTHORIZED") {
        setScanResult(`ENTRADA AUTORIZADA · ${result.guest_name}`, "success");
        await loadAdminTickets();
      } else if (result?.result === "ALREADY_USED") {
        setScanResult("ACESSO NEGADO · ESTE INGRESSO JÁ FOI UTILIZADO", "error");
      } else {
        setScanResult("ACESSO NEGADO · QR CODE INVÁLIDO", "error");
      }
    } catch (error) {
      setScanResult(`FALHA NA VALIDAÇÃO · ${error.message || "Erro desconhecido"}`, "error");
    } finally {
      processingScan = false;
    }
  }

  async function startScanner() {
    if (typeof Html5Qrcode === "undefined") {
      setScanResult("A biblioteca de câmera não carregou. Verifique sua conexão.", "error");
      return;
    }
    if (scannerRunning) return;
    try {
      scanner = new Html5Qrcode("reader");
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || !cameras.length) throw new Error("Nenhuma câmera foi encontrada.");
      const preferred = cameras.find((camera) => /back|rear|environment|trás|traseira/i.test(camera.label)) || cameras[cameras.length - 1];
      await scanner.start(
        { deviceId: { exact: preferred.id } },
        { fps: 10, qrbox: { width: 230, height: 230 }, aspectRatio: 1.0 },
        (decodedText) => { void validateScannedText(decodedText); },
        () => {}
      );
      scannerRunning = true;
      $("startScannerButton").disabled = true;
      $("stopScannerButton").disabled = false;
      setScanResult("CÂMERA ATIVA · AGUARDANDO QR CODE");
    } catch (error) {
      setScanResult(`NÃO FOI POSSÍVEL INICIAR A CÂMERA · ${error.message || error}`, "error");
      if (scanner) {
        try { await scanner.clear(); } catch (_) {}
        scanner = null;
      }
    }
  }

  async function stopScanner() {
    if (scanner && scannerRunning) {
      try { await scanner.stop(); await scanner.clear(); } catch (_) {}
    }
    scanner = null;
    scannerRunning = false;
    $("startScannerButton").disabled = false;
    $("stopScannerButton").disabled = true;
    setScanResult("LEITOR DESATIVADO");
  }

  async function logout() {
    await stopScanner();
    await supabase.auth.signOut();
    currentUser = null;
    currentProfile = null;
    setAuthMode("login");
    showAuth();
    setMessage(authMessage, "Sessão encerrada.", "success");
  }

  loginTab.addEventListener("click", () => setAuthMode("login"));
  signupTab.addEventListener("click", () => setAuthMode("signup"));
  authForm.addEventListener("submit", handleAuthSubmit);
  $("claimForm").addEventListener("submit", handleClaim);
  $("createTicketForm").addEventListener("submit", handleCreateTicket);
  $("logoutButton").addEventListener("click", logout);
  $("startScannerButton").addEventListener("click", startScanner);
  $("stopScannerButton").addEventListener("click", stopScanner);
  $("refreshTicketsButton").addEventListener("click", loadAdminTickets);
  $("copyCodeButton").addEventListener("click", async () => {
    if (!lastCreatedCode) return;
    try {
      await navigator.clipboard.writeText(lastCreatedCode);
      setMessage(appMessage, "Código copiado.", "success");
    } catch (_) {
      setMessage(appMessage, `Selecione e copie o código: ${lastCreatedCode}`);
    }
  });
  $("ticketCode").addEventListener("input", (event) => {
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 9);
  });

  if (!configIsReady()) {
    setMessage(authMessage, "Antes de usar: edite config.js e informe a Project URL e a chave pública do Supabase.");
  } else if (!window.supabase || typeof window.supabase.createClient !== "function") {
    setMessage(authMessage, "Não foi possível carregar a conexão do Supabase. Verifique sua internet.");
  } else {
    supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        currentUser = null;
        currentProfile = null;
        showAuth();
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) loadProfileAndRender().catch((error) => {
        showApp();
        setMessage(appMessage, error.message || "Falha ao carregar seu perfil.");
      });
    });
  }

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
})();
