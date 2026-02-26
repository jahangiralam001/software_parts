const socket = io();
let typing = false;
let typingTimeout;

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

function addMessage(msg, sender, id, time, status = null) {
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

button.addEventListener('click', () => {
    const message = input.value.trim();
    if (message === "") return;

    const messageId = createMessageId();
    const messageTime = formatTime();

    addMessage(message, "You", messageId, messageTime, "sent");

    socket.emit('message', {
        id: messageId,
        text: message,
        time: messageTime
    });

    input.value = "";
})


socket.on('message', (msg) => {
    addMessage(msg.text, "Other User", msg.id, msg.time);
    socket.emit('message delivered', msg.id);
    observerMessageVisible(msg.id);
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
