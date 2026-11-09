import { request } from './api';

export interface CopyRow {
  copy_id: number;
  status: 'on shelf' | 'checked out' | 'held' | 'archived';
  member_name: string | null;
  due_date: string | null;
}

export const listCopies = (kind: 'book' | 'media', id: number) => request<CopyRow[]>(`/copies?kind=${kind}&id=${id}`);
export const archiveCopy = (copyId: number) => request<{ copy_id: number }>(`/copies/${copyId}`, 'PATCH');
