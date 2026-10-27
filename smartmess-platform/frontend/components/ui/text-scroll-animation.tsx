"use client";

import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import React, { useRef } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type CharacterProps = {
  char: string;
  index: number;
  centerIndex: number;
  scrollYProgress: MotionValue<number>;
};

const CharacterV1 = ({ char, index, centerIndex, scrollYProgress }: CharacterProps) => {
  const isSpace = char === " ";
  const distanceFromCenter = index - centerIndex;

  // Clamped horizontal offset to prevent 800px+ offscreen horizontal overflow on mobile devices
  const clampedOffset = Math.max(-80, Math.min(80, distanceFromCenter * 20));
  const x = useTransform(scrollYProgress, [0, 0.4], [clampedOffset, 0]);
  const rotateX = useTransform(scrollYProgress, [0, 0.4], [Math.max(-45, Math.min(45, distanceFromCenter * 20)), 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.3], [0, 1]);

  return (
    <motion.span
      aria-hidden="true"
      className={cn("inline-block", isSpace && "w-3")}
      style={{ x, rotateX, opacity }}
    >
      {char}
    </motion.span>
  );
};

type HeaderProps = {
  text?: string;
  id?: string;
};

export const AnimatedServicesHeader = ({ text = "Our Main Services", id }: HeaderProps) => {
  const targetRef = useRef<HTMLDivElement | null>(null);

  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start 90%", "center center"],
  });

  const characters = text.split("");
  const centerIndex = Math.floor(characters.length / 2);

  return (
    <div
      id={id}
      ref={targetRef}
      className="text-center mb-[60px] w-full max-w-full scroll-mt-24 overflow-x-clip"
      style={{ perspective: "500px" }}
    >
      <h2
        aria-label={text}
        className="font-serif text-[2.2rem] md:text-[3rem] font-bold text-[#2B2620] m-0 tracking-tight"
      >
        {characters.map((char, index) => (
          <CharacterV1
            key={index}
            char={char}
            index={index}
            centerIndex={centerIndex}
            scrollYProgress={scrollYProgress}
          />
        ))}
      </h2>
    </div>
  );
};

type AnimatedCardProps = {
  children: React.ReactNode;
  distanceFromCenter: number;
  scrollYProgress: MotionValue<number>;
};

const AnimatedCard = ({ children, distanceFromCenter: d, scrollYProgress }: AnimatedCardProps) => {
  const x = useTransform(scrollYProgress, [0, 1], [d * 80, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [100 + Math.abs(d) * 60, 0]);
  const rotate = useTransform(scrollYProgress, [0, 1], [d * 10, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [0, 1]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.85, 1]);

  return (
    <motion.div style={{ x, y, rotate, opacity, scale }} className="w-full flex justify-center">
      <div className="w-full max-w-[380px] h-full">{children}</div>
    </motion.div>
  );
};

export const AnimatedServicesGrid = ({ children }: { children: React.ReactNode }) => {
  const targetRef = useRef<HTMLDivElement | null>(null);

  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start 95%", "center 65%"],
  });

  const childrenArray = React.Children.toArray(children);
  const center = (childrenArray.length - 1) / 2;

  return (
    <div
      ref={targetRef}
      className="grid grid-cols-1 lg:grid-cols-3 gap-[30px] lg:gap-[50px] max-w-[1250px] w-full mx-auto mt-[40px] overflow-x-clip"
      style={{ perspective: "1000px" }}
    >
      {childrenArray.map((child, index) => (
        <AnimatedCard
          key={index}
          distanceFromCenter={index - center}
          scrollYProgress={scrollYProgress}
        >
          {child}
        </AnimatedCard>
      ))}
    </div>
  );
};