/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ─────────────────────────────────────────────────────────────
        //  Brand — royal blue (referest.ru palette)
        //  #2462EA against white: contrast 5.4:1 (WCAG AA).
        // ─────────────────────────────────────────────────────────────
        brand: {
          50:  '#EEF3FE',
          100: '#D5E1FC',
          200: '#ABBFF7',
          300: '#7C99F1',
          400: '#527AED',
          500: '#2462EA',
          600: '#1B4FC8',
          700: '#163FA0',
          800: '#112F78',
          900: '#0B1F50',
        },

        // Neutral surfaces — cool side
        surface: {
          DEFAULT: '#FAFAFA',
          muted:   '#F1F1F1',
          raised:  '#FFFFFF',
          border:  '#E2E5E5',
          deep:    '#EBEBE8',      // for editorial stripe dividers
        },

        // ─────────────────────────────────────────────────────────────
        //  Premium paper — warm cream tones for locked-state previews.
        //  Not grey. Feels like high-end printed material: a reason to
        //  upgrade, not a disabled widget.
        // ─────────────────────────────────────────────────────────────
        paper: {
          DEFAULT: '#F4EFE5',      // cream background of lock overlays
          deep:    '#EAE2D1',      // border / embossed rim
          line:    '#D7CCB3',      // hair-line within paper
          ink:     '#4C4435',      // text on paper
        },

        // ─────────────────────────────────────────────────────────────
        //  Accent — antique gold. Used sparingly: upgrade CTAs, plan
        //  seals, "Business" marks. Never for success / confirmation —
        //  it's a "prestige" signal, not a state indicator.
        // ─────────────────────────────────────────────────────────────
        gold: {
          50:   '#FBF4DF',
          100:  '#F4E3B0',
          300:  '#E7C770',
          500:  '#C79A33',    // primary gold accent
          600:  '#A37C10',
          700:  '#7C5D0A',
          800:  '#5C4409',
        },

        // Ink scale (editorial typography)
        ink: {
          DEFAULT: '#1A1A1A',
          muted:   '#525757',
          subtle:  '#8B9190',
          invert:  '#FAFAFA',
        },

        // Status — tuned warmer than the usual pure red/green.
        success: { DEFAULT: '#2E7D32', bg: '#E6F1E8' },
        moss:    { DEFAULT: '#6B8E5A', bg: '#EEF2E8' },   // subtle success
        danger:  { DEFAULT: '#B03A2E', bg: '#F7E3E0' },
        warn:    { DEFAULT: '#B77914', bg: '#FCF1DA' },
        terra:   { DEFAULT: '#C86644', bg: '#F9E6DD' },   // warmer alert
      },

      fontFamily: {
        // ── Display: Fraunces — variable serif with soft, humane curves.
        //    Great at large sizes for numbers/headlines. Good Cyrillic.
        display: [
          '"Fraunces"',
          'ui-serif',
          'Georgia',
          'serif',
        ],
        // ── Body/UI: IBM Plex Sans — characterful, technical, excellent
        //    Cyrillic. Replaces Inter — too generic.
        sans: [
          '"IBM Plex Sans"',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'monospace',
        ],
      },

      fontSize: {
        // Editorial display scale — large + tighter leading
        'display-xl': ['5rem',   { lineHeight: '1',     letterSpacing: '-0.03em' }],
        'display-lg': ['3.5rem', { lineHeight: '1.05',  letterSpacing: '-0.025em' }],
        'display-md': ['2.5rem', { lineHeight: '1.1',   letterSpacing: '-0.02em' }],
      },

      borderRadius: {
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem',
      },

      boxShadow: {
        card:  '0 1px 2px 0 rgba(0,43,41,0.04), 0 2px 8px 0 rgba(0,43,41,0.06)',
        panel: '0 4px 12px rgba(0,43,41,0.08)',
        // Premium paper shadow — warm, softer, with a hint of gold
        paper: '0 1px 2px rgba(95,72,26,0.08), 0 10px 24px -8px rgba(95,72,26,0.15)',
        // Subtle inset for editorial frames
        rule:  'inset 0 -1px 0 rgba(0,43,41,0.08)',
      },

      backgroundImage: {
        // Grain / noise for paper surfaces
        'paper-grain': `
          radial-gradient(rgba(140,106,46,0.10) 1px, transparent 1px),
          linear-gradient(180deg, #F4EFE5 0%, #EFE8D8 100%)
        `,
        // Thin editorial rule — centered dot
        'dot-rule': `linear-gradient(to right,
          transparent 0%,
          #E2E5E5 20%,
          #E2E5E5 48%,
          #2462EA 48%,
          #2462EA 52%,
          #E2E5E5 52%,
          #E2E5E5 80%,
          transparent 100%)`,
      },

      backgroundSize: {
        'paper-grain': '6px 6px, 100% 100%',
      },

      keyframes: {
        'fade-in':    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'rise':       {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'seal-in': {
          '0%':   { opacity: '0', transform: 'rotate(-4deg) scale(0.92)' },
          '100%': { opacity: '1', transform: 'rotate(-4deg) scale(1)' },
        },
        // Progress-bar lifesigns. Slow ping for the "still working"
        // dot; sliding chip for indeterminate state; marching
        // diagonal stripes for the determinate fill.
        'ping-slow': {
          '0%, 100%': { transform: 'scale(1)',   opacity: '1' },
          '50%':      { transform: 'scale(1.4)', opacity: '0.5' },
        },
        'progress-indeterminate': {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' },
        },
        'progress-stripes': {
          '0%':   { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '40px 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'rise':    'rise 360ms cubic-bezier(0.22, 1, 0.36, 1)',
        'seal-in': 'seal-in 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'ping-slow':              'ping-slow 1.4s ease-in-out infinite',
        'progress-indeterminate': 'progress-indeterminate 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
