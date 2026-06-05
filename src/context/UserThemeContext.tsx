import React, { createContext, useContext, useMemo, useSyncExternalStore } from 'react';

export type UserTheme = 'light' | 'dark';

type UserThemeContextValue = {
  theme: UserTheme;
};

const UserThemeContext = createContext<UserThemeContextValue | null>(null);

const darkQuery = '(prefers-color-scheme: dark)';

function getSystemTheme(): UserTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia(darkQuery).matches ? 'dark' : 'light';
}

function subscribeSystemTheme(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia(darkQuery);
  mq.addEventListener('change', onStoreChange);
  return () => mq.removeEventListener('change', onStoreChange);
}

/**
 * Applies Tailwind `dark` on a wrapper from the OS/browser color scheme
 * (`prefers-color-scheme`). Updates when the user changes system appearance.
 */
export const UserThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemTheme,
    () => 'light' as UserTheme
  );

  const value = useMemo(() => ({ theme }), [theme]);

  return (
    <UserThemeContext.Provider value={value}>
      <div className={theme === 'dark' ? 'dark min-h-full' : 'min-h-full'}>{children}</div>
    </UserThemeContext.Provider>
  );
};

export function useUserTheme(): UserThemeContextValue {
  const ctx = useContext(UserThemeContext);
  if (!ctx) {
    throw new Error('useUserTheme must be used within UserThemeProvider');
  }
  return ctx;
}

/** When the tree is not wrapped in UserThemeProvider. */
export function useUserThemeOptional(): UserThemeContextValue | null {
  return useContext(UserThemeContext);
}
