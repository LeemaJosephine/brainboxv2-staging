# Backend deployment (Socket.IO / WebSockets)

This server uses **Socket.IO** for real-time quiz hosting (host game, join game, live questions). **Vercel serverless does not support WebSockets** or long-lived connections, so deploying this backend to Vercel will cause:

- `WebSocket connection to 'wss://your-app.vercel.app/socket.io/...' failed`

## Recommended: deploy backend elsewhere

Deploy this Node.js server to a platform that supports **persistent processes and WebSockets**:

- **[Railway](https://railway.app)** – simple, supports WebSockets, free tier
- **[Render](https://render.com)** – Web Services (not Static Sites) support WebSockets
- **[Fly.io](https://fly.io)** – supports WebSockets
- **DigitalOcean App Platform**, **Heroku**, or any VPS (e.g. with `node index.js` or PM2)

Then:

1. Set the backend URL in your **frontend** `.env`:
   ```env
   VITE_API_URL=https://your-backend.railway.app
   ```
   (or your Render/Fly URL). The client uses this for both REST API and Socket.IO.

2. In your backend env on Railway/Render, set:
   - `MONGODB_URI`, `JWT_SECRET`, and any other existing env vars
   - No need to change code; Socket.IO runs on the same server as Express.

3. Keep your **frontend** on Vercel if you like; point `VITE_API_URL` to the new backend URL so API and WebSocket both hit the same host.

## If you keep the server on Vercel

Only the **HTTP API** (auth, quiz, reports, etc.) can work on Vercel. **Host Game** and **Join Game** (real-time) will not work until the backend is moved to a WebSocket-capable host as above.
