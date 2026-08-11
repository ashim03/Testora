import { Types } from "mongoose";
import { ChatMessage, Notification, TeacherStudentAssignment, User } from "../models";
import { ApiError } from "../utils/helpers";
import { notify } from "./notificationService";
import { isTeacherOfStudent } from "./userService";

type Role = "SUPER_ADMIN" | "TEACHER" | "STUDENT";

interface Actor {
  id: string;
  role: string;
}

interface ContactUser {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  avatarUrl?: string | null;
}

export async function listContacts(actor: Actor): Promise<unknown[]> {
  const role = actor.role as Role;
  const users = await allowedContactUsers(actor.id, role);
  const contacts = [];

  for (const user of users) {
    const lastMessage = await ChatMessage.findOne(pairFilter(actor.id, String(user._id)))
      .sort({ createdAt: -1 })
      .lean();
    const unread = await ChatMessage.countDocuments({
      senderId: user._id,
      recipientId: actor.id,
      readAt: null,
    });
    contacts.push({
      id: String(user._id),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl ?? null,
      unread,
      lastMessage: lastMessage
        ? {
            id: String(lastMessage._id),
            body: lastMessage.body,
            senderId: String(lastMessage.senderId),
            recipientId: String(lastMessage.recipientId),
            createdAt: lastMessage.createdAt,
            readAt: lastMessage.readAt,
          }
        : null,
    });
  }

  return contacts.sort((a, b) => {
    const ad = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const bd = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
    if (bd !== ad) return bd - ad;
    return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
  });
}

export async function listMessages(actor: Actor, contactId: string): Promise<unknown[]> {
  await ensureCanChat(actor, contactId);
  await markConversationRead(actor, contactId);
  const messages = await ChatMessage.find(pairFilter(actor.id, contactId)).sort({ createdAt: 1 }).limit(200).lean();
  return messages.map(formatMessage);
}

export async function sendMessage(actor: Actor, recipientId: string, body: string): Promise<unknown> {
  await ensureCanChat(actor, recipientId);
  const text = body.trim();
  if (!text) throw new ApiError(400, "Message cannot be empty");
  if (text.length > 2000) throw new ApiError(400, "Message must be 2000 characters or fewer");

  const message = await ChatMessage.create({
    senderId: actor.id,
    recipientId,
    body: text,
  });

  await notify(
    recipientId,
    "CHAT_MESSAGE",
    "New message",
    "You have a new chat message.",
    { senderId: actor.id },
  );

  return formatMessage(message);
}

export async function markConversationRead(actor: Actor, contactId: string): Promise<void> {
  await ensureCanChat(actor, contactId);
  const readAt = new Date();
  await Promise.all([
    ChatMessage.updateMany(
      { senderId: contactId, recipientId: actor.id, readAt: null },
      { $set: { readAt } },
    ),
    Notification.updateMany(
      { recipientId: actor.id, type: "CHAT_MESSAGE", read: false, "data.senderId": contactId },
      { $set: { read: true, readAt } },
    ),
  ]);
}

async function ensureCanChat(actor: Actor, contactId: string): Promise<void> {
  if (!Types.ObjectId.isValid(contactId)) throw new ApiError(400, "Invalid contact");
  if (actor.id === contactId) throw new ApiError(400, "Choose another user to chat with");

  const contact = await User.findOne({ _id: contactId, deletedAt: null, status: { $ne: "SUSPENDED" } }).lean();
  if (!contact) throw new ApiError(404, "Contact not found");

  if (actor.role === "STUDENT" && contact.role === "TEACHER") {
    if (await isTeacherOfStudent(contactId, actor.id)) return;
  }

  if (actor.role === "TEACHER" && contact.role === "STUDENT") {
    if (await isTeacherOfStudent(actor.id, contactId)) return;
  }

  if (actor.role === "TEACHER" && contact.role === "SUPER_ADMIN") return;
  if (actor.role === "SUPER_ADMIN" && contact.role === "TEACHER") return;

  throw new ApiError(403, "You cannot chat with this user");
}

async function allowedContactUsers(actorId: string, role: Role): Promise<ContactUser[]> {
  if (role === "STUDENT") {
    const assignments = await TeacherStudentAssignment.find({ studentId: actorId, status: "ACTIVE", endedAt: null })
      .select("teacherId")
      .lean();
    const teacherIds = assignments.map((a) => a.teacherId);
    return User.find({ _id: { $in: teacherIds }, role: "TEACHER", deletedAt: null, status: { $ne: "SUSPENDED" } })
      .sort({ firstName: 1, lastName: 1 })
      .lean() as Promise<ContactUser[]>;
  }

  if (role === "TEACHER") {
    const assignments = await TeacherStudentAssignment.find({ teacherId: actorId, status: "ACTIVE", endedAt: null })
      .select("studentId")
      .lean();
    const studentIds = assignments.map((a) => a.studentId);
    const [students, admins] = await Promise.all([
      User.find({ _id: { $in: studentIds }, role: "STUDENT", deletedAt: null, status: { $ne: "SUSPENDED" } })
        .sort({ firstName: 1, lastName: 1 })
        .lean(),
      User.find({ role: "SUPER_ADMIN", deletedAt: null, status: { $ne: "SUSPENDED" } })
        .sort({ firstName: 1, lastName: 1 })
        .lean(),
    ]);
    return [...admins, ...students] as ContactUser[];
  }

  if (role === "SUPER_ADMIN") {
    return User.find({ role: "TEACHER", deletedAt: null, status: { $ne: "SUSPENDED" } })
      .sort({ firstName: 1, lastName: 1 })
      .lean() as Promise<ContactUser[]>;
  }

  return [];
}

function pairFilter(userId: string, contactId: string): Record<string, unknown> {
  return {
    $or: [
      { senderId: userId, recipientId: contactId },
      { senderId: contactId, recipientId: userId },
    ],
  };
}

function formatMessage(message: {
  _id: unknown;
  senderId: unknown;
  recipientId: unknown;
  body: string;
  readAt?: Date | null;
  createdAt?: Date;
}): Record<string, unknown> {
  return {
    id: String(message._id),
    senderId: String(message.senderId),
    recipientId: String(message.recipientId),
    body: message.body,
    readAt: message.readAt ?? null,
    createdAt: message.createdAt,
  };
}
