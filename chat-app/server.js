const express = require('express');
const http = require('http');
const { Server } = require('socket.io');


const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(("public")));

server.listen(3000, () => {
    console.log("Server is running on port 3000");
})

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('message', (msg) => {
        console.log('server is saying message got from the client:', msg);
        socket.emit('message', "Server received your msg: "+ msg);
    })

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });

});
