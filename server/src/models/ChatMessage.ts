import mongoose, { type Document, type Model, type Types } from "mongoose";

export interface IChatMessage extends Document {
  senderId: Types.ObjectId;
  recipientId: Types.ObjectId;
  body: string;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ senderId: 1, recipientId: 1, createdAt: -1 });
schema.index({ recipientId: 1, readAt: 1, createdAt: -1 });

export const ChatMessage: Model<IChatMessage> = mongoose.model<IChatMessage>("ChatMessage", schema);
