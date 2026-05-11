"use client";

import React from "react";
import { motion } from "framer-motion";

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  gradient?: string;
  animate?: boolean;
  animationDuration?: number;
}

const GradientText: React.FC<GradientTextProps> = ({
  children,
  className = "",
  style,
  gradient = "bg-gradient-to-r from-[#EA580C] via-[#F7931A] to-[#FFD600]",
  animate = true,
  animationDuration = 4,
}) => {
  const animationProps = animate
    ? {
        animate: { backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] },
        transition: {
          duration: animationDuration,
          repeat: Infinity,
          ease: "linear",
        },
      }
    : {};

  return (
    <motion.span
      className={`relative ${gradient} bg-clip-text text-transparent font-edu ${className}`}
      style={{
        backgroundSize: animate ? "200% 200%" : "100% 100%",
        ...style,
      }}
      {...(animationProps as any)}
    >
      {children}
    </motion.span>
  );
};

export default GradientText;
