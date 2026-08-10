import {
  LayoutDashboard,
  Users,
  UserCog,
  Link2,
  BookOpen,
  Layers,
  FolderOpen,
  FileText,
  Inbox,
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
    label: "Management",
    items: [
      { label: "Teachers", to: "/admin/teachers", icon: Users },
      { label: "Students", to: "/admin/students", icon: UserCog },
      { label: "Assignments", to: "/admin/assignments", icon: Link2 },
      { label: "Courses", to: "/admin/courses", icon: BookOpen },
      { label: "Batches", to: "/admin/batches", icon: Layers },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Question bank", to: "/admin/questions", icon: FolderOpen },
      { label: "Examinations", to: "/admin/exams", icon: FileText },
      { label: "Submissions", to: "/admin/submissions", icon: Inbox },
      { label: "Results", to: "/admin/results", icon: Award },
    ],
  },
  {
    label: "System",
    items: [
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
      { label: "Notifications", to: "/student/notifications", icon: Bell },
      { label: "Subscription", to: "/student/subscription", icon: CreditCard },
      { label: "Profile", to: "/student/profile", icon: User },
    ],
  },
];

export function navGroupsFor(role: string | undefined): NavGroup[] {
  switch (role) {
    case "SUPER_ADMIN":
      return adminNav;
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
  if (role === "TEACHER") return "/teacher";
  if (role === "STUDENT") return "/student";
  return "/login";
};