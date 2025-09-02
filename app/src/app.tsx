import 'src/global.css';

import React, { useEffect } from 'react';

import { usePathname } from 'src/routes/hooks';

import { ThemeProvider } from 'src/theme/theme-provider';

import i18n from './locales/i18n';

// ----------------------------------------------------------------------

type AppProps = {
  children: React.ReactNode;
};

export default function App({ children }: Readonly<AppProps>) {
  useScrollToTop();

  useEffect(() => {
    const stored = localStorage.getItem("i18nextLng");
    if (stored) {
      i18n.changeLanguage(stored);
    }
  }, []);

  return (
    <ThemeProvider>
      {children}
    </ThemeProvider>
  );
}

// ----------------------------------------------------------------------

function useScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
