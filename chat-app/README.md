# Chat App (Learning Project)

Basic real-time chat foundation built with Node.js, Express, and Socket.IO.

## What this version does
- Starts a Socket.IO server
- Connects browser client to server
- Sends a sample message from client to server
- Sends server response back to client
- Logs events in terminal and browser console

## Tech Stack
- Node.js
- Express
- Socket.IO

## Run locally
1. Install dependencies:
   - `npm install`
2. Start server:
   - `node server.js`
3. Open in browser:
   - `http://localhost:3000`

## Project Structure
- `server.js` - backend server and socket events
- `public/index.html` - basic client page
- `public/client.js` - client socket logic

## Note
This is a beginner foundation project. Next step is adding full two-user message UI and typing indicator.
