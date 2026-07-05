import { Platform } from 'react-native';

export const injectWebStyles = () => {
  if (Platform.OS !== 'web') return;
  if (typeof document === 'undefined') return;
  if (document.getElementById('mc-web-styles')) return;

  const style = document.createElement('style');
  style.id = 'mc-web-styles';
  style.textContent = `

    /* ── Emil Design Engineering: Custom Easing Curves ── */
    :root {
      --ease-out:    cubic-bezier(0.23, 1, 0.32, 1);
      --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
      --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
      --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
    }

    html, body {
      background: #060912 !important;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* ── Atmospheric moon glow ── */
    body::before {
      content: '';
      position: fixed;
      top: -25vh;
      left: 50%;
      transform: translateX(-50%);
      width: 100vw;
      height: 70vh;
      background: radial-gradient(ellipse at 50% 0%, rgba(240,192,64,0.05) 0%, transparent 65%);
      pointer-events: none;
      z-index: 0;
    }

    /* ── Entry animation — starts from scale(0.97), not scale(0) ── */
    @keyframes mc-enter {
      from {
        opacity: 0;
        transform: translateY(8px) scale(0.97);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    /* ── Stagger animation for list items ── */
    @keyframes mc-stagger {
      from { opacity: 0; transform: translateY(5px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Custom scrollbar ── */
    ::-webkit-scrollbar { width: 3px; height: 3px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb {
      background: rgba(240,192,64,0.3);
      border-radius: 3px;
      transition: background 200ms var(--ease-out);
    }
    ::-webkit-scrollbar-thumb:hover { background: rgba(240,192,64,0.7); }

    /* ── Selection ── */
    ::selection { background: rgba(240,192,64,0.18); color: #F0C040; }

    /* ── Button press feedback — Emil: scale(0.97), instant press ── */
    [role="button"] {
      transition:
        filter   180ms var(--ease-out),
        transform 100ms var(--ease-out) !important;
      cursor: pointer !important;
    }

    /* Hover only on real pointer devices — Emil: @media (hover: hover) guard */
    @media (hover: hover) and (pointer: fine) {
      [role="button"]:hover {
        filter: brightness(1.14) saturate(1.08) !important;
      }
    }

    /* Press: instant scale down, then spring back on release */
    [role="button"]:active {
      transform: scale(0.97) !important;
      transition-duration: 60ms !important;
    }

    /* ── Tab bar: slightly brighter on hover ── */
    @media (hover: hover) and (pointer: fine) {
      nav [role="button"]:hover {
        filter: brightness(1.5) !important;
      }
    }

    /* ── prefers-reduced-motion — Emil: fewer animations, not zero ── */
    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    }
  `;
  document.head.appendChild(style);
};
