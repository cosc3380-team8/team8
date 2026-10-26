import { DBState, emptyState, nextId } from './state';
import { addDays, today } from '../utils/dates';
import { checkout, log, payFine, placeHold, returnLoan } from './rules';
import type { ItemKind } from '../types';

export function buildSeed(): DBState {
  const s = emptyState();
  const t = today();
  const ago = (n: number) => addDays(t, -n);

  s.staff.push(
    { staff_id: nextId(s, 'staff'), first_name: 'Clark', last_name: 'Nguyen', email: 'clark@library.edu', password: 'staff123', is_admin: false, is_active: true },
    { staff_id: nextId(s, 'staff'), first_name: 'Azael', last_name: 'Aaron', email: 'azael@library.edu', password: 'admin123', is_admin: true, is_active: true },
  );

  const people: [string, string, string, 'student' | 'faculty', string][] = [
    ['Esther', 'Burns', 'esther@uni.edu', 'student', 'student123'],
    ['Ben', 'Carter', 'ben@uni.edu', 'student', 'student123'],
    ['Aliza', 'Salman', 'aliza@uni.edu', 'faculty', 'faculty123'],
    ['Dan', 'Okafor', 'dan@uni.edu', 'faculty', 'faculty123'],
    ['Uriel', 'Smith', 'uriel@uni.edu', 'student', 'student123'],
  ];
  people.forEach(([first_name, last_name, email, role, password]) =>
    s.members.push({ user_id: nextId(s, 'members'), first_name, last_name, email, password, role, is_active: true }));

  [['Harper', 'Lee'], ['George', 'Orwell'], ['Jane', 'Austen'], ['Mary', 'Shelley'], ['Fyodor', 'Dostoevsky'], ['Albert', 'Camus'], ['Oscar', 'Wilde'], ['F. Scott', 'Fitzgerald'], ['Bram', 'Stoker'], ['Alexandre', 'Dumas'], ['Neil', 'Gaiman'], ['Lewis', 'Carroll'], ['Ramez', 'Elmasri'], ['Shamkant B.', 'Navathe'], ['William', 'Stallings']]
    .forEach(([first_name, last_name]) => s.authors.push({ author_id: nextId(s, 'authors'), first_name, last_name }));

  const books: [string, string, string, number[], number][] = [
    ['To Kill a Mockingbird', '9780060935467', 'Harper Perennial', [1], 2],
    ['1984', '9780451524935', 'Signet Classics', [2], 2],
    ['Animal Farm', '9780451526342', 'Signet Classics', [2], 1],
    ['Pride and Prejudice', '9780141439518', 'Penguin Classics', [3], 2],
    ['Frankenstein', '9780141439471', 'Penguin Classics', [4], 2],
    ['Crime and Punishment', '9780679734505', 'Vintage Classics', [5], 1],
    ['The Stranger', '9780679720201', 'Vintage International', [6], 1],
    ['The Picture of Dorian Gray', '9780141439570', 'Penguin Classics', [7], 3],
    ['The Great Gatsby', '9780743273565', 'Scribner', [8], 2],
    ['Dracula', '9780141439846', 'Penguin Classics', [9], 2],
    ['The Count of Monte Cristo', '9780140449266', 'Penguin Classics', [10], 2],
    ['Coraline', '9780380807345', 'HarperCollins', [11], 2],
    ['Alice in Wonderland', '9781509865390', 'Macmillan', [12], 2],
    ['Fundamentals of Database Systems, 7th Edition', '9780133970777', 'Pearson', [13, 14], 3],
    ['Operating Systems: Internals and Design Principles, 9th Edition', '9780134670959', 'Prentice Hall, 2017', [15], 3],
    ['The Idiot', '9780140447927', 'Penguin Classics', [5], 2],
    ['The Brothers Karamazov', '9780679729259', 'Vintage Classics', [5], 2],
    ['White Nights', '9780141398921', 'Penguin Classics', [5], 1],
  ];
  books.forEach(([title, isbn, publisher, author_ids, copies]) => {
    const book_id = nextId(s, 'books');
    s.books.push({ book_id, title, isbn, publisher, is_active: true });
    author_ids.forEach((author_id, i) => s.bookAuthors.push({ book_id, author_id, author_order: i + 1 }));
    for (let i = 0; i < copies; i++) s.bookCopies.push({ copy_id: nextId(s, 'bookCopies'), book_id, status: 'available' });
  });

  const media: [string, 'DVD' | 'Audiobook' | 'Device', number][] = [
    ['The Great Gatsby (Audiobook)', 'Audiobook', 2],
    ['Coraline (DVD)', 'DVD', 2],
    ['Graphing Calculator TI-84', 'Device', 2],
    ['Noise-Cancelling Headphones', 'Device', 1],
    ['The Picture of Dorian Gray (Audiobook)', 'Audiobook', 2],
    ['Alice in Wonderland (DVD)', 'DVD', 2],
  ];
  media.forEach(([title, media_type, copies]) => {
    const media_id = nextId(s, 'media');
    s.media.push({ media_id, title, media_type, is_active: true });
    for (let i = 0; i < copies; i++) s.mediaCopies.push({ media_copy_id: nextId(s, 'mediaCopies'), media_id, status: 'available' });
  });

  [['101', 1, 4], ['102', 1, 6], ['201', 2, 8], ['202', 2, 10]].forEach(([room_number, room_level, capacity]) =>
    s.rooms.push({ room_id: nextId(s, 'rooms'), room_number: String(room_number), room_level: Number(room_level), capacity: Number(capacity), is_active: true }));

  const history: [number, ItemKind, number, number, number][] = [
    [1, 'book', 4, 58, 50],
    [1, 'book', 1, 55, 30],
    [2, 'book', 2, 45, 20],
    [2, 'media', 1, 40, 35],
    [3, 'book', 8, 50, 25],
    [4, 'book', 5, 60, 12],
    [4, 'media', 3, 30, 28],
    [1, 'book', 2, 30, 25],
    [2, 'book', 1, 20, 10],
    [3, 'book', 5, 15, 8],
    [2, 'book', 5, 10, 6],
    [3, 'media', 2, 14, 9],
  ];
  const paidLoanIds: number[] = [];
  history.forEach(([user, kind, item, b, r], i) => {
    const loan = checkout(s, user, kind, item, ago(b));
    returnLoan(s, loan.loan_id, ago(r));
    if (i === 1) paidLoanIds.push(loan.loan_id);
  });
  paidLoanIds.forEach((id) => {
    const fine = s.fines.find((f) => f.loan_id === id);
    if (fine) payFine(s, fine.fine_id, 'Card', 1, ago(29));
  });

  checkout(s, 1, 'book', 5, ago(5));
  checkout(s, 1, 'book', 2, ago(19));
  checkout(s, 1, 'book', 6, ago(25));
  checkout(s, 2, 'book', 3, ago(2));
  checkout(s, 2, 'media', 2, ago(4));
  checkout(s, 3, 'book', 14, ago(40));
  checkout(s, 4, 'book', 7, ago(3));
  checkout(s, 5, 'media', 4, ago(1));

  placeHold(s, 2, 'book', 7, ago(2));
  placeHold(s, 3, 'book', 7, ago(1));
  placeHold(s, 3, 'book', 6, t);

  s.reservations.push(
    { reservation_id: nextId(s, 'reservations'), room_id: 2, user_id: 2, start_time: `${ago(3)}T13:00`, end_time: `${ago(3)}T15:00` },
    { reservation_id: nextId(s, 'reservations'), room_id: 1, user_id: 1, start_time: `${addDays(t, 1)}T10:00`, end_time: `${addDays(t, 1)}T12:00` },
    { reservation_id: nextId(s, 'reservations'), room_id: 3, user_id: 3, start_time: `${addDays(t, 1)}T14:00`, end_time: `${addDays(t, 1)}T16:00` },
  );

  s.audit = [];
  log(s, 'seed', 'all tables', 'Demo data loaded.');
  return s;
}
