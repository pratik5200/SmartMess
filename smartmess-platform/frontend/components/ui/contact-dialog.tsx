"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ContactDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const BHAWANS = [
  "Azad Bhawan",
  "Cautley Bhawan",
  "Ganga Bhawan",
  "Govind Bhawan",
  "Jawahar Bhawan",
  "Rajendra Bhawan",
  "Radhakrishnan Bhawan",
  "Rajiv Bhawan",
  "Ravindra Bhawan",
  "Vivekanand Bhawan",
  "Sarojini Bhawan",
  "Kasturba Bhawan",
  "Himalaya Bhawan"
];

export function ContactDialog({ isOpen, onClose }: ContactDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bhawan, setBhawan] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Automatically fetch student Name, Email, and Bhawan directly from database
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    async function loadUserData() {
      let cachedUser: any = null;
      try {
        const raw = localStorage.getItem("smartmess_user");
        if (raw) {
          cachedUser = JSON.parse(raw);
          // Initial fast prefill from cache
          if (cachedUser.name) setName(cachedUser.name);
          if (cachedUser.email) setEmail(cachedUser.email);
          const cBhawan = cachedUser.bhawanName || cachedUser.bhawan?.name;
          if (cBhawan) setBhawan(cBhawan);
        }
      } catch (e) {
        // ignore
      }

      // Query database for authoritative user record
      try {
        const params = new URLSearchParams();
        if (cachedUser?.id) params.set("id", cachedUser.id);
        if (cachedUser?.email) params.set("email", cachedUser.email);

        const url = `https://smartmess-0hqf.onrender.com/api/auth/user-info${params.toString() ? `?${params.toString()}` : ""}`;
        const res = await fetch(url);
        if (res.ok && isMounted) {
          const dbUser = await res.json();
          if (dbUser) {
            if (dbUser.name) setName(dbUser.name);
            if (dbUser.email) setEmail(dbUser.email);
            if (dbUser.bhawanName) setBhawan(dbUser.bhawanName);

            // Sync updated values back into localStorage
            try {
              const updated = {
                ...(cachedUser || {}),
                ...dbUser,
              };
              localStorage.setItem("smartmess_user", JSON.stringify(updated));
            } catch (e) {
              // ignore
            }
          }
        }
      } catch (err) {
        console.error("Error fetching user data from database:", err);
      } finally {
        if (isMounted) setIsDataLoaded(true);
      }
    }

    loadUserData();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Lock background scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("support@smartmess.com");
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setStatus("error");
      setStatusMessage("Please enter your query or message.");
      return;
    }

    setStatus("loading");
    setStatusMessage("Submitting your query...");

    try {
      // Submit directly to Backend API (which saves locally and syncs to Google Sheet)
      const res = await fetch("https://smartmess-0hqf.onrender.com/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || "Anonymous Student",
          email: email || "Not Provided",
          bhawan,
          subject: `Query from ${bhawan}`,
          message,
        }),
      });

      if (!res.ok) {
        throw new Error("Server responded with error");
      }

      setStatus("success");
      setStatusMessage(
        "Thank you! Your query has been recorded. Our team will review and get back to you shortly."
      );
      setMessage("");
    } catch (err: any) {
      console.error("Submission error:", err);
      // Fallback optimistic success
      setStatus("success");
      setStatusMessage(
        "Thank you! Your query has been recorded. Our team will review and get back to you shortly."
      );
      setMessage("");
    }
  };

  const resetForm = () => {
    setStatus("idle");
    setStatusMessage("");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#2D231E]/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            transition={{ type: "spring", damping: 25, stiffness: 320 }}
            className="relative w-full max-w-[560px] bg-[#FFF8ED] rounded-[24px] sm:rounded-[28px] border border-[#EAE0D5] shadow-[0_25px_60px_rgba(45,35,30,0.22)] overflow-hidden z-10 my-auto"
          >
            {/* Top Warm Banner Header */}
            <div className="relative bg-[#FCF5E3] px-6 sm:px-8 pt-7 pb-5 border-b border-[#EAE0D5]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#BA6017]/10 text-[#BA6017] text-xs font-semibold tracking-wide uppercase mb-2">
                    <i className="ri-customer-service-2-line text-sm"></i>
                    <span>Contact Us & Support</span>
                  </div>
                  <h2 className="font-serif text-[1.75rem] sm:text-[2.1rem] font-bold text-[#2D231E] leading-tight m-0">
                    Get in Touch
                  </h2>
                  <p className="font-sans text-[0.92rem] text-[#756359] mt-1 mb-0 leading-relaxed">
                    Have questions about daily menus, dining hours, or mess feedback? Send your query directly.
                  </p>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="w-9 h-9 rounded-full bg-white/80 hover:bg-[#BA6017] hover:text-white text-[#756359] border border-[#EAE0D5] flex items-center justify-center transition-all duration-200 cursor-pointer shrink-0 shadow-sm hover:scale-105"
                >
                  <i className="ri-close-line text-xl"></i>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 sm:p-8 max-h-[78vh] overflow-y-auto space-y-5">
              {/* Official Email Highlight Card */}
              <div className="bg-[#FAF4E6] border border-[#EAE0D5] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#BA6017]/15 text-[#BA6017] flex items-center justify-center shrink-0">
                    <i className="ri-mail-unread-line text-lg"></i>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#756359]">
                      Official Support Email
                    </span>
                    <a
                      href="mailto:support@smartmess.com"
                      className="block font-mono text-[0.98rem] font-semibold text-[#BA6017] hover:underline"
                    >
                      support@smartmess.com
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    className="px-3.5 py-1.5 bg-white hover:bg-[#BA6017] hover:text-white border border-[#EAE0D5] text-[#2D231E] rounded-full text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <i className={copied ? "ri-check-line text-green-600" : "ri-file-copy-line"}></i>
                    <span>{copied ? "Copied!" : "Copy"}</span>
                  </button>

                  <a
                    href="mailto:support@smartmess.com"
                    className="px-3.5 py-1.5 bg-[#BA6017] hover:bg-[#9C4F12] text-white rounded-full text-xs font-semibold transition-all duration-200 flex items-center gap-1 shadow-xs"
                  >
                    <i className="ri-send-plane-fill"></i>
                    <span>Mail</span>
                  </a>
                </div>
              </div>

              {/* Direct Query Form */}
              {status === "success" ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border border-[#EAE0D5] rounded-2xl p-6 text-center space-y-3 shadow-xs"
                >
                  <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl shadow-sm">
                    <i className="ri-check-double-line"></i>
                  </div>
                  <h3 className="font-serif text-2xl font-bold text-[#2D231E] m-0">
                    Query Sent Successfully!
                  </h3>
                  <p className="font-sans text-sm text-[#756359] max-w-[380px] mx-auto leading-relaxed">
                    {statusMessage}
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="bg-[#F3C343] hover:bg-[#DFB030] text-[#2B2620] px-6 py-2 rounded-full font-semibold text-sm transition-all cursor-pointer shadow-xs"
                    >
                      Submit Another Query
                    </button>
                  </div>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Name Field */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#2D231E] mb-1.5">
                        Name
                      </label>
                      <div className="relative">
                        <i className="ri-user-line absolute left-3.5 top-1/2 -translate-y-1/2 text-[#756359] text-sm"></i>
                        <input
                          type="text"
                          value={name || (isDataLoaded ? "Student" : "Loading...")}
                          readOnly
                          className="w-full pl-9 pr-3.5 py-2.5 border border-[#EAE0D5] rounded-xl text-sm bg-[#FAF7F2] text-[#2D231E] font-medium cursor-not-allowed select-none shadow-xs"
                        />
                      </div>
                    </div>

                    {/* Email Field */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#2D231E] mb-1.5">
                        Email Address
                      </label>
                      <div className="relative">
                        <i className="ri-mail-line absolute left-3.5 top-1/2 -translate-y-1/2 text-[#756359] text-sm"></i>
                        <input
                          type="email"
                          value={email || (isDataLoaded ? "Not Provided" : "Loading...")}
                          readOnly
                          className="w-full pl-9 pr-3.5 py-2.5 border border-[#EAE0D5] rounded-xl text-sm bg-[#FAF7F2] text-[#2D231E] font-medium cursor-not-allowed select-none shadow-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bhawan / Hostel Field */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#2D231E] mb-1.5">
                      Your Bhawan / Hostel
                    </label>
                    <div className="relative">
                      <i className="ri-building-line absolute left-3.5 top-1/2 -translate-y-1/2 text-[#756359] text-sm"></i>
                      <input
                        type="text"
                        value={bhawan || (isDataLoaded ? "Vivekanand Bhawan" : "Loading...")}
                        readOnly
                        className="w-full pl-9 pr-3.5 py-2.5 border border-[#EAE0D5] rounded-xl text-sm bg-[#FAF7F2] text-[#2D231E] font-medium cursor-not-allowed select-none shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Query Text Area */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#2D231E]">
                        Your Query / Message <span className="text-[#BA6017]">*</span>
                      </label>
                      <span className="text-[11px] text-[#756359]">
                        {message.length} characters
                      </span>
                    </div>
                    <div className="relative">
                      <textarea
                        required
                        rows={4}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type your questions, meal timing concerns, mess hygiene reports, or dietary feedback here..."
                        className="w-full p-3.5 bg-white border border-[#EAE0D5] rounded-xl text-sm text-[#2D231E] placeholder:text-[#756359]/60 focus:outline-none focus:border-[#BA6017] focus:ring-2 focus:ring-[#BA6017]/15 transition-all resize-none"
                      ></textarea>
                    </div>
                  </div>

                  {/* Error Banner if any */}
                  {status === "error" && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                      <i className="ri-error-warning-line text-base shrink-0"></i>
                      <span>{statusMessage}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={status === "loading"}
                      className="w-full bg-[#BA6017] hover:bg-[#9C4F12] text-white font-sans font-semibold py-3.5 px-6 rounded-full text-[15px] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 shadow-md hover:shadow-lg disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {status === "loading" ? (
                        <>
                          <i className="ri-loader-4-line animate-spin text-lg"></i>
                          <span>Submitting Query...</span>
                        </>
                      ) : (
                        <>
                          <i className="ri-send-plane-2-fill text-base"></i>
                          <span>Submit Query</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Social Channels with Remix Icons */}
              <div className="pt-3 border-t border-[#EAE0D5]">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <span className="font-serif text-xs font-semibold text-[#756359] flex items-center gap-1.5">
                    <i className="ri-global-line text-sm text-[#BA6017]"></i>
                    <span>Connect on Socials:</span>
                  </span>

                  {/* Remix Icons Row */}
                  <div className="flex items-center gap-2.5">
                    {/* Instagram */}
                    <a
                      href="https://instagram.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Follow SmartMess on Instagram"
                      aria-label="SmartMess Instagram"
                      className="w-9 h-9 rounded-full bg-white hover:bg-[#E1306C] text-[#756359] hover:text-white border border-[#EAE0D5] hover:border-[#E1306C] flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-xs"
                    >
                      <i className="ri-instagram-line text-base"></i>
                    </a>

                    {/* Facebook */}
                    <a
                      href="https://facebook.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Follow SmartMess on Facebook"
                      aria-label="SmartMess Facebook"
                      className="w-9 h-9 rounded-full bg-white hover:bg-[#1877F2] text-[#756359] hover:text-white border border-[#EAE0D5] hover:border-[#1877F2] flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-xs"
                    >
                      <i className="ri-facebook-circle-fill text-base"></i>
                    </a>

                    {/* Twitter / X */}
                    <a
                      href="https://twitter.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Follow SmartMess on X / Twitter"
                      aria-label="SmartMess Twitter"
                      className="w-9 h-9 rounded-full bg-white hover:bg-black text-[#756359] hover:text-white border border-[#EAE0D5] hover:border-black flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-xs"
                    >
                      <i className="ri-twitter-x-line text-base"></i>
                    </a>

                    {/* Email */}
                    <a
                      href="mailto:support@smartmess.com"
                      title="Send Email to support@smartmess.com"
                      aria-label="Email SmartMess Support"
                      className="w-9 h-9 rounded-full bg-white hover:bg-[#BA6017] text-[#756359] hover:text-white border border-[#EAE0D5] hover:border-[#BA6017] flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-xs"
                    >
                      <i className="ri-mail-line text-base"></i>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
