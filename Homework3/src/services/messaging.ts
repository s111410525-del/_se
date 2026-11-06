import { badRequest, forbidden } from '../core/errors.js';
import type {
  Conversation,
  ConversationStatus,
  Database,
  Job,
  Message,
  User,
} from '../types.js';
import { CONVERSATION_STATUSES } from '../types.js';
import { newId } from '../util/id.js';

export function conversationsFor(db: Database, user: User): Conversation[] {
  return db.conversations
    .filter((conversation) =>
      user.role === 'admin'
        ? true
        : conversation.seekerId === user.id || conversation.employerId === user.id,
    )
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function isParticipant(conversation: Conversation, user: User): boolean {
  return user.role === 'admin' || conversation.seekerId === user.id || conversation.employerId === user.id;
}

export function findConversation(db: Database, jobId: string, seekerId: string): Conversation | undefined {
  return db.conversations.find((conversation) => conversation.jobId === jobId && conversation.seekerId === seekerId);
}

export function needConversation(db: Database, id: string): Conversation {
  const conversation = db.conversations.find((item) => item.id === id);
  if (conversation === undefined) throw badRequest('找不到這則對話');
  return conversation;
}

export function messagesOf(db: Database, conversationId: string): Message[] {
  return db.messages
    .filter((message) => message.conversationId === conversationId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export function lastMessageOf(db: Database, conversation: Conversation): Message | undefined {
  return messagesOf(db, conversation.id).at(-1);
}

function readField(conversation: Conversation, userId: string): 'seekerReadAt' | 'employerReadAt' | null {
  if (conversation.seekerId === userId) return 'seekerReadAt';
  if (conversation.employerId === userId) return 'employerReadAt';
  return null;
}

/** 未讀訊息數：對方送出且時間晚於自己上次讀取。 */
export function unreadCount(db: Database, conversation: Conversation, userId: string): number {
  const field = readField(conversation, userId);
  if (field === null) return 0;
  const readAt = conversation[field];
  const floor = readAt === null ? 0 : Date.parse(readAt);
  return db.messages.filter(
    (message) =>
      message.conversationId === conversation.id &&
      message.senderId !== userId &&
      Date.parse(message.createdAt) > floor,
  ).length;
}

export function totalUnread(db: Database, user: User): number {
  return conversationsFor(db, user).reduce((sum, conversation) => sum + unreadCount(db, conversation, user.id), 0);
}

export function markRead(conversation: Conversation, userId: string, nowISO: string): void {
  const field = readField(conversation, userId);
  if (field !== null) conversation[field] = nowISO;
}

export function sendMessage(
  db: Database,
  conversation: Conversation,
  sender: User,
  body: string,
  nowISO: string,
): Message {
  if (!isParticipant(conversation, sender)) throw forbidden('你不能在這個對話中留言');
  const trimmed = body.trim();
  if (trimmed === '') throw badRequest('訊息不可空白');

  const message: Message = {
    id: newId('msg'),
    conversationId: conversation.id,
    senderId: sender.id,
    body: trimmed,
    createdAt: nowISO,
  };
  db.messages.push(message);
  conversation.updatedAt = nowISO;
  markRead(conversation, sender.id, nowISO);
  return message;
}

export interface ApplyResult {
  conversation: Conversation;
  message: Message;
  created: boolean;
}

/**
 * 應徵職缺：建立（或沿用）求職者與雇主針對這個職缺的對話，並送出第一則私訊。
 * 這就是平台規定的應徵方式。
 */
export function applyToJob(db: Database, job: Job, seeker: User, body: string, nowISO: string): ApplyResult {
  if (seeker.role !== 'seeker') throw forbidden('只有求職者帳號可以應徵職缺');
  if (job.employerId === seeker.id) throw badRequest('不能應徵自己發布的職缺');
  if (!job.published) throw badRequest('這個職缺目前沒有開放應徵');

  const existing = findConversation(db, job.id, seeker.id);
  if (existing !== undefined) {
    if (existing.status === 'closed') {
      existing.status = 'applied';
      existing.employerReadAt = null;
    }
    const message = sendMessage(db, existing, seeker, body, nowISO);
    return { conversation: existing, message, created: false };
  }

  const conversation: Conversation = {
    id: newId('conv'),
    jobId: job.id,
    seekerId: seeker.id,
    employerId: job.employerId,
    status: 'applied',
    createdAt: nowISO,
    updatedAt: nowISO,
    seekerReadAt: nowISO,
    employerReadAt: null,
  };
  db.conversations.push(conversation);
  const message = sendMessage(db, conversation, seeker, body, nowISO);
  return { conversation, message, created: true };
}

export function setConversationStatus(
  conversation: Conversation,
  status: ConversationStatus,
  nowISO: string,
): void {
  conversation.status = status;
  conversation.updatedAt = nowISO;
  // 狀態更新後，讓雙方下次開啟對話時能看到最新狀態。
  conversation.employerReadAt = nowISO;
}

export function parseStatus(value: string): ConversationStatus | undefined {
  return CONVERSATION_STATUSES.includes(value as ConversationStatus)
    ? (value as ConversationStatus)
    : undefined;
}

export function applicationCountOfJob(db: Database, jobId: string): number {
  return db.conversations.filter((conversation) => conversation.jobId === jobId).length;
}

export function applicationsOfSeeker(db: Database, seekerId: string): Conversation[] {
  return db.conversations
    .filter((conversation) => conversation.seekerId === seekerId)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function applicationsOfEmployer(db: Database, employerId: string): Conversation[] {
  return db.conversations
    .filter((conversation) => conversation.employerId === employerId)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}
