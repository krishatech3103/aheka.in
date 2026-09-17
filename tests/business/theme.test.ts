import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getStoredTheme,
  setTheme,
  resolveTheme,
  applyTheme,
  DEFAULT_THEME,
  PUBLIC_STORAGE_KEY,
  ADMIN_STORAGE_KEY,
} from '../../src/lib/client/theme';

describe('Theme Engine & System Mode', () => {
  let mockStorage: Record<string, string> = {};
  let mockMatches = false;

  beforeEach(() => {
    mockStorage = {};
    mockMatches = false;

    const mockLocalStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };

    const mockMatchMedia = (query: string) => ({
      matches: mockMatches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    vi.stubGlobal('localStorage', mockLocalStorage);

    vi.stubGlobal('window', {
      localStorage: mockLocalStorage,
      matchMedia: mockMatchMedia,
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    // Mock document
    const classListSet = new Set<string>();
    const attributes: Record<string, string> = {};
    const metaElement = {
      getAttribute: (attr: string) => (attr === 'name' ? 'theme-color' : null),
      setAttribute: vi.fn(),
    };

    vi.stubGlobal('document', {
      documentElement: {
        classList: {
          add: (cls: string) => classListSet.add(cls),
          remove: (cls: string) => classListSet.delete(cls),
          contains: (cls: string) => classListSet.has(cls),
        },
        setAttribute: (k: string, v: string) => {
          attributes[k] = v;
        },
        getAttribute: (k: string) => attributes[k] || null,
        style: {} as any,
      },
      querySelector: (selector: string) => {
        if (selector === 'meta[name="theme-color"]') return metaElement;
        return null;
      },
    });
  });

  it('defaults to System theme when no choice is stored', () => {
    expect(DEFAULT_THEME).toBe('system');
    const stored = getStoredTheme(PUBLIC_STORAGE_KEY);
    expect(stored).toBe('system');
  });

  it('resolves system mode based on OS prefers-color-scheme', () => {
    // When OS is dark
    mockMatches = true;
    expect(resolveTheme('system')).toBe('dark');

    // When OS is light
    mockMatches = false;
    expect(resolveTheme('system')).toBe('light');
  });

  it('explicit light or dark overrides system preference', () => {
    mockMatches = true; // OS is dark
    expect(resolveTheme('light')).toBe('light'); // Explicit light wins

    mockMatches = false; // OS is light
    expect(resolveTheme('dark')).toBe('dark'); // Explicit dark wins
  });

  it('persists preference locally in localStorage', () => {
    setTheme('dark', PUBLIC_STORAGE_KEY);
    expect(getStoredTheme(PUBLIC_STORAGE_KEY)).toBe('dark');
    expect(mockStorage[PUBLIC_STORAGE_KEY]).toBe('dark');

    setTheme('light', PUBLIC_STORAGE_KEY);
    expect(getStoredTheme(PUBLIC_STORAGE_KEY)).toBe('light');
    expect(mockStorage[PUBLIC_STORAGE_KEY]).toBe('light');

    setTheme('system', PUBLIC_STORAGE_KEY);
    expect(getStoredTheme(PUBLIC_STORAGE_KEY)).toBe('system');
    expect(mockStorage[PUBLIC_STORAGE_KEY]).toBe('system');
  });

  it('separates admin theme preferences from public theme preferences', () => {
    setTheme('dark', ADMIN_STORAGE_KEY);
    setTheme('light', PUBLIC_STORAGE_KEY);

    expect(getStoredTheme(ADMIN_STORAGE_KEY)).toBe('dark');
    expect(getStoredTheme(PUBLIC_STORAGE_KEY)).toBe('light');
    expect(mockStorage[ADMIN_STORAGE_KEY]).toBe('dark');
    expect(mockStorage[PUBLIC_STORAGE_KEY]).toBe('light');
  });

  it('applies dark theme by updating classList, data-theme, and colorScheme', () => {
    applyTheme('dark', PUBLIC_STORAGE_KEY);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('applies light theme by removing dark class and setting colorScheme to light', () => {
    applyTheme('dark', PUBLIC_STORAGE_KEY);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    applyTheme('light', PUBLIC_STORAGE_KEY);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('updates meta theme-color for PWA compatibility', () => {
    const meta = document.querySelector('meta[name="theme-color"]') as any;

    applyTheme('dark', PUBLIC_STORAGE_KEY);
    expect(meta.setAttribute).toHaveBeenCalledWith('content', '#121214');

    applyTheme('light', PUBLIC_STORAGE_KEY);
    expect(meta.setAttribute).toHaveBeenCalledWith('content', '#e65100');
  });
});
