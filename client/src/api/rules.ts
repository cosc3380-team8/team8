import { DBState, nextId } from './state';
import type { BookCopy, Fine, Hold, ItemKind, Loan, MediaCopy } from '../types';
import { addDays, daysBetween, today } from '../utils/dates';

export const LIMITS = {
  student: { maxItems: 3, days: 20 },
  faculty: { maxItems: 6, days: 30 },
} as const;

export const HOLD_DAYS = 3;
export const MAX_ACTIVE_HOLDS = 3;
export const WARNING_DAYS = 2;
export const STUDENT_LIMIT_MESSAGE =
  'Trying to borrow more books? Return one today and experience another book’s world!';

export const fineAmount = (daysOverdue: number) =>
  daysOverdue > 0 ? 5 + Math.floor(daysOverdue / 7) : 0;

export function log(s: DBState, trigger: string, table: string, message: string) {
  s.audit.unshift({
    log_id: nextId(s, 'audit'),
    logged_at: new Date().toISOString(),
    trigger_name: trigger,
    table_name: table,
    message,
  });
}

type AnyCopy = BookCopy | MediaCopy;

function copiesFor(s: DBState, kind: ItemKind, itemId: number): AnyCopy[] {
  return kind === 'book'
    ? s.bookCopies.filter((c) => c.book_id === itemId)
    : s.mediaCopies.filter((c) => c.media_id === itemId);
}

const holdMatches = (h: Hold, kind: ItemKind, itemId: number) =>
  kind === 'book' ? h.book_id === itemId : h.media_id === itemId;

export function holdItem(h: Hold): { kind: ItemKind; itemId: number } {
  return h.book_id !== null
    ? { kind: 'book', itemId: h.book_id }
    : { kind: 'media', itemId: h.media_id as number };
}

export function itemTitle(s: DBState, kind: ItemKind, itemId: number): string {
  return (
    (kind === 'book'
      ? s.books.find((b) => b.book_id === itemId)?.title
      : s.media.find((m) => m.media_id === itemId)?.title) ?? 'Unknown item'
  );
}

export function loanItem(s: DBState, l: Loan): { kind: ItemKind; itemId: number; title: string } {
  if (l.book_copy_id !== null) {
    const c = s.bookCopies.find((x) => x.copy_id === l.book_copy_id)!;
    return { kind: 'book', itemId: c.book_id, title: itemTitle(s, 'book', c.book_id) };
  }
  const c = s.mediaCopies.find((x) => x.media_copy_id === l.media_copy_id)!;
  return { kind: 'media', itemId: c.media_id, title: itemTitle(s, 'media', c.media_id) };
}

function memberOrThrow(s: DBState, userId: number) {
  const m = s.members.find((x) => x.user_id === userId && x.is_active);
  if (!m) throw new Error('Member not found or account is inactive.');
  return m;
}

export function checkout(
  s: DBState, userId: number, kind: ItemKind, itemId: number, asOf = today(),
): Loan {
  const member = memberOrThrow(s, userId);
  const limit = LIMITS[member.role];
  const activeCount = s.loans.filter((l) => l.user_id === userId && l.return_date === null).length;

  if (activeCount >= limit.maxItems) {
    log(s, 'trg_loans_enforce_limit', 'loans',
      `Blocked checkout: member ${userId} (${member.role}) already has ${activeCount}/${limit.maxItems} items.`);
    throw new Error(
      member.role === 'student'
        ? STUDENT_LIMIT_MESSAGE
        : `Faculty limit of ${limit.maxItems} items reached. Please return an item first.`,
    );
  }

  const ready = s.holds.find(
    (h) => h.user_id === userId && h.status === 'ready' && holdMatches(h, kind, itemId),
  );
  const copies = copiesFor(s, kind, itemId);
  const copy = ready
    ? copies.find((c) => c.status === 'held')
    : copies.find((c) => c.status === 'available');
  if (!copy) throw new Error('No copy is available right now. Place a hold to join the queue.');

  const loan: Loan = {
    loan_id: nextId(s, 'loans'),
    user_id: userId,
    book_copy_id: kind === 'book' ? (copy as BookCopy).copy_id : null,
    media_copy_id: kind === 'media' ? (copy as MediaCopy).media_copy_id : null,
    borrow_date: asOf,
    due_date: addDays(asOf, limit.days),
    return_date: null,
  };
  s.loans.push(loan);
  copy.status = 'loaned';
  if (ready) ready.status = 'fulfilled';
  log(s, 'trg_loans_after_insert', 'loans',
    `Loan ${loan.loan_id}: copy marked loaned${ready ? ', hold fulfilled' : ''}; due ${loan.due_date}.`);
  return loan;
}

export function returnLoan(s: DBState, loanId: number, asOf = today()): { fine: Fine | null } {
  const loan = s.loans.find((l) => l.loan_id === loanId);
  if (!loan) throw new Error('Loan not found.');
  if (loan.return_date) throw new Error('This loan was already returned.');
  const info = loanItem(s, loan);
  const copy: AnyCopy =
    loan.book_copy_id !== null
      ? s.bookCopies.find((c) => c.copy_id === loan.book_copy_id)!
      : s.mediaCopies.find((c) => c.media_copy_id === loan.media_copy_id)!;

  loan.return_date = asOf;
  copy.status = 'available';
  log(s, 'trg_loans_after_return', 'loans', `Loan ${loan.loan_id} returned: copy of "${info.title}" is available again.`);

  let fine: Fine | null = null;
  const late = daysBetween(loan.due_date, asOf);
  if (late > 0) {
    fine = {
      fine_id: nextId(s, 'fines'),
      loan_id: loan.loan_id,
      amount: fineAmount(late),
      paid_status: 'unpaid',
      paid_date: null,
    };
    s.fines.push(fine);
    log(s, 'trg_loans_after_return', 'fines',
      `Fine ${fine.fine_id} of $${fine.amount.toFixed(2)} created for loan ${loan.loan_id} (${late} days late).`);
  }
  promoteNextHold(s, info.kind, info.itemId, asOf);
  return { fine };
}

export function promoteNextHold(s: DBState, kind: ItemKind, itemId: number, asOf = today()) {
  const copy = copiesFor(s, kind, itemId).find((c) => c.status === 'available');
  const next = s.holds
    .filter((h) => h.status === 'waiting' && holdMatches(h, kind, itemId))
    .sort((a, b) => a.request_date.localeCompare(b.request_date) || a.hold_id - b.hold_id)[0];
  if (!copy || !next) return;
  next.status = 'ready';
  next.ready_date = asOf;
  next.expiration_date = addDays(asOf, HOLD_DAYS);
  copy.status = 'held';
  log(s, 'sp_promote_next_hold', 'holds',
    `Hold ${next.hold_id} is ready for member ${next.user_id}; pick up by ${next.expiration_date}.`);
}

export function placeHold(
  s: DBState, userId: number, kind: ItemKind, itemId: number, asOf = today(),
): Hold {
  memberOrThrow(s, userId);
  const active = s.holds.filter((h) => h.user_id === userId && (h.status === 'waiting' || h.status === 'ready'));
  if (active.length >= MAX_ACTIVE_HOLDS) throw new Error(`You can have at most ${MAX_ACTIVE_HOLDS} active holds.`);
  if (active.some((h) => holdMatches(h, kind, itemId))) throw new Error('You already have a hold on this item.');

  const hold: Hold = {
    hold_id: nextId(s, 'holds'),
    user_id: userId,
    book_id: kind === 'book' ? itemId : null,
    media_id: kind === 'media' ? itemId : null,
    request_date: asOf,
    status: 'waiting',
    ready_date: null,
    expiration_date: null,
  };
  s.holds.push(hold);
  promoteNextHold(s, kind, itemId, asOf);
  return hold;
}

function releaseHold(s: DBState, h: Hold, newStatus: 'cancelled' | 'expired', asOf: string) {
  const wasReady = h.status === 'ready';
  h.status = newStatus;
  if (wasReady) {
    const { kind, itemId } = holdItem(h);
    const held = copiesFor(s, kind, itemId).find((c) => c.status === 'held');
    if (held) held.status = 'available';
    promoteNextHold(s, kind, itemId, asOf);
  }
}

export function cancelHold(s: DBState, holdId: number, asOf = today()) {
  const h = s.holds.find((x) => x.hold_id === holdId);
  if (!h) throw new Error('Hold not found.');
  if (h.status !== 'waiting' && h.status !== 'ready') throw new Error('This hold is no longer active.');
  releaseHold(s, h, 'cancelled', asOf);
}

export function expireHolds(s: DBState, asOf = today()): number {
  const overdue = s.holds.filter((h) => h.status === 'ready' && h.expiration_date !== null && h.expiration_date < asOf);
  overdue.forEach((h) => {
    releaseHold(s, h, 'expired', asOf);
    log(s, 'sp_expire_holds', 'holds', `Hold ${h.hold_id} expired (not picked up by ${h.expiration_date}).`);
  });
  return overdue.length;
}

export function payFine(s: DBState, fineId: number, method: string, asOf = today()) {
  const fine = s.fines.find((f) => f.fine_id === fineId);
  if (!fine) throw new Error('Fine not found.');
  if (fine.paid_status === 'paid') throw new Error('This fine is already paid.');
  const loan = s.loans.find((l) => l.loan_id === fine.loan_id)!;

  const payment = {
    payment_id: nextId(s, 'payments'),
    fine_id: fine.fine_id,
    user_id: loan.user_id,
    amount_paid: fine.amount,
    payment_method: method,
    payment_date: asOf,
  };
  s.payments.push(payment);
  fine.paid_status = 'paid';
  fine.paid_date = asOf;
  const receipt = {
    receipt_id: nextId(s, 'receipts'),
    payment_id: payment.payment_id,
    transaction_code: `TXN-${asOf.replace(/-/g, '')}-${String(payment.payment_id).padStart(4, '0')}`,
    issued_date: asOf,
  };
  s.receipts.push(receipt);
  log(s, 'trg_payments_after_insert', 'payments',
    `Payment ${payment.payment_id}: fine ${fine.fine_id} marked paid; receipt ${receipt.transaction_code} issued.`);
  return receipt;
}

export function reserveRoom(s: DBState, userId: number, roomId: number, start: string, end: string) {
  memberOrThrow(s, userId);
  const room = s.rooms.find((r) => r.room_id === roomId && r.is_active);
  if (!room) throw new Error('Room not found.');
  if (!start || !end || end <= start) throw new Error('End time must be after start time.');
  const clash = s.reservations.find((r) => r.room_id === roomId && start < r.end_time && end > r.start_time);
  if (clash) {
    log(s, 'trg_reservations_no_overlap', 'room_reservations',
      `Blocked: room ${room.room_number} overlaps reservation ${clash.reservation_id}.`);
    throw new Error(`Room ${room.room_number} is already reserved from ${clash.start_time.replace('T', ' ')} to ${clash.end_time.replace('T', ' ')}.`);
  }
  const r = { reservation_id: nextId(s, 'reservations'), room_id: roomId, user_id: userId, start_time: start, end_time: end };
  s.reservations.push(r);
  return r;
}
