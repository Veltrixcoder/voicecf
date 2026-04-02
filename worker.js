// ============================================================
// VoiceLink — Cloudflare Worker + Durable Objects
// Peer-to-peer voice calling via WebRTC signaling
// ============================================================

// ── HTML Frontend ───────────────────────────────────────────
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>VoiceLink</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;700;800&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #0a0a0f;
    --surface: #13131a;
    --surface2: #1c1c26;
    --border: #2a2a3a;
    --accent: #00e5a0;
    --accent2: #7c6aff;
    --danger: #ff4d6d;
    --warn: #ffb347;
    --text: #e8e8f0;
    --muted: #6b6b85;
    --glow: 0 0 20px rgba(0,229,160,0.25);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Syne', sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* ── Noise overlay ── */
  body::before {
    content: '';
    position: fixed; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    pointer-events: none; z-index: 0;
  }

  /* ── Splash / Name Entry ── */
  #splash {
    position: fixed; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 32px; z-index: 100;
    background: var(--bg);
    transition: opacity 0.5s, transform 0.5s;
  }
  #splash.hidden { opacity: 0; transform: scale(0.96); pointer-events: none; }

  .logo {
    font-family: 'Syne', sans-serif;
    font-size: 52px; font-weight: 800;
    letter-spacing: -2px;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .tagline { color: var(--muted); font-size: 14px; letter-spacing: 3px; text-transform: uppercase; }

  .name-form {
    display: flex; flex-direction: column; gap: 12px;
    width: 320px;
  }
  .name-form label { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: var(--muted); }
  .name-form input {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-family: 'Space Mono', monospace;
    font-size: 16px;
    padding: 14px 16px;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .name-form input:focus {
    border-color: var(--accent);
    box-shadow: var(--glow);
  }
  .btn-join {
    background: var(--accent);
    border: none; border-radius: 8px;
    color: #000; cursor: pointer;
    font-family: 'Syne', sans-serif;
    font-size: 15px; font-weight: 700;
    padding: 14px;
    transition: opacity 0.2s, transform 0.1s;
    letter-spacing: 1px;
  }
  .btn-join:hover { opacity: 0.9; transform: translateY(-1px); }
  .btn-join:active { transform: translateY(0); }
  .error-msg { color: var(--danger); font-size: 13px; font-family: 'Space Mono', monospace; min-height: 18px; }

  /* ── Main App ── */
  #app {
    display: none; flex-direction: column;
    min-height: 100vh; position: relative; z-index: 1;
  }
  #app.visible { display: flex; }

  header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 32px;
    border-bottom: 1px solid var(--border);
    background: rgba(10,10,15,0.8);
    backdrop-filter: blur(12px);
    position: sticky; top: 0; z-index: 50;
  }
  .header-logo { font-size: 22px; font-weight: 800; letter-spacing: -1px;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .user-badge {
    display: flex; align-items: center; gap: 8px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 100px; padding: 6px 14px 6px 10px;
    font-size: 13px; font-family: 'Space Mono', monospace;
  }
  .user-badge .dot { width: 8px; height: 8px; background: var(--accent); border-radius: 50%;
    box-shadow: 0 0 8px var(--accent); animation: pulse 2s infinite; }

  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

  .main-grid {
    display: grid; grid-template-columns: 320px 1fr;
    flex: 1; gap: 0;
  }

  /* ── Sidebar ── */
  .sidebar {
    border-right: 1px solid var(--border);
    display: flex; flex-direction: column;
    background: var(--surface);
  }
  .sidebar-header {
    padding: 20px 24px 12px;
    font-size: 10px; letter-spacing: 3px; text-transform: uppercase;
    color: var(--muted); border-bottom: 1px solid var(--border);
    display: flex; justify-content: space-between; align-items: center;
  }
  .online-count {
    background: var(--accent); color: #000;
    border-radius: 100px; padding: 2px 8px;
    font-size: 11px; font-weight: 700;
  }
  #user-list { flex: 1; overflow-y: auto; padding: 8px; }

  .user-card {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 14px; border-radius: 8px; margin-bottom: 4px;
    cursor: pointer; transition: background 0.15s, border-color 0.15s;
    border: 1px solid transparent;
  }
  .user-card:hover { background: var(--surface2); border-color: var(--border); }
  .user-card.selected { background: rgba(0,229,160,0.08); border-color: rgba(0,229,160,0.3); }
  .user-card.in-call { opacity: 0.5; cursor: not-allowed; }
  .user-card .uname {
    font-size: 14px; font-family: 'Space Mono', monospace;
    display: flex; align-items: center; gap: 8px;
  }
  .user-card .uname::before {
    content: ''; width: 6px; height: 6px;
    background: var(--accent); border-radius: 50%;
    flex-shrink: 0;
  }
  .user-card .call-btn {
    background: transparent; border: 1px solid var(--border);
    border-radius: 6px; color: var(--accent);
    font-size: 11px; padding: 4px 10px; cursor: pointer;
    font-family: 'Space Mono', monospace;
    transition: background 0.15s, border-color 0.15s;
  }
  .user-card .call-btn:hover { background: rgba(0,229,160,0.1); border-color: var(--accent); }
  .empty-list { text-align: center; color: var(--muted); font-size: 13px; padding: 40px 20px;
    font-family: 'Space Mono', monospace; line-height: 1.8; }

  /* ── Call Area ── */
  .call-area {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 32px; padding: 40px;
    flex: 1;
  }

  /* Idle state */
  .idle-state { text-align: center; }
  .idle-state .big-icon {
    font-size: 64px; margin-bottom: 16px;
    filter: grayscale(0.3);
  }
  .idle-state h2 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
  .idle-state p { color: var(--muted); font-size: 14px; line-height: 1.6; max-width: 280px; margin: auto; }

  /* Calling / In-call state */
  .call-state { display: none; flex-direction: column; align-items: center; gap: 24px; }
  .call-state.visible { display: flex; }

  .avatar-ring {
    position: relative; width: 120px; height: 120px;
  }
  .avatar-ring .ring {
    position: absolute; inset: 0; border-radius: 50%;
    border: 2px solid var(--accent);
    animation: ring-pulse 1.5s ease-out infinite;
    opacity: 0;
  }
  .avatar-ring .ring:nth-child(2) { animation-delay: 0.5s; }
  .avatar-ring .ring:nth-child(3) { animation-delay: 1s; }
  @keyframes ring-pulse { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(1.6);opacity:0} }

  .avatar-inner {
    position: absolute; inset: 10px;
    background: linear-gradient(135deg, var(--accent2), var(--accent));
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 36px; font-weight: 800;
    color: #fff;
    box-shadow: 0 0 30px rgba(0,229,160,0.3);
  }

  .call-label { font-size: 13px; letter-spacing: 3px; text-transform: uppercase; color: var(--muted); }
  .call-name { font-size: 28px; font-weight: 800; }
  .call-status { font-family: 'Space Mono', monospace; font-size: 12px; color: var(--accent); }

  /* Volume bars */
  .vol-bars { display: flex; align-items: flex-end; gap: 3px; height: 24px; }
  .vol-bar {
    width: 4px; background: var(--accent); border-radius: 2px;
    opacity: 0.3; transition: height 0.1s;
  }
  .vol-bars.active .vol-bar { animation: bar-bounce 0.6s ease-in-out infinite; }
  .vol-bars.active .vol-bar:nth-child(1) { animation-delay: 0s; }
  .vol-bars.active .vol-bar:nth-child(2) { animation-delay: 0.1s; }
  .vol-bars.active .vol-bar:nth-child(3) { animation-delay: 0.2s; }
  .vol-bars.active .vol-bar:nth-child(4) { animation-delay: 0.15s; }
  .vol-bars.active .vol-bar:nth-child(5) { animation-delay: 0.05s; }
  @keyframes bar-bounce { 0%,100%{height:4px;opacity:0.3} 50%{height:20px;opacity:1} }

  .call-timer { font-family: 'Space Mono', monospace; font-size: 20px; font-weight: 700;
    letter-spacing: 2px; color: var(--text); }

  .call-controls { display: flex; gap: 12px; }
  .ctrl-btn {
    width: 56px; height: 56px; border-radius: 50%;
    border: 1px solid var(--border); background: var(--surface2);
    color: var(--text); cursor: pointer; font-size: 20px;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s;
  }
  .ctrl-btn:hover { background: var(--surface); border-color: var(--muted); transform: scale(1.05); }
  .ctrl-btn.active { background: rgba(255,77,109,0.15); border-color: var(--danger); color: var(--danger); }
  .ctrl-btn.end-call { background: var(--danger); border-color: var(--danger); color: #fff; }
  .ctrl-btn.end-call:hover { opacity: 0.85; transform: scale(1.08); }

  /* Incoming call overlay */
  #incoming-overlay {
    display: none; position: fixed; inset: 0; z-index: 200;
    background: rgba(10,10,15,0.85); backdrop-filter: blur(8px);
    align-items: center; justify-content: center;
  }
  #incoming-overlay.visible { display: flex; }
  .incoming-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px; padding: 40px;
    display: flex; flex-direction: column; align-items: center; gap: 20px;
    width: 300px;
    animation: card-in 0.3s cubic-bezier(0.34,1.56,0.64,1);
  }
  @keyframes card-in { from{transform:scale(0.85) translateY(20px);opacity:0} to{transform:none;opacity:1} }
  .incoming-card .ring-icon { font-size: 40px; animation: shake 0.5s ease-in-out infinite; }
  @keyframes shake { 0%,100%{transform:rotate(-15deg)} 50%{transform:rotate(15deg)} }
  .incoming-card h3 { font-size: 18px; font-weight: 700; }
  .incoming-card p { color: var(--muted); font-size: 13px; font-family: 'Space Mono', monospace; }
  .incoming-btns { display: flex; gap: 12px; width: 100%; }
  .btn-accept { flex: 1; background: var(--accent); border: none; border-radius: 8px;
    color: #000; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 15px;
    padding: 12px; cursor: pointer; transition: opacity 0.2s; }
  .btn-accept:hover { opacity: 0.85; }
  .btn-decline { flex: 1; background: transparent; border: 1px solid var(--danger);
    border-radius: 8px; color: var(--danger); font-family: 'Syne', sans-serif;
    font-weight: 700; font-size: 15px; padding: 12px; cursor: pointer; transition: background 0.2s; }
  .btn-decline:hover { background: rgba(255,77,109,0.1); }

  /* Toast */
  #toast {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 8px; padding: 12px 20px;
    font-size: 13px; font-family: 'Space Mono', monospace;
    z-index: 300; opacity: 0; transition: opacity 0.3s, bottom 0.3s;
    pointer-events: none; white-space: nowrap;
  }
  #toast.show { opacity: 1; bottom: 32px; }
  #toast.error { border-color: var(--danger); color: var(--danger); }
  #toast.success { border-color: var(--accent); color: var(--accent); }

  @media (max-width: 640px) {
    .main-grid { grid-template-columns: 1fr; }
    .sidebar { border-right: none; border-bottom: 1px solid var(--border); max-height: 40vh; }
  }
</style>
</head>
<body>

<!-- ── Splash ── -->
<div id="splash">
  <div class="logo">VoiceLink</div>
  <div class="tagline">Peer · to · Peer · Voice</div>
  <div class="name-form">
    <label for="nameInput">Choose your handle</label>
    <input id="nameInput" type="text" placeholder="e.g. shashwat" maxlength="24" autocomplete="off" spellcheck="false">
    <div class="error-msg" id="nameError"></div>
    <button class="btn-join" id="joinBtn">Enter Room →</button>
  </div>
</div>

<!-- ── App ── -->
<div id="app">
  <header>
    <div class="header-logo">VoiceLink</div>
    <div class="user-badge"><span class="dot"></span><span id="myNameBadge"></span></div>
  </header>
  <div class="main-grid">
    <aside class="sidebar">
      <div class="sidebar-header">
        <span>Online Now</span>
        <span class="online-count" id="onlineCount">0</span>
      </div>
      <div id="user-list"><div class="empty-list">Waiting for<br>others to join…</div></div>
    </aside>
    <main class="call-area">
      <div class="idle-state" id="idleState">
        <div class="big-icon">🎙️</div>
        <h2>Ready to Connect</h2>
        <p>Select someone from the list on the left to start a voice call.</p>
      </div>
      <div class="call-state" id="callState">
        <div class="avatar-ring">
          <div class="ring"></div><div class="ring"></div><div class="ring"></div>
          <div class="avatar-inner" id="callAvatar">?</div>
        </div>
        <div class="call-label" id="callLabel">Calling</div>
        <div class="call-name" id="callPeerName"></div>
        <div class="call-status" id="callStatus">Connecting…</div>
        <div class="vol-bars" id="volBars">
          <div class="vol-bar"></div><div class="vol-bar"></div>
          <div class="vol-bar"></div><div class="vol-bar"></div>
          <div class="vol-bar"></div>
        </div>
        <div class="call-timer" id="callTimer">00:00</div>
        <div class="call-controls">
          <button class="ctrl-btn" id="muteBtn" title="Mute">🎤</button>
          <button class="ctrl-btn end-call" id="endCallBtn" title="End call">📵</button>
          <button class="ctrl-btn" id="speakerBtn" title="Speaker">🔊</button>
        </div>
      </div>
    </main>
  </div>
</div>

<!-- ── Incoming call overlay ── -->
<div id="incoming-overlay">
  <div class="incoming-card">
    <div class="ring-icon">📲</div>
    <h3>Incoming Call</h3>
    <p id="incomingName">someone</p>
    <div class="incoming-btns">
      <button class="btn-accept" id="acceptBtn">Accept</button>
      <button class="btn-decline" id="declineBtn">Decline</button>
    </div>
  </div>
</div>

<!-- ── Toast ── -->
<div id="toast"></div>
<audio id="remoteAudio" autoplay></audio>

<script>
// ────────────────────────────────────────────────
//  STATE
// ────────────────────────────────────────────────
const state = {
  myName: null,
  ws: null,
  users: {},            // { name: { inCall: bool } }
  pc: null,             // RTCPeerConnection
  localStream: null,
  callPeer: null,       // name of peer in/being called
  callState: 'idle',    // idle | calling | incoming | connected
  isMuted: false,
  callStart: null,
  timerInterval: null,
  pendingOffer: null,   // { offer, from }
};

// ────────────────────────────────────────────────
//  DOM REFS
// ────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const splash       = $('splash');
const app          = $('app');
const nameInput    = $('nameInput');
const nameError    = $('nameError');
const joinBtn      = $('joinBtn');
const myNameBadge  = $('myNameBadge');
const onlineCount  = $('onlineCount');
const userList     = $('user-list');
const idleState    = $('idleState');
const callStateEl  = $('callState');
const callAvatar   = $('callAvatar');
const callLabel    = $('callLabel');
const callPeerName = $('callPeerName');
const callStatus   = $('callStatus');
const callTimer    = $('callTimer');
const volBars      = $('volBars');
const muteBtn      = $('muteBtn');
const endCallBtn   = $('endCallBtn');
const incomingOverlay = $('incoming-overlay');
const incomingName = $('incomingName');
const acceptBtn    = $('acceptBtn');
const declineBtn   = $('declineBtn');
const remoteAudio  = $('remoteAudio');
const toast        = $('toast');

// ────────────────────────────────────────────────
//  TOAST
// ────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = '') {
  toast.textContent = msg;
  toast.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.className = '', 3000);
}

// ────────────────────────────────────────────────
//  JOIN FLOW
// ────────────────────────────────────────────────
nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') joinBtn.click(); });
joinBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name) { nameError.textContent = 'Please enter a handle.'; return; }
  if (!/^[a-zA-Z0-9_-]{2,24}$/.test(name)) {
    nameError.textContent = 'Letters, numbers, _ and - only (2–24 chars).';
    return;
  }
  nameError.textContent = '';
  joinBtn.disabled = true;
  joinBtn.textContent = 'Connecting…';
  connectWS(name);
});

// ────────────────────────────────────────────────
//  WEBSOCKET
// ────────────────────────────────────────────────
function connectWS(name) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(\`\${proto}://\${location.host}/ws?name=\${encodeURIComponent(name)}\`);
  state.ws = ws;

  ws.onopen = () => {
    state.myName = name;
    myNameBadge.textContent = name;
    splash.classList.add('hidden');
    app.classList.add('visible');
  };

  ws.onmessage = ({ data }) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    handleSignal(msg);
  };

  ws.onclose = () => {
    if (!state.myName) {
      nameError.textContent = 'Name already taken — choose another.';
      joinBtn.disabled = false;
      joinBtn.textContent = 'Enter Room →';
      return;
    }
    showToast('Connection lost. Refreshing…', 'error');
    setTimeout(() => location.reload(), 2000);
  };

  ws.onerror = () => {
    if (!state.myName) {
      nameError.textContent = 'Could not connect. Try again.';
      joinBtn.disabled = false;
      joinBtn.textContent = 'Enter Room →';
    }
  };
}

function send(msg) {
  if (state.ws && state.ws.readyState === WebSocket.OPEN)
    state.ws.send(JSON.stringify(msg));
}

// ────────────────────────────────────────────────
//  SIGNAL HANDLER
// ────────────────────────────────────────────────
async function handleSignal(msg) {
  switch (msg.type) {
    case 'user-list':
      state.users = msg.users; // { name: { inCall } }
      renderUserList();
      break;

    case 'name-taken':
      nameError.textContent = 'That handle is taken — choose another.';
      joinBtn.disabled = false;
      joinBtn.textContent = 'Enter Room →';
      splash.classList.remove('hidden');
      app.classList.remove('visible');
      state.myName = null;
      state.ws.close();
      break;

    case 'offer':
      if (state.callState !== 'idle') {
        send({ type: 'decline', to: msg.from });
        return;
      }
      state.pendingOffer = { offer: msg.offer, from: msg.from };
      state.callState = 'incoming';
      incomingName.textContent = msg.from;
      incomingOverlay.classList.add('visible');
      break;

    case 'answer':
      if (state.pc) {
        await state.pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
      }
      break;

    case 'ice':
      if (state.pc && msg.candidate) {
        try { await state.pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {}
      }
      break;

    case 'decline':
      teardown();
      showCallUI('idle');
      showToast(msg.from + ' declined the call.', 'error');
      break;

    case 'hangup':
      teardown();
      showCallUI('idle');
      showToast('Call ended.', '');
      break;

    case 'busy':
      teardown();
      showCallUI('idle');
      showToast(msg.from + ' is busy.', '');
      break;
  }
}

// ────────────────────────────────────────────────
//  USER LIST RENDER
// ────────────────────────────────────────────────
function renderUserList() {
  const others = Object.entries(state.users).filter(([n]) => n !== state.myName);
  onlineCount.textContent = others.length;

  if (others.length === 0) {
    userList.innerHTML = '<div class="empty-list">No one else here yet.<br>Share this link to invite!</div>';
    return;
  }

  userList.innerHTML = '';
  others.forEach(([name, info]) => {
    const card = document.createElement('div');
    card.className = 'user-card' + (info.inCall ? ' in-call' : '');
    card.dataset.name = name;

    const uname = document.createElement('div');
    uname.className = 'uname';
    uname.textContent = name;

    const btn = document.createElement('button');
    btn.className = 'call-btn';
    btn.textContent = info.inCall ? 'busy' : 'call';
    btn.disabled = info.inCall || state.callState !== 'idle';

    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (!info.inCall && state.callState === 'idle') startCall(name);
    });

    card.appendChild(uname);
    card.appendChild(btn);
    userList.appendChild(card);
  });
}

// ────────────────────────────────────────────────
//  WEBRTC CALL (INITIATOR)
// ────────────────────────────────────────────────
async function startCall(peerName) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    state.localStream = stream;
    state.callPeer = peerName;
    state.callState = 'calling';
    showCallUI('calling', peerName);

    const pc = createPC();
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send({ type: 'offer', to: peerName, offer: pc.localDescription });
  } catch (err) {
    showToast('Microphone access denied.', 'error');
    teardown();
    showCallUI('idle');
  }
}

// ────────────────────────────────────────────────
//  WEBRTC ANSWER (RECEIVER)
// ────────────────────────────────────────────────
acceptBtn.addEventListener('click', async () => {
  incomingOverlay.classList.remove('visible');
  const { offer, from } = state.pendingOffer;
  state.pendingOffer = null;
  state.callPeer = from;
  state.callState = 'connecting';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    state.localStream = stream;

    const pc = createPC();
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    send({ type: 'answer', to: from, answer: pc.localDescription });

    showCallUI('calling', from);
  } catch (err) {
    showToast('Microphone access denied.', 'error');
    send({ type: 'decline', to: from });
    teardown();
    showCallUI('idle');
  }
});

declineBtn.addEventListener('click', () => {
  incomingOverlay.classList.remove('visible');
  if (state.pendingOffer) {
    send({ type: 'decline', to: state.pendingOffer.from });
    state.pendingOffer = null;
  }
  state.callState = 'idle';
  showCallUI('idle');
});

// ────────────────────────────────────────────────
//  PEER CONNECTION
// ────────────────────────────────────────────────
function createPC() {
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  });
  state.pc = pc;

  pc.onicecandidate = ({ candidate }) => {
    if (candidate && state.callPeer)
      send({ type: 'ice', to: state.callPeer, candidate });
  };

  pc.ontrack = ({ streams }) => {
    remoteAudio.srcObject = streams[0];
    state.callState = 'connected';
    callLabel.textContent = 'In call with';
    callStatus.textContent = 'Connected ✓';
    volBars.classList.add('active');
    startTimer();
  };

  pc.onconnectionstatechange = () => {
    if (['disconnected','failed','closed'].includes(pc.connectionState)) {
      teardown();
      showCallUI('idle');
      showToast('Call disconnected.', '');
    }
  };

  return pc;
}

// ────────────────────────────────────────────────
//  CALL UI
// ────────────────────────────────────────────────
function showCallUI(mode, peerName = '') {
  idleState.style.display   = mode === 'idle' ? '' : 'none';
  callStateEl.classList.toggle('visible', mode !== 'idle');

  if (peerName) {
    callAvatar.textContent = peerName[0].toUpperCase();
    callPeerName.textContent = peerName;
    callLabel.textContent = mode === 'calling' ? 'Calling' : 'In call with';
    callStatus.textContent = 'Connecting…';
  }
}

// ────────────────────────────────────────────────
//  CALL CONTROLS
// ────────────────────────────────────────────────
muteBtn.addEventListener('click', () => {
  state.isMuted = !state.isMuted;
  if (state.localStream) {
    state.localStream.getAudioTracks().forEach(t => t.enabled = !state.isMuted);
  }
  muteBtn.classList.toggle('active', state.isMuted);
  muteBtn.textContent = state.isMuted ? '🔇' : '🎤';
});

endCallBtn.addEventListener('click', () => {
  if (state.callPeer) send({ type: 'hangup', to: state.callPeer });
  teardown();
  showCallUI('idle');
  showToast('Call ended.', '');
});

// ────────────────────────────────────────────────
//  TIMER
// ────────────────────────────────────────────────
function startTimer() {
  state.callStart = Date.now();
  clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    const s = Math.floor((Date.now() - state.callStart) / 1000);
    callTimer.textContent = \`\${String(Math.floor(s/60)).padStart(2,'0')}:\${String(s%60).padStart(2,'0')}\`;
  }, 1000);
}

// ────────────────────────────────────────────────
//  TEARDOWN
// ────────────────────────────────────────────────
function teardown() {
  clearInterval(state.timerInterval);
  callTimer.textContent = '00:00';
  volBars.classList.remove('active');
  muteBtn.textContent = '🎤'; muteBtn.classList.remove('active');
  state.isMuted = false;

  if (state.pc) { state.pc.close(); state.pc = null; }
  if (state.localStream) { state.localStream.getTracks().forEach(t => t.stop()); state.localStream = null; }
  remoteAudio.srcObject = null;

  state.callPeer = null;
  state.callState = 'idle';
  state.pendingOffer = null;
  incomingOverlay.classList.remove('visible');
}
</script>
</body>
</html>`;

// ── Durable Object — Signaling Room ─────────────────────────
export class SignalingRoom {
  constructor(state, env) {
    this.state = state;
    // Map<name, WebSocket>
    this.sockets = new Map();
    // Map<name, { inCall: bool }>
    this.users = new Map();
  }

  async fetch(request) {
    const upgrade = request.headers.get('Upgrade');
    if (!upgrade || upgrade !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const url = new URL(request.url);
    const name = url.searchParams.get('name');

    if (!name || !/^[a-zA-Z0-9_-]{2,24}$/.test(name)) {
      return new Response('Invalid name', { status: 400 });
    }

    // Name taken?
    if (this.sockets.has(name)) {
      const { 0: client, 1: server } = new WebSocketPair();
      server.accept();
      server.send(JSON.stringify({ type: 'name-taken' }));
      server.close(1008, 'Name taken');
      return new Response(null, { status: 101, webSocket: client });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();

    this.sockets.set(name, server);
    this.users.set(name, { inCall: false });

    // Send current user list to the new user
    server.send(JSON.stringify({ type: 'user-list', users: this.serializeUsers() }));

    // Broadcast updated list to all
    this.broadcastUserList();

    // Message handling
    server.addEventListener('message', ({ data }) => {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      this.route(name, msg);
    });

    // Disconnect
    const cleanup = () => {
      this.sockets.delete(name);
      this.users.delete(name);
      this.broadcastUserList();
    };
    server.addEventListener('close', cleanup);
    server.addEventListener('error', cleanup);

    return new Response(null, { status: 101, webSocket: client });
  }

  route(from, msg) {
    const { type, to } = msg;

    // Relay signaling messages peer-to-peer
    if (['offer', 'answer', 'ice', 'decline', 'hangup', 'busy'].includes(type)) {
      if (to && this.sockets.has(to)) {
        const payload = { ...msg, from };
        this.sockets.get(to).send(JSON.stringify(payload));
      }

      // Track in-call state
      if (type === 'offer') {
        this.setInCall(from, true);
        this.setInCall(to, true);
        this.broadcastUserList();
      }
      if (['decline', 'hangup'].includes(type)) {
        this.setInCall(from, false);
        this.setInCall(to, false);
        this.broadcastUserList();
      }
    }
  }

  setInCall(name, val) {
    if (this.users.has(name)) this.users.get(name).inCall = val;
  }

  serializeUsers() {
    const obj = {};
    for (const [name, info] of this.users) obj[name] = { inCall: info.inCall };
    return obj;
  }

  broadcastUserList() {
    const payload = JSON.stringify({ type: 'user-list', users: this.serializeUsers() });
    for (const ws of this.sockets.values()) {
      try { ws.send(payload); } catch {}
    }
  }
}

// ── Worker Entry ─────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Serve HTML frontend
    if (url.pathname === '/' || url.pathname === '') {
      return new Response(HTML, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    // WebSocket signaling endpoint
    if (url.pathname === '/ws') {
      const id = env.SIGNALING_ROOM.idFromName('main');
      const room = env.SIGNALING_ROOM.get(id);
      return room.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  }
};
