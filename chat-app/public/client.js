const socket = io();
let typing = false;
let typingTimeout;

console.log("Trying to connect to the server...");

const input = document.getElementById("messageInput");
const button = document.getElementById("sendBtn");
const messageDiv = document.getElementById("message");
const typingDiv = document.getElementById("typing");


function addMessage(msg, sender, id) {
    const p = document.createElement("p");
    p.textContent = sender + ": " + msg;
    // Add bubble class for styling (sent = right/blue, received = left/gray)
    p.classList.add(sender === "You" ? "sent" : "received");
    if(id) {
        p.setAttribute("data-id", id); // Set data-id attribute for tracking
    }
    messageDiv.appendChild(p);
    // Auto-scroll to latest message
    messageDiv.scrollTop = messageDiv.scrollHeight;
}

input.addEventListener('input', () => {
    // socket.emit('typing', "User is typing...");
    if(!typing) {
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
    const message = input.value;
    if(message.trim() === "") return;
    const messageId = Date.now();

    //1. show message immediately/locally (Sender side)
    addMessage(message, "You", messageId);

    //2. send message to the server
    // socket.emit('message', message);
    socket.emit('message', {
        id: messageId, // Unique ID for this message (can be used to track sender/receiver)
        text: message,
        
    })

    input.value = "";
})


socket.on('message', (msg) =>{
    // const p = document.createElement("p");
    // p.textContent = msg;
    // messageDiv.appendChild(p);
    // addMessage(msg, "Other User");
    addMessage(msg.text, "Other User", msg.id);
    socket.emit('message read', msg.id); // Notify server that message has been read (can be used for read receipts)
})

socket.on('typing', () => {
    typingDiv.textContent = "Other user is typing...";
    // setTimeout(() =>{
    //     typingDiv.textContent = "";
    // }, 2000);
    });
    
socket.on('stop typing', () => {
    typingDiv.textContent = "";
});

// socket.on('connect', () =>{
//     console.log("Connected to the server with id: " + socket.id);

//     socket.emit('message', 'Hello from the client!');
// })
socket.on('message read', (id) => {
    // Find the message element with the corresponding data-id and mark it as read (e.g., change color or add a checkmark)
    const messageElement = document.querySelector(`[data-id="${id}"]`);
    if(messageElement) {
        messageElement.textContent += "✓✓ Read"; // Add 'read' class for styling (e.g., change color to indicate read status)
    }
});

socket.on('message', (msg) => {
    console.log("Message from the server: ", msg);
})
