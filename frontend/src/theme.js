// Theme helpers. Initial theme is applied by the inline script in index.html
// (saved choice -> device preference -> dark) to avoid a flash on load.

export function getActiveTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem('galaxy_theme', theme);
  } catch (e) {
    /* ignore storage errors */
  }
}


// --- Text size (xs | sm | md | lg | xl) ---
export const FONT_SIZES = ['xs', 'sm', 'md', 'lg', 'xl'];

export function getActiveFontSize() {
  return document.documentElement.getAttribute('data-fontsize') || 'md';
}

export function setFontSize(size) {
  document.documentElement.setAttribute('data-fontsize', size);
  try {
    localStorage.setItem('galaxy_fontsize', size);
  } catch (e) {
    /* ignore */
  }
}
