import { useEffect, useState, type FC } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

interface AdminThemeToggleProps {
  compact?: boolean;
}

export const AdminThemeToggle: FC<AdminThemeToggleProps> = ({ compact = false }) => {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === 'dark' : false;

  return (
    <button
      type="button"
      className={`fb-btn fb-btn-secondary fb-theme-toggle ${compact ? 'fb-theme-toggle-compact' : ''}`.trim()}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      {compact ? null : <span>{isDark ? 'Light' : 'Dark'} mode</span>}
    </button>
  );
};