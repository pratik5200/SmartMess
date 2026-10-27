const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- DYNAMIC CORS CONFIGURATION ---
const allowedOrigins = [
    "http://localhost:3000",       // Your new frontend port
    "http://127.0.0.1:3000",
    "http://localhost:5500",       // VS Code Live Server port (just in case)
    "http://127.0.0.1:5500",
    "https://smartmess.iitr.ac.in" // Future production domain
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error("CORS Blocked: This website is not trusted by the SmartMess Backend."));
        }
    },
    credentials: true
}));
// ----------------------------------

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const authRoutes = require("./routes/auth.routes");
const bhawanRoutes = require("./routes/bhawan.routes");
const menuRoutes = require("./routes/menu.routes");
const feedbackRoutes = require("./routes/feedback.routes");
const contactRoutes = require("./routes/contact.routes");

app.use("/api/auth", authRoutes);
app.use("/api/bhawans", bhawanRoutes);
app.use("/api/menus", menuRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/contact", contactRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "SmartMess Backend API is running successfully!",
    status: "healthy",
    endpoints: {
      health: "/api/health",
      auth: "/api/auth",
      bhawans: "/api/bhawans",
      menus: "/api/menus",
      feedback: "/api/feedback"
    }
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "SmartMess Backend is fully operational and auto-updating!", timestamp: new Date() });
});

app.listen(PORT, async () => {
  console.log(`SmartMess backend running on http://localhost:${PORT}`);
  
  // Safe Wake-Up Ping: Calls your existing API so it uses the correct Prisma Adapter
  try {
    console.log("Waking up Neon database...");
    await fetch(`http://localhost:${PORT}/api/bhawans`);
    console.log("Neon Database is fully awake and ready!");
  } catch (error) {
    console.log("Wake-up ping initiated.");
  }
});