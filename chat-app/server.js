const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs').promises;
const path = require('path');


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});
const DATA_DIR = path.join(__dirname, 'data');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const MESSAGE_TTL_MS = 24 * 60 * 60 * 1000; // Messages will expire after 24 hours

let messages = [];
const expirationTimers = new Map();

async function ensureStorage() {
    await fs.mkdir(DATA_DIR, { recursive: true });

    try {
        await fs.access(MESSAGES_FILE);
    } catch {
        await fs.writeFile(MESSAGES_FILE, '[]', 'utf8');
    }
}

async function loadMessages() {
    const raw = await fs.readFile(MESSAGES_FILE, 'utf8');
    const parsed = JSON.parse(raw || '[]');
    messages = Array.isArray(parsed) ? parsed : [];
}

async function saveMessages() {
    await fs.writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2), 'utf8');
}

function clearMessageTimer(id) {
    const timer = expirationTimers.get(id);
    if (timer) {
        clearTimeout(timer);
        expirationTimers.delete(id);
    }
}

async function expireMessage(id, shouldBroadcast = true) {
    clearMessageTimer(id);
    const beforeCount = messages.length;
    messages = messages.filter((message) => message.id !== id);

    if (messages.length === beforeCount) {
        return;
    }

    await saveMessages();

    if (shouldBroadcast) {
        io.emit('message expired', id);
    }
}

function scheduleMessageExpiration(id, expireAt) {
    clearMessageTimer(id);

    const delay = expireAt - Date.now();
    if (delay <= 0) {
        expireMessage(id).catch((error) => {
            console.error('Failed to expire message immediately:', error);
        });
        return;
    }

    const timer = setTimeout(() => {
        expireMessage(id).catch((error) => {
            console.error('Failed to expire scheduled message:', error);
        });
    }, delay);

    expirationTimers.set(id, timer);
}

async function pruneExpiredMessages() {
    const now = Date.now();
    const expiredIds = messages
        .filter((message) => Number(message.expireAt) <= now)
        .map((message) => message.id);

    if (expiredIds.length === 0) {
        return;
    }

    messages = messages.filter((message) => Number(message.expireAt) > now);
    await saveMessages();

    expiredIds.forEach((id) => {
        clearMessageTimer(id);
        io.emit('message expired', id);
    });
}

async function initStorage() {
    try {
        await ensureStorage();
        await loadMessages();
        await pruneExpiredMessages();

        messages.forEach((message) => {
            if (message && message.id && Number(message.expireAt)) {
                scheduleMessageExpiration(message.id, Number(message.expireAt));
            }
        });
    } catch (error) {
        console.error('Failed to initialize storage:', error);
        messages = [];
    }
}

// ── ICE / TURN credential endpoint ───────────────────────────────────────────
// If METERED_APP_NAME + METERED_API_KEY env vars are set (free Metered.ca account),
// the server fetches fresh TURN credentials and returns them to the client.
// Falls back to static public relay credentials if they are not set.
app.get('/api/ice-config', async (req, res) => {
    const appName = process.env.METERED_APP_NAME;
    const apiKey  = process.env.METERED_API_KEY;

    if (appName && apiKey) {
        try {
            const url = `https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`;
            const response = await fetch(url);
            if (response.ok) {
                const iceServers = await response.json();
                return res.json({ iceServers });
            }
            console.warn('Metered.ca responded with', response.status);
        } catch (err) {
            console.warn('Metered.ca TURN fetch failed:', err.message);
        }
    }

    // Static fallback — works for simple NAT, may fail mobile↔mobile
    res.json({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'turn:openrelay.metered.ca:80',    username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:openrelay.metered.ca:443',   username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turns:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
        ]
    });
});

app.use(express.static(("public")));


const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
})

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n❌  Port ${PORT} is already in use.`);
        console.error(`    Stop the old server first, then run: npm run dev\n`);
        process.exit(1);
    } else {
        throw err;
    }
});

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.emit('chat history', messages);

    socket.on('message', async (msg) => {
        console.log('server is saying message got from the client:', msg);

        const createdAt = Number(msg?.createdAt) || Date.now();
        const expireAt = Number(msg?.expireAt) || (createdAt + MESSAGE_TTL_MS);

        const storedMessage = {
            id: String(msg?.id || `${Date.now()}-${Math.floor(Math.random() * 100000)}`),
            text: String(msg?.text || ''),
            time: msg?.time || new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            createdAt,
            expireAt,
            senderId: msg?.senderId || null
        };

        messages.push(storedMessage);

        try {
            await saveMessages();
            scheduleMessageExpiration(storedMessage.id, expireAt);
            socket.broadcast.emit('message', storedMessage);
        } catch (error) {
            console.error('Failed to persist message:', error);
        }
    });

    socket.on('typing', (msg) => {
        socket.broadcast.emit('typing');
    });
    
    socket.on('stop typing', (msg) => {
        socket.broadcast.emit('stop typing');
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });

    socket.on('message read', (id) => {
        socket.broadcast.emit('message read', id);
    });

    socket.on('message delivered', (id) => {
        socket.broadcast.emit('message delivered', id);
    });

    socket.on('message expired', async (id) => {
        try {
            await expireMessage(id, true);
        } catch (error) {
            console.error('Failed to handle message expired event:', error);
        }
    });

    // ── WebRTC Signaling (relay only) ──────────────────
    socket.on('call-offer',     (data) => socket.broadcast.emit('call-offer', data));
    socket.on('call-answer',    (data) => socket.broadcast.emit('call-answer', data));
    socket.on('ice-candidate',  (data) => socket.broadcast.emit('ice-candidate', data));
    socket.on('call-end',       ()     => socket.broadcast.emit('call-end'));
    socket.on('call-rejected',  ()     => socket.broadcast.emit('call-rejected'));

    // ── Call log — persisted with same 24 h TTL as messages ─────────
    socket.on('call-log', async (data) => {
        const createdAt = Date.now();
        const expireAt  = createdAt + MESSAGE_TTL_MS;

        const entry = {
            id:       `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
            kind:     'call-log',
            callType: String(data?.callType || 'audio'),
            status:   String(data?.status   || 'completed'),
            duration: Number(data?.duration) || 0,
            time:     data?.time || new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            createdAt,
            expireAt,
        };

        messages.push(entry);

        try {
            await saveMessages();
            scheduleMessageExpiration(entry.id, expireAt);
            io.emit('call-log', entry); // broadcast to ALL clients (including sender)
        } catch (err) {
            console.error('Failed to persist call log:', err);
        }
    });

});
