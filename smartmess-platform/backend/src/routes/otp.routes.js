const express = require("express");
const router = express.Router();
const prisma = require("../db");
const bcrypt = require("bcrypt");
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

// Helper: generate a 6-digit numeric OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper: validate IITR email domain
function isValidIITREmail(email) {
    if (!email || typeof email !== "string") return false;
    const parts = email.trim().toLowerCase().split("@");
    if (parts.length !== 2) return false;
    const domain = parts[1];
    return domain === "iitr.ac.in" || domain.endsWith(".iitr.ac.in");
}

// ─────────────────────────────────────────────────────────────
// POST /api/otp/send-otp
// Called before account creation — sends a 6-digit OTP to email
// Body: { email }
// ─────────────────────────────────────────────────────────────
router.post("/send-otp", async (req, res) => {
    const { email } = req.body;

    if (!email || !isValidIITREmail(email)) {
        return res.status(400).json({
            error: "Please provide a valid IIT Roorkee email ID ending with .iitr.ac.in.",
        });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Block if a verified account with this email already exists
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
        return res.status(400).json({
            error: "An account with this email already exists. Please log in instead.",
        });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Delete any previous (possibly expired) OTPs for this email
    await prisma.otpVerification.deleteMany({ where: { email: normalizedEmail } });

    // Store the new OTP
    await prisma.otpVerification.create({
        data: { email: normalizedEmail, otp, expiresAt },
    });

    // Send the email via Resend
    try {
        const { error: sendError } = await resend.emails.send({
            from: "SmartMess <onboarding@resend.dev>",
            to: [normalizedEmail],
            subject: "Your SmartMess Verification Code",
            html: `
                <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #FEFCF6; border-radius: 16px; border: 1px solid #E5E7EB;">
                    <div style="text-align: center; margin-bottom: 24px;">
                        <h1 style="font-size: 1.5rem; color: #231F1D; margin: 0;">SmartMess Email Verification</h1>
                        <p style="color: #6B7280; margin-top: 8px; font-size: 0.95rem;">Use the code below to verify your email and create your account.</p>
                    </div>
                    <div style="background: #FFFFFF; border: 1.5px solid #E5E7EB; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                        <p style="margin: 0 0 8px 0; color: #6B7280; font-size: 0.9rem;">Your One-Time Verification Code</p>
                        <div style="font-size: 2.8rem; font-weight: 800; letter-spacing: 10px; color: #5F7751; font-family: monospace;">
                            ${otp}
                        </div>
                        <p style="margin: 12px 0 0 0; color: #9CA3AF; font-size: 0.82rem;">This code expires in <strong>10 minutes</strong>.</p>
                    </div>
                    <p style="color: #9CA3AF; font-size: 0.8rem; text-align: center; margin: 0;">
                        If you did not request this, please ignore this email.<br/>
                        This email was sent to <strong>${normalizedEmail}</strong>.
                    </p>
                </div>
            `,
        });

        if (sendError) {
            console.error("Resend error:", sendError);
            return res.status(500).json({ error: "Failed to send verification email. Please try again." });
        }

        return res.json({
            message: "Verification code sent! Please check your email inbox (and spam folder).",
            email: normalizedEmail,
        });
    } catch (err) {
        console.error("OTP send error:", err);
        return res.status(500).json({ error: "Failed to send verification email. Please try again." });
    }
});

// ─────────────────────────────────────────────────────────────
// POST /api/otp/verify-and-register
// Verifies OTP and creates the account atomically
// Body: { email, otp, name, identifier, password, bhawanName }
// ─────────────────────────────────────────────────────────────
router.post("/verify-and-register", async (req, res) => {
    const { email, otp, name, identifier, password, bhawanName } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ error: "Email and OTP are required." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find the most recent OTP record for this email
    const record = await prisma.otpVerification.findFirst({
        where: { email: normalizedEmail },
        orderBy: { createdAt: "desc" },
    });

    if (!record) {
        return res.status(400).json({ error: "No verification code was sent to this email. Please request a new one." });
    }

    if (new Date() > record.expiresAt) {
        await prisma.otpVerification.delete({ where: { id: record.id } });
        return res.status(400).json({ error: "Verification code has expired. Please request a new one." });
    }

    if (record.otp !== otp.trim()) {
        return res.status(400).json({ error: "Incorrect verification code. Please try again." });
    }

    // OTP is valid — mark as verified and create the user account
    await prisma.otpVerification.delete({ where: { id: record.id } });

    try {
        // Check once more that the user doesn't already exist
        const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existingUser) {
            return res.status(400).json({ error: "An account with this email already exists. Please log in." });
        }

        let userBhawan = await prisma.bhawan.findFirst({ where: { name: bhawanName } });
        if (!userBhawan) {
            userBhawan = await prisma.bhawan.create({ data: { name: bhawanName } });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const isEmail = (identifier || normalizedEmail).includes("@");
        const finalIdentifier = identifier ? identifier.trim() : normalizedEmail;

        const user = await prisma.user.create({
            data: {
                name: name && name.trim() ? name.trim() : null,
                email: normalizedEmail,
                roll_no: isEmail ? null : finalIdentifier,
                password: hashedPassword,
                bhawanId: userBhawan.id,
                role: "STUDENT",
            },
            include: { bhawan: true },
        });

        const userWithBhawan = {
            ...user,
            bhawanName: user.bhawan ? user.bhawan.name : bhawanName,
        };

        return res.json({ message: "Account created successfully!", user: userWithBhawan });
    } catch (err) {
        console.error("Registration error after OTP:", err);
        return res.status(500).json({ error: "Failed to create account. Please try again." });
    }
});

// ─────────────────────────────────────────────────────────────
// POST /api/otp/resend-otp
// Resends a fresh OTP — identical logic to /send-otp
// Body: { email }
// ─────────────────────────────────────────────────────────────
async function sendOtpHandler(req, res) {
    const { email } = req.body;

    if (!email || !isValidIITREmail(email)) {
        return res.status(400).json({
            error: "Please provide a valid IIT Roorkee email ID ending with .iitr.ac.in.",
        });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
        return res.status(400).json({
            error: "An account with this email already exists. Please log in instead.",
        });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.otpVerification.deleteMany({ where: { email: normalizedEmail } });
    await prisma.otpVerification.create({ data: { email: normalizedEmail, otp, expiresAt } });

    try {
        const { error: sendError } = await resend.emails.send({
            from: "SmartMess <onboarding@resend.dev>",
            to: [normalizedEmail],
            subject: "Your SmartMess Verification Code",
            html: `
                <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #FEFCF6; border-radius: 16px; border: 1px solid #E5E7EB;">
                    <div style="text-align: center; margin-bottom: 24px;">
                        <h1 style="font-size: 1.5rem; color: #231F1D; margin: 0;">SmartMess Email Verification</h1>
                        <p style="color: #6B7280; margin-top: 8px; font-size: 0.95rem;">Use the code below to verify your email and create your account.</p>
                    </div>
                    <div style="background: #FFFFFF; border: 1.5px solid #E5E7EB; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                        <p style="margin: 0 0 8px 0; color: #6B7280; font-size: 0.9rem;">Your One-Time Verification Code</p>
                        <div style="font-size: 2.8rem; font-weight: 800; letter-spacing: 10px; color: #5F7751; font-family: monospace;">
                            ${otp}
                        </div>
                        <p style="margin: 12px 0 0 0; color: #9CA3AF; font-size: 0.82rem;">This code expires in <strong>10 minutes</strong>.</p>
                    </div>
                    <p style="color: #9CA3AF; font-size: 0.8rem; text-align: center; margin: 0;">
                        If you did not request this, please ignore this email.<br/>
                        This email was sent to <strong>${normalizedEmail}</strong>.
                    </p>
                </div>
            `,
        });

        if (sendError) {
            console.error("Resend error:", sendError);
            return res.status(500).json({ error: "Failed to send verification email. Please try again." });
        }

        return res.json({
            message: "Verification code sent! Please check your email inbox (and spam folder).",
            email: normalizedEmail,
        });
    } catch (err) {
        console.error("OTP send error:", err);
        return res.status(500).json({ error: "Failed to send verification email. Please try again." });
    }
}

router.post("/resend-otp", sendOtpHandler);

module.exports = router;
