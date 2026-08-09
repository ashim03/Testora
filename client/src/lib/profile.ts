export interface AccountProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  avatarUrl?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  country?: string | null;
  timezone?: string | null;
  examType?: string;
  targetScore?: string | null;
  currentLevel?: string | null;
  preferredTestDate?: string | null;
  createdAt?: string;
}

export const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

export const EXAM_TYPES = ["IELTS", "PTE", ""] as const;

export const COUNTRIES = [
  "Australia",
  "Bangladesh",
  "Canada",
  "China",
  "Germany",
  "India",
  "Ireland",
  "Malaysia",
  "Nepal",
  "New Zealand",
  "Nigeria",
  "Pakistan",
  "Philippines",
  "Singapore",
  "South Africa",
  "Sri Lanka",
  "UAE",
  "United Kingdom",
  "United States",
  "Vietnam",
].sort();

export const TIMEZONES = [
  "EST (UTC-5) New York",
  "CST (UTC-6) Chicago",
  "MST (UTC-7) Denver",
  "PST (UTC-8) Los Angeles",
  "AST (UTC-4) Halifax",
  "GMT (UTC+0) London",
  "CET (UTC+1) Berlin",
  "IME (UTC+3) Dubai",
  "IST (UTC+5:30) New Delhi",
  "BST (UTC+6) Dhaka",
  "ICT (UTC+7) Bangkok",
  "SGT (UTC+8) Singapore",
  "CST (UTC+8) Beijing",
  "KST (UTC+9) Seoul",
  "AEST (UTC+10) Sydney",
  "NZST (UTC+12) Auckland",
];

const PERSONAL_FIELDS = ["firstName", "lastName", "email", "phone", "gender", "country", "timezone", "avatarUrl", "address"] as const;
const ACADEMIC_FIELDS = ["examType", "targetScore", "currentLevel", "preferredTestDate"] as const;

export function profileCompletion(profile: Partial<AccountProfile>): number {
  const personalFilled = PERSONAL_FIELDS.filter((k) => {
    const v = profile[k];
    return v !== undefined && v !== null && String(v).trim() !== "";
  }).length;
  const academicFilled = ACADEMIC_FIELDS.filter((k) => {
    const v = profile[k];
    return v !== undefined && v !== null && String(v).trim() !== "";
  }).length;
  const total = PERSONAL_FIELDS.length + ACADEMIC_FIELDS.length;
  return Math.round(((personalFilled + academicFilled) / total) * 100);
}

export function toLocalDateInput(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}