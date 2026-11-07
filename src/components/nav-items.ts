import { BookOpen, BarChart3, Shuffle, BookCheck, Trophy } from 'lucide-react';

// Shared by the desktop header (HeaderNav) and the mobile bottom bar (Nav).
export const navItems = [
  { href: '/', label: 'Learn', icon: BookOpen },
  { href: '/custom-test', label: 'Test', icon: Shuffle },
  { href: '/exams', label: 'Exams', icon: BookCheck },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/progress', label: 'Progress', icon: BarChart3 },
];
