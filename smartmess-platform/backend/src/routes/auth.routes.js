const express = require("express");
const router = express.Router();
const prisma = require("../db");
const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcrypt');

const GOOGLE_CLIENT_ID = "548846928986-jateo4qrmv4mc4k6t6746cdedj9bqd77.apps.googleusercontent.com"; 
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

router.post('/login', async (req, res) => {
    const { identifier, password, role, bhawanName, staffPasscode, isSignUp, name } = req.body;

    try {
        let user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { roll_no: identifier }
                ]
            },
            include: { bhawan: true }
        });
        if (!user && !isSignUp) {
            return res.status(404).json({ error: "Account not found. Please click 'Create an account' below." });
        }
        if (user && isSignUp) {
            return res.status(400).json({ error: "Account already exists. Please switch to Login." });
        }
        // EXISTING USER: Handle Login
        if (user && !isSignUp) {
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) return res.status(401).json({ error: "Incorrect password." });
            
            // If user provided a name and DB didn't have one, update it
            if (name && name.trim() && !user.name) {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: { name: name.trim() },
                    include: { bhawan: true }
                });
            }

            const userWithBhawan = {
                ...user,
                bhawanName: user.bhawan ? user.bhawan.name : null
            };
            return res.json({ message: "Login successful", user: userWithBhawan });
        } 
        
        // NEW USER: Handle Registration
        if (!user && isSignUp) {
            // SECURITY CHECK: Verify Staff Passcode
            if (role === "STAFF" && staffPasscode !== "ADMIN123") {
                return res.status(403).json({ error: "Invalid staff authorization code." });
            }

            if (!bhawanName) return res.status(400).json({ error: "Please select a Bhawan for new registration." });

            let userBhawan = await prisma.bhawan.findFirst({ where: { name: bhawanName } });
            if (!userBhawan) userBhawan = await prisma.bhawan.create({ data: { name: bhawanName } });

            const isEmail = identifier.includes("@");
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            let dbRole = "STUDENT";
            if (role === "STAFF") {
                dbRole = "ADMIN"; 
            }

            user = await prisma.user.create({
                data: {
                    name: name && name.trim() ? name.trim() : null,
                    email: isEmail ? identifier : `${identifier}@iitr.ac.in`,
                    roll_no: isEmail ? null : identifier,
                    password: hashedPassword,
                    bhawanId: userBhawan.id,
                    role: dbRole
                },
                include: { bhawan: true }
            });

            const userWithBhawan = {
                ...user,
                bhawanName: user.bhawan ? user.bhawan.name : userBhawan.name
            };

            return res.json({ message: "Registration successful", user: userWithBhawan });
        }
    } catch (error) {
        console.error("Auth Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.post("/google", async (req, res) => {
  try {
    const { credential, bhawanName } = req.body;
    const ticket = await client.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const email = payload.email;
    const name = payload.name;

    if (!email.endsWith("iitr.ac.in")) return res.status(403).json({ error: "Please use your valid institute email ID (@iitr.ac.in)." });

    let user = await prisma.user.findUnique({ where: { email: email }, include: { bhawan: true } });

    if (!user) {
      if (!bhawanName) return res.status(400).json({ error: "Please select a Bhawan before logging in." });
      let userBhawan = await prisma.bhawan.findFirst({ where: { name: bhawanName } });
      if (!userBhawan) userBhawan = await prisma.bhawan.create({ data: { name: bhawanName } });

      user = await prisma.user.create({
        data: { email: email, name: name || null, role: "STUDENT", bhawanId: userBhawan.id }, 
        include: { bhawan: true }
      });
    } else if (name && !user.name) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name: name },
        include: { bhawan: true }
      });
    }

    res.status(200).json({ 
      message: "Login successful", 
      user: { id: user.id, name: user.name, email: user.email, role: user.role, bhawanId: user.bhawanId, bhawanName: user.bhawan ? user.bhawan.name : null, roll_no: user.roll_no }
    });
  } catch (error) {
    res.status(401).json({ error: "Invalid Google token." });
  }
});

// NEW: Fetch user info by id, email, or latest student from database
router.get("/user-info", async (req, res) => {
    try {
        const { id, email, roll_no } = req.query;
        let user = null;

        if (id) {
            user = await prisma.user.findUnique({
                where: { id },
                include: { bhawan: true }
            });
        }

        if (!user && email) {
            user = await prisma.user.findFirst({
                where: { email },
                include: { bhawan: true }
            });
        }

        if (!user && roll_no) {
            user = await prisma.user.findFirst({
                where: { roll_no },
                include: { bhawan: true }
            });
        }

        // If no user found by query or no query provided, fallback to first student in database
        if (!user) {
            user = await prisma.user.findFirst({
                where: { role: "STUDENT" },
                orderBy: { id: "asc" },
                include: { bhawan: true }
            });
        }

        if (!user) {
            return res.status(404).json({ error: "No user found in database" });
        }

        // Format clean display name if not present
        let displayName = user.name ? user.name.trim() : "";
        if (!displayName && user.email) {
            const prefix = user.email.split("@")[0].replace(/[._-]/g, " ");
            displayName = prefix.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        }

        const result = {
            id: user.id,
            name: displayName || user.name || "Student",
            email: user.email,
            roll_no: user.roll_no,
            role: user.role,
            bhawanId: user.bhawanId,
            bhawanName: user.bhawan ? user.bhawan.name : "Vivekanand Bhawan"
        };

        res.json(result);
    } catch (error) {
        console.error("Error fetching user info:", error);
        res.status(500).json({ error: "Failed to fetch user info from database" });
    }
});

// NEW: Fetch all Bhawans for the Settings dropdown
router.get("/bhawans", async (req, res) => {
    try {
        const bhawans = await prisma.bhawan.findMany({ orderBy: { name: 'asc' } });
        res.json(bhawans);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch bhawans" });
    }
});

router.get("/profile/:id", async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            include: { bhawan: true }
        });
        if (!user) return res.status(404).json({ error: "User not found" });
        const userWithBhawan = {
            ...user,
            bhawanName: user.bhawan ? user.bhawan.name : null
        };
        res.json(userWithBhawan);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch profile" });
    }
});

// UPDATED: Now handles Bhawan transfers and ticket cleanup
router.put("/profile/:id", async (req, res) => {
    try {
        const { name, profilePic, email, roll_no, bhawanId } = req.body;
        const currentUser = await prisma.user.findUnique({ where: { id: req.params.id } });
        
        const updateData = { name };
        if (profilePic !== undefined) updateData.profilePic = profilePic;
        if (!currentUser.email && email) updateData.email = email;
        if (!currentUser.roll_no && roll_no) updateData.roll_no = roll_no;

        // ADVANCED LOGIC: If the user changes their Bhawan
        if (bhawanId && bhawanId !== currentUser.bhawanId) {
            updateData.bhawanId = bhawanId;

            const todayMidnight = new Date();
            todayMidnight.setHours(0,0,0,0);

            // Find all pending tickets at the OLD Bhawan
            const ticketsToDelete = await prisma.mealSelection.findMany({
                where: {
                    studentId: currentUser.id,
                    menu: {
                        bhawanId: currentUser.bhawanId,
                        week_start: { gte: todayMidnight }
                    }
                }
            });

            // Delete those old tickets so staff don't over-prepare food
            const ticketIds = ticketsToDelete.map(t => t.id);
            if (ticketIds.length > 0) {
                await prisma.mealSelection.deleteMany({
                    where: { id: { in: ticketIds } }
                });
            }
        }

        const updatedUser = await prisma.user.update({
            where: { id: req.params.id },
            data: updateData,
            include: { bhawan: true } // Include bhawan relation to send the new name back
        });

        const userWithBhawan = {
            ...updatedUser,
            bhawanName: updatedUser.bhawan ? updatedUser.bhawan.name : null
        };

        res.json({ message: "Profile updated successfully", user: userWithBhawan });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to update profile" });
    }
});

module.exports = router;
// Prisma Studio is running at: http://localhost:51212
// SmartMess backend running on http://localhost:5000
