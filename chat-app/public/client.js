const socket = io();

console.log("Trying to connect to the server...");

socket.on('connect', () =>{
    console.log("Connected to the server with id: " + socket.id);

    socket.emit('message', 'Hello from the client!');
})

socket.on('message', (msg) => {
    console.log("Message from the server: ", msg);
})