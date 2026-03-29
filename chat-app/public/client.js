const socket = io();
let typing = false;
let typingTimeout;
const MESSAGE_TTL_MS = 24 * 60 * 60 * 1000; // Messages will expire after 24 hours

function getClientId() {
    const key = 'chat_client_id';
    let clientId = localStorage.getItem(key);

    if (!clientId) {
        clientId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        localStorage.setItem(key, clientId);
    }

    return clientId;
}

const clientId = getClientId();

console.log("Trying to connect to the server...");

const input = document.getElementById("messageInput");
const button = document.getElementById("sendBtn");
const messageDiv = document.getElementById("message");
const typingDiv = document.getElementById("typing");

function formatTime(date = new Date()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function createMessageId() {
    return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function setStatusText(statusElement, status) {
    if (!statusElement) {
        return;
    }

    statusElement.classList.remove("status-sent", "status-delivered", "status-seen");

    if (status === "sent") {
        statusElement.textContent = "✓";
        statusElement.classList.add("status-sent");
        return;
    }

    if (status === "delivered") {
        statusElement.textContent = "✓✓";
        statusElement.classList.add("status-delivered");
        return;
    }

    if (status === "seen") {
        statusElement.textContent = "✓✓";
        statusElement.classList.add("status-seen");
    }
}

function addMessage(msg, sender, id, time, status = null, exprireAt = null) {
    const p = document.createElement("p");
    const textSpan = document.createElement("span");
    const metaSpan = document.createElement("span");
    const timeSpan = document.createElement("span");

    textSpan.classList.add("message-text");
    textSpan.textContent = msg;

    metaSpan.classList.add("message-meta");

    timeSpan.classList.add("message-time");
    timeSpan.textContent = time || formatTime();

    p.classList.add(sender === "You" ? "sent" : "received");
    p.appendChild(textSpan);
    p.appendChild(metaSpan);
    metaSpan.appendChild(timeSpan);

    if (sender === "You") {
        const statusSpan = document.createElement("span");
        statusSpan.classList.add("message-status");
        setStatusText(statusSpan, status || "sent");
        metaSpan.appendChild(statusSpan);
    }
    
    if (id) {
        p.setAttribute("data-id", id);
        p.setAttribute("data-expire-at", exprireAt);
    }
    // Schedule message expiration if expireAt is provided
    if (id && exprireAt) {
        scheduleMessageExpiration(id, exprireAt);
    }

    messageDiv.appendChild(p);
    messageDiv.scrollTop = messageDiv.scrollHeight;
}

function updateMessageStatus(id, status) {
    const messageElement = document.querySelector(`[data-id="${id}"]`);
    if (!messageElement || !messageElement.classList.contains("sent")) {
        return;
    }

    const statusElement = messageElement.querySelector(".message-status");
    setStatusText(statusElement, status);
}

function observerMessageVisible(id) {
    const messageElement = document.querySelector(`[data-id="${id}"]`);
    if (!messageElement) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                socket.emit('message read', id);
                observer.unobserve(messageElement);
            }
        });
    }, { threshold: 0.6 });

    observer.observe(messageElement);
}

function scheduleMessageExpiration(id, expireAt) {
    const now = Date.now();
    const timeleft = expireAt - now;

    if(timeleft <= 0) {
        removeMessage(id);
        return;
    }
    setTimeout(()=>{
        removeMessage(id);
        socket.emit('message expired', id); // Notify server that the message has expired (can be used for cleanup or analytics)
    }, timeleft);
}


function removeMessage(id) {
    const messageElement = document.querySelector(`[data-id="${id}"]`);
    if (messageElement) {
        messageElement.remove();
    }       
}

input.addEventListener('input', () => {
    if (!typing) {
        typing = true;
        socket.emit('typing');
    }
    clearTimeout(typingTimeout);

    typingTimeout = setTimeout(() => {
        typing = false;
        socket.emit('stop typing');
    }, 1000);

});

input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') button.click();
});
// Send message to the server (other users)
button.addEventListener('click', () => {
    const message = input.value.trim();
    if (message === "") return;

    const messageId = createMessageId();
    const messageTime = formatTime();
    const createdAt = Date.now();
    const expireAt = createdAt + MESSAGE_TTL_MS;

    addMessage(message, "You", messageId, messageTime, "sent", expireAt);
    socket.emit('message', {
        id: messageId,
        text: message,
        time: messageTime,
        createdAt: createdAt,
        expireAt: expireAt,
        senderId: clientId
    });

    input.value = "";
})

// Listen for messages from the server (other users/receivers)
socket.on('message', (msg) => {
    addMessage(msg.text, "Other User", msg.id, msg.time, null, msg.expireAt);
    socket.emit('message delivered', msg.id);
    observerMessageVisible(msg.id);
});

socket.on('chat history', (historyMessages) => {
    messageDiv.innerHTML = "";

    historyMessages.forEach((msg) => {
        if (msg.kind === 'call-log') {
            // Render persisted call log chip
            addCallLogMessage(msg.callType, msg.status, msg.duration, msg.time);
        } else {
            const sender = msg.senderId && msg.senderId === clientId ? "You" : "Other User";
            const status = sender === "You" ? "sent" : null;
            addMessage(msg.text, sender, msg.id, msg.time, status, msg.expireAt);
        }
    });
});

socket.on('typing', () => {
    typingDiv.textContent = "Other user is typing...";
    // setTimeout(() =>{
    //     typingDiv.textContent = "";
    // }, 2000);
    });
    
socket.on('stop typing', () => {
    typingDiv.textContent = "";
});

socket.on('message read', (id) => {
    updateMessageStatus(id, 'seen');
});

socket.on('message delivered', (id) => {
    updateMessageStatus(id, 'delivered');
});

socket.on('message expired', (id) => {
    removeMessage(id);      
});

// ================================================================
// WebRTC — Audio & Video Call
// ================================================================
// ── ICE Config (fetched from server — supports Metered.ca dynamic TURN) ───
// The server returns Metered.ca credentials when env vars are set,
// or falls back to static openrelay. Cached after first call.
let _iceConfigCache = null;

async function fetchIceConfig() {
    if (_iceConfigCache) return _iceConfigCache;
    try {
        const res  = await fetch('/api/ice-config');
        const data = await res.json();
        _iceConfigCache = {
            iceServers:        data.iceServers,
            bundlePolicy:      'max-bundle',
            rtcpMuxPolicy:     'require',
            iceCandidatePoolSize: 10,
        };
    } catch (e) {
        console.warn('ICE config fetch failed, using minimal fallback:', e);
        _iceConfigCache = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ],
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require',
            iceCandidatePoolSize: 10,
        };
    }
    return _iceConfigCache;
}

// State
let callState            = 'idle'; // 'idle' | 'calling' | 'incoming' | 'connected'
let callType             = 'audio'; // 'audio' | 'video'
let pendingCallType      = 'audio';
let localStream          = null;
let peerConnection       = null;
let pendingOffer         = null;
let pendingIceCandidates = [];
let isMuted              = false;
let isCameraOff          = false;
let amICaller            = false;
let callTimer            = null;
let callSeconds          = 0;
let disconnectTimer      = null;

// ── Socket.IO Relay state ────────────────────────────────────────────────
// Used when WebRTC P2P fails (e.g. both sides behind mobile CGNAT).
// The server acts as a relay: audio as PCM binary, video as JPEG frames.
let callRelayMode    = false;  // are we in server-relay mode?
let relayAudioCtx    = null;   // AudioContext for microphone capture
let relayAudioProc   = null;   // ScriptProcessorNode (deprecated but widely supported)
let relayPlayCtx     = null;   // AudioContext for playing received audio
let relayNextTime    = 0;      // WebAudio clock cursor for gapless playback
let relayVideoTimer  = null;   // setInterval for JPEG frame sends
let relayCapVideo    = null;   // hidden <video> used to grab local frames
let relayCanvas      = null;   // off-screen canvas for JPEG encoding
let relayRxSampleRate = 44100; // receiver's sample rate (sent by sender in relay-start)

// DOM — audio bar
const callBtn             = document.getElementById('callBtn');
const videoCallBtn        = document.getElementById('videoCallBtn');
const activeCallBar       = document.getElementById('activeCallBar');
const incomingCallOverlay = document.getElementById('incomingCallOverlay');
const acceptCallBtn       = document.getElementById('acceptCallBtn');
const rejectCallBtn       = document.getElementById('rejectCallBtn');
const endCallBtn          = document.getElementById('endCallBtn');
const muteBtn             = document.getElementById('muteBtn');
const callDurationEl      = document.getElementById('callDuration');
const remoteAudio         = document.getElementById('remoteAudio');
const incomingTypeLabel   = document.getElementById('incomingTypeLabel');

// DOM — video overlay
const videoCallOverlay  = document.getElementById('videoCallOverlay');
const callingOverlay    = document.getElementById('callingOverlay');
const remoteVideo       = document.getElementById('remoteVideo');
const relayVideoImg     = document.getElementById('relayVideoImg');
const relayBadge        = document.getElementById('relayBadge');
const localVideo        = document.getElementById('localVideo');
const videoCallDurEl    = document.getElementById('videoCallDuration');
const videoMuteAudioBtn = document.getElementById('videoMuteAudioBtn');
const videoMuteVideoBtn = document.getElementById('videoMuteVideoBtn');
const videoEndCallBtn   = document.getElementById('videoEndCallBtn');
const cancelCallBtn     = document.getElementById('cancelCallBtn');

// ── Peer Connection ──────────────────────────────────────────────
async function createPeerConnection() {
    const config = await fetchIceConfig();
    peerConnection = new RTCPeerConnection(config);

    peerConnection.onicecandidate = ({ candidate }) => {
        if (candidate) socket.emit('ice-candidate', { candidate });
    };

    // ── Track handler: separate audio + video for mobile reliability ──────
    // Routing audio through a <video> srcObject is unreliable on mobile
    // (often played through earpiece, not speaker). Using a dedicated
    // <audio> element guarantees speaker output on iOS and Android.
    peerConnection.ontrack = (event) => {
        const track = event.track;

        if (track.kind === 'audio') {
            // Always route remote audio through dedicated <audio> element
            const audioStream = new MediaStream([track]);
            remoteAudio.srcObject = audioStream;
            remoteAudio.play().catch(e => console.warn('Remote audio play:', e));

        } else if (track.kind === 'video' && callType === 'video') {
            // Route video track to <video> element (muted — audio is handled above)
            const videoStream = new MediaStream([track]);
            remoteVideo.srcObject = videoStream;
            remoteVideo.muted = true;
            remoteVideo.play().catch(e => console.warn('Remote video play:', e));
        }
    };

    // ── Connection state: 'disconnected' is transient — give it 8s to recover ──
    peerConnection.onconnectionstatechange = () => {
        const s = peerConnection.connectionState;
        if (s === 'connected') {
            if (disconnectTimer) { clearTimeout(disconnectTimer); disconnectTimer = null; }
        } else if (s === 'disconnected') {
            disconnectTimer = setTimeout(() => {
                if (peerConnection && peerConnection.connectionState === 'disconnected') {
                    // Still disconnected after 8s — switch to relay then
                    if (!callRelayMode && callState !== 'idle') startRelayMode();
                    else endCall(false);
                }
            }, 8000);
        } else if (s === 'failed') {
            if (disconnectTimer) { clearTimeout(disconnectTimer); disconnectTimer = null; }
            // ICE failed — try our Socket.IO relay instead of ending the call
            if (!callRelayMode && callState !== 'idle') {
                startRelayMode();
            } else {
                endCall(false);
            }
        }
    };
}

async function flushPendingCandidates() {
    for (const c of pendingIceCandidates) {
        try { await peerConnection.addIceCandidate(new RTCIceCandidate(c)); }
        catch (e) { console.error('ICE candidate error:', e); }
    }
    pendingIceCandidates = [];
}

// ── Call Button Listeners ────────────────────────────────────────
callBtn.addEventListener('click', () => {
    if (callState === 'calling' || callState === 'connected') { endCall(true); return; }
    if (callState === 'idle') startCall('audio');
});

videoCallBtn.addEventListener('click', () => {
    if (callState === 'calling' || callState === 'connected') { endCall(true); return; }
    if (callState === 'idle') startCall('video');
});

// ── Start Call ───────────────────────────────────────────────────
async function startCall(type) {
    callType = type;
    const constraints = type === 'video'
        ? { audio: true, video: { width: 640, height: 480 } }
        : { audio: true };

    try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
        alert(`${type === 'video' ? 'Camera/Microphone' : 'Microphone'} access denied.`);
        return;
    }

    callState = 'calling';
    amICaller = true;
    await createPeerConnection(); // must await — it fetches ICE config async
    localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('call-offer', { offer, callType: type });

    // Show the full-screen calling screen for both audio and video
    callingOverlay.classList.remove('hidden');
    if (type === 'video') {
        // Pre-attach local stream so it's ready when the screen transitions
        localVideo.srcObject = localStream;
        videoCallBtn.classList.add('in-call');
    } else {
        callBtn.classList.add('in-call');
        callBtn.title = 'Cancel Call';
    }
}

// ── Accept / Reject ──────────────────────────────────────────────
acceptCallBtn.addEventListener('click', acceptCall);
rejectCallBtn.addEventListener('click', rejectCall);
endCallBtn.addEventListener('click',       () => endCall(true));
muteBtn.addEventListener('click',          toggleMute);
videoMuteAudioBtn.addEventListener('click', toggleMute);
videoMuteVideoBtn.addEventListener('click', toggleCamera);
videoEndCallBtn.addEventListener('click',  () => endCall(true));
cancelCallBtn.addEventListener('click',    () => endCall(true));

async function acceptCall() {
    callType = pendingCallType;
    const constraints = callType === 'video'
        ? { audio: true, video: { width: 640, height: 480 } }
        : { audio: true };

    try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
        alert(`${callType === 'video' ? 'Camera/Microphone' : 'Microphone'} access denied.`);
        rejectCall(); return;
    }

    callState = 'connected';
    await createPeerConnection(); // must await — it fetches ICE config async
    localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));

    await peerConnection.setRemoteDescription(new RTCSessionDescription(pendingOffer));
    await flushPendingCandidates();

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('call-answer', { answer });

    showConnectedUI();
}

function rejectCall() {
    const type = pendingCallType;
    socket.emit('call-rejected');
    callState = 'idle';
    pendingOffer = null;
    incomingCallOverlay.classList.add('hidden');
    // Persist & broadcast via server
    socket.emit('call-log', { callType: type, status: 'declined', time: formatTime() });
}

// ── End Call ─────────────────────────────────────────────────────
function endCall(notifyPeer = true) {
    // Capture state BEFORE cleanup for call log
    const prevState    = callState;
    const prevType     = callType;
    const prevDuration = callSeconds;
    const wasCaller    = amICaller;

    if (notifyPeer && prevState !== 'idle') socket.emit('call-end');

    if (peerConnection) { peerConnection.close(); peerConnection = null; }
    if (localStream)    { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
    if (remoteAudio.srcObject) remoteAudio.srcObject = null;
    if (remoteVideo.srcObject) { remoteVideo.srcObject = null; remoteVideo.muted = false; }
    if (localVideo.srcObject)  localVideo.srcObject  = null;

    if (disconnectTimer) { clearTimeout(disconnectTimer); disconnectTimer = null; }
    cleanupRelay();
    pendingOffer = null;
    pendingIceCandidates = [];
    isMuted = false; isCameraOff = false;
    amICaller = false;
    callState = 'idle'; callType = 'audio';

    stopCallTimer();
    callingOverlay.classList.add('hidden');
    activeCallBar.classList.add('hidden');
    videoCallOverlay.classList.add('hidden');
    incomingCallOverlay.classList.add('hidden');
    callBtn.classList.remove('in-call');
    videoCallBtn.classList.remove('in-call');
    callBtn.title = 'Audio Call';
    videoCallBtn.title = 'Video Call';
    muteBtn.classList.remove('muted');
    videoMuteAudioBtn.classList.remove('muted');
    videoMuteVideoBtn.classList.remove('camera-off');

    // ── Call log: emit to server (persisted + broadcast to both sides) ──
    if (prevState === 'idle') return;

    if (!notifyPeer) return; // the other side already emitted (or will emit) the log

    let logStatus;
    if (prevState === 'connected') {
        logStatus = 'completed';
    } else if (prevState === 'calling') {
        logStatus = 'cancelled';
    } else {
        return; // incoming + notifyPeer shouldn't reach here normally
    }

    socket.emit('call-log', {
        callType: prevType,
        status:   logStatus,
        duration: prevDuration,
        time:     formatTime(),
    });
}

// ── Mute / Camera ─────────────────────────────────────────────────
function toggleMute() {
    if (!localStream) return;
    isMuted = !isMuted;
    localStream.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
    muteBtn.classList.toggle('muted', isMuted);
    videoMuteAudioBtn.classList.toggle('muted', isMuted);
}

function toggleCamera() {
    if (!localStream) return;
    isCameraOff = !isCameraOff;
    localStream.getVideoTracks().forEach(t => { t.enabled = !isCameraOff; });
    videoMuteVideoBtn.classList.toggle('camera-off', isCameraOff);
}

// ── Timer ─────────────────────────────────────────────────────────
function startCallTimer() {
    callSeconds = 0;
    callTimer = setInterval(() => {
        callSeconds++;
        const m = String(Math.floor(callSeconds / 60)).padStart(2, '0');
        const s = String(callSeconds % 60).padStart(2, '0');
        const t = `${m}:${s}`;
        callDurationEl.textContent = t;
        videoCallDurEl.textContent = t;
    }, 1000);
}

function stopCallTimer() {
    if (callTimer) { clearInterval(callTimer); callTimer = null; }
    callSeconds = 0;
}

// ── Connected UI ─────────────────────────────────────────────────
function showConnectedUI() {
    // Dismiss the calling / incoming screens
    incomingCallOverlay.classList.add('hidden');
    callingOverlay.classList.add('hidden');

    if (callType === 'video') {
        localVideo.srcObject = localStream;
        videoCallOverlay.classList.remove('hidden');
        videoCallBtn.classList.add('in-call');
        requestAnimationFrame(() => {
            localVideo.play().catch(e => console.warn('Local video play:', e));
            if (remoteVideo.srcObject) {
                remoteVideo.play().catch(e => console.warn('Remote video play:', e));
            }
        });
    } else {
        activeCallBar.classList.remove('hidden');
        callBtn.classList.add('in-call');
        callBtn.title = 'End Call';
    }
    startCallTimer();
}

// ── Socket Handlers ────────────────────────────────────────────────
socket.on('call-offer', ({ offer, callType: incomingType }) => {
    if (callState !== 'idle') { socket.emit('call-rejected'); return; }
    callState = 'incoming';
    amICaller = false;
    pendingOffer = offer;
    pendingCallType = incomingType || 'audio';
    if (incomingTypeLabel) {
        incomingTypeLabel.textContent = pendingCallType === 'video' ? '📹 Video Call' : '📞 Audio Call';
    }
    incomingCallOverlay.classList.remove('hidden');
});

socket.on('call-answer', async ({ answer }) => {
    if (!peerConnection) return;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    await flushPendingCandidates();
    callState = 'connected';
    showConnectedUI();
});

socket.on('ice-candidate', async ({ candidate }) => {
    if (peerConnection && peerConnection.remoteDescription) {
        try { await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)); }
        catch (e) { console.error('ICE error:', e); }
    } else {
        pendingIceCandidates.push(candidate);
    }
});

socket.on('call-end',      () => endCall(false));
socket.on('call-rejected', () => endCall(false));

// ================================================================
// Socket.IO Media Relay — self-hosted fallback for mobile CGNAT
// ================================================================
// How it works:
//  1. WebRTC P2P is always attempted first.
//  2. If ICE fails (onconnectionstatechange === 'failed'), we fall back here.
//  3. Audio: mic → ScriptProcessorNode → Int16 PCM → socket → AudioContext playback
//  4. Video: local stream → canvas → JPEG → socket → <img> element

async function startRelayMode() {
    if (callRelayMode) return;
    callRelayMode = true;
    console.info('🔀 WebRTC P2P failed — switching to Socket.IO server relay');

    // ── Audio capture via Web Audio API ───────────────────────────
    if (localStream && localStream.getAudioTracks().length) {
        try {
            relayAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const src = relayAudioCtx.createMediaStreamSource(localStream);
            // ScriptProcessorNode: deprecated but works on all mobile browsers.
            // Processes audio in 2048-sample chunks (~46ms at 44.1kHz).
            relayAudioProc = relayAudioCtx.createScriptProcessor(2048, 1, 1);
            relayAudioProc.onaudioprocess = (e) => {
                if (!callRelayMode || isMuted) return;
                const f32 = e.inputBuffer.getChannelData(0);
                // Convert Float32 (±1.0) → Int16 (saves 50% bandwidth vs float)
                const i16 = new Int16Array(f32.length);
                for (let i = 0; i < f32.length; i++) {
                    i16[i] = Math.max(-32768, Math.min(32767, f32[i] * 32768));
                }
                // volatile: drop packet if socket is busy (prefer dropping over latency)
                socket.volatile.emit('relay-audio', i16.buffer);
            };
            src.connect(relayAudioProc);
            relayAudioProc.connect(relayAudioCtx.destination);
        } catch (e) { console.warn('Relay audio capture failed:', e); }
    }

    // ── Video capture via canvas frame grab (8 fps, 320x240 JPEG) ──
    if (callType === 'video' && localStream && localStream.getVideoTracks().length) {
        try {
            relayCanvas = document.createElement('canvas');
            relayCanvas.width = 320; relayCanvas.height = 240;
            const ctx2d = relayCanvas.getContext('2d');

            // Hidden video element feeds local webcam frames into the canvas
            relayCapVideo = document.createElement('video');
            relayCapVideo.srcObject = localStream;
            relayCapVideo.muted     = true;
            relayCapVideo.setAttribute('playsinline', '');
            await relayCapVideo.play().catch(() => {});

            relayVideoTimer = setInterval(() => {
                if (!callRelayMode || !relayCapVideo) return;
                try {
                    ctx2d.drawImage(relayCapVideo, 0, 0, 320, 240);
                    const jpeg = relayCanvas.toDataURL('image/jpeg', 0.35);
                    socket.volatile.emit('relay-video', jpeg);
                } catch (_) {}
            }, 125); // ~8 fps
        } catch (e) { console.warn('Relay video capture failed:', e); }
    }

    // Show relay badge + notify peer to also switch
    if (relayBadge) relayBadge.classList.remove('hidden');
    socket.emit('relay-start', {
        relayType:  callType,
        sampleRate: relayAudioCtx ? relayAudioCtx.sampleRate : 44100,
    });
}

function cleanupRelay() {
    callRelayMode = false;
    if (relayAudioProc)  { try { relayAudioProc.disconnect(); } catch(_) {} relayAudioProc = null; }
    if (relayAudioCtx)   { relayAudioCtx.close().catch(() => {}); relayAudioCtx = null; }
    if (relayPlayCtx)    { relayPlayCtx.close().catch(() => {}); relayPlayCtx = null; }
    if (relayVideoTimer) { clearInterval(relayVideoTimer); relayVideoTimer = null; }
    if (relayCapVideo)   { relayCapVideo.srcObject = null; relayCapVideo = null; }
    relayCanvas = null; relayNextTime = 0; relayRxSampleRate = 44100;
    if (relayVideoImg)  { relayVideoImg.classList.add('hidden'); relayVideoImg.src = ''; }
    if (relayBadge)     relayBadge.classList.add('hidden');
    if (remoteVideo)    remoteVideo.style.display = '';
}

// ── Relay receivers ───────────────────────────────────────────────────
socket.on('relay-start', ({ relayType, sampleRate }) => {
    relayRxSampleRate = sampleRate || 44100;
    if (callState !== 'idle' && !callRelayMode) startRelayMode();
});

socket.on('relay-audio', (pcmBuffer) => {
    if (callState === 'idle') return;
    try {
        // Lazy-init playback context using the sender's sample rate
        if (!relayPlayCtx) {
            relayPlayCtx = new (window.AudioContext || window.webkitAudioContext)(
                { sampleRate: relayRxSampleRate }
            );
            relayNextTime = relayPlayCtx.currentTime + 0.1; // 100ms initial buffer
        }
        const ctx = relayPlayCtx;
        const i16 = new Int16Array(pcmBuffer);
        const f32 = new Float32Array(i16.length);
        for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 32768.0;

        const buf = ctx.createBuffer(1, f32.length, relayRxSampleRate);
        buf.copyToChannel(f32, 0);

        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);

        // Schedule gaplessly: if we fall behind, jump ahead to avoid build-up
        const now = ctx.currentTime;
        if (relayNextTime < now) relayNextTime = now + 0.05;
        src.start(relayNextTime);
        relayNextTime += buf.duration;
    } catch (e) { console.warn('Relay audio playback error:', e); }
});

socket.on('relay-video', (jpeg) => {
    if (callState === 'idle') return;
    if (relayVideoImg) {
        relayVideoImg.src = jpeg;
        relayVideoImg.classList.remove('hidden');
        remoteVideo.style.display = 'none'; // hide empty WebRTC video
    }
});

// Receive persisted call-log entry from server and render chip
socket.on('call-log', (entry) => {
    addCallLogMessage(entry.callType, entry.status, entry.duration, entry.time);
});

// ── Call Log Chip (Instagram-style) ───────────────────────────────
function addCallLogMessage(type, status, durationSecs = 0, time = null) {
    const isVideo = type === 'video';
    const icon    = isVideo ? '📹' : '📞';
    const label   = isVideo ? 'Video call' : 'Audio call';

    let text, isMissed = false;

    if (status === 'completed') {
        const m = String(Math.floor(durationSecs / 60)).padStart(2, '0');
        const s = String(durationSecs % 60).padStart(2, '0');
        text = `${label} · ${m}:${s}`;
    } else if (status === 'missed') {
        text = `Missed ${label.toLowerCase()}`; isMissed = true;
    } else if (status === 'no-answer') {
        text = `${label} · No answer`;
    } else if (status === 'cancelled') {
        text = `${label} · Cancelled`;
    } else if (status === 'declined') {
        text = `${label} · Declined`; isMissed = true;
    } else {
        return;
    }

    const displayTime = time || formatTime();

    const wrap = document.createElement('div');
    wrap.className = `call-log${isMissed ? ' call-log--missed' : ''}`;
    wrap.innerHTML = `
        <span class="call-log-icon">${icon}</span>
        <span class="call-log-text">${text}</span>
        <span class="call-log-time">${displayTime}</span>
    `;

    messageDiv.appendChild(wrap);
    messageDiv.scrollTop = messageDiv.scrollHeight;
}

//hgfh
