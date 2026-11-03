const express = require("express");
const router = express.Router();
const prisma = require("../db");
const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcrypt');

const GOOGLE_CLIENT_ID = "548846928986-jateo4qrmv4mc4k6t6746cdedj9bqd77.apps.googleusercontent.com"; 
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// Validates official IIT Roorkee student email addresses:
// Accepts @iitr.ac.in and all branch/subdomain variants (e.g. @es.iitr.ac.in, @cs.iitr.ac.in)
function isValidIITREmail(email) {
    if (!email || typeof email !== 'string') return false;
    const trimmed = email.trim().toLowerCase();
    const parts = trimmed.split('@');
    if (parts.length !== 2) return false;
    const domain = parts[1];
    return domain === 'iitr.ac.in' || domain.endsWith('.iitr.ac.in');
}

router.post('/login', async (req, res) => {
    const { identifier, password, bhawanName, isSignUp, name } = req.body;
    const trimmedId = (identifier || '').trim();
    const isEmail = trimmedId.includes('@');

    // Strict validation for new account creation: email MUST end with .iitr.ac.in
    if (isSignUp && isEmail && !isValidIITREmail(trimmedId)) {
        return res.status(403).json({
            error: "Please use your valid IIT Roorkee institute email ID ending with .iitr.ac.in (e.g., student@iitr.ac.in or student@branch.iitr.ac.in)."
        });
    }

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
            // Security check: Omniport accounts without a password cannot log in via password form
            if (user.auth_provider === "omniport" && !user.password) {
                return res.status(400).json({
                    error: "This account was created via Omniport. Please use 'Log in with Omniport'."
                });
            }

            // Block any student account previously registered with a non-IITR email
            if (user.role === "STUDENT" && user.email && !isValidIITREmail(user.email)) {
                return res.status(403).json({
                    error: "Access denied. Only official IIT Roorkee email IDs (*.iitr.ac.in) are authorized for student accounts."
                });
            }

            if (!user.password) {
                return res.status(400).json({ error: "This account uses SSO. Please log in using Google or Omniport." });
            }
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
            if (!bhawanName) return res.status(400).json({ error: "Please select a Bhawan for new registration." });

            let userBhawan = await prisma.bhawan.findFirst({ where: { name: bhawanName } });
            if (!userBhawan) userBhawan = await prisma.bhawan.create({ data: { name: bhawanName } });

            const isEmail = identifier.includes("@");
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            user = await prisma.user.create({
                data: {
                    name: name && name.trim() ? name.trim() : null,
                    email: isEmail ? identifier : `${identifier}@iitr.ac.in`,
                    roll_no: isEmail ? null : identifier,
                    password: hashedPassword,
                    bhawanId: userBhawan.id,
                    role: "STUDENT",
                    auth_provider: "local"
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

    if (!isValidIITREmail(email)) return res.status(403).json({ error: "Please use your valid institute email ID ending with .iitr.ac.in (e.g. @iitr.ac.in or @branch.iitr.ac.in)." });

    let user = await prisma.user.findUnique({ where: { email: email }, include: { bhawan: true } });

    if (!user) {
      if (!bhawanName) return res.status(400).json({ error: "Please select a Bhawan before logging in." });
      let userBhawan = await prisma.bhawan.findFirst({ where: { name: bhawanName } });
      if (!userBhawan) userBhawan = await prisma.bhawan.create({ data: { name: bhawanName } });

      user = await prisma.user.create({
        data: { email: email, name: name || null, role: "STUDENT", bhawanId: userBhawan.id, auth_provider: "google" }, 
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
            bhawanName: user.bhawan ? user.bhawan.name : "Vivekanand Bhawan",
            auth_provider: user.auth_provider || "local"
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
        if (!currentUser.email && email) {
            if (currentUser.role === "STUDENT" && !isValidIITREmail(email)) {
                return res.status(403).json({ error: "Only official IIT Roorkee email IDs (*.iitr.ac.in) are allowed." });
            }
            updateData.email = email;
        }
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
            include: { bhawan: true }
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

// =============================================
// OMNIPORT OAUTH2 LOGIN FLOW
// =============================================

// Route 1: Redirect user to Omniport OAuth login portal
router.get("/omniport", (req, res) => {
    const clientId = process.env.OMNIPORT_CLIENT_ID || "";
    const redirectUri = process.env.OMNIPORT_REDIRECT_URI || "";
    return res.redirect(`https://channeli.in/oauth/authorise/?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code`);
});

// Route 2: Handle Omniport OAuth callback
router.get("/omniport/callback", async (req, res) => {
    const frontendUrl = (process.env.FRONTEND_URL || "https://smart-mess-theta.vercel.app").replace(/\/$/, "");
    const { code } = req.query;

    if (!code) {
        return res.redirect(`${frontendUrl}/login.html?error=omniport_missing_code`);
    }

    try {
        // Exchange authorization code for access token
        const tokenParams = new URLSearchParams({
            client_id: process.env.OMNIPORT_CLIENT_ID || "",
            grant_type: "authorization_code",
            code: String(code),
            redirect_uri: process.env.OMNIPORT_REDIRECT_URI || "",
        });

        // Crucially, only append client_secret if it is provided
        if (process.env.OMNIPORT_CLIENT_SECRET && process.env.OMNIPORT_CLIENT_SECRET.trim()) {
            tokenParams.append("client_secret", process.env.OMNIPORT_CLIENT_SECRET.trim());
        }

        const tokenResponse = await fetch("https://channeli.in/open_auth/token/", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: tokenParams.toString(),
        });

        if (!tokenResponse.ok) {
            const errText = await tokenResponse.text();
            console.error("Omniport Token Exchange Failed:", tokenResponse.status, errText);
            return res.redirect(`${frontendUrl}/login.html?error=omniport_token_failed`);
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        if (!accessToken) {
            console.error("Omniport OAuth Error: No access_token in response", tokenData);
            return res.redirect(`${frontendUrl}/login.html?error=omniport_no_token`);
        }

        // Fetch user profile from Omniport
        const profileResponse = await fetch("https://channeli.in/open_auth/get_user_data/", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!profileResponse.ok) {
            const profileErr = await profileResponse.text();
            console.error("Omniport Profile Fetch Failed:", profileResponse.status, profileErr);
            return res.redirect(`${frontendUrl}/login.html?error=omniport_profile_failed`);
        }

        const profile = await profileResponse.json();

        // Safely extract student details
        const rawRollNo = profile.student?.enrolmentNumber 
            || profile.student?.enrolment_number 
            || profile.student?.roll_no 
            || profile.enrollment_number 
            || profile.enrolmentNumber 
            || profile.student_id 
            || profile.roll_no 
            || profile.userId 
            || null;
        const rollNo = rawRollNo ? String(rawRollNo).trim() : null;

        const email = (typeof profile.contactInformation?.instituteWebmailAddress === "string" && profile.contactInformation.instituteWebmailAddress.trim())
            || (typeof profile.institute_webmail_address === "string" && profile.institute_webmail_address.trim())
            || (typeof profile.email === "string" && profile.email.trim())
            || (typeof profile.username === "string" && profile.username.includes("@") && profile.username.trim())
            || (rollNo ? `${rollNo}@iitr.ac.in` : null);

        const name = (typeof profile.person?.fullName === "string" && profile.person.fullName.trim()) 
            || (typeof profile.name === "string" && profile.name.trim()) 
            || (profile.first_name ? `${profile.first_name} ${profile.last_name || ""}`.trim() : null)
            || "Student";

        // CRITICAL: Ensure bhawanName is ALWAYS a string, never an Object (currentAddress is an object in Channel i)
        let bhawanName = "Rajiv Bhawan";
        if (typeof profile.hostel === "string" && profile.hostel.trim()) {
            bhawanName = profile.hostel.trim();
        } else if (typeof profile.bhawan === "string" && profile.bhawan.trim()) {
            bhawanName = profile.bhawan.trim();
        } else if (typeof profile.student?.hostel === "string" && profile.student.hostel.trim()) {
            bhawanName = profile.student.hostel.trim();
        } else if (typeof profile.student?.currentAddress === "string" && profile.student.currentAddress.trim()) {
            bhawanName = profile.student.currentAddress.trim();
        } else if (profile.student?.currentAddress && typeof profile.student.currentAddress === "object") {
            const addr = profile.student.currentAddress.address || "";
            const knownBhawans = ["Azad", "Cautley", "Ganga", "Govind", "Himalaya", "Jawahar", "Kasturba", "Malviya", "Radhakrishnan", "Rajendra", "Rajiv", "Ravindra", "Sarojini", "Vigyan Kunj", "Vivekanand"];
            const found = knownBhawans.find(b => addr.toLowerCase().includes(b.toLowerCase()));
            if (found) bhawanName = `${found} Bhawan`;
        }

        let user = null;
        const lookupConditions = [];
        if (email) lookupConditions.push({ email });
        if (rollNo) lookupConditions.push({ roll_no: rollNo });

        if (lookupConditions.length > 0) {
            user = await prisma.user.findFirst({
                where: { OR: lookupConditions },
                include: { bhawan: true }
            });
        }

        // If still not found by email or roll_no, try matching by full name
        if (!user && name && name !== "Student") {
            user = await prisma.user.findFirst({
                where: { name: { equals: name.trim(), mode: 'insensitive' } },
                include: { bhawan: true }
            });
        }

        if (user) {
            // Update auth_provider to omniport if it isn't already
            const updateData = {};
            if (user.auth_provider !== "omniport") {
                updateData.auth_provider = "omniport";
            }
            if (name && !user.name) {
                updateData.name = name;
            }
            if (rollNo && !user.roll_no) {
                // Check if rollNo is already taken by another account before updating
                const existingWithRoll = await prisma.user.findFirst({ where: { roll_no: rollNo } });
                if (!existingWithRoll) {
                    updateData.roll_no = rollNo;
                }
            }

            if (Object.keys(updateData).length > 0) {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: updateData,
                    include: { bhawan: true }
                });
            }
        } else {
            // Find or create Bhawan, then create new User
            let userBhawan = await prisma.bhawan.findFirst({ where: { name: bhawanName } });
            if (!userBhawan) {
                userBhawan = await prisma.bhawan.create({ data: { name: bhawanName } });
            }

            const userEmail = email || `${rollNo || Date.now()}@iitr.ac.in`;
            user = await prisma.user.create({
                data: {
                    email: userEmail,
                    roll_no: rollNo,
                    name: name || null,
                    role: "STUDENT",
                    bhawanId: userBhawan.id,
                    auth_provider: "omniport"
                },
                include: { bhawan: true }
            });
        }

        // Prepare serialized user object
        const userPayload = {
            id: user.id,
            name: user.name,
            email: user.email,
            roll_no: user.roll_no,
            role: user.role,
            bhawanId: user.bhawanId,
            bhawanName: user.bhawan ? user.bhawan.name : bhawanName,
            auth_provider: user.auth_provider || "omniport"
        };

        const encodedUser = Buffer.from(JSON.stringify(userPayload)).toString("base64");
        return res.redirect(`${frontendUrl}/student-dashboard.html?omni_user=${encodedUser}`);
    } catch (error) {
        console.error("Omniport OAuth Callback Error:", error);
        const errDetail = encodeURIComponent(error.message || String(error));
        return res.redirect(`${frontendUrl}/login.html?error=omniport_server_error&details=${errDetail}`);
    }
});

module.exports = router;
