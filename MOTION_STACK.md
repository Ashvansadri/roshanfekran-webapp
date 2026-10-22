# Motion design integration — video IMG_3812

The uploaded 43.9-second Persian reference video showcases **React Bits**, **GSAP**, and **Lenis**. It is used as a technical reference, not redistributed as part of the academy website. No third-party site, illustration, or logo was copied.

## Current implementation

- **GSAP 3.13.0 + ScrollTrigger:** gentle headline and hero entrance, editorial cards revealed once at the viewport, subtle top-edge progress line. Source code: `site/motion.js`. Pinned scripts loaded as `defer` from jsDelivr.
- **Lenis 1.3.27:** synchronized desktop smooth-wheel scrolling, wired through the GSAP ticker and `ScrollTrigger.update`. On touch devices the browser retains native scrolling. The app never prevents keyboard movement.
- **React Bits:** React components cannot be imported directly into the current no-build, framework-free staging site. The design uses *original* small interactive primitives in `site/luxury.js`, `site/luxury.css`, and `site/motion.css`. React Bits can be adopted if the project later migrates to React/Vite; do not misrepresent the current plain-JS implementation as using React Bits itself.
- Reduced motion: no GSAP or Lenis animations under `prefers-reduced-motion: reduce`. CDN failure falls back to native scroll and fully visible content. Private dashboards are not animated.
- Hash SPA: motion timelines are killed and recreated after route/data rerenders to avoid stale ScrollTrigger references.
- PWA: only local `motion.js` and `motion.css` are offline cached. CDN libraries may not be available offline; this is safe and degrades gracefully.

## Licences
- GSAP: GreenSock's standard no-charge licence (not MIT); check current terms at https://gsap.com/standard-license/.
- Lenis: MIT licence, https://github.com/darkroomengineering/lenis.
- React Bits: source components available via https://reactbits.dev/; no React Bits source embedded here.

## Verification
- `node scripts/verify.mjs`: source verification.
- GitHub Actions Chromium smoke test desktop/mobile.
- Further real-device, browser, accessibility and financial-transaction QA required before commercial production cutover.
