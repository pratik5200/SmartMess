"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactLenis from "lenis/react";
import Link from "next/link";
import {
  AnimatedServicesHeader,
  AnimatedServicesGrid,
} from "@/components/ui/text-scroll-animation";
import { ScrollRevealGrid } from "@/components/ui/scroll-reveal-grid";
import { MenuFlipReveal, type Meal } from "@/components/ui/menu-flip-reveal";
import { RollingLink } from "@/components/ui/rolling-text";
import { ContactDialog } from "@/components/ui/contact-dialog";

/* =========================================================
   Shared card styles
========================================================= */

const cardClass =
  "bg-[#F8F3E5] rounded-[20px] p-5 sm:p-[30px] w-full h-full flex flex-col box-border transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] hover:-translate-y-2 hover:scale-[1.03] hover:shadow-[0_15px_30px_rgba(0,0,0,0.12)]";

const selectBtn =
  "bg-[#F3C343] text-[#2B2620] font-sans px-5 sm:px-6 py-2 sm:py-2.5 rounded-full text-[0.9rem] sm:text-[1rem] font-semibold transition-colors hover:bg-[#DFB030]";

/* =========================================================
   Data
========================================================= */

const services = [
  {
    title: "View Your Menu",
    label: "One Click",
    action: "View",
    href: "/index.html?tab=menu",
    alt: "View Menu",
    img: "/menu-img.png",
  },
  {
    title: "Give Feedbacks",
    label: "Rate Meal",
    action: "Rate",
    href: "/index.html?tab=menu&rate=current",
    alt: "Give Feedback",
    img: "/feedback-img.png",
  },
  {
    title: "See What they like!",
    label: "Others' Feedback",
    action: "Explore",
    href: "#feedback",
    alt: "See Community Feedback",
    img: "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=600&q=80",
  },
];

/* ── Fallback static meals shown when no backend data is available ── */
const DEFAULT_MEALS: Meal[] = [
  {
    image: "/breakfast.jpg",
    icon: "🌅",
    name: "Breakfast",
    time: "7:30 – 9:30 AM",
    items: "Vermicelli Upma, Chocos, Bread Toast, Banana, Sprouts, Chai",
    rating: "—",
  },
  {
    image: "/lunch.png",
    icon: "☀️",
    name: "Lunch",
    time: "12:30 – 2:30 PM",
    items: "Steamed Rice, Roti, Dal Tadka, Kadhi, Bhindi Masala, Boondi Raita",
    rating: "—",
  },
  {
    image: "/dinner.png",
    icon: "🌙",
    name: "Dinner",
    time: "7:30 – 9:30 PM",
    items: "Fluffy Puri, Jeera Rice, Shahi Paneer, Aloo Gobi, Dal, Gulab Jamun",
    rating: "—",
  },
];

/* ── Images for each meal type ── */
const MEAL_IMAGES: Record<string, string> = {
  Breakfast: "/breakfast.jpg",
  Lunch: "/lunch.png",
  Dinner: "/dinner.png",
};

/* ── Icons for each meal type ── */
const MEAL_ICONS: Record<string, string> = {
  Breakfast: "🌅",
  Lunch: "☀️",
  Dinner: "🌙",
};

/* ── Build time string ── */
function formatTime(start: string, end: string): string {
  if (!start || !end) return "";
  return `${start} – ${end}`;
}

/* ── Hook: fetch today's dynamic menu from backend ── */
function useTodaysMeals() {
  const [meals, setMeals] = useState<Meal[]>(DEFAULT_MEALS);

  useEffect(() => {
    async function load() {
      try {
        const raw = localStorage.getItem("smartmess_user");
        if (!raw) return;
        const user = JSON.parse(raw);
        const bhawanId = user?.bhawanId || (user?.bhawan && user?.bhawan?.id);
        if (!bhawanId) return;

        const res = await fetch(`http://localhost:5000/api/menus/today/${bhawanId}`);
        if (!res.ok) return;
        const data: Array<{
          meal_type: string;
          start_time: string;
          end_time: string;
          items: string[];
          averageRating?: number;
          ratingCount?: number;
        }> = await res.json();

        if (!data || !Array.isArray(data) || data.length === 0) return;

        const todayEntries = data.filter((m) => m.meal_type !== undefined);

        const builtMeals: Meal[] = (["Breakfast", "Lunch", "Dinner"] as const).map((type) => {
          const entry = todayEntries.find((m) => m.meal_type === type);
          if (!entry) {
            return {
              image: MEAL_IMAGES[type],
              icon: MEAL_ICONS[type],
              name: type,
              time: "Menu for next week currently not uploaded",
              items: "Menu for next week currently not uploaded.",
              rating: "—",
            };
          }
          const avgRating = entry.averageRating && entry.ratingCount && entry.ratingCount > 0
            ? entry.averageRating.toFixed(1)
            : "—";
          return {
            image: MEAL_IMAGES[type],
            icon: MEAL_ICONS[type],
            name: type,
            time: formatTime(entry.start_time, entry.end_time),
            items: entry.items.join(", "),
            rating: avgRating,
          };
        });

        setMeals(builtMeals);
      } catch {
        // Fallback silently to DEFAULT_MEALS
      }
    }
    load();
  }, []);

  return { meals };
}

const steps = [
  {
    n: "01",
    title: "Sign In",
    text: "Log in with your mess account in a few seconds. No paperwork, no queues.",
  },
  {
    n: "02",
    title: "Rate Your Meal",
    text: "Tap a star rating and add a quick comment right after you eat.",
  },
  {
    n: "03",
    title: "Menu Gets Better",
    text: "Management sees live feedback and tunes tomorrow's menu to what you actually like.",
  },
];

const reviews = [
  {
    name: "Aarav S.",
    role: "Hostel Resident",
    text: "I finally know what's for dinner before I walk down. The rating option is super quick.",
  },
  {
    name: "Priya M.",
    role: "Final Year Student",
    text: "Seeing what others rated helps me decide when to skip or go. Love the clean design.",
  },
  {
    name: "Mess Manager",
    role: "Management",
    text: "Daily feedback tells us which dishes work. Menu planning is so much easier now.",
  },
];

const quickLinks = [
  { label: "Service", href: "#services" },
  { label: "Today's Menu", href: "/index.html?tab=menu" },
  { label: "How It Works", href: "#how" },
  { label: "Feedback", href: "#feedback" },
];

/* =========================================================
   Main Page
========================================================= */

export default function SmartMessHome() {
  const { meals } = useTodaysMeals();
  const [isContactOpen, setIsContactOpen] = useState(false);
  const lenisRef = useRef<any>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const check = () => {
      // Lenis smooth-scroll is only for desktop devices with fine pointer (mouse/trackpad)
      const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
      const isLargeScreen = window.innerWidth >= 1024;
      setIsDesktop(isLargeScreen && hasFinePointer);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [currentUser, setCurrentUser] = useState<{
    id?: number;
    name?: string;
    role?: string;
    email?: string;
    bhawanId?: number;
    bhawanName?: string;
  } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("smartmess_user");
      if (raw) {
        setCurrentUser(JSON.parse(raw));
      }
    } catch (e) {
      console.error("Error reading user session", e);
    }
  }, []);

  const handleLogout = () => {
    try {
      localStorage.removeItem("smartmess_user");
      sessionStorage.clear();
      setCurrentUser(null);
    } catch (e) {
      console.error("Logout error", e);
    }
    window.location.href = "/";
  };

  const scrollToSection = useCallback((targetId: string) => {
    const cleanId = targetId.replace(/^#/, "");
    const target = document.getElementById(cleanId);
    if (!target) return;

    const lenis = (window as any).__lenis || lenisRef.current?.lenis;
    if (lenis && typeof lenis.scrollTo === "function") {
      lenis.scrollTo(target, {
        offset: cleanId === "menu" ? 40 : -20,
        duration: 1.2,
      });
    } else {
      const top =
        target.getBoundingClientRect().top +
        window.pageYOffset +
        (cleanId === "menu" ? 40 : -20);
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

  // Global capture listener to intercept all hash clicks so they work every single time
  useEffect(() => {
    const handleCaptureClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a, button");
      if (!anchor) return;

      const scrollToAttr = anchor.getAttribute("data-scroll-to");
      const href = anchor.getAttribute("href");
      const targetHash =
        scrollToAttr ||
        (href && href.startsWith("#") && href.length > 1 ? href : null);

      if (targetHash) {
        const id = targetHash.replace(/^#/, "");
        const el = document.getElementById(id);
        if (el) {
          e.preventDefault();
          e.stopPropagation();
          scrollToSection(id);
        }
      }
    };

    document.addEventListener("click", handleCaptureClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleCaptureClick, {
        capture: true,
      });
    };
  }, [scrollToSection]);

  const mainContent = (
    <main className="relative w-full max-w-full min-h-screen font-sans overflow-x-clip">
        {/* =================================================
            1. HERO
        ================================================== */}

        <section
          id="hero"
          className="
            relative z-10 w-full min-h-[100dvh] md:h-screen flex flex-col justify-between
            bg-[#ffca28]
            bg-[url('/home_mess_final.png')]
            bg-no-repeat
            bg-[length:100%_100%]
            bg-top
            max-md:bg-cover
            max-md:bg-[position:center_top]
          "
        >
          {/* Navbar */}
          <nav className="relative z-20 flex flex-wrap justify-between items-center px-4 sm:px-[4%] py-3 sm:py-4 bg-[#FCF5E3] w-full shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
            <a
              href="#hero"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection("hero");
              }}
              className="text-[20px] sm:text-[24px] md:text-[28px] text-black no-underline flex items-center gap-2 sm:gap-2.5 md:gap-3 tracking-tight group cursor-pointer shrink-0"
              style={{ fontFamily: "var(--font-manrope), sans-serif", fontWeight: 800, color: '#000000' }}
            >
              <img
                src="/smartmess_logo_vector.svg"
                alt="SmartMess Logo"
                width={52}
                height={52}
                loading="eager"
                decoding="async"
                className="w-9 h-9 sm:w-11 sm:h-11 md:w-[52px] md:h-[52px] object-contain shrink-0 transition-transform duration-300 group-hover:scale-105 drop-shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
              />
              <span style={{ fontFamily: "var(--font-manrope), sans-serif", fontWeight: 800, color: '#000000' }}>SmartMess</span>
            </a>

            <div className="flex gap-4 sm:gap-6 w-full justify-center items-center overflow-x-auto py-2 order-3 border-t border-black/5 mt-2 md:mt-0 md:border-t-0 md:absolute md:left-1/2 md:-translate-x-1/2 md:w-auto md:order-none md:py-0 md:gap-[35px] md:overflow-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <RollingLink
                plain
                href="/index.html?tab=menu"
                className="font-serif text-[#3D3126] text-[13px] sm:text-[14px] md:text-base font-medium whitespace-nowrap cursor-pointer"
              >
                Menu
              </RollingLink>
              <RollingLink
                plain
                href="/index.html?tab=profile"
                className="font-serif text-[#3D3126] text-[13px] sm:text-[14px] md:text-base font-medium whitespace-nowrap"
              >
                Profile
              </RollingLink>
              <RollingLink
                href="#feedback"
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  scrollToSection("feedback");
                }}
                className="font-serif text-[#3D3126] text-[13px] sm:text-[14px] md:text-base font-medium whitespace-nowrap cursor-pointer"
              >
                Feedback
              </RollingLink>
              <RollingLink
                href="#how"
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  scrollToSection("how");
                }}
                className="font-serif text-[#3D3126] text-[13px] sm:text-[14px] md:text-base font-medium whitespace-nowrap cursor-pointer"
              >
                Help
              </RollingLink>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5 md:gap-4 shrink-0">
              <button
                type="button"
                onClick={() => setIsContactOpen(true)}
                className="bg-[#BA6017] text-white font-sans px-3.5 sm:px-5 md:px-7 py-1.5 sm:py-2 md:py-2.5 rounded-full font-semibold text-[12px] sm:text-[13px] md:text-[15px] transition-all hover:bg-[#9C4F12] hover:-translate-y-0.5 cursor-pointer shadow-sm whitespace-nowrap"
              >
                Contact
              </button>
              {currentUser ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="bg-[#BA6017] text-white font-sans px-3.5 sm:px-5 md:px-7 py-1.5 sm:py-2 md:py-2.5 rounded-full font-semibold text-[12px] sm:text-[13px] md:text-[15px] transition-all hover:bg-[#9C4F12] hover:-translate-y-0.5 cursor-pointer shadow-sm whitespace-nowrap"
                >
                  Logout
                </button>
              ) : (
                <a
                  href="/login.html"
                  className="bg-[#BA6017] text-white font-sans px-3.5 sm:px-5 md:px-7 py-1.5 sm:py-2 md:py-2.5 rounded-full font-semibold text-[12px] sm:text-[13px] md:text-[15px] transition-all hover:bg-[#9C4F12] hover:-translate-y-0.5 cursor-pointer shadow-sm whitespace-nowrap no-underline inline-block"
                >
                  Sign In
                </a>
              )}
            </div>
          </nav>

          {/* Hero Content */}
          <div className="relative z-10 px-4 sm:px-[5%] py-6 sm:py-8 md:pt-[6%] md:pb-[8%] max-w-full sm:max-w-[90%] md:max-w-[62%] lg:max-w-[48%] flex flex-col justify-center my-auto max-md:bg-[#FFF8ED]/85 max-md:backdrop-blur-md max-md:rounded-2xl max-md:m-4 max-md:p-5 max-md:shadow-[0_8px_24px_rgba(0,0,0,0.06)] max-md:border max-md:border-white/50">
            <h1 className="font-serif text-[2.1rem] sm:text-[2.6rem] md:text-[3rem] lg:text-[3.5rem] font-bold text-[#1A1510] m-0 leading-[1.15] tracking-tighter">
              See Your Menu
              <br />
              Share Your Feedback
            </h1>

            <h2 className="font-serif text-[1.25rem] sm:text-[1.5rem] md:text-[1.7rem] lg:text-[2rem] font-semibold text-[#3D3126] mt-2.5 sm:mt-[15px]">
              Rate What You Like.
            </h2>

            <p className="font-sans text-sm sm:text-base leading-[1.6] text-[#4A3F35] my-4 sm:my-[22px] font-normal w-full lg:w-[85%]">
              Experience seamless dining with real time updates. Check
              what's cooking today, give your instant reviews, and help shape
              a better daily menu for everyone. Good food, better management,
              directly from your pocket.
            </p>

            <div className="flex flex-wrap sm:flex-nowrap gap-3 sm:gap-[15px] pt-1">
              <a
                href={currentUser?.role === "STAFF" ? "/staff-dashboard.html" : "/index.html?tab=menu"}
                className="bg-[#BA6017] text-white font-sans px-5 sm:px-7 py-2.5 rounded-full font-semibold text-[13px] sm:text-[15px] transition-all hover:bg-[#9C4F12] hover:-translate-y-0.5 inline-block text-center cursor-pointer no-underline shadow-sm flex-1 sm:flex-none whitespace-nowrap"
              >
                View Today's Menu
              </a>

              {currentUser ? (
                <a
                  href={currentUser.role === "STAFF" ? "/staff-dashboard.html" : "/index.html"}
                  className="bg-transparent text-[#3D3126] border-2 border-[#3D3126] font-sans px-5 sm:px-7 py-2.5 rounded-full font-semibold text-[13px] sm:text-[15px] transition-all hover:bg-[#3D3126] hover:text-[#FCF5E3] inline-block text-center flex-1 sm:flex-none whitespace-nowrap no-underline"
                >
                  {currentUser.role === "STAFF" ? "Staff Dashboard" : "My Dashboard"}
                </a>
              ) : (
                <a
                  href="/login.html"
                  className="bg-transparent text-[#3D3126] border-2 border-[#3D3126] font-sans px-5 sm:px-7 py-2.5 rounded-full font-semibold text-[13px] sm:text-[15px] transition-all hover:bg-[#3D3126] hover:text-[#FCF5E3] inline-block text-center flex-1 sm:flex-none whitespace-nowrap no-underline"
                >
                  Sign In
                </a>
              )}
            </div>
          </div>
          <div className="hidden md:block h-4" />
        </section>

        {/* =================================================
            2. SERVICES
        ================================================== */}

        <section
          id="services"
          className="relative z-10 bg-white px-4 sm:px-[5%] py-12 sm:py-[8%] flex flex-col items-center justify-center min-h-screen"
        >
          <AnimatedServicesHeader text="Our Main Services" />

          <AnimatedServicesGrid>
            {services.map((s) => (
              <div
                key={s.title}
                className={`${cardClass} cursor-pointer`}
                onClick={() => {
                  if (s.title === "Give Feedbacks") {
                    const now = new Date();
                    const currentMinutes =
                      now.getHours() * 60 + now.getMinutes();
                    let currentMeal = "Breakfast";
                    if (
                      currentMinutes >= 11 * 60 + 30 &&
                      currentMinutes < 17 * 60
                    ) {
                      currentMeal = "Lunch";
                    } else if (currentMinutes >= 17 * 60) {
                      currentMeal = "Dinner";
                    }
                    window.location.href = `/index.html?tab=menu&rate=${currentMeal}`;
                    return;
                  }
                  if (s.href.startsWith("#")) {
                    scrollToSection(s.href);
                  } else {
                    window.location.href = s.href;
                  }
                }}
              >
                <div className="h-[180px] sm:h-[220px] w-full flex justify-center items-center mb-4 sm:mb-[25px] rounded-xl overflow-hidden">
                  <img
                    src={s.img}
                    alt={s.alt}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                </div>

                <h3 className="font-serif text-[1.7rem] font-bold text-[#2B2620] m-0 mb-[15px] tracking-tight">
                  {s.title}
                </h3>

                <div className="h-[1px] bg-black/5 mb-[20px] w-full" />

                <div className="flex justify-between items-center mt-auto">
                  <span className="font-serif text-[1.15rem] font-semibold text-[#3D352D]">
                    {s.label}
                  </span>

                  <span className={selectBtn}>
                    {s.action}
                  </span>
                </div>
              </div>
            ))}
          </AnimatedServicesGrid>
        </section>

        {/* =================================================
            3. TODAY'S MENU  (photo splits, then flips into cards)
        ================================================== */}

        <MenuFlipReveal meals={meals} />

        {/* =================================================
            4. HOW IT WORKS
        ================================================== */}

        <section
          id="how"
          className="relative z-10 bg-[#FAF8F5] pt-[8%] pb-[6%] flex flex-col items-center justify-start min-h-[90vh]"
        >
          <AnimatedServicesHeader text="How SmartMess Works" />

          <ScrollRevealGrid steps={steps} />
        </section>

        {/* =================================================
            5. FEEDBACK
        ================================================== */}

        <section
          id="feedback"
          className="relative z-10 bg-[#FCF5E3] px-4 sm:px-[5%] py-12 sm:py-[8%] flex flex-col items-center justify-center min-h-screen"
        >
          <AnimatedServicesHeader text="Loved By Diners" />

          <AnimatedServicesGrid>
            {reviews.map((r) => (
              <div key={r.name} className={`${cardClass} bg-white`}>
                <span
                  className="font-serif text-[4rem] font-bold leading-none text-[#BA6017]"
                  aria-hidden="true"
                >
                  “
                </span>

                <p className="font-sans text-[1.05rem] leading-[1.7] text-[#4A3F35] m-0 mb-[20px]">
                  {r.text}
                </p>

                <div
                  className="text-[#F3C343] text-[1.2rem] tracking-widest mb-[18px]"
                  aria-label="5 out of 5 stars"
                >
                  ★★★★★
                </div>

                <div className="h-[1px] bg-black/5 mb-[18px] w-full" />

                <div className="mt-auto">
                  <p className="font-serif text-[1.15rem] font-bold text-[#2B2620] m-0">
                    {r.name}
                  </p>

                  <p className="font-sans text-[0.9rem] text-[#7a6a58] m-0">
                    {r.role}
                  </p>
                </div>
              </div>
            ))}
          </AnimatedServicesGrid>
        </section>

        {/* =================================================
            6. CTA
        ================================================== */}

        <section
          id="contact"
          className="relative z-10 bg-[#ffca28] px-4 sm:px-[5%] py-14 sm:py-[10%] flex flex-col items-center justify-center text-center"
        >
          <h2 className="font-serif text-[1.9rem] sm:text-[2.6rem] md:text-[3.5rem] font-bold text-[#1A1510] m-0 leading-[1.15] tracking-tighter max-w-[800px]">
            Good Food Starts With Good Feedback
          </h2>

          <p className="font-sans text-sm sm:text-base md:text-lg leading-[1.6] text-[#3D3126] my-4 sm:my-[25px] max-w-[600px]">
            Join your mess community today. Check the menu, rate your meals
            and help make every day's food better.
          </p>

          <div className="flex flex-wrap gap-3 sm:gap-[15px] justify-center">
            <a
              href="/login.html"
              className="bg-[#BA6017] text-white font-sans px-6 sm:px-8 py-2.5 sm:py-3 rounded-full font-semibold text-sm sm:text-[16px] transition-all hover:bg-[#9C4F12] hover:-translate-y-0.5 inline-block text-center"
            >
              Get Started
            </a>

            <button
              type="button"
              onClick={() => setIsContactOpen(true)}
              className="bg-transparent text-[#3D3126] border-2 border-[#3D3126] font-sans px-6 sm:px-8 py-2.5 sm:py-3 rounded-full font-semibold text-sm sm:text-[16px] transition-all hover:bg-[#3D3126] hover:text-[#FCF5E3] inline-block cursor-pointer text-center"
            >
              Contact Us
            </button>
          </div>
        </section>

        {/* =================================================
            7. FOOTER
        ================================================== */}

        <footer
          id="help"
          className="relative z-10 bg-[#2B2620] text-[#FCF5E3] px-4 sm:px-[5%] pt-12 sm:pt-[70px] pb-8 sm:pb-[30px]"
        >
          <div className="max-w-[1250px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[40px]">
            <div className="lg:col-span-2">
              <Link
                href="/"
                className="font-serif text-[30px] font-bold text-[#F3C343] no-underline tracking-tight flex items-center gap-2.5 group"
              >
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center p-0.5">
                  <img
                    src="/smartmess_logo_vector.svg"
                    alt="SmartMess Logo"
                    width={32}
                    height={32}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-contain"
                  />
                </div>
                <span>SmartMess</span>
              </Link>

              <p className="font-sans text-[0.95rem] leading-[1.7] text-[#FCF5E3]/70 mt-[15px] max-w-[420px]">
                A simple way to see your daily mess menu, share honest
                feedback and help shape better meals for everyone.
              </p>
            </div>

            <div>
              <h4 className="font-serif text-[1.2rem] font-bold text-[#F3C343] m-0 mb-[18px]">
                Quick Links
              </h4>

              <ul className="list-none p-0 m-0 flex flex-col gap-[10px]">
                {quickLinks.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      onClick={(e) => {
                        if (l.href.startsWith("#")) {
                          e.preventDefault();
                          scrollToSection(l.href);
                        }
                      }}
                      className="font-sans text-[0.95rem] text-[#FCF5E3]/70 no-underline transition-colors hover:text-[#F3C343] cursor-pointer"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-serif text-[1.2rem] font-bold text-[#F3C343] m-0 mb-[18px]">
                Contact
              </h4>

              <ul className="list-none p-0 m-0 flex flex-col gap-[10px] font-sans text-[0.95rem] text-[#FCF5E3]/70">
                <li>
                  <button
                    type="button"
                    onClick={() => setIsContactOpen(true)}
                    className="text-left text-[#FCF5E3]/80 hover:text-[#F3C343] transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <i className="ri-mail-line"></i>
                    <span>support@smartmess.com</span>
                  </button>
                </li>
                <li>+91 00000 00000</li>
                <li>IIT Roorkee, Uttarakhand</li>
              </ul>
            </div>
          </div>

          <div className="max-w-[1250px] mx-auto mt-[50px] pt-[25px] border-t border-[#FCF5E3]/10 flex flex-col md:flex-row justify-between items-center gap-[10px]">
            <p className="font-sans text-[0.85rem] text-[#FCF5E3]/50 m-0">
              © {new Date().getFullYear()} SmartMess. All rights reserved.
            </p>

            <p className="font-sans text-[0.85rem] text-[#FCF5E3]/50 m-0">
              Made with care for better mess food.
            </p>
          </div>
        </footer>

        {/* Contact Us Dialog Box */}
        <ContactDialog
          isOpen={isContactOpen}
          onClose={() => setIsContactOpen(false)}
        />
      </main>
  );

  if (isDesktop) {
    return (
      <ReactLenis
        root
        ref={lenisRef}
        options={{
          naiveDimensions: true,
          autoResize: true,
          syncTouch: false,
        }}
      >
        {mainContent}
      </ReactLenis>
    );
  }

  return mainContent;
}