require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const http = require("http");
const { Server } = require("socket.io");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const connectDB = require("./src/config/db");

// Route imports
const authRoutes = require("./src/routes/authRoutes");
const patientRoutes = require("./src/routes/patientRoutes");
const checkInRoutes = require("./src/routes/checkInRoutes");
const conditionRoutes = require("./src/routes/conditionRoutes");
const dashboardRoutes = require("./src/routes/dashboardRoutes");
const reportRoutes = require("./src/routes/reportRoutes");
const messageRoutes = require("./src/routes/messageRoutes");

// Initialize Express
const app = express();
const server = http.createServer(app);
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
];

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
};

// Socket.io setup
const io = new Server(server, {
  cors: { ...corsOptions, methods: ["GET", "POST"] },
});

// Middleware
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health-check route
app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "MediTrack API is running" });
});

// ── API Routes ──────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/checkins", checkInRoutes);
app.use("/api/conditions", conditionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/messages", messageRoutes);

// ── Socket.io ───────────────────────────────────────────
const { initializeSocket } = require("./src/socket/socketHandler");
initializeSocket(io);

// Make io accessible to route handlers
app.set("io", io);

// Start server
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
