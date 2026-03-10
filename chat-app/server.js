const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs').promises;
const path = require('path');


const app = express();
const server = http.createServer(app);
const io = new Server(server);
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

initStorage();

app.use(express.static(("public")));

server.listen(3000, () => {
    console.log("Server is running on port 3000");
})

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

});
