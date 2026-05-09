import { Platform } from 'react-native';

export const injectWebStyles = () => {
  if (Platform.OS !== 'web') return;
  if (typeof document === 'undefined') return;
  if (document.getElementById('mc-web-styles')) return;

  const style = document.createElement('style');
  style.id = 'mc-web-styles';
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@300;400;500;600&display=swap');

    html, body {
      background: #060912 !important;
      margin: 0;
      padding: 0;
    }

    /* Atmospheric moon glow on body */
    body::before {
      content: '';
      position: fixed;
      top: -20vh;
      left: 50%;
      transform: translateX(-50%);
      width: 80vw;
      height: 60vh;
      background: radial-gradient(ellipse at center, rgba(240,192,64,0.04) 0%, transparent 70%);
      pointer-events: none;
      z-index: 0;
    }

    /* Font smoothing */
    * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }

    /* Custom scrollbar */
    ::-webkit-scrollbar { width: 3px; height: 3px; }
    ::-webkit-scrollbar-track { background: #060912; }
    ::-webkit-scrollbar-thumb { background: rgba(240,192,64,0.4); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #F0C040; }

    /* Selection */
    ::selection { background: rgba(240,192,64,0.2); color: #F0C040; }

    /* Button hover & press */
    [role="button"] {
      transition: filter 0.15s ease, transform 0.1s ease !important;
      cursor: pointer !important;
    }
    [role="button"]:hover {
      filter: brightness(1.15) saturate(1.1) !important;
    }
    [role="button"]:active {
      transform: scale(0.965) !important;
      filter: brightness(0.95) !important;
    }

    /* Tab bar links */
    nav [role="button"]:hover {
      filter: brightness(1.4) !important;
    }

    /* Card hover depth */
    [data-focusable="true"]:hover {
      box-shadow: 0 8px 32px rgba(240,192,64,0.08) !important;
    }
  `;
  document.head.appendChild(style);
};
