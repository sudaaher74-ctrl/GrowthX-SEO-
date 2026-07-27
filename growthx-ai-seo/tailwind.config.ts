import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "oklch(0.97 0.02 280)",
          100: "oklch(0.93 0.05 280)",
          200: "oklch(0.86 0.10 280)",
          300: "oklch(0.77 0.16 280)",
          400: "oklch(0.66 0.22 280)",
          500: "oklch(0.55 0.26 280)",
          600: "oklch(0.47 0.26 280)",
          700: "oklch(0.40 0.24 280)",
          800: "oklch(0.33 0.20 280)",
          900: "oklch(0.26 0.16 280)",
          950: "oklch(0.17 0.10 280)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Geist", "Inter", "sans-serif"],
        mono: ["Geist Mono", "JetBrains Mono", "monospace"],
      },
      borderRadius: {
        sm: "0.375rem",
        md: "0.625rem",
        lg: "0.875rem",
        xl: "1.25rem",
        "2xl": "1.75rem",
      },
      boxShadow: {
        "card": "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-hover": "0 8px 30px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
        "glow-brand": "0 0 20px rgba(99,102,241,0.3)",
        "glow-success": "0 0 20px rgba(16,185,129,0.3)",
        "glow-warning": "0 0 20px rgba(245,158,11,0.3)",
        "glow-error": "0 0 20px rgba(239,68,68,0.3)",
      },
      backgroundImage: {
        "gradient-brand": "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)",
        "gradient-hero": "linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 50%, #0a1a2e 100%)",
        "gradient-card": "linear-gradient(145deg, rgba(99,102,241,0.05) 0%, rgba(168,85,247,0.03) 100%)",
        "noise": "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")",
      },
      animation: {
        "fade-up": "fadeUp 0.4s ease forwards",
        "fade-in": "fadeIn 0.3s ease forwards",
        "scale-in": "scaleIn 0.2s ease forwards",
        "slide-in-right": "slideInRight 0.3s ease forwards",
        "slide-in-left": "slideInLeft 0.3s ease forwards",
        "shimmer": "shimmer 1.5s infinite",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "spin-slow": "spin 3s linear infinite",
        "bounce-soft": "bounceSoft 2s ease-in-out infinite",
        "ticker": "ticker 0.5s ease forwards",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideInLeft: {
          "0%": { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(99,102,241,0.3)" },
          "50%": { boxShadow: "0 0 0 8px rgba(99,102,241,0)" },
        },
        bounceSoft: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        ticker: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
