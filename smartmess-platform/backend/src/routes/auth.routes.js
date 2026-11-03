const express = require("express");
const router = express.Router();
const prisma = require("../db");
const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { verifyToken } = require('../middleware/auth');

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
            // Standard Login Safeguard: Check if user's password is null (Omniport account)
            if (user.password === null || user.password === undefined) {
                return res.status(400).json({
                    error: "This account uses Omniport. Please use the Log in with Omniport button."
                });
            }
            // Block any student account previously registered with a non-IITR email
            if (user.role === "STUDENT" && user.email && !isValidIITREmail(user.email)) {
                return res.status(403).json({
                    error: "Access denied. Only official IIT Roorkee email IDs (*.iitr.ac.in) are authorized for student accounts."
                });
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
            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role, bhawanId: user.bhawanId, auth_provider: user.auth_provider || "local" },
                process.env.JWT_SECRET || "smartmess_jwt_secret_key_2026_super_secure",
                { expiresIn: "7d" }
            );

            return res.json({ message: "Login successful", user: userWithBhawan, token });
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
                    role: "STUDENT"
                },
                include: { bhawan: true }
            });

            const userWithBhawan = {
                ...user,
                bhawanName: user.bhawan ? user.bhawan.name : userBhawan.name
            };

            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role, bhawanId: user.bhawanId, auth_provider: "local" },
                process.env.JWT_SECRET || "smartmess_jwt_secret_key_2026_super_secure",
                { expiresIn: "7d" }
            );

            return res.json({ message: "Registration successful", user: userWithBhawan, token });
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

// Self profile route
router.get("/profile", verifyToken, async (req, res) => {
    try {
        const userId = req.user && req.user.id;
        if (!userId) return res.status(401).json({ error: "Unauthorized user." });
        const user = await prisma.user.findUnique({
            where: { id: userId },
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

router.get("/profile/:id", verifyToken, async (req, res) => {
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
router.put("/profile/:id", verifyToken, async (req, res) => {
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

// =============================================
// OMNIPORT OAUTH2 LOGIN FLOW
// =============================================

// Step 1: Redirect user to Omniport's OAuth authorization page
router.get('/omniport', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.OMNIPORT_CLIENT_ID,
    redirect_uri: process.env.OMNIPORT_REDIRECT_URI,
    response_type: 'code',
  });

  res.redirect(`https://omniport.iitr.ac.in/oauth/?${params.toString()}`);
});

// Step 2: Handle the callback from Omniport after user authorizes
router.get('/omniport/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    console.error('Omniport OAuth Error: No authorization code received in callback.');
    return res.status(400).json({ error: 'Authorization code missing from Omniport callback.' });
  }

  try {
    // Exchange the authorization code for an access token
    const tokenResponse = await fetch('https://omniport.iitr.ac.in/open_auth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.OMNIPORT_CLIENT_ID,
        client_secret: process.env.OMNIPORT_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.OMNIPORT_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error('Omniport Token Exchange Failed:', tokenResponse.status, errorBody);
      return res.status(tokenResponse.status).json({ error: 'Failed to exchange authorization code for token.' });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error('Omniport OAuth Error: No access_token in token response.', tokenData);
      return res.status(500).json({ error: 'No access token received from Omniport.' });
    }

    // Fetch the user's campus profile from Omniport
    const profileResponse = await fetch('https://omniport.iitr.ac.in/resources/profile/', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!profileResponse.ok) {
      const profileError = await profileResponse.text();
      console.error('Omniport Profile Fetch Failed:', profileResponse.status, profileError);
      return res.status(profileResponse.status).json({ error: 'Failed to fetch profile from Omniport.' });
    }

    const profileData = await profileResponse.json();
    console.log('Omniport Profile Data:', JSON.stringify(profileData, null, 2));

    // Extract email, name, roll_no, bhawan from Omniport profile
    const rawEmail = (
      profileData.email ||
      (profileData.contactInformation && profileData.contactInformation.instituteWebmailAddress) ||
      (profileData.user && profileData.user.email) ||
      profileData.instituteEmail ||
      ""
    ).trim().toLowerCase();

    const rawName = (
      profileData.name ||
      (profileData.person && (profileData.person.fullName || profileData.person.display_name)) ||
      (profileData.user && profileData.user.name) ||
      "Student"
    ).trim();

    const rawRoll = (
      (profileData.student && (profileData.student.enrolmentNumber || profileData.student.rollNumber)) ||
      profileData.roll_no ||
      profileData.rollNo ||
      profileData.enrolmentNumber ||
      profileData.enrolment_no ||
      ""
    ).toString().trim();

    const rawBhawan = (
      (profileData.student && profileData.student.currentBhawan) ||
      profileData.bhawan ||
      profileData.hostel ||
      ""
    ).toString().trim();

    if (!rawEmail) {
      console.error('Omniport OAuth Error: Profile missing campus email address.', profileData);
      return res.status(400).json({ error: 'Campus email address not found in Omniport profile.' });
    }

    // Check if user exists in the Neon database with that campus email
    let user = await prisma.user.findUnique({
      where: { email: rawEmail },
      include: { bhawan: true }
    });

    if (user) {
      // Existing user: sync missing fields
      const updateData = {};
      if (!user.name && rawName) updateData.name = rawName;
      if (!user.roll_no && rawRoll) updateData.roll_no = rawRoll;
      if (!user.auth_provider) updateData.auth_provider = 'omniport';

      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
          include: { bhawan: true }
        });
      }
    } else {
      // User does not exist: automatically create new user record
      let userBhawan = null;
      if (rawBhawan) {
        userBhawan = await prisma.bhawan.findFirst({
          where: { name: { equals: rawBhawan, mode: 'insensitive' } }
        });
      }
      if (!userBhawan) {
        userBhawan = await prisma.bhawan.findFirst({ orderBy: { name: 'asc' } });
      }
      if (!userBhawan) {
        userBhawan = await prisma.bhawan.create({ data: { name: "Vivekanand Bhawan" } });
      }

      user = await prisma.user.create({
        data: {
          email: rawEmail,
          name: rawName || null,
          roll_no: rawRoll || null,
          password: null,
          auth_provider: 'omniport',
          role: 'STUDENT',
          bhawanId: userBhawan.id
        },
        include: { bhawan: true }
      });
    }

    // Generate JWT using process.env.JWT_SECRET
    const jwtToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        bhawanId: user.bhawanId,
        auth_provider: user.auth_provider || 'omniport'
      },
      process.env.JWT_SECRET || "smartmess_jwt_secret_key_2026_super_secure",
      { expiresIn: '7d' }
    );

    const userParam = encodeURIComponent(JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      roll_no: user.roll_no,
      role: user.role,
      bhawanId: user.bhawanId,
      bhawanName: user.bhawan ? user.bhawan.name : null
    }));

    // Redirect the user back to the frontend at student-dashboard.html with the JWT
    res.redirect(`https://smart-mess-theta.vercel.app/student-dashboard.html?token=${jwtToken}&user=${userParam}`); = require("../db");
const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { verifyToken } = require('../middleware/auth');

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
            // Standard Login Safeguard: Check if user's password is null (Omniport account)
            if (user.password === null || user.password === undefined) {
                return res.status(400).json({
                    error: "This account uses Omniport. Please use the Log in with Omniport button."
                });
            }
            // Block any student account previously registered with a non-IITR email
            if (user.role === "STUDENT" && user.email && !isValidIITREmail(user.email)) {
                return res.status(403).json({
                    error: "Access denied. Only official IIT Roorkee email IDs (*.iitr.ac.in) are authorized for student accounts."
                });
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
            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role, bhawanId: user.bhawanId, auth_provider: user.auth_provider || "local" },
                process.env.JWT_SECRET || "smartmess_jwt_secret_key_2026_super_secure",
                { expiresIn: "7d" }
            );

            return res.json({ message: "Login successful", user: userWithBhawan, token });
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
                    role: "STUDENT"
                },
                include: { bhawan: true }
            });

            const userWithBhawan = {
                ...user,
                bhawanName: user.bhawan ? user.bhawan.name : userBhawan.name
            };

            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role, bhawanId: user.bhawanId, auth_provider: "local" },
                process.env.JWT_SECRET || "smartmess_jwt_secret_key_2026_super_secure",
                { expiresIn: "7d" }
            );

            return res.json({ message: "Registration successful", user: userWithBhawan, token });
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

// Self profile route
router.get("/profile", verifyToken, async (req, res) => {
    try {
        const userId = req.user && req.user.id;
        if (!userId) return res.status(401).json({ error: "Unauthorized user." });
        const user = await prisma.user.findUnique({
            where: { id: userId },
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

router.get("/profile/:id", verifyToken, async (req, res) => {
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
router.put("/profile/:id", verifyToken, async (req, res) => {
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

// =============================================
// OMNIPORT OAUTH2 LOGIN FLOW
// =============================================

// Step 1: Redirect user to Omniport's OAuth authorization page
router.get('/omniport', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.OMNIPORT_CLIENT_ID,
    redirect_uri: process.env.OMNIPORT_REDIRECT_URI,
    response_type: 'code',
  });

  res.redirect(`https://omniport.iitr.ac.in/oauth/?${params.toString()}`);
});

// Step 2: Handle the callback from Omniport after user authorizes
router.get('/omniport/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    console.error('Omniport OAuth Error: No authorization code received in callback.');
    return res.status(400).json({ error: 'Authorization code missing from Omniport callback.' });
  }

  try {
    // Exchange the authorization code for an access token
    const tokenResponse = await fetch('https://omniport.iitr.ac.in/open_auth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.OMNIPORT_CLIENT_ID,
        client_secret: process.env.OMNIPORT_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.OMNIPORT_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error('Omniport Token Exchange Failed:', tokenResponse.status, errorBody);
      return res.status(tokenResponse.status).json({ error: 'Failed to exchange authorization code for token.' });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error('Omniport OAuth Error: No access_token in token response.', tokenData);
      return res.status(500).json({ error: 'No access token received from Omniport.' });
    }

    // Fetch the user's campus profile from Omniport
    const profileResponse = await fetch('https://omniport.iitr.ac.in/resources/profile/', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!profileResponse.ok) {
      const profileError = await profileResponse.text();
      console.error('Omniport Profile Fetch Failed:', profileResponse.status, profileError);
      return res.status(profileResponse.status).json({ error: 'Failed to fetch profile from Omniport.' });
    }

    const profileData = await profileResponse.json();
    console.log('Omniport Profile Data:', JSON.stringify(profileData, null, 2));

    // Redirect the user to the frontend dashboard with the access token
    res.redirect(`https://smart-mess-theta.vercel.app/student-dashboard.html?token=${accessToken}`);
  } catch (error) {
    console.error('Omniport OAuth Callback Error:', error.message || error);
    res.status(500).json({ error: 'Internal server error during Omniport authentication.' });
  }
});

module.exports = router;