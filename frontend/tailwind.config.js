/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // KSU Theme — สีหลักดึงจากตรามหาวิทยาลัยกาฬสินธุ์
        ksu: {
          sky: '#2E64B5',
          blue: '#1F4E9A',
          deep: '#163A75',
          logo: '#7FA3D7',
          tint: '#EAF1FB',
          mist: '#F5F9FF',
          line: '#D6E2F3',
        },
        ink: '#0F1E3A',
        body: '#1B2A44',
        muted: '#56637A',
        subtle: '#66748C',
        line: '#E2E8F2',
        ground: '#F4F6FA',
        gold: '#F2B33D',
        success: { DEFAULT: '#1F7A4D', soft: '#E7F5EE', line: '#7CC4A0' },
        warning: { DEFAULT: '#E9A23B', text: '#8A5300', soft: '#FFF4DB', bg: '#FFFBF0' },
        danger: { DEFAULT: '#C2412D', text: '#A8321F', soft: '#FDECEA' },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Thai"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(14,39,71,.04)',
        pop: '0 12px 32px rgba(14,39,71,.16)',
        soft: '0 6px 20px rgba(14,39,71,.06)',
      },
    },
  },
  plugins: [],
}
