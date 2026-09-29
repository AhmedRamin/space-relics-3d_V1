import { useEffect, useState } from 'react';

/** Reactive media query — drives the drawer/sheet behaviour on small screens. */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (typeof window === 'undefined' ? false : window.matchMedia(query).matches));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const list = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export const useBreakpoints = () => ({
  isPhone: useMediaQuery('(max-width: 700px)'),
  isTablet: useMediaQuery('(max-width: 1080px)'),
});
