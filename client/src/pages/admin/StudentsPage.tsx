import { UserRoleTable } from "./components/UserRoleTable";

export function StudentsPage() {
  return <UserRoleTable role="STUDENT" title="Students" basePath="/admin/students" resource="STUDENT" />;
}