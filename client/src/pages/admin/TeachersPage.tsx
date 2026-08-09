import { UserRoleTable } from "./components/UserRoleTable";

export function TeachersPage() {
  return <UserRoleTable role="TEACHER" title="Teachers" basePath="/admin/teachers" resource="TEACHER" />;
}