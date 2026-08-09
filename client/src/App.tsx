import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { RequireAuth, RequireRole, GuestOnly } from "./routes/guards";
import { PageSpinner } from "./components/ui/feedback";

const LoginPage = lazy(() => import("./pages/auth/LoginPage").then((m) => ({ default: m.LoginPage })));
const ForgotPasswordPage = lazy(() => import("./pages/auth/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("./pages/auth/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })));

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard").then((m) => ({ default: m.AdminDashboard })));
const TeachersPage = lazy(() => import("./pages/admin/TeachersPage").then((m) => ({ default: m.TeachersPage })));
const StudentsPage = lazy(() => import("./pages/admin/StudentsPage").then((m) => ({ default: m.StudentsPage })));
const CoursesPage = lazy(() => import("./pages/admin/CoursesPage").then((m) => ({ default: m.CoursesPage })));
const BatchesPage = lazy(() => import("./pages/admin/BatchesPage").then((m) => ({ default: m.BatchesPage })));
const AssignmentsPage = lazy(() => import("./pages/admin/AssignmentsPage").then((m) => ({ default: m.AssignmentsPage })));
const QuestionsPage = lazy(() => import("./pages/admin/QuestionsPage").then((m) => ({ default: m.QuestionsPage })));
const AdminExamsPage = lazy(() => import("./pages/admin/ExamsPage").then((m) => ({ default: m.ExamsPage })));
const SubmissionsPage = lazy(() => import("./pages/admin/SubmissionsPage").then((m) => ({ default: m.SubmissionsPage })));
const AdminResultsPage = lazy(() => import("./pages/admin/ResultsPage").then((m) => ({ default: m.ResultsPage })));
const ReportsPage = lazy(() => import("./pages/admin/ReportsPage").then((m) => ({ default: m.ReportsPage })));
const AuditLogsPage = lazy(() => import("./pages/admin/AuditLogsPage").then((m) => ({ default: m.AuditLogsPage })));
const AdminSettingsPage = lazy(() => import("./pages/admin/SettingsPage").then((m) => ({ default: m.SettingsPage })));

const TeacherDashboard = lazy(() => import("./pages/teacher/TeacherDashboard").then((m) => ({ default: m.TeacherDashboard })));
const TeacherExams = lazy(() => import("./pages/teacher/TeacherExams").then((m) => ({ default: m.TeacherExams })));
const TeacherQuestions = lazy(() => import("./pages/teacher/TeacherQuestions").then((m) => ({ default: m.TeacherQuestions })));
const TeacherResults = lazy(() => import("./pages/teacher/TeacherResults").then((m) => ({ default: m.TeacherResults })));
const TeacherAssignments = lazy(() => import("./pages/teacher/TeacherAssignments").then((m) => ({ default: m.TeacherAssignments })));
const TeacherStudents = lazy(() => import("./pages/teacher/TeacherStudents").then((m) => ({ default: m.TeacherStudents })));
const TeacherBatches = lazy(() => import("./pages/teacher/TeacherBatches").then((m) => ({ default: m.TeacherBatches })));
const TeacherSubmissions = lazy(() => import("./pages/teacher/TeacherSubmissions").then((m) => ({ default: m.TeacherSubmissions })));
const TeacherReportsPage = lazy(() => import("./pages/teacher/TeacherReports").then((m) => ({ default: m.TeacherReports })));

const StudentDashboard = lazy(() => import("./pages/student/StudentDashboard").then((m) => ({ default: m.StudentDashboard })));
const StudentExams = lazy(() => import("./pages/student/StudentExams").then((m) => ({ default: m.StudentExams })));
const StudentTests = lazy(() => import("./pages/student/StudentTests").then((m) => ({ default: m.StudentTests })));
const StudentPractice = lazy(() => import("./pages/student/StudentPractice").then((m) => ({ default: m.StudentPractice })));
const StudentAssignments = lazy(() => import("./pages/student/StudentAssignments").then((m) => ({ default: m.StudentAssignments })));
const StudentResults = lazy(() => import("./pages/student/StudentResults").then((m) => ({ default: m.StudentResults })));
const StudentFeedback = lazy(() => import("./pages/student/StudentFeedback").then((m) => ({ default: m.StudentFeedback })));
const StudentProgress = lazy(() => import("./pages/student/StudentProgress").then((m) => ({ default: m.StudentProgress })));
const StudentNotifications = lazy(() => import("./pages/student/StudentNotifications").then((m) => ({ default: m.StudentNotifications })));
const ProfilePage = lazy(() => import("./pages/account/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const SettingsPage = lazy(() => import("./pages/account/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const NotificationsPage = lazy(() => import("./pages/account/NotificationsPage").then((m) => ({ default: m.NotificationsPage })));
const SearchPage = lazy(() => import("./pages/account/SearchPage").then((m) => ({ default: m.SearchPage })));
const StudentSubscription = lazy(() => import("./pages/student/StudentSubscription").then((m) => ({ default: m.StudentSubscription })));
const ExamAttemptPage = lazy(() => import("./pages/student/ExamAttemptPage").then((m) => ({ default: m.ExamAttemptPage })));

const UnauthorizedPage = lazy(() => import("./pages/UnauthorizedPage").then((m) => ({ default: m.UnauthorizedPage })));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));

function withLayout(role: string, element: React.ReactNode) {
  return (
    <RequireAuth>
      <AppLayout>
        <RequireRole roles={[role]}>{element}</RequireRole>
      </AppLayout>
    </RequireAuth>
  );
}

function withLayoutAnyRole(element: React.ReactNode) {
  return (
    <RequireAuth>
      <AppLayout>
        <RequireRole roles={["STUDENT", "TEACHER", "SUPER_ADMIN"]}>{element}</RequireRole>
      </AppLayout>
    </RequireAuth>
  );
}

export function App() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
        <Route path="/reset-password" element={<GuestOnly><ResetPasswordPage /></GuestOnly>} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        <Route path="/admin" element={withLayout("SUPER_ADMIN", <AdminDashboard />)} />
        <Route path="/admin/teachers" element={withLayout("SUPER_ADMIN", <TeachersPage />)} />
        <Route path="/admin/students" element={withLayout("SUPER_ADMIN", <StudentsPage />)} />
        <Route path="/admin/assignments" element={withLayout("SUPER_ADMIN", <AssignmentsPage />)} />
        <Route path="/admin/courses" element={withLayout("SUPER_ADMIN", <CoursesPage />)} />
        <Route path="/admin/batches" element={withLayout("SUPER_ADMIN", <BatchesPage />)} />
        <Route path="/admin/questions" element={withLayout("SUPER_ADMIN", <QuestionsPage />)} />
        <Route path="/admin/exams" element={withLayout("SUPER_ADMIN", <AdminExamsPage />)} />
        <Route path="/admin/submissions" element={withLayout("SUPER_ADMIN", <SubmissionsPage />)} />
        <Route path="/admin/results" element={withLayout("SUPER_ADMIN", <AdminResultsPage />)} />
        <Route path="/admin/reports" element={withLayout("SUPER_ADMIN", <ReportsPage />)} />
        <Route path="/admin/audit-logs" element={withLayout("SUPER_ADMIN", <AuditLogsPage />)} />
        <Route path="/admin/settings" element={withLayout("SUPER_ADMIN", <AdminSettingsPage />)} />
        <Route path="/admin/profile" element={withLayout("SUPER_ADMIN", <ProfilePage />)} />
        <Route path="/admin/notifications" element={withLayout("SUPER_ADMIN", <NotificationsPage />)} />

        <Route path="/teacher" element={withLayout("TEACHER", <TeacherDashboard />)} />
        <Route path="/teacher/students" element={withLayout("TEACHER", <TeacherStudents />)} />
        <Route path="/teacher/batches" element={withLayout("TEACHER", <TeacherBatches />)} />
        <Route path="/teacher/exams" element={withLayout("TEACHER", <TeacherExams />)} />
        <Route path="/teacher/questions" element={withLayout("TEACHER", <TeacherQuestions />)} />
        <Route path="/teacher/assignments" element={withLayout("TEACHER", <TeacherAssignments />)} />
        <Route path="/teacher/submissions" element={withLayout("TEACHER", <TeacherSubmissions />)} />
        <Route path="/teacher/results" element={withLayout("TEACHER", <TeacherResults />)} />
        <Route path="/teacher/reports" element={withLayout("TEACHER", <TeacherReportsPage />)} />
        <Route path="/teacher/profile" element={withLayout("TEACHER", <ProfilePage />)} />
        <Route path="/teacher/settings" element={withLayout("TEACHER", <SettingsPage />)} />
        <Route path="/teacher/notifications" element={withLayout("TEACHER", <NotificationsPage />)} />

        <Route path="/student" element={withLayout("STUDENT", <StudentDashboard />)} />
        <Route path="/student/tests" element={withLayout("STUDENT", <StudentTests />)} />
        <Route path="/student/exams" element={withLayout("STUDENT", <StudentExams />)} />
        <Route path="/student/practice" element={withLayout("STUDENT", <StudentPractice />)} />
        <Route path="/student/assignments" element={withLayout("STUDENT", <StudentAssignments />)} />
        <Route path="/student/results" element={withLayout("STUDENT", <StudentResults />)} />
        <Route path="/student/feedback" element={withLayout("STUDENT", <StudentFeedback />)} />
        <Route path="/student/progress" element={withLayout("STUDENT", <StudentProgress />)} />
        <Route path="/student/notifications" element={withLayout("STUDENT", <StudentNotifications />)} />
        <Route path="/student/profile" element={withLayout("STUDENT", <ProfilePage />)} />
        <Route path="/student/settings" element={withLayout("STUDENT", <SettingsPage />)} />
        <Route path="/student/subscription" element={withLayout("STUDENT", <StudentSubscription />)} />
        <Route path="/student/exam/:attemptId" element={withLayout("STUDENT", <ExamAttemptPage />)} />

        <Route path="/search" element={withLayoutAnyRole(<SearchPage />)} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}