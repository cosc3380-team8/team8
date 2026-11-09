export const LIMITS = {
  student: { maxItems: 3, days: 20 },
  faculty: { maxItems: 6, days: 30 },
} as const;

export const STUDENT_LIMIT_MESSAGE =
  'Trying to borrow more books? Return one today and experience another book’s world!';

export const IN_PERSON_METHODS = ['Cash', 'Card'] as const;


