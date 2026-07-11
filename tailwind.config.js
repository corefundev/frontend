/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ─────────────────────────────────────────────────────────────
        //  Brand — referest royal blue (#2463EB).
        //  Anchored on #2463EB; scale tuned for AA contrast on white.
        // ─────────────────────────────────────────────────────────────
        brand: {
          50:  '#EEF2FE',
          100: '#D9E2FD',
          200: '#B3C5FB',
          300: '#8DA8F9',
          400: '#588AF2',
          500: '#2463EB',
          600: '#1D54CC',
          700: '#1A4AB8',
          800: '#1540A0',
          900: '#112F78',
        },

        // Neutral surfaces — referest slate scale.
        // #394-4: RGB-триплеты в CSS-переменных (см. :root в index.css) —
        // светлые значения те же, тёмные включает .admin-dark (только
        // консоль); триплет-формат сохраняет opacity-модификаторы (bg-x/40).
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          muted:   'rgb(var(--surface-muted) / <alpha-value>)',
          raised:  'rgb(var(--surface-raised) / <alpha-value>)',
          border:  'rgb(var(--surface-border) / <alpha-value>)',
          deep:    'rgb(var(--surface-deep) / <alpha-value>)',
        },

        // ─────────────────────────────────────────────────────────────
        //  Premium paper — warm cream tones for locked-state previews.
        //  Kept as-is: distinct from the public UI's slate palette,
        //  used only inside `/app` for upgrade-gate overlays.
        // ─────────────────────────────────────────────────────────────
        paper: {
          DEFAULT: '#F4EFE5',
          deep:    '#EAE2D1',
          line:    '#D7CCB3',
          ink:     '#4C4435',
        },

        // ─────────────────────────────────────────────────────────────
        //  Accent — antique gold. Sparingly: upgrade CTAs, plan seals,
        //  "Business" marks. Never for success / confirmation.
        // ─────────────────────────────────────────────────────────────
        gold: {
          50:   '#FBF4DF',
          100:  '#F4E3B0',
          300:  '#E7C770',
          500:  '#C79A33',
          600:  '#A37C10',
          700:  '#7C5D0A',
          800:  '#5C4409',
        },

        // Ink scale — referest deep-navy primary text (#394-4: через
        // переменные, см. surface выше)
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          muted:   'rgb(var(--ink-muted) / <alpha-value>)',
          subtle:  'rgb(var(--ink-subtle) / <alpha-value>)',
          invert:  'rgb(var(--ink-invert) / <alpha-value>)',
        },

        // Status — tuned warmer than the usual pure red/green.
        // #394-4: success/danger/warn через переменные (бейджи должны
        // оставаться читаемыми в admin-dark); moss/terra — вне консоли,
        // фиксированные.
        success: { DEFAULT: 'rgb(var(--success) / <alpha-value>)',
                   bg: 'rgb(var(--success-bg) / <alpha-value>)' },
        moss:    { DEFAULT: '#6B8E5A', bg: '#EEF2E8' },
        danger:  { DEFAULT: 'rgb(var(--danger) / <alpha-value>)',
                   bg: 'rgb(var(--danger-bg) / <alpha-value>)' },
        warn:    { DEFAULT: 'rgb(var(--warn) / <alpha-value>)',
                   bg: 'rgb(var(--warn-bg) / <alpha-value>)' },
        terra:   { DEFAULT: '#C86644', bg: '#F9E6DD' },
      },

      fontFamily: {
        // Referest spec: Inter as the single typographic voice.
        // Fraunces/IBM Plex retired — Inter handles display + body + UI.
        sans: [
          '"Inter"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          '"Helvetica Neue"',
          'sans-serif',
        ],
        display: [
          '"Inter"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
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
        // Referest display scale — Inter, tight negative tracking.
        'display-xl': ['48px', { lineHeight: '60px', letterSpacing: '-0.02em', fontWeight: '800' }],
        'display-lg': ['30px', { lineHeight: '36px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'display-md': ['24px', { lineHeight: '32px', letterSpacing: '0',       fontWeight: '600' }],
      },

      borderRadius: {
        // Referest radius scale: 0 / 4 / 6 / 8 / 20 / full only.
        // No flat-2px override (warmth retained) and no >8px squishy corners.
        none:    '0',
        sm:      '4px',
        DEFAULT: '6px',
        md:      '6px',
        lg:      '8px',
        xl:      '8px',
        '2xl':   '8px',
        '3xl':   '8px',
        pill:    '20px',
        full:    '9999px',
      },

      boxShadow: {
        // Referest elevation system — two-layer composition, restrained.
        raised:   '0px 1px 2px rgba(0,0,0,0.05), 0px 1px 2px rgba(0,0,0,0.05)',
        floating: '0px 4px 6px rgba(0,0,0,0.10), 0px 2px 4px rgba(0,0,0,0.06)',
        lifted:   '0px 10px 15px rgba(0,0,0,0.10), 0px 4px 6px rgba(0,0,0,0.05)',
        overlay:  '0px 20px 25px rgba(0,0,0,0.15), 0px 8px 10px rgba(0,0,0,0.10)',
        // Brand focus ring per spec
        focus:    '0 0 0 3px rgba(36,99,235,0.10)',
        // Legacy aliases — many components still reference these
        card:     '0px 1px 2px rgba(0,0,0,0.05), 0px 1px 2px rgba(0,0,0,0.05)',
        panel:    '0px 4px 6px rgba(0,0,0,0.10), 0px 2px 4px rgba(0,0,0,0.06)',
        paper:    '0 1px 2px rgba(95,72,26,0.08), 0 10px 24px -8px rgba(95,72,26,0.15)',
        rule:     'inset 0 -1px 0 rgba(0,0,0,0.06)',
      },

      backgroundImage: {
        'paper-grain': `
          radial-gradient(rgba(140,106,46,0.10) 1px, transparent 1px),
          linear-gradient(180deg, #F4EFE5 0%, #EFE8D8 100%)
        `,
        'dot-rule': `linear-gradient(to right,
          transparent 0%,
          #E2E8F0 20%,
          #E2E8F0 48%,
          #2463EB 48%,
          #2463EB 52%,
          #E2E8F0 52%,
          #E2E8F0 80%,
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
