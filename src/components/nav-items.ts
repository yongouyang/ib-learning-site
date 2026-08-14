import { BookOpen, BarChart3, Shuffle, BookCheck } from 'lucide-react';

// Shared by the desktop header (HeaderNav) and the mobile bottom bar (Nav).
export const navItems = [
  { href: '/', label: 'Learn', icon: BookOpen },
  { href: '/mixed-review', label: 'Review', icon: Shuffle },
  { href: '/exams', label: 'Exams', icon: BookCheck },
  { href: '/progress', label: 'Progress', icon: BarChart3 },
];
