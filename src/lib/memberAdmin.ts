/**
 * Member administration — ported from js/manager/members.js and roles.js.
 */
import {
  dbSaveMember,
  dbDeleteMember,
  dbSetMemberRole,
  dbSetMemberPassword,
  dbGetMembers,
  logAudit,
  type MemberInput,
} from './db';
import { hashPassword } from './crypto';
import { saveSession, getSession } from './session';
import { resetClientCache } from './supabase';
import type { Member } from '../core/types';

export async function addMember(input: MemberInput, existing: Member[]): Promise<void> {
  if (!input.name?.trim()) throw new Error('Name is required');
  if (!input.username?.trim()) throw new Error('Username is required');
  if (!input.password || input.password.length < 6) throw new Error('Password must be at least 6 characters');
  if (existing.some((m) => m.username === input.username.trim())) throw new Error('Username is taken');
  const hashed = await hashPassword(input.password);
  await dbSaveMember({ ...input, name: input.name.trim(), username: input.username.trim(), password: hashed, role: 'member' });
  await logAudit('create', 'member', input.name, `Member "${input.name}" added`);
}

export async function updateMember(input: MemberInput, existing: Member[]): Promise<void> {
  if (!input.id) throw new Error('Missing member id');
  if (!input.name?.trim()) throw new Error('Name is required');
  if (existing.some((m) => m.username === input.username.trim() && m.id !== input.id))
    throw new Error('Username is taken');
  const payload: MemberInput = { ...input, name: input.name.trim(), username: input.username.trim() };
  if (input.password) payload.password = await hashPassword(input.password);
  else delete payload.password;
  await dbSaveMember(payload);
  await logAudit('update', 'member', input.name, `Member "${input.name}" updated`);
}

export async function removeMember(m: Member): Promise<void> {
  await dbDeleteMember(m.id);
  await logAudit('delete', 'member', m.name, `Member "${m.name}" removed`);
}

export async function setSubManager(m: Member, promote: boolean): Promise<void> {
  await dbSetMemberRole(m.id, promote ? 'sub_manager' : 'member');
  await logAudit('update', 'member', m.name, `${m.name} ${promote ? 'promoted to sub-manager' : 'demoted to member'}`);
}

export async function resetMemberPassword(m: Member, newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < 6) throw new Error('Password must be at least 6 characters');
  await dbSetMemberPassword(m.id, await hashPassword(newPassword));
  await logAudit('update', 'member', m.name, `Password reset for ${m.name}`);
}

/**
 * Transfer manager role. The current manager becomes a member; `target` becomes
 * manager. Updates the local session so the app immediately drops manager access.
 */
export async function transferManagerRole(target: Member): Promise<void> {
  const session = getSession();
  const me = session?.user;
  if (!me?.memberId) throw new Error('Not signed in');
  await dbSetMemberRole(me.memberId, 'member');
  await dbSetMemberRole(target.id, 'manager');
  await logAudit('update', 'member', target.name, `Manager role transferred to ${target.name}`);
  await saveSession({ ...me, role: 'member' }, session!.mess, session!.jwt);
  resetClientCache();
}

export async function refreshMembers(): Promise<Member[]> {
  return dbGetMembers();
}
