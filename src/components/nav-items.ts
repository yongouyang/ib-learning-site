import { BookOpen, BarChart3, Shuffle } from 'lucide-react';

// Shared by the desktop header (HeaderNav) and the mobile bottom bar (Nav).
export const navItems = [
  { href: '/', label: 'Learn', icon: BookOpen },
  { href: '/mixed-review', label: 'Review', icon: Shuffle },
  { href: '/progress', label: 'Progress', icon: BarChart3 },
];
