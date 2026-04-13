import { useState, useCallback } from 'react';

export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initial;
    } catch {
      return initial;
    }
  });

  const set = useCallback((v) => {
    try {
      const newValue = typeof v === 'function' ? v(value) : v;
      setValue(newValue);
      localStorage.setItem(key, JSON.stringify(newValue));
    } catch (err) {
      console.error(`Failed to set localStorage[${key}]:`, err);
    }
  }, [key, value]);

  return [value, set];
}
