# Reference measurements (layout study, numbers only)

Source bundle: one stylesheet (~93 KB) plus Next.js chunks. Values below were read from the compiled CSS.

- Page shell: sticky header, padding 14px / clamp(16px,3vw,40px); main max-width 1320px, inline padding clamp(16px,4vw,56px).
- Hero: single column, max-width 740px, gap 26px, padding-top 64px, bottom 40px. A canvas stage sits absolute right, width 44vw, height min(940px,100vh); on narrow screens it goes full width at .3 opacity.
- Type: h1 clamp(46px,7.2vw,112px) / 800 / lh .92; h2 clamp(34px,4.4vw,60px) / 700 / lh 1; final h2 clamp(56px,9vw,140px) / 800 / lh .9; lede clamp(18px,1.6vw,21px) / 1.55, max 36em; letter-spacing -.045em on display.
- Eyebrow: mono, 12px, .1em tracking, uppercase.
- Button: min-height 48px, radius 16, padding 0 22px, 16px / 800, transition transform .25s cubic-bezier(.2,.8,.2,1); hover lifts translateY(-2px).
- Glass card: 1px line border, radius 26, inset top highlight, deep drop shadow (0 40px 80px -40px).
- Pill: radius 999, 13px / 600, padding 7px 12px.
- Chip: radius 12, mono 13px, padding 8px 12px. Tag: radius 999, 12px / 700.
- Live grid: two columns 1.3fr / 1fr, gap 16, margin-top 36; livecard padding 26, gap 18.
- Rule picker: tab shelf (gap 8), tile grid repeat(auto-fill,minmax(210px,1fr)) gap 8, tile radius 16 padding 12px 14px, transition border-color/background .2s.
- Facts row: flex row, hairline separators, 26px padding.
- Motion: ping 1.8s infinite (scale to 2, fade at 75%); sheen 8s ease-in-out infinite alternate; spin .8s linear; tooltip .18s ease-out; float 5s ease-in-out infinite.
- Breakpoints: 1300, 1100, 980, 860, 760, 720, 640, 560, 520, 370; pointer:coarse; prefers-reduced-motion present in reference.
- Timers in scripts: 20/100/300/500 ms nudges, 1600 ms idle reset.
