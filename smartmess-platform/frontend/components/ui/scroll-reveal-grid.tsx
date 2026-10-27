"use client";

import { motion, useScroll, type Variants } from "framer-motion";
import React, { useRef } from "react";

export interface ScrollRevealGridProps {
  steps: {
    n: string;
    title: string;
    text: string;
  }[];
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

export function ScrollRevealGrid({ steps }: ScrollRevealGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 80%", "end 50%"],
  });

  return (
    <div ref={containerRef} className="relative w-full max-w-7xl mx-auto mt-20 mb-20 px-4 md:px-8 overflow-x-clip">
      <motion.div
        className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
      >
        {/* Continuous timeline line behind everything for desktop */}
        <div className="hidden md:block absolute bottom-[23px] left-0 w-full h-[2px] bg-[#EAE0D5] z-0">
          <motion.div 
            className="h-full bg-terracotta origin-left"
            style={{ scaleX: scrollYProgress }}
          />
        </div>

        {steps.map((step, index) => (
          <motion.div
            key={index}
            variants={itemVariants}
            className="flex flex-col relative z-10 h-full"
          >
            {/* Top: Card Box */}
            <div className="bg-[#F8F3E5] rounded-[20px] p-8 md:p-10 w-full flex-1 flex flex-col box-border transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] hover:-translate-y-2 hover:shadow-[0_15px_30px_rgba(0,0,0,0.12)] mb-10 border border-black/5">
              <h3 className="font-serif text-espresso text-2xl font-bold mb-4 tracking-tight">
                {step.title}
              </h3>
              <p className="font-sans text-taupe leading-relaxed text-[1.05rem] m-0">
                {step.text}
              </p>
            </div>

            {/* Bottom: Horizontal line & square badge */}
            <div className="relative flex items-center justify-start md:justify-center h-[48px] mt-auto">
              {/* Mobile line (only spans the card width) */}
              <div className="md:hidden absolute left-0 w-full h-[2px] bg-[#EAE0D5] z-0">
                <motion.div 
                  className="h-full bg-terracotta origin-left"
                  style={{ scaleX: scrollYProgress }}
                />
              </div>
              
              <div className="bg-terracotta text-white font-serif font-bold text-xl w-12 h-12 flex items-center justify-center relative z-10">
                {parseInt(step.n)}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
