import type { Config } from 'tailwindcss';

/**
 * NETRA — "Khaki & Ember".
 *
 * Why not dark+cyan: the old palette's neutrals sat at OKLCH H 258–264 and its accent at H 233 —
 * the entire interface was one hue family. That collapse is what reads as "generic dev tool"
 * before a single pixel of layout is judged. (Copying Blueprint's blue-on-blue-grey would lower
 * the chroma and keep the disease.)
 *
 * Ground  = Karnataka police khaki. A uniform is a GROUND, not a signal.
 * Heat    = the Kannada flag's yellow→red, which is literally the top of a crime-intensity scale.
 * Accent  = jade. It is the only hue region left once the ember ramp owns violet→gold, and it is
 *           free precisely because NETRA's risk system refuses red/green semantics.
 *
 * Severity is LIGHTNESS-MONOTONE: brightest = worst. The conventional orange→red escalation
 * measured deutan ΔE 4.6 between SEVERE and CRITICAL — the two bands an analyst most needs to
 * separate are indistinguishable to ~8% of male users. At the red end you run out of lightness
 * headroom, and under protan/deutan lightness is the only surviving channel.
 *
 * Every ratio below is measured against --bg-panel #1e1c15.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ── grounds. Elevation goes DOWN for wells, UP for popovers ── */
        page: '#0b0a07',      // root ground (not #000 — halation defence)
        sunken: '#14130e',    // map / graph / timeline canvases, inputs
        panel: '#1e1c15',     // default panel surface
        raised: '#28251e',    // popovers, palette, modals — the only layer with a shadow
        hairline: '#333028',  // borders, table rules (1.29:1 — non-text only, by design)
        stroke: '#4b483e',    // input borders, hatch outlines (1.86:1 — non-text only)

        /* ── ink. --fg-muted is the FLOOR for all text ── */
        fg: '#eeebe2',            // 14.30:1 body + headings (not #fff — halation defence)
        'fg-secondary': '#bbb7ab', // 8.50:1 field labels, eyebrows, status strip
        'fg-muted': '#8a867a',     // 4.68:1 AA body floor — ticks, units, metadata
        onfill: '#0b0a07',         // text on ANY filled accent/severity chip (never white)

        /* ── the ONLY accent. Budget: <=10% of pixels ── */
        accent: {
          DEFAULT: '#4bbd91',  // jade H165/C0.123 — 7.29:1, passes AA body so it may carry text
          hover: '#6fd6ab',    // 9.64:1 — hover AND the focus-visible ring
          dim: '#2f8f6a',      // 4.27:1 — inactive, sparklines, the live dot
          wash: '#143b2d',     // 1.37:1 — selected-row fill ONLY, never text on it
        },

        /* ── severity. BRIGHTEST = WORST. Disjoint from categorical, by rule ── */
        sev: {
          nominal: '#8a867a',   // no fill — an idle screen must be almost colourless
          elevated: '#7c3b7e',  // 2.26:1 fill-only
          high: '#b04a72',      // 3.30:1 — darkest step allowed on an ordinal chip
          severe: '#d95f4a',    // 4.61:1 — also the destructive-action colour
          critical: '#ef8a2c',  // 6.77:1 — deliberately NOT red
        },

        /* ── graph communities. EXACTLY 5, fixed order, never cycled; 6th+ folds to fg-muted.
             Validated all-pairs (any two can touch): min CVD ΔE 9.5. n=6 fails the floor. ── */
        cat: {
          1: '#ae436b', 2: '#846204', 3: '#00a3aa', 4: '#5268b9', 5: '#879f10',
        },

        /* ── sequential heat (KDE / choropleth). Monotone L 0.269→0.838.
             Dark end melting into the ground is CORRECT: zero crime = background. ── */
        seq: {
          1: '#2b1f3d', 2: '#4a2d63', 3: '#7c3b7e', 4: '#b04a72',
          5: '#d95f4a', 6: '#ef8a2c', 7: '#f7c05a',
        },
      },

      /* Instrument type scale. Base 12px. Nothing above 16px — a hero size has no job here. */
      fontSize: {
        '2xs': ['9px', { lineHeight: '1.28571' }],
        xs: ['10px', { lineHeight: '1.28571' }],
        sm: ['11px', { lineHeight: '1.28571' }],
        base: ['12px', { lineHeight: '1.28571' }],
        md: ['14px', { lineHeight: '1.4' }],
        lg: ['16px', { lineHeight: '1.4' }],
      },

      borderRadius: { none: '0', sm: '2px', DEFAULT: '2px', md: '3px', lg: '3px' },

      fontFamily: {
        // Platform sans for clean Latin UI (Segoe UI on the Windows target), with Noto Sans
        // Kannada in the stack so Kannada glyphs render consistently via fallback. Known-Kannada
        // content (narration, the toggle) also carries `font-kn` explicitly for correct metrics.
        sans: ['system-ui', '"Segoe UI"', 'Roboto', '"Noto Sans Kannada"', 'sans-serif'],
        kn: ['"Noto Sans Kannada"', 'system-ui', 'sans-serif'],
        // Mono ONLY for machine-generated identifiers an analyst may read aloud or transcribe.
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
