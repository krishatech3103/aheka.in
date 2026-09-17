/**
 * Aheka Client-side Theme Management Utility
 * Supports 'light' | 'dark' | 'system' preferences with local persistence,
 * system color scheme detection, zero-flash synchronization, and isolated storage keys.
 */

export type ThemePreference = 'light' | 'dark' | 'system';

export const DEFAULT_THEME: ThemePreference = 'system';
export const PUBLIC_STORAGE_KEY = 'aheka_theme';
export const ADMIN_STORAGE_KEY = 'aheka_admin_theme';

export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getStoredTheme(storageKey: string = PUBLIC_STORAGE_KEY): ThemePreference {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return DEFAULT_THEME;
  }
  try {
    const val = localStorage.getItem(storageKey);
    if (val === 'light' || val === 'dark' || val === 'system') {
      return val;
    }
  } catch (err) {
    console.warn('Could not read theme from localStorage:', err);
  }
  return DEFAULT_THEME;
}

export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return getSystemTheme();
}

export function applyTheme(preference: ThemePreference, storageKey: string = PUBLIC_STORAGE_KEY): void {
  if (typeof document === 'undefined') return;

  const resolved = resolveTheme(preference);
  const isDark = resolved === 'dark';
  const docEl = document.documentElement;

  if (isDark) {
    docEl.classList.add('dark');
    docEl.setAttribute('data-theme', 'dark');
  } else {
    docEl.classList.remove('dark');
    docEl.setAttribute('data-theme', 'light');
  }

  docEl.style.colorScheme = resolved;

  // Update PWA theme-color meta tag
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    // #121214 for warm dark charcoal, #e65100 for primary light branding
    metaThemeColor.setAttribute('content', isDark ? '#121214' : '#e65100');
  }

  // Dispatch custom event for reactive UI components (e.g. ThemeToggle)
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent('aheka:theme-changed', {
        detail: { preference, resolved, storageKey },
      })
    );
  }
}

export function setTheme(preference: ThemePreference, storageKey: string = PUBLIC_STORAGE_KEY): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(storageKey, preference);
    } catch (err) {
      console.warn('Could not persist theme to localStorage:', err);
    }
  }
  applyTheme(preference, storageKey);
}

/**
 * Attaches an OS `prefers-color-scheme` change listener.
 * If the active preference is 'system', the page theme will update reactively without a reload.
 */
export function initThemeListener(storageKey: string = PUBLIC_STORAGE_KEY): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = () => {
    const currentPref = getStoredTheme(storageKey);
    if (currentPref === 'system') {
      applyTheme('system', storageKey);
    }
  };

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  } else if ('addListener' in mediaQuery) {
    // Legacy browser fallback
    (mediaQuery as any).addListener(listener);
    return () => (mediaQuery as any).removeListener(listener);
  }

  return () => {};
}
