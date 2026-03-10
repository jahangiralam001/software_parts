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
        const sender = msg.senderId && msg.senderId === clientId ? "You" : "Other User";
        const status = sender === "You" ? "sent" : null;
        addMessage(msg.text, sender, msg.id, msg.time, status, msg.expireAt);
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