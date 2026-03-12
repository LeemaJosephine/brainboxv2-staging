require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const app = express();
const port = process.env.PORT || 3000;

connectDB();

app.use(express.json());
app.use(cors());


const authRoutes = require("./routes/authRoutes");
const teamRoutes = require("./routes/teamRoutes");
const reportsRoutes = require("./routes/reportsRoutes");
const quizRoutes = require("./routes/quizRoutes");
const gameRoutes = require("./routes/gameRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const usersRoutes = require("./routes/usersRoutes");
const inviteRoutes = require("./routes/inviteRoutes");

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.use("/api/auth", authRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/category", categoryRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/invite", inviteRoutes);

const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: { origin: "*" },
});
const { registerSocket } = require("./socket");
registerSocket(io);

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
