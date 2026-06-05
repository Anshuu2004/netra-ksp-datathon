import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0a0e14',
        panel: '#111722',
        panel2: '#161d2b',
        edge: '#223049',
        accent: '#38bdf8',
        accent2: '#22d3ee',
        danger: '#f43f5e',
        warn: '#f59e0b',
        good: '#34d399',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Noto Sans Kannada', 'sans-serif'],
        kn: ['Noto Sans Kannada', 'Inter', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      keyframes: {
        pulseRing: {
          '0%': { transform: 'scale(0.6)', opacity: '0.7' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
      },
      animation: { pulseRing: 'pulseRing 2s ease-out infinite' },
    },
  },
  plugins: [],
};

export default config;
