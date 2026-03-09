# 🎨 SSSK PWA Design System

This document defines the visual and interaction guidelines for the Svitlo Starkon PWA. All frontend components must adhere to these principles to maintain a premium, minimalistic, and modern user experience.

---

## 🏛️ Design Philosophy
**Minimalism + Liquid Glass.** The interface should feel spacious, translucent, and calm, inspired by Apple's design language.

---

## 1. Visual Space & Layout (Clean Interface)
- **80/20 Principle:** 80% content/empty space, 20% navigation/secondary UI.
- **Generous Negative Space:** Large padding and spacing between elements.
- **Content Alignment:** Primary content must be centered for visual balance.
- **Backgrounds:**
  - Light theme: `#FFFFFF`
  - Dark theme: `#000000`
  - *No gradients or noise on the base background.*

---

## 2. Typography & Hierarchy
- **Primary Font:** `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif`
- **Headlines:** Large, bold or semi-bold.
- **Body Text:** Significantly smaller, `#86868B` (neutral gray), line-height `1.4`.
- **Focus:** Clarity and strong vertical hierarchy.

---

## 3. Liquid Glass Effect (Glassmorphism)
- **Surfaces:** Use `backdrop-filter: blur(20px);`.
- **Translucency:** UI should feel lightweight and see-through.
- **Borders:** Ultra-thin `0.5px – 1px`, white or light gray, `10–15% opacity`.
- **Lighting:** Avoid heavy shadows. Use soft glow effects and subtle inner gradients to simulate refraction.

---

## 4. Color Palette & Accents
- **Base:** White, Black, Neutral grays (`#F5F5F7`, `#E8E8ED`).
- **Accent Color:** `#007AFF` (Apple System Blue).
  - *Used ONLY for primary action buttons and active states.*
- **System Theme:** Full support for `prefers-color-scheme: dark`.

---

## 5. Motion & Interaction
- **Tone:** Smooth, subtle, and tactile.
- **Transitions:** `ease-in-out`.
- **Entry:** Fade-in combined with a slight upward motion.
- **Parallax:** Subtle scaling or shifting of primary images on scroll.
- **Tactile Feedback:** Buttons should slightly shrink (scale down) when pressed.

---

## 6. Implementation Checklist
- [ ] Implement CSS Variables for colors and blurs.
- [ ] Create a reusable `glass-card` CSS utility.
- [ ] Define reusable typography classes (`headline-hero`, `body-neutral`).
- [ ] Setup dark/light theme triggers.
