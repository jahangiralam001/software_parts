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
const imageBtn = document.getElementById("imageBtn");
const imageInput = document.getElementById("imageInput");
const e2eeBtn = document.getElementById("e2eeBtn");
const messageDiv = document.getElementById("message");
const typingDiv = document.getElementById("typing");
const appDialog = document.getElementById("appDialog");
const appDialogTitle = document.getElementById("appDialogTitle");
const appDialogMessage = document.getElementById("appDialogMessage");
const appDialogInput = document.getElementById("appDialogInput");
const appDialogCancel = document.getElementById("appDialogCancel");
const appDialogOk = document.getElementById("appDialogOk");
const IMAGE_TTL_MS = 10 * 60 * 1000;
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const E2EE_STORAGE_KEY = 'chat_e2ee_passphrase';
const E2EE_COUNTER_KEY = 'chat_e2ee_send_counter';
const E2EE_VERSION = 1;

let e2eePassphrase = sessionStorage.getItem(E2EE_STORAGE_KEY) || '';
let e2eeRootSecretPromise = null;
let e2eeLegacyKeyPromise = null;
let e2eeFingerprint = '';
let sendKeyCounter = Number(localStorage.getItem(E2EE_COUNTER_KEY) || 0);

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function showAppDialog(options) {
    const {
        title = 'Notice',
        message = '',
        mode = 'alert',
        okText = 'OK',
        cancelText = 'Cancel',
        inputValue = '',
        inputPlaceholder = '',
    } = options;

    return new Promise((resolve) => {
        if (!appDialog) {
            resolve(mode === 'prompt' ? null : true);
            return;
        }

        appDialogTitle.textContent = title;
        appDialogMessage.textContent = message;
        appDialogOk.textContent = okText;
        appDialogCancel.textContent = cancelText;

        const isPrompt = mode === 'prompt';
        const isConfirm = mode === 'confirm';

        appDialogInput.classList.toggle('hidden', !isPrompt);
        appDialogCancel.style.display = isConfirm || isPrompt ? '' : 'none';

        if (isPrompt) {
            appDialogInput.value = inputValue;
            appDialogInput.placeholder = inputPlaceholder;
        } else {
            appDialogInput.value = '';
            appDialogInput.placeholder = '';
        }

        const close = (value) => {
            appDialog.classList.add('hidden');
            appDialogOk.removeEventListener('click', onOk);
            appDialogCancel.removeEventListener('click', onCancel);
            appDialog.removeEventListener('click', onBackdropClick);
            document.removeEventListener('keydown', onKeyDown);
            resolve(value);
        };

        const onOk = () => {
            if (isPrompt) {
                close(appDialogInput.value);
            } else {
                close(true);
            }
        };

        const onCancel = () => {
            close(isPrompt ? null : false);
        };

        const onBackdropClick = (event) => {
            if (!event.target.matches('[data-dialog-close="backdrop"]')) return;
            if (mode === 'alert') {
                close(true);
            } else {
                onCancel();
            }
        };

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                if (mode === 'alert') close(true);
                else onCancel();
                return;
            }

            if (event.key === 'Enter') {
                onOk();
            }
        };

        appDialogOk.addEventListener('click', onOk);
        appDialogCancel.addEventListener('click', onCancel);
        appDialog.addEventListener('click', onBackdropClick);
        document.addEventListener('keydown', onKeyDown);

        appDialog.classList.remove('hidden');
        if (isPrompt) appDialogInput.focus();
        else appDialogOk.focus();
    });
}

function appAlert(message, title = 'Notice') {
    return showAppDialog({ title, message, mode: 'alert' });
}

function appConfirm(message, title = 'Confirm') {
    return showAppDialog({ title, message, mode: 'confirm' });
}

function appPrompt(message, inputValue = '', title = 'Input') {
    return showAppDialog({
        title,
        message,
        mode: 'prompt',
        inputValue,
        inputPlaceholder: 'Enter value',
    });
}

function updateE2EEButtonState() {
    if (!e2eeBtn) return;
    const configured = Boolean(e2eePassphrase);
    e2eeBtn.classList.toggle('configured', configured);
    e2eeBtn.title = configured ? 'Encryption key set (tap to change)' : 'Set encryption key';
}

function toBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}

function fromBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function bytesToHex(bytes) {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

function formatFingerprint(bytes) {
    const hex = bytesToHex(bytes).slice(0, 24);
    return hex.match(/.{1,4}/g).join('-').toUpperCase();
}

async function deriveRootSecret(passphrase) {
    const passphraseKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(passphrase),
        'PBKDF2',
        false,
        ['deriveBits']
    );

    const bits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: encoder.encode('chat-app-e2ee-v1'),
            iterations: 210000,
            hash: 'SHA-256',
        },
        passphraseKey,
        256
    );

    return new Uint8Array(bits);
}

async function deriveLegacyE2EEKey(passphrase) {
    const passphraseKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(passphrase),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode('chat-app-e2ee-v1'),
            iterations: 210000,
            hash: 'SHA-256',
        },
        passphraseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

async function deriveMessageKey(rootSecret, senderId, keyCounter, saltBytes) {
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        rootSecret,
        'HKDF',
        false,
        ['deriveKey']
    );

    const info = encoder.encode(`chat-msg|v${E2EE_VERSION}|${senderId}|${keyCounter}`);

    return crypto.subtle.deriveKey(
        {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: saltBytes,
            info,
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

async function setE2EEPassphrase(passphrase) {
    const prevFingerprint = e2eeFingerprint;
    const hadKeyBefore = Boolean(e2eePassphrase);

    e2eePassphrase = passphrase.trim();
    sessionStorage.setItem(E2EE_STORAGE_KEY, e2eePassphrase);
    e2eeRootSecretPromise = deriveRootSecret(e2eePassphrase);
    e2eeLegacyKeyPromise = deriveLegacyE2EEKey(e2eePassphrase);

    const rootSecret = await e2eeRootSecretPromise;
    const digest = await crypto.subtle.digest('SHA-256', rootSecret);
    e2eeFingerprint = formatFingerprint(new Uint8Array(digest));

    updateE2EEButtonState();

    return {
        changed: hadKeyBefore && prevFingerprint && prevFingerprint !== e2eeFingerprint,
        fingerprint: e2eeFingerprint,
    };
}

async function requestE2EEPassphrase() {
    const entered = await appPrompt(
        'Enter a shared chat encryption key (same key on both devices, min 8 characters):',
        e2eePassphrase || '',
        'Encryption Key'
    );
    if (!entered) return false;
    if (entered.trim().length < 8) {
        await appAlert('Encryption key must be at least 8 characters.', 'Invalid Key');
        return false;
    }
    const { changed, fingerprint } = await setE2EEPassphrase(entered);
    await appAlert(`Safety number: ${fingerprint}\nVerify this matches on both devices.`, 'Safety Number');

    if (changed) {
        socket.emit('security-event', {
            eventType: 'key-changed',
            senderId: clientId,
            time: formatTime(),
        });
    }
    return true;
}

async function ensureE2EEReady(interactive = true) {
    if (!window.crypto || !window.crypto.subtle) {
        await appAlert('Your browser does not support Web Crypto required for end-to-end encryption.', 'Unsupported Browser');
        return false;
    }

    if (!e2eePassphrase) {
        if (!interactive) return false;
        const ok = await requestE2EEPassphrase();
        if (!ok) return false;
    }

    if (!e2eeRootSecretPromise) {
        e2eeRootSecretPromise = deriveRootSecret(e2eePassphrase);
    }

    if (!e2eeLegacyKeyPromise) {
        e2eeLegacyKeyPromise = deriveLegacyE2EEKey(e2eePassphrase);
    }

    return true;
}

async function encryptPayload(plainText, senderId) {
    const ready = await ensureE2EEReady(true);
    if (!ready) throw new Error('Encryption key is required');

    const nextCounter = sendKeyCounter + 1;
    const rootSecret = await e2eeRootSecretPromise;
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveMessageKey(rootSecret, senderId, nextCounter, salt);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(plainText)
    );

    sendKeyCounter = nextCounter;
    localStorage.setItem(E2EE_COUNTER_KEY, String(sendKeyCounter));

    return {
        encrypted: true,
        e2eeVersion: E2EE_VERSION,
        keyCounter: nextCounter,
        salt: toBase64(salt),
        iv: toBase64(iv),
        ciphertext: toBase64(new Uint8Array(encrypted)),
    };
}

async function decryptPayload(msg) {
    const ready = await ensureE2EEReady(false);
    if (!ready) throw new Error('Encryption key not configured');

    const iv = fromBase64(msg.iv);
    const ciphertext = fromBase64(msg.ciphertext);

    if (msg.salt && Number.isFinite(Number(msg.keyCounter))) {
        const rootSecret = await e2eeRootSecretPromise;
        const senderIdForKey = msg.senderId || 'unknown';
        const key = await deriveMessageKey(
            rootSecret,
            senderIdForKey,
            Number(msg.keyCounter),
            fromBase64(msg.salt)
        );

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            ciphertext
        );

        return decoder.decode(decrypted);
    }

    // Backward compatibility with earlier encrypted payload format.
    const legacyKey = await e2eeLegacyKeyPromise;
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        legacyKey,
        ciphertext
    );

    return decoder.decode(decrypted);
}

async function normalizeIncomingMessage(msg) {
    if (!msg || !msg.encrypted) {
        return msg;
    }

    try {
        const plain = await decryptPayload(msg);
        if (msg.kind === 'image') {
            return { ...msg, imageData: plain };
        }
        return { ...msg, text: plain };
    } catch {
        const fallback = msg.kind === 'image'
            ? '[Encrypted image - set/correct key to decrypt]'
            : '[Encrypted message - set/correct key to decrypt]';
        return { ...msg, text: fallback, imageData: null };
    }
}

if (e2eePassphrase) {
    e2eeRootSecretPromise = deriveRootSecret(e2eePassphrase);
    e2eeLegacyKeyPromise = deriveLegacyE2EEKey(e2eePassphrase);
    e2eeRootSecretPromise.then(async (rootSecret) => {
        const digest = await crypto.subtle.digest('SHA-256', rootSecret);
        e2eeFingerprint = formatFingerprint(new Uint8Array(digest));
        updateE2EEButtonState();
    }).catch(() => {});
}
updateE2EEButtonState();

if (e2eeBtn) {
    e2eeBtn.addEventListener('click', async () => {
        if (e2eePassphrase) {
            const shouldRotate = await appConfirm(
                `Safety number: ${e2eeFingerprint}\n\nPress OK to change the key, or Cancel to keep current key.`,
                'Encryption Key'
            );
            if (!shouldRotate) return;
        }
        await requestE2EEPassphrase();
    });
}

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

function addImageMessage(imageData, sender, id, time, status = null, expireAt = null) {
    const p = document.createElement("p");
    const image = document.createElement("img");
    const metaSpan = document.createElement("span");
    const timeSpan = document.createElement("span");

    p.classList.add(sender === "You" ? "sent" : "received", "image-message");

    image.classList.add("message-image");
    image.src = imageData;
    image.alt = "Shared image";
    image.loading = "lazy";

    metaSpan.classList.add("message-meta");

    timeSpan.classList.add("message-time");
    timeSpan.textContent = time || formatTime();

    p.appendChild(image);
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
        p.setAttribute("data-expire-at", expireAt);
    }

    if (id && expireAt) {
        scheduleMessageExpiration(id, expireAt);
    }

    messageDiv.appendChild(p);
    messageDiv.scrollTop = messageDiv.scrollHeight;
}

function addSecurityNotice(text) {
    const notice = document.createElement('div');
    const icon = document.createElement('span');
    const body = document.createElement('span');

    notice.className = 'security-notice';
    icon.className = 'security-notice-icon';
    icon.textContent = '🔐';
    body.textContent = text;

    notice.appendChild(icon);
    notice.appendChild(body);
    messageDiv.appendChild(notice);
    messageDiv.scrollTop = messageDiv.scrollHeight;
}

function buildSecurityNoticeText(eventEntry) {
    if (eventEntry?.eventType === 'key-changed') {
        if (eventEntry.senderId && eventEntry.senderId === clientId) {
            return 'Your security code with this chat changed. Messages sent before change may not decrypt.';
        }
        return 'Security code with this chat changed. Verify with your contact.';
    }

    return 'Security settings were updated for this chat.';
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
button.addEventListener('click', async () => {
    const message = input.value.trim();
    if (message === "") return;

    const messageId = createMessageId();
    const messageTime = formatTime();
    const createdAt = Date.now();
    const expireAt = createdAt + MESSAGE_TTL_MS;
    let encryptedPayload;

    try {
        encryptedPayload = await encryptPayload(message, clientId);
    } catch (error) {
        await appAlert('Unable to encrypt message. Set a valid encryption key first.', 'Encryption Error');
        return;
    }

    addMessage(message, "You", messageId, messageTime, "sent", expireAt);
    socket.emit('message', {
        id: messageId,
        kind: 'text',
        text: '',
        imageData: null,
        ...encryptedPayload,
        time: messageTime,
        createdAt: createdAt,
        expireAt: expireAt,
        senderId: clientId
    });

    input.value = "";
})

imageBtn.addEventListener('click', () => {
    imageInput.click();
});

imageInput.addEventListener('change', () => {
    const file = imageInput.files && imageInput.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        appAlert('Please select an image file.', 'Invalid File');
        imageInput.value = '';
        return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
        appAlert('Image is too large. Max size is 2MB.', 'File Too Large');
        imageInput.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
        const imageData = reader.result;
        if (typeof imageData !== 'string') {
            imageInput.value = '';
            return;
        }

        let encryptedPayload;
        try {
            encryptedPayload = await encryptPayload(imageData, clientId);
        } catch (error) {
            await appAlert('Unable to encrypt image. Set a valid encryption key first.', 'Encryption Error');
            imageInput.value = '';
            return;
        }

        const messageId = createMessageId();
        const messageTime = formatTime();
        const createdAt = Date.now();
        const expireAt = createdAt + IMAGE_TTL_MS;

        addImageMessage(imageData, 'You', messageId, messageTime, 'sent', expireAt);
        socket.emit('message', {
            id: messageId,
            kind: 'image',
            imageData: null,
            text: '',
            ...encryptedPayload,
            time: messageTime,
            createdAt,
            expireAt,
            senderId: clientId,
        });

        imageInput.value = '';
    };

    reader.onerror = () => {
        appAlert('Failed to read the selected image.', 'Upload Error');
        imageInput.value = '';
    };

    reader.readAsDataURL(file);
});

// Listen for messages from the server (other users/receivers)
socket.on('message', async (msg) => {
    const normalized = await normalizeIncomingMessage(msg);

    if (normalized.kind === 'image' && normalized.imageData) {
        addImageMessage(normalized.imageData, "Other User", normalized.id, normalized.time, null, normalized.expireAt);
    } else {
        addMessage(normalized.text || '[Encrypted message]', "Other User", normalized.id, normalized.time, null, normalized.expireAt);
    }
    socket.emit('message delivered', normalized.id);
    observerMessageVisible(normalized.id);
});

socket.on('chat history', async (historyMessages) => {
    messageDiv.innerHTML = "";

    for (const msg of historyMessages) {
        if (msg.kind === 'call-log') {
            // Render persisted call log chip
            addCallLogMessage(msg.callType, msg.status, msg.duration, msg.time);
        } else if (msg.kind === 'security-event') {
            addSecurityNotice(buildSecurityNoticeText(msg));
        } else {
            const normalized = await normalizeIncomingMessage(msg);
            const sender = normalized.senderId && normalized.senderId === clientId ? "You" : "Other User";
            const status = sender === "You" ? "sent" : null;

            if (normalized.kind === 'image' && normalized.imageData) {
                addImageMessage(normalized.imageData, sender, normalized.id, normalized.time, status, normalized.expireAt);
            } else {
                addMessage(normalized.text || '[Encrypted message]', sender, normalized.id, normalized.time, status, normalized.expireAt);
            }
        }
    }
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
let orientationChangeTimer = null;

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
let relayFrameReceived = false; // switch UI only after first valid relay frame

// ── PiP state ────────────────────────────────────────────────────────────────────────────
let remoteVideoStream = null;  // separate ref so swap() can restore it
let pipSwapped        = false; // has the user tapped to swap main ↔ PiP?

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
const callModeBadge     = document.getElementById('callModeBadge');
const localVideo        = document.getElementById('localVideo');
const videoCallDurEl    = document.getElementById('videoCallDuration');
const videoMuteAudioBtn = document.getElementById('videoMuteAudioBtn');
const videoMuteVideoBtn = document.getElementById('videoMuteVideoBtn');
const switchCameraBtn   = document.getElementById('switchCameraBtn');
const videoEndCallBtn   = document.getElementById('videoEndCallBtn');

const cancelCallBtn     = document.getElementById('cancelCallBtn');

let preferredFacingMode = 'user';

// ── Draggable PiP controller (initialised after DOM refs are set) ────────────────
// swapVideos() is defined below showConnectedUI so we defer init.
let pip; // set once the DOM is ready (a few lines down)

if (relayVideoImg) {
    // If a relay JPEG cannot decode, immediately fall back to WebRTC video layer.
    relayVideoImg.addEventListener('error', () => {
        relayVideoImg.classList.add('hidden');
        relayVideoImg.src = '';
        if (remoteVideo) remoteVideo.style.display = '';
        relayFrameReceived = false;
    });
}

function setCallModeBadge(text) {
    if (!callModeBadge) return;
    callModeBadge.textContent = text;
}

function isLandscapeViewport() {
    if (window.matchMedia && window.matchMedia('(orientation: landscape)').matches) return true;
    return window.innerWidth > window.innerHeight;
}

function getPreferredVideoConstraints() {
    const landscape = isLandscapeViewport();
    return {
        width: { ideal: landscape ? 640 : 480 },
        height: { ideal: landscape ? 480 : 640 },
        facingMode: { ideal: preferredFacingMode },
    };
}

function applyLocalPreviewVisuals() {
    if (!localVideo) return;
    localVideo.classList.toggle('preview-landscape', isLandscapeViewport());
    // Mirror only front-camera self preview. Outgoing track is unaffected.
    localVideo.classList.toggle('preview-mirrored', preferredFacingMode === 'user');
}

function getRelayFrameSize() {
    const srcW = relayCapVideo?.videoWidth || 640;
    const srcH = relayCapVideo?.videoHeight || 480;
    const maxEdge = 320;
    let w;
    let h;

    if (srcW >= srcH) {
        w = maxEdge;
        h = Math.max(180, Math.round((srcH / srcW) * maxEdge));
    } else {
        h = maxEdge;
        w = Math.max(180, Math.round((srcW / srcH) * maxEdge));
    }

    return { w, h };
}

async function replaceLocalVideoTrack(newTrack) {
    if (!newTrack || !localStream) return;

    newTrack.enabled = !isCameraOff;

    const oldTrack = localStream.getVideoTracks()[0];
    if (oldTrack) {
        localStream.removeTrack(oldTrack);
        oldTrack.stop();
    }

    localStream.addTrack(newTrack);

    if (peerConnection) {
        const sender = peerConnection.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) {
            await sender.replaceTrack(newTrack);
        }
    }

    if (localVideo) {
        localVideo.srcObject = localStream;
        applyLocalPreviewVisuals();
        localVideo.play().catch(() => {});
    }

    if (relayCapVideo) {
        relayCapVideo.srcObject = localStream;
        relayCapVideo.play().catch(() => {});
    }
}

async function refreshLocalVideoTrackForOrientation() {
    if (!localStream || callType !== 'video' || callState === 'idle') return;

    const switched = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: getPreferredVideoConstraints(),
    });

    const newTrack = switched.getVideoTracks()[0];
    if (!newTrack) {
        switched.getTracks().forEach((t) => t.stop());
        return;
    }

    await replaceLocalVideoTrack(newTrack);
}

function onDeviceOrientationChange() {
    if (orientationChangeTimer) clearTimeout(orientationChangeTimer);
    orientationChangeTimer = setTimeout(() => {
        applyLocalPreviewVisuals();
        refreshLocalVideoTrackForOrientation().catch((e) => {
            console.warn('Orientation refresh failed:', e);
        });
    }, 250);
}

window.addEventListener('orientationchange', onDeviceOrientationChange);
if (screen.orientation && typeof screen.orientation.addEventListener === 'function') {
    screen.orientation.addEventListener('change', onDeviceOrientationChange);
}

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
        const incomingStream = event.streams && event.streams[0] ? event.streams[0] : null;

        if (track.kind === 'audio') {
            // Always route remote audio through dedicated <audio> element
            const audioStream = incomingStream || new MediaStream([track]);
            remoteAudio.srcObject = audioStream;
            remoteAudio.play().catch(e => console.warn('Remote audio play:', e));

        } else if (track.kind === 'video' && callType === 'video') {
            // Route video track to <video> element (muted — audio is handled above)
            const videoStream = incomingStream || new MediaStream([track]);
            remoteVideoStream = videoStream; // keep a separate ref for PiP swap
            if (!pipSwapped) {
                remoteVideo.srcObject = videoStream;
            } else {
                localVideo.srcObject = videoStream; // already swapped — put remote in PiP
            }
            remoteVideo.style.display = '';
            if (relayVideoImg) {
                relayVideoImg.classList.add('hidden');
                relayVideoImg.src = '';
            }
            relayFrameReceived = false;
            remoteVideo.muted = true;
            remoteVideo.play().catch(e => console.warn('Remote video play:', e));
            setCallModeBadge('Direct video');
        }
    };

    // ── Connection state: 'disconnected' is transient — give it 8s to recover ──
    peerConnection.onconnectionstatechange = () => {
        const s = peerConnection.connectionState;
        if (s === 'connected') {
            if (disconnectTimer) { clearTimeout(disconnectTimer); disconnectTimer = null; }
            if (callType === 'video') setCallModeBadge('Waiting for video...');
        } else if (s === 'disconnected') {
            setCallModeBadge('Reconnecting...');
            disconnectTimer = setTimeout(() => {
                if (peerConnection && peerConnection.connectionState === 'disconnected') {
                    // Still disconnected after 8s — switch to relay then
                    if (!callRelayMode && callState !== 'idle') startRelayMode();
                    else endCall(false);
                }
            }, 8000);
        } else if (s === 'failed') {
            if (disconnectTimer) { clearTimeout(disconnectTimer); disconnectTimer = null; }
            setCallModeBadge('Switching to relay...');
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
        ? {
            audio: true,
            video: getPreferredVideoConstraints(),
        }
        : { audio: true };

    try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
        await appAlert(`${type === 'video' ? 'Camera/Microphone' : 'Microphone'} access denied.`, 'Permission Denied');
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
        applyLocalPreviewVisuals();
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
if (switchCameraBtn) {
    switchCameraBtn.addEventListener('click', switchCameraFacing);
}

async function acceptCall() {
    callType = pendingCallType;
    const constraints = callType === 'video'
        ? {
            audio: true,
            video: getPreferredVideoConstraints(),
        }
        : { audio: true };

    try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
        await appAlert(`${callType === 'video' ? 'Camera/Microphone' : 'Microphone'} access denied.`, 'Permission Denied');
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
    // Reset PiP state so next call starts in default layout
    remoteVideoStream = null;
    pipSwapped        = false;

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
    setCallModeBadge('Connecting...');

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

async function switchCameraFacing() {
    if (!localStream || callType !== 'video') return;

    preferredFacingMode = preferredFacingMode === 'user' ? 'environment' : 'user';
    applyLocalPreviewVisuals();

    try {
        const switched = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: getPreferredVideoConstraints(),
        });

        const newTrack = switched.getVideoTracks()[0];
        if (!newTrack) return;

        await replaceLocalVideoTrack(newTrack);
    } catch (e) {
        console.warn('Camera switch failed:', e);
    }
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
        // Reset remote layer state each time video UI is entered.
        if (remoteVideo) remoteVideo.style.display = '';
        if (relayVideoImg) {
            relayVideoImg.classList.add('hidden');
            relayVideoImg.src = '';
        }
        relayFrameReceived = false;

        localVideo.srcObject = localStream;
        applyLocalPreviewVisuals();
        videoCallOverlay.classList.remove('hidden');
        videoCallBtn.classList.add('in-call');
        setCallModeBadge('Waiting for video...');
        requestAnimationFrame(() => {
            localVideo.play().catch(e => console.warn('Local video play:', e));
            if (remoteVideo.srcObject) {
                remoteVideo.play().catch(e => console.warn('Remote video play:', e));
            }
            // Position PiP in bottom-right corner and arm drag logic
            if (pip) pip.reset();
        });
    } else {
        activeCallBar.classList.remove('hidden');
        callBtn.classList.add('in-call');
        callBtn.title = 'End Call';
    }
    startCallTimer();
}

// ── PiP swap (tap on PiP toggles main ↔ small view) ────────────────────────
// Audio is NOT touched: remoteAudio handles remote audio, local is muted everywhere.
function swapVideos() {
    if (callRelayMode) return; // relay mode uses img, skip
    pipSwapped = !pipSwapped;
    if (pipSwapped) {
        // Remote stream moves to PiP, local stream goes full-screen
        localVideo.srcObject  = remoteVideoStream;
        remoteVideo.srcObject = localStream;
    } else {
        // Restore normal layout
        localVideo.srcObject  = localStream;
        remoteVideo.srcObject = remoteVideoStream;
    }
    // Both elements always stay muted (audio handled separately)
    localVideo.muted  = true;
    remoteVideo.muted = true;
    localVideo.play().catch(() => {});
    remoteVideo.play().catch(() => {});
}

// Initialise draggable PiP once DOM refs are all in scope
pip = useDraggablePiP(localVideo, videoCallOverlay, {
    onSwap:       swapVideos,
    margin:       12,
    bottomMargin: 88, // stay above call controls
});

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
    setCallModeBadge('Relay mode');

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
                    const { w, h } = getRelayFrameSize();
                    if (relayCanvas.width !== w || relayCanvas.height !== h) {
                        relayCanvas.width = w;
                        relayCanvas.height = h;
                    }
                    ctx2d.drawImage(relayCapVideo, 0, 0, relayCanvas.width, relayCanvas.height);
                    const jpeg = relayCanvas.toDataURL('image/jpeg', 0.5);
                    socket.emit('relay-video', jpeg);
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
    relayFrameReceived = false;
    if (relayAudioProc)  { try { relayAudioProc.disconnect(); } catch(_) {} relayAudioProc = null; }
    if (relayAudioCtx)   { relayAudioCtx.close().catch(() => {}); relayAudioCtx = null; }
    if (relayPlayCtx)    { relayPlayCtx.close().catch(() => {}); relayPlayCtx = null; }
    if (relayVideoTimer) { clearInterval(relayVideoTimer); relayVideoTimer = null; }
    if (relayCapVideo)   { relayCapVideo.srcObject = null; relayCapVideo = null; }
    relayCanvas = null; relayNextTime = 0; relayRxSampleRate = 44100;
    if (relayVideoImg)  { relayVideoImg.classList.add('hidden'); relayVideoImg.src = ''; }
    if (relayBadge)     relayBadge.classList.add('hidden');
    if (remoteVideo)    remoteVideo.style.display = '';
    setCallModeBadge('Direct video');
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
    if (!relayVideoImg || typeof jpeg !== 'string') return;
    // Ignore malformed frames so we don't switch to a broken image on mobile.
    if (!jpeg.startsWith('data:image/jpeg') || jpeg.length < 128) return;

    // Prefer direct WebRTC video when already live.
    if (!callRelayMode && remoteVideo && remoteVideo.srcObject) {
        const hasLiveDirectVideo = remoteVideo.srcObject
            .getVideoTracks()
            .some((track) => track.readyState === 'live');
        if (hasLiveDirectVideo) return;
    }

    relayVideoImg.src = jpeg;
    relayVideoImg.classList.remove('hidden');

    if (!relayFrameReceived) {
        relayFrameReceived = true;
        remoteVideo.style.display = 'none'; // hide WebRTC video only after first valid relay frame
        setCallModeBadge('Relay video');
    }
});

// Receive persisted call-log entry from server and render chip
socket.on('call-log', (entry) => {
    addCallLogMessage(entry.callType, entry.status, entry.duration, entry.time);
});

socket.on('security-event', (entry) => {
    addSecurityNotice(buildSecurityNoticeText(entry));
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
