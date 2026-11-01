"use client";

import { useRef } from "react";
import {
    motion,
    useReducedMotion,
    useScroll,
    useTransform,
    type MotionValue,
} from "framer-motion";
import {
    AnimatedServicesHeader,
    AnimatedServicesGrid,
} from "@/components/ui/text-scroll-animation";

/* =========================================================
   Settings you can tweak
========================================================= */

// Put your photo in the /public folder with this name
const IMAGE_SRC = "/IIT-Roorkee(1).jpg";
// Which part of the photo stays visible when it is cropped (x y)
const IMAGE_POSITION = "center center";

const SECTION_HEIGHT = "340vh"; // longer = slower animation
const GAP_PCT = 13; // space between the cards, as % of one card's width
const RADIUS = 20; // card corner radius in px
const FAN_DEG = 12; // tilt of the outer panels when the photo splits

// Scroll progress (0 → 1) at which each stage happens
const SPLIT: [number, number] = [0.08, 0.28]; // photo splits into panels
const FLIP_FIRST_START = 0.3; // first panel starts flipping
const FLIP_STAGGER = 0.04; // each next panel starts a bit later
const FLIP_LENGTH = 0.34; // how much scroll one flip takes

/* =========================================================
   Types + shared card styles
========================================================= */

export type Meal = {
    image?: string;
    icon?: string;
    name: string;
    time: string;
    items: string;
    rating: string;
};

const cardBase =
    "bg-white rounded-[20px] w-full h-full flex flex-col box-border transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] hover:-translate-y-2 hover:scale-[1.03] hover:shadow-[0_15px_30px_rgba(0,0,0,0.12)]";

const selectBtn =
    "bg-[#F3C343] text-[#2B2620] font-sans px-6 py-2.5 rounded-full text-[1rem] font-semibold transition-colors hover:bg-[#DFB030]";

function MealCard({ meal, compact = false }: { meal: Meal; compact?: boolean }) {
    return (
        <div className={`${cardBase} ${compact ? "p-4 sm:p-[22px]" : "p-5 sm:p-[28px]"}`}>
            <div
                className={`w-full relative rounded-xl overflow-hidden shrink-0 bg-[#FFF1C2] ${
                    compact ? "h-[135px] mb-[18px]" : "h-[165px] mb-[22px]"
                }`}
            >
                {meal.image ? (
                    <img
                        src={meal.image}
                        alt={`${meal.name} Menu`}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                ) : (
                    <div className="w-full h-full flex justify-center items-center text-[4rem]">
                        <span aria-hidden="true">{meal.icon}</span>
                    </div>
                )}
            </div>

            <h3 className="font-serif text-[1.7rem] font-bold text-[#2B2620] m-0 mb-[6px] tracking-tight">
                {meal.name}
            </h3>

            <p className="font-sans text-[0.95rem] font-medium text-[#BA6017] m-0 mb-[14px]">
                {meal.time}
            </p>

            <p className="font-sans text-[1rem] leading-[1.6] text-[#4A3F35] m-0">
                {meal.items}
            </p>

            <div className="h-[1px] bg-black/5 my-[20px] w-full" />

            <div className="flex justify-between items-center mt-auto">
                <span className="font-serif text-[1.15rem] font-semibold text-[#3D352D]">
                    {meal.rating !== "—" ? `★ ${meal.rating} / 5` : "No ratings yet"}
                </span>
                <a
                    href={`/student-dashboard.html?tab=menu&rate=${encodeURIComponent(meal.name)}`}
                    className={selectBtn}
                >
                    Rate
                </a>
            </div>
        </div>
    );
}

/* =========================================================
   One panel: photo slice on the front, meal card on the back
========================================================= */

type PanelProps = {
    index: number;
    count: number;
    meal: Meal;
    progress: MotionValue<number>;
};

function Panel({ index, count, meal, progress }: PanelProps) {
    const d = index - (count - 1) / 2; // distance from the middle panel
    const flipStart = FLIP_FIRST_START + index * FLIP_STAGGER;
    const flipEnd = flipStart + FLIP_LENGTH;
    const flipMid = (flipStart + flipEnd) / 2;

    // Photo splits: panels move apart and fan out
    const x = useTransform(progress, SPLIT, ["0%", `${d * GAP_PCT}%`]);

    // Fan out, hold, then flip all the way over (180°) to show the card
    const rotateY = useTransform(
        progress,
        [SPLIT[0], SPLIT[1], flipStart, flipEnd],
        [0, -d * FAN_DEG, -d * FAN_DEG, 180]
    );
    const rotateZ = useTransform(
        progress,
        [SPLIT[0], SPLIT[1], flipStart, flipEnd],
        [0, d * 2.5, d * 2.5, 0]
    );
    // Small lift while flipping
    const y = useTransform(progress, [flipStart, flipMid, flipEnd], [0, -22, 0]);

    // Corners: only the outer edges are rounded while it is still one photo
    const innerRadius = useTransform(progress, SPLIT, [0, RADIUS]);
    const outerRadius = useTransform(progress, SPLIT, [14, RADIUS]);
    const leftRadius = index === 0 ? outerRadius : innerRadius;
    const rightRadius = index === count - 1 ? outerRadius : innerRadius;

    // Once flipped, the photo must not catch clicks meant for the card
    const frontPointer = useTransform(progress, (v) => (v > flipMid ? "none" : "auto"));

    return (
        <motion.div
            className="relative h-full flex-1 basis-0 will-change-transform"
            style={{
                x,
                y,
                rotateY,
                rotateZ,
                transformStyle: "preserve-3d",
                borderTopLeftRadius: leftRadius,
                borderBottomLeftRadius: leftRadius,
                borderTopRightRadius: rightRadius,
                borderBottomRightRadius: rightRadius,
            }}
        >
            {/* Back: the meal card */}
            <div
                className="absolute inset-0"
                style={{
                    transform: "rotateY(180deg)",
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                }}
            >
                <MealCard meal={meal} compact />
            </div>

            {/* Front: this panel's slice of the photo */}
            <motion.div
                className="absolute inset-0 overflow-hidden bg-[#2B2620]"
                style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    borderRadius: "inherit",
                    pointerEvents: frontPointer,
                }}
            >
                <img
                    src={IMAGE_SRC}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    loading="lazy"
                    decoding="async"
                    className="absolute top-0 h-full max-w-none object-cover select-none"
                    style={{
                        width: `${count * 100}%`,
                        left: `${-index * 100}%`,
                        objectPosition: IMAGE_POSITION,
                    }}
                />
            </motion.div>
        </motion.div>
    );
}

/* =========================================================
   Desktop: pinned section driven by scroll
========================================================= */

function DesktopFlip({ meals }: { meals: Meal[] }) {
    const ref = useRef<HTMLElement | null>(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start start", "end end"],
    });

    return (
        <section
            ref={ref}
            className="relative bg-[#FCF5E3]"
            style={{ height: SECTION_HEIGHT }}
        >
            <div className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden px-[5%]">
                <div className="relative inline-block mx-auto mb-[40px]">
                    <h2 className="text-[1.8rem] md:text-[2.5rem] text-black border-[1.5px] border-[#BA6017] bg-[#BA6017]/10 px-[12px] py-[4px] w-fit m-0" 
                        style={{ 
                            fontFamily: "var(--font-manrope), sans-serif", 
                            fontWeight: 500,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em"
                        }}>
                        Today's Menu
                    </h2>
                    {/* Figma-style corner handles in theme color */}
                    <div className="absolute top-[-3px] left-[-3px] w-[6px] h-[6px] bg-[#BA6017]"></div>
                    <div className="absolute top-[-3px] right-[-3px] w-[6px] h-[6px] bg-[#BA6017]"></div>
                    <div className="absolute bottom-[-3px] left-[-3px] w-[6px] h-[6px] bg-[#BA6017]"></div>
                    <div className="absolute bottom-[-3px] right-[-3px] w-[6px] h-[6px] bg-[#BA6017]"></div>
                </div>

                <div
                    className="flex w-[86%] max-w-[1150px] h-[clamp(440px,68vh,500px)]"
                    style={{ perspective: 1600 }}
                >
                    {meals.map((meal, i) => (
                        <Panel
                            key={meal.name}
                            index={i}
                            count={meals.length}
                            meal={meal}
                            progress={scrollYProgress}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}

/* =========================================================
   Phones / tablets / reduced motion: your original card grid
========================================================= */

function SimpleGrid({ meals }: { meals: Meal[] }) {
    return (
        <section className="bg-[#FCF5E3] px-4 sm:px-[5%] py-12 sm:py-[12%] lg:py-[8%] flex flex-col items-center justify-center min-h-screen overflow-hidden">
            <div className="relative inline-block mx-auto mb-8 sm:mb-[40px]">
                <h2 className="text-[1.4rem] sm:text-[1.8rem] md:text-[2.5rem] text-black border-[1.5px] border-[#BA6017] bg-[#BA6017]/10 px-[12px] py-[4px] w-fit m-0" 
                    style={{ 
                        fontFamily: "var(--font-manrope), sans-serif", 
                        fontWeight: 500,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em"
                    }}>
                    Today's Menu
                </h2>
                {/* Figma-style corner handles in theme color */}
                <div className="absolute top-[-3px] left-[-3px] w-[6px] h-[6px] bg-[#BA6017]"></div>
                <div className="absolute top-[-3px] right-[-3px] w-[6px] h-[6px] bg-[#BA6017]"></div>
                <div className="absolute bottom-[-3px] left-[-3px] w-[6px] h-[6px] bg-[#BA6017]"></div>
                <div className="absolute bottom-[-3px] right-[-3px] w-[6px] h-[6px] bg-[#BA6017]"></div>
            </div>

            <AnimatedServicesGrid>
                {meals.map((meal) => (
                    <MealCard key={meal.name} meal={meal} />
                ))}
            </AnimatedServicesGrid>
        </section>
    );
}

/* =========================================================
   Export
========================================================= */

export function MenuFlipReveal({ meals }: { meals: Meal[] }) {
    const reduceMotion = useReducedMotion();

    return (
        <div id="menu" className="relative z-10 w-full max-w-full overflow-x-clip">
            {!reduceMotion && (
                <div className="hidden lg:block">
                    <DesktopFlip meals={meals} />
                </div>
            )}

            <div className={reduceMotion ? "" : "lg:hidden"}>
                <SimpleGrid meals={meals} />
            </div>
        </div>
    );
}