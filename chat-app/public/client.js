const socket = io();
let typing = false;
let typingTimeout;

console.log("Trying to connect to the server...");

const input = document.getElementById("messageInput");
const button = document.getElementById("sendBtn");
const messageDiv = document.getElementById("message");
const typingDiv = document.getElementById("typing");


function addMessage(msg, sender) {
    const p = document.createElement("p");
    p.textContent = msg;
    // Add bubble class for styling (sent = right/blue, received = left/gray)
    p.classList.add(sender === "You" ? "sent" : "received");
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

    //1. show message immediately/locally (Sender side)
    addMessage(message, "You");

    //2. send message to the server
    socket.emit('message', message);

    input.value = "";
})


socket.on('message', (msg) =>{
    // const p = document.createElement("p");
    // p.textContent = msg;
    // messageDiv.appendChild(p);
    addMessage(msg, "Other User");
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

socket.on('message', (msg) => {
    console.log("Message from the server: ", msg);
})
