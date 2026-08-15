import {
  LayoutDashboard,
  Users,
  UserCog,
  BookOpen,
  Layers,
  FolderOpen,
  FileText,
  Award,
  BarChart3,
  ScrollText,
  Settings,
  PenSquare,
  ClipboardPen,
  User,
  MessageSquare,
  Bell,
  ClipboardList,
  PenLine,
  CreditCard,
  Building2,
  Receipt,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const adminNav: NavGroup[] = [
  { label: "Overview", items: [{ label: "Dashboard", to: "/admin", icon: LayoutDashboard, end: true }] },
  {
    label: "Business",
    items: [
      { label: "Consultancies", to: "/admin/consultancies", icon: Building2 },
      { label: "Subscription packages", to: "/admin/packages", icon: CreditCard },
      { label: "Subscriptions & billing", to: "/admin/subscriptions", icon: Receipt },
    ],
  },
  {
    label: "Global content",
    items: [
      { label: "Courses", to: "/admin/courses", icon: BookOpen },
      { label: "Examinations", to: "/admin/exams", icon: FileText },
      { label: "Question bank", to: "/admin/questions", icon: FolderOpen },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Messages", to: "/admin/chat", icon: MessageSquare },
      { label: "Reports", to: "/admin/reports", icon: BarChart3 },
      { label: "Audit logs", to: "/admin/audit-logs", icon: ScrollText },
      { label: "Settings", to: "/admin/settings", icon: Settings },
    ],
  },
];

const teacherNav: NavGroup[] = [
  { label: "Overview", items: [{ label: "Dashboard", to: "/teacher", icon: LayoutDashboard, end: true }] },
  {
    label: "Classes",
    items: [
      { label: "My students", to: "/teacher/students", icon: Users },
      { label: "Batches", to: "/teacher/batches", icon: Layers },
      { label: "Messages", to: "/teacher/chat", icon: MessageSquare },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "My courses", to: "/teacher/courses", icon: BookOpen },
      { label: "Question bank", to: "/teacher/questions", icon: FolderOpen },
      { label: "Examinations", to: "/teacher/exams", icon: FileText },
      { label: "Assignments", to: "/teacher/assignments", icon: ClipboardList },
      { label: "Grading", to: "/teacher/submissions", icon: PenLine },
      { label: "Results", to: "/teacher/results", icon: Award },
    ],
  },
  { label: "Reports", items: [{ label: "Reports", to: "/teacher/reports", icon: BarChart3 }] },
];

const studentNav: NavGroup[] = [
  { label: "Overview", items: [{ label: "Dashboard", to: "/student", icon: LayoutDashboard, end: true }] },
  {
    label: "Learning",
    items: [
      { label: "My courses", to: "/student/courses", icon: BookOpen },
      { label: "My tests", to: "/student/tests", icon: ClipboardList },
      { label: "Practice tests", to: "/student/practice", icon: PenSquare },
      { label: "Assignments", to: "/student/assignments", icon: ClipboardPen },
      { label: "Results", to: "/student/results", icon: Award },
      { label: "Feedback", to: "/student/feedback", icon: MessageSquare },
      { label: "Progress", to: "/student/progress", icon: BarChart3 },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Messages", to: "/student/chat", icon: MessageSquare },
      { label: "Notifications", to: "/student/notifications", icon: Bell },
      { label: "Profile", to: "/student/profile", icon: User },
    ],
  },
];

const consultancyNav: NavGroup[] = [
  { label: "Overview", items: [{ label: "Dashboard", to: "/consultancy", icon: LayoutDashboard, end: true }] },
  {
    label: "Organization",
    items: [
      { label: "Teachers", to: "/consultancy/teachers", icon: UserCog },
      { label: "Students", to: "/consultancy/students", icon: Users },
      { label: "Subscription", to: "/consultancy/subscription", icon: CreditCard },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Courses", to: "/consultancy/courses", icon: BookOpen },
      { label: "Tests", to: "/consultancy/exams", icon: FileText },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Messages", to: "/consultancy/chat", icon: MessageSquare },
      { label: "Notifications", to: "/consultancy/notifications", icon: Bell },
      { label: "Profile", to: "/consultancy/profile", icon: User },
    ],
  },
];

export function navGroupsFor(role: string | undefined): NavGroup[] {
  switch (role) {
    case "SUPER_ADMIN":
      return adminNav;
    case "CONSULTANCY":
      return consultancyNav;
    case "TEACHER":
      return teacherNav;
    case "STUDENT":
      return studentNav;
    default:
      return [];
  }
}

export const homePathForRole = (role: string | undefined): string => {
  if (role === "SUPER_ADMIN") return "/admin";
  if (role === "CONSULTANCY") return "/consultancy";
  if (role === "TEACHER") return "/teacher";
  if (role === "STUDENT") return "/student";
  return "/login";
};
