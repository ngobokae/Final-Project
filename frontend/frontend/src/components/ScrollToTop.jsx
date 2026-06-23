import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { scrollPageToTop } from '../utils/scrollToTop';

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    scrollPageToTop();
  }, [pathname]);

  return null;
}
