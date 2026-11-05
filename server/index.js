/* import http from 'http';
import sql from 'mssql';
import { getSqlConfig } from './config.js';
import { listBooks, addBook, deleteBook, updateBook } from './api/books.js';
import { listAuthors, saveAuthor, deleteAuthor, updateAuthor } from './api/author.js';
import { listLoans } from './api/loans.js';
import { listMedia, addMedia, updateMedia, deleteMedia} from './api/media.js';
import { listRooms, saveRoom, updateRoom, deleteRoom } from './api/rooms.js';
import { listReservations, saveRoomReservation, cancelRoomReservation } from './api/reservations.js';
import { listMembers } from './api/members.js';
import { listStaff, saveStaff, deleteStaff } from './api/staff.js';
import { listFines } from './api/fines.js';
import { listWaitlist, placeHold } from './api/waitlist.js';
import { runQuery, runReport, listReportAuthors } from './api/reports.js';
import { login, signup } from './api/auth.js';
import { error } from 'console';

const port = Number(process.env.PORT) || 3000;
const allowedOrigins = new Set(['http://localhost', 'http://localhost:5173', 'https://umas-library.vercel.app']);

// Read a JSON request body (Vercel may have parsed it already)
async function readJson(req) {
    if (req.body !== undefined) {
        return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
    }
    let body = '';
    for await (const chunk of req) {
        body += chunk;
    }
    return body ? JSON.parse(body) : {};
}

// Create the server and handle requests
const server = http.createServer(async (req, res) => {
    let baseUrl = "http://localhost";
    const origin = req.headers.origin;

    if (origin && allowedOrigins.has(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        baseUrl = origin;
    }
    
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, baseUrl);

    // Route handlers for books
    if (req.method === 'GET' && url.pathname === '/books') {
        try {
            const database = await sql.connect(await getSqlConfig());
            const books = await listBooks(database, url.searchParams.get('search') || '');
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(books));
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error fetching books:', error);
            res.writeHead(status, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({ 
                error: status === 400
                    ? error.message
                    : 'An error occurred while fetching books.'
             }));
        }
        return;
    }
    else if (req.method === 'POST' && url.pathname === '/books') {
        try {
            const body = await readJson(req);
            const database = await sql.connect(await getSqlConfig());
            
            const book = await addBook(database, body);

            res.writeHead(201, { 'content-type': 'application/json' });
            res.end(JSON.stringify(book));
        } catch (error) {
            console.error('Error saving book:', error);

            const status = error.statusCode || 500;
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                error: status < 500 ? error.message : 'An error occurred while saving this book.'
            }));
        }

        return;
    }
    else if (req.method === 'PUT' && url.pathname.startsWith('/books/')) {
        const match = url.pathname.match(/^\/books\/(\d+)$/);

        if (!match) {
            res.writeHead(404, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'Book not found.' }));
            return;
        }
        try {
            const body = await readJson(req);
            const database = await sql.connect(await getSqlConfig());
            const book = { ...body, book_id: Number(match[1]) };

            await updateBook(database, book);

            res.writeHead(204);
            res.end();
        } catch (error) {
            console.error('Error updating book', error);

            const status = error.statusCode || 500;
            res.writeHead(status, { 'content-type': 'application/json'});
            res.end(JSON.stringify({
                error: status < 500 ? error.message : 'An error occurred while updating this book.'
            }));
        }

        return;
    }
    else if (req.method === 'PATCH' && url.pathname.startsWith('/books/')) {
        const match = url.pathname.match(/^\/books\/(\d+)$/);

        if (!match) {
            res.writeHead(404, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'Book not found.' }));
            return;
        }

        const book_id = Number(match[1]);
        
        try {
            const database = await sql.connect(await getSqlConfig());

            await deleteBook(database, book_id);

            res.writeHead(204);
            res.end();
        } catch (error) {
            console.error('Error deleting book', error);

            const status = error.statusCode || 500;
            res.writeHead(status, { 'content-type': 'application/json'});
            res.end(JSON.stringify({
                error: status < 500 ? error.message : 'An error occurred while deleting this book.'
            }));
        }  
        return;
    }

    // Route handlers for authors
    else if (req.method === 'GET' && url.pathname === '/authors') {
        try {
            const database = await sql.connect(await getSqlConfig());
            const books = await listAuthors(database, url.searchParams.get('search') || '');
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(books));
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error fetching authors:', error);
            res.writeHead(status, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({ 
                error: status === 400
                    ? error.message
                    : 'An error occurred while fetching books.'
             }));
        }
        return;
    }
    else if (req.method === 'POST' && url.pathname === '/authors') {
        try {
            const body = await readJson(req);
            const database = await sql.connect(await getSqlConfig());

            const author = await saveAuthor(database, body);

            res.writeHead(201, { 'content-type': 'application/json' });
            res.end(JSON.stringify(author));
        } catch (error) {
            console.error('Error saving author:', error);

            const status = error.statusCode || 500;
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                error: status < 500 ? error.message : 'An error occurred while saving this author.'
            }));
        }

        return;
    }
    else if (req.method === 'PUT' && url.pathname.startsWith('/authors/')) {
        const match = url.pathname.match(/^\/authors\/(\d+)$/);

        if (!match) {
            res.writeHead(404, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'Author not found.' }));
            return;
        }

        const author_id = Number(match[1]);

        try {
            const body = await readJson(req);
            const database = await sql.connect(await getSqlConfig());

            await updateAuthor(database, author_id, body);

            res.writeHead(204);
            res.end();
        } catch (error) {
            console.error('Error updating author:', error);
            const status = error.statusCode || 500;
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                error: status < 500 ? error.message : 'An error occurred while updating this author.'
            }));
        }

        return;
    }
    else if (req.method === 'DELETE' && url.pathname.startsWith('/authors/')) {
        const match = url.pathname.match(/^\/authors\/(\d+)$/);
        
        if (!match) {
            res.writeHead(404, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'Author not found.' }));
            return;
        }

        const author_id = Number(match[1]);

        try {
            const database = await sql.connect(await getSqlConfig());
            await deleteAuthor(database, author_id);

            res.writeHead(204);
            res.end();
        } catch (error) {
            console.error('Error deleting author:', error);
            const status = error.statusCode || 500;
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                error: status < 500 ? error.message : 'An error occurred while deleting this author.'
            }));
        }
    }

    // Route handlers for media
    else if (req.method === 'GET' && url.pathname === '/media') {
        try {
            const database = await sql.connect(await getSqlConfig());
            const media = await listMedia(database, url.searchParams.get('search') || '');
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(media));
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error fetching media:', error);
            res.writeHead(status, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({ 
                error: status === 400
                    ? error.message
                    : 'An error occurred while fetching media.'
             }));
        }
        return;
    }
    else if (req.method === 'POST' && url.pathname === '/media') {
        try {
            const body = await readJson(req);
            const database = await sql.connect(await getSqlConfig());

            const media = await addMedia(database, body);

            res.writeHead(201, { 'content-type': 'application/json' });
            res.end(JSON.stringify(media));
        } catch (error) {
            console.error('Error saving media:', error);
            const status = error.statusCode || 500;
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                error: status < 500 ? error.message : 'An error occurred while saving this media.'
            }));

        }
        return;
    }
    else if (req.method === 'PUT' && url.pathname.startsWith('/media/')) {
        const match = url.pathname.match(/^\/media\/(\d+)$/);

        if (!match) {
            res.writeHead(404, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'Media not found.' }));
            return;
        }

        const media_id = Number(match[1]);

        try {
            const body = await readJson(req);
            const database = await sql.connect(await getSqlConfig());

            await updateMedia(database, media_id, body);

            res.writeHead(204);
            res.end();
        } catch (error) {
            console.error('Error updating media:', error);
            const status = error.statusCode || 500;
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                error: status < 500 ? error.message : 'An error occurred while updating this media.'
            }));
        }

        return;
    }
    else if (req.method === 'PATCH' && url.pathname.startsWith('/media/')) {
        const match = url.pathname.match(/^\/media\/(\d+)$/);
        if (!match) {
            res.writeHead(404, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'Media not found.' }));
            return;
        }

        const media_id = Number(match[1]);

        try {
            const database = await sql.connect(await getSqlConfig());

            await deleteMedia(database, media_id);

            res.writeHead(204);
            res.end();
        } catch (error) {
            console.error('Error deleting media:', error);
            const status = error.statusCode || 500;
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                error: status < 500 ? error.message : 'An error occurred while deleting this media.'
            }));
        }

        return;
    }

    // Route handlers for loans
    else if (req.method === 'GET' && url.pathname === '/loans') {
        try {
            const database = await sql.connect(await getSqlConfig());
            const userId = url.searchParams.get('user_id');

            const loans = await listLoans(database, {
                userId: userId === null ? undefined : Number(userId),
            });
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(loans));
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error fetching loans:', error);
            res.writeHead(status, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                error: status === 400
                    ? error.message
                    : 'An error occurred while fetching loans.'
            }));
        }
        return;
    }
    else if (req.method === 'POST' && url.pathname === '/loans') {
        return;
    }
    else if (req.method === 'DELETE' && url.pathname.startsWith('/loans')) {
        return;
    }
        
    // Route handlers for rooms
    else if (req.method === 'GET' && url.pathname === '/rooms') {
        try {
            const database = await sql.connect(await getSqlConfig());
            const rooms = await listRooms(database, url.searchParams.get('search') || '');
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(rooms));
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error fetching rooms:', error);
            res.writeHead(status, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                error: status === 400
                    ? error.message
                    : 'An error occurred while fetching rooms.'
            }));
        }
        return;
    }
    else if (req.method === 'POST' && url.pathname === '/rooms') {
        try {
            const body = await readJson(req);
            const database = await sql.connect(await getSqlConfig());

            const room = await saveRoom(database, body);

            res.writeHead(201, { 'content-type': 'application/json' });
            res.end(JSON.stringify(room));
        } catch (error) {
            console.error('Error saving room:', error);
            const status = error.statusCode || 500;
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                error: status < 500 ? error.message : 'An error occurred while saving this room.'
            }));
        }

        return;
    }
    else if (req.method === 'PUT' && url.pathname.startsWith('/rooms/')) {
        const match = url.pathname.match(/^\/rooms\/(\d+)$/);

        if (!match) {
            res.writeHead(404, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'Room not found.' }));
            return;
        }

        const room_id = Number(match[1]);

        try {
            const body = await readJson(req);
            const database = await sql.connect(await getSqlConfig());

            await updateRoom(database, room_id, body);

            res.writeHead(204);
            res.end();
        } catch (error) {
            console.error('Error updating room:', error);
            const status = error.statusCode || 500;
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                error: status < 500 ? error.message : 'An error occurred while updating the room.'
            }));
        }

        return;
    }
    else if (req.method === 'PATCH' && url.pathname.startsWith('/rooms/')) {
        const match = url.pathname.match(/^\/rooms\/(\d+)$/);
        
        if (!match) {
            res.writeHead(404, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'Room not found.' }));
            return;
        }

        const room_id = Number(match[1]);

        try {
            const database = await sql.connect(await getSqlConfig());

            await deleteRoom(database, room_id);

            res.writeHead(204);
            res.end();
        } catch (error) {
            console.error('Error deleting room:', error);
            const status = error.statusCode || 500;
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                error: status < 500 ? error.message : 'An error occurred while deleting this media.'
            }));
        }

        return;
    }

    // Route handlers for reservations
    else if (req.method === 'GET' && url.pathname === '/reservations') {
        const rawUserId = url.searchParams.get('user_id');
        const userId = rawUserId === null ? undefined : Number(rawUserId);

        try {
            const database = await sql.connect(await getSqlConfig());
            const reservations = await listReservations(database, userId);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(reservations));
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error fetching reservations:', error);
            res.writeHead(status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'An error occurred while fetching reservations.' }));
        }

        return;
    }
    else if (req.method === 'POST' && url.pathname === '/reservations') {
        try {
            const body = await readJson(req);
            body.reservation_id = null; // Ensure reservation_id is null for new reservations

            const database = await sql.connect(await getSqlConfig());
            await saveRoomReservation(database, body);
            
            res.writeHead(201);
            res.end();
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error creating reservation:', error);
            res.writeHead(status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'An error occurred while creating the reservation.' }));
        }

        return;
    }
    else if (req.method === 'PATCH' && url.pathname.startsWith('/reservations/')) {
        const match = url.pathname.match(/^\/reservations\/(\d+)$/);
        if (!match) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Reservation not found.' }));
            return;
        }

        try {
            const database = await sql.connect(await getSqlConfig());
            const reservation_id = Number(match[1]);
            await cancelRoomReservation(database, reservation_id);

            res.writeHead(204);
            res.end();
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error cancelling reservation:', error);
            res.writeHead(status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'An error occurred while cancelling the reservation.' }));
        }
        return;
    }
    // Route handlers for members
    else if (req.method === 'GET' && url.pathname === '/members') {
        try {
            const database = await sql.connect(await getSqlConfig());
            const members = await listMembers(database);
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(members));
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error fetching members:', error);
            res.writeHead(status, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                error: status === 400
                    ? error.message
                    : 'An error occurred while fetching members.'
            }));
        }
        return;
    }
    else if (req.method === 'POST' && url.pathname === '/members') {
        return;
    }
    else if (req.method === 'DELETE' && url.pathname.startsWith('/members')) {
        return;
    }

    // Route handlers for staff
    else if (req.method === 'GET' && url.pathname === '/staff') {
        try {
            const database = await sql.connect(await getSqlConfig());
            const staff = await listStaff(database);
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(staff));
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error fetching staff:', error);
            res.writeHead(status, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                error: status === 400
                    ? error.message
                    : 'An error occurred while fetching staff.'
            }));
        }
        return;
    }
    
    else if (req.method === 'GET' && url.pathname === '/report-authors') {
        try {
            const database = await sql.connect(await getSqlConfig());
            const authors = await listReportAuthors(database);
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(authors));
        } catch (error) {
            console.error('Error fetching authors:', error);
            res.writeHead(500, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({ error: 'An error occurred while fetching authors.' }));
        }
        return;
    }
    else if (req.method === 'GET' && url.pathname.startsWith('/queries/')) {
        try {
            const database = await sql.connect(await getSqlConfig());
            const id = url.pathname.slice('/queries/'.length);
            const table = await runQuery(database, id, Object.fromEntries(url.searchParams));
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(table));
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error running query:', error);
            res.writeHead(status, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                error: status === 400
                    ? error.message
                    : 'An error occurred while running the query.'
            }));
        }
        return;
    }
    else if (req.method === 'GET' && url.pathname.startsWith('/reports/')) {
        try {
            const database = await sql.connect(await getSqlConfig());
            const id = url.pathname.slice('/reports/'.length);
            const report = await runReport(database, id, Object.fromEntries(url.searchParams));
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(report));
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error running report:', error);
            res.writeHead(status, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                error: status === 400
                    ? error.message
                    : 'An error occurred while running the report.'
            }));
        }
        return;
    }
        //added
    else if (req.method === 'POST' && url.pathname === '/holds') {
    try {
        const database = await sql.connect(await getSqlConfig());
        const body = await readJson(req);
        const hold = await placeHold(database, body);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(hold));
    } catch (error) {
        const status = error.statusCode || 500;
        console.error('Error placing hold:', error);
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: status === 400 ? error.message : 'An error occurred while placing the hold.' }));
    }
    return;
    }
    else if (req.method === 'GET' && url.pathname.startsWith('/holds')) {
        try {
            const database = await sql.connect(await getSqlConfig());
            const userId = url.searchParams.get('user_id');
            const activeOnly = url.searchParams.get('active_only') === 'true';
            const waitlist = await listWaitlist(database, { userId, activeOnly });
          //  const holds = await listWaitlist(database);
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(waitlist));
        }catch(error){
            const status = error.statusCode || 500;
            console.error('Error listing waitlist:', error);
            res.writeHead(status, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                error: status === 400
                    ? error.message
                    : 'An error occurred while listing the waitlist.'
            }));
        }
        return;
    }
    else if (req.method === 'GET' && url.pathname.startsWith('/fines')) {
        try {
            const database = await sql.connect(await getSqlConfig());
            const userId = url.searchParams.get('user_id');
            const activeOnly = url.searchParams.get('active_only') === 'true';
            const fines = await listFines(database, { userId, activeOnly });
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(fines));
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error listing fines:', error);
            res.writeHead(status, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                error: status === 400
                    ? error.message
                    : 'An error occurred while listing the fines.'
            }));
        }
        return;
    }
    else if (req.method === 'POST' && url.pathname === '/login') {
        try {
            const database = await sql.connect(await getSqlConfig());
            const body = await readJson(req);
            const session = await login(database, body.email, body.password);
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(session));
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error logging in:', error);
            res.writeHead(status, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                error: status === 400
                    ? error.message
                    : 'An error occurred while logging in.'
            }));
        }
        return;
    }
    else if (req.method === 'POST' && url.pathname === '/signup') {
        try {
            const database = await sql.connect(await getSqlConfig());
            const body = await readJson(req);
            const session = await signup(database, body);
            res.writeHead(201, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(session));
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error signing up:', error);
            res.writeHead(status, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                error: status === 400
                    ? error.message
                    : 'An error occurred while creating the account.'
            }));
        }
        return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Route not found' }));
});


server.listen(port, () => {
    console.log(`Server started on port ${port}`);
});
*/

import http from 'http';
import sql from 'mssql';
import jwt from 'jsonwebtoken';
import { getSqlConfig } from './config.js';
import { listBooks, addBook, deleteBook, updateBook } from './api/books.js';
import { listAuthors, saveAuthor, deleteAuthor, updateAuthor } from './api/author.js';
import { listLoans, checkout, returnLoan } from './api/loans.js';
import { listMedia, addMedia, updateMedia, deleteMedia} from './api/media.js';
import { listRooms, saveRoom, updateRoom, deleteRoom } from './api/rooms.js';
import { listReservations, saveRoomReservation, cancelRoomReservation, reservationOwner } from './api/reservations.js';
import { listMembers, saveMember, updateMember, deleteMember } from './api/members.js';
import { listStaff, saveStaff, updateStaff, deleteStaff } from './api/staff.js';
import { listFines, payFine } from './api/fines.js';
import { listWaitlist, placeHold, cancelHold, expireHolds, holdOwner } from './api/waitlist.js';
import { runQuery, runReport, listReportAuthors } from './api/reports.js';
import { login } from './api/auth.js';
import { listAudit } from './api/audit.js';
import { dashboardStats } from './api/stats.js';
import { listNotifications, unreadCount, markRead } from './api/notifications.js';
import { listReceipts } from './api/receipts.js';

const port = Number(process.env.PORT) || 3000;
const allowedOrigins = new Set(['http://localhost', 'http://localhost:5173', 'https://umas-library.vercel.app']);

// Read a JSON request body (Vercel may have parsed it already)
async function readJson(req) {
    if (req.body !== undefined) {
        return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
    }
    let body = '';
    for await (const chunk of req) {
        body += chunk;
    }
    return body ? JSON.parse(body) : {};
}

const STAFF = ['employee', 'admin'];

function currentUser(req) {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) {
        return null;
    }
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return null;
    }
}

// Who may call a route; null means anyone who is signed in
function allowedRoles(method, path) {
    if (/^\/(staff|audit|queries|reports|report-authors)(\/|$)/.test(path)) return ['admin'];
    if (method === 'POST' && path === '/members') return ['admin'];
    if (/^\/(members|stats)(\/|$)/.test(path)) return STAFF;
    if (method !== 'GET' && /^\/(books|authors|media|rooms)(\/|$)/.test(path)) return STAFF;
    if (method === 'POST' && /^\/(loans(\/\d+\/return)?|fines\/\d+\/pay|holds\/expire)$/.test(path)) return STAFF;
    return null;
}

// Members can only read and change their own records
function assertSelf(user, userId) {
    if (!STAFF.includes(user.role) && Number(userId) !== user.id) {
        throw Object.assign(new Error('You can only view your own records.'), { statusCode: 403 });
    }
}

// Messages thrown by our procedures and triggers are written for the user
function describeError(error, fallback) {
    const number = error.number ?? error.originalError?.info?.number;
    if (number >= 50000) {
        return { status: 400, message: error.message };
    }
    if (number === 2601 || number === 2627) {
        return { status: 409, message: 'That value is already in use.' };
    }
    const status = error.statusCode || 500;
    return { status, message: status < 500 ? error.message : fallback };
}

// Connect, run a handler, and send its result (204 when it has none)
async function respond(res, successStatus, fallback, handler) {
    try {
        const database = await sql.connect(await getSqlConfig());
        const data = await handler(database);
        if (data === undefined) {
            res.writeHead(204);
            res.end();
            return;
        }
        res.writeHead(successStatus, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    } catch (error) {
        console.error(fallback, error);
        const { status, message } = describeError(error, fallback);
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: message }));
    }
}

// Create the server and handle requests
const server = http.createServer(async (req, res) => {
    let baseUrl = "http://localhost";
    const origin = req.headers.origin;

    if (origin && allowedOrigins.has(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        baseUrl = origin;
    }
    
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, baseUrl);

    let user = null;
    if (!(req.method === 'POST' && url.pathname === '/login')) {
        user = currentUser(req);
        const roles = allowedRoles(req.method, url.pathname);

        if (!user || (roles && !roles.includes(user.role))) {
            res.writeHead(user ? 403 : 401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: user ? 'You do not have access to this.' : 'Please sign in.' }));
            return;
        }
    }

    // Route handlers for books
    if (req.method === 'GET' && url.pathname === '/books') {
        try {
            const database = await sql.connect(await getSqlConfig());
            const books = await listBooks(database, url.searchParams.get('search') || '');
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(books));
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error fetching books:', error);
            res.writeHead(status, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({ 
                error: status === 400
                    ? error.message
                    : 'An error occurred while fetching books.'
             }));
        }
        return;
    }
    else if (req.method === 'POST' && url.pathname === '/books') {
        try {
            const body = await readJson(req);
            const database = await sql.connect(await getSqlConfig());
            
            const book = await addBook(database, body);

            res.writeHead(201, { 'content-type': 'application/json' });
            res.end(JSON.stringify(book));
        } catch (error) {
            console.error('Error saving book:', error);

            const { status, message } = describeError(error, 'An error occurred while saving this book.');
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: message }));
        }

        return;
    }
    else if (req.method === 'PUT' && url.pathname.startsWith('/books/')) {
        const match = url.pathname.match(/^\/books\/(\d+)$/);

        if (!match) {
            res.writeHead(404, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'Book not found.' }));
            return;
        }
        try {
            const body = await readJson(req);
            const database = await sql.connect(await getSqlConfig());
            const book = { ...body, book_id: Number(match[1]) };

            await updateBook(database, book);

            res.writeHead(204);
            res.end();
        } catch (error) {
            console.error('Error updating book', error);

            const status = error.statusCode || 500;
            res.writeHead(status, { 'content-type': 'application/json'});
            res.end(JSON.stringify({
                error: status < 500 ? error.message : 'An error occurred while updating this book.'
            }));
        }

        return;
    }
    else if (req.method === 'PATCH' && url.pathname.startsWith('/books/')) {
        const match = url.pathname.match(/^\/books\/(\d+)$/);

        if (!match) {
            res.writeHead(404, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'Book not found.' }));
            return;
        }

        const book_id = Number(match[1]);
        
        try {
            const database = await sql.connect(await getSqlConfig());

            await deleteBook(database, book_id);

            res.writeHead(204);
            res.end();
        } catch (error) {
            console.error('Error deleting book', error);

            const status = error.statusCode || 500;
            res.writeHead(status, { 'content-type': 'application/json'});
            res.end(JSON.stringify({
                error: status < 500 ? error.message : 'An error occurred while deleting this book.'
            }));
        }  
        return;
    }

    // Route handlers for authors
    else if (req.method === 'GET' && url.pathname === '/authors') {
        try {
            const database = await sql.connect(await getSqlConfig());
            const books = await listAuthors(database, url.searchParams.get('search') || '');
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(books));
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error fetching authors:', error);
            res.writeHead(status, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({ 
                error: status === 400
                    ? error.message
                    : 'An error occurred while fetching books.'
             }));
        }
        return;
    }
    else if (req.method === 'POST' && url.pathname === '/authors') {
        try {
            const body = await readJson(req);
            const database = await sql.connect(await getSqlConfig());

            const author = await saveAuthor(database, body);

            res.writeHead(201, { 'content-type': 'application/json' });
            res.end(JSON.stringify(author));
        } catch (error) {
            console.error('Error saving author:', error);

            const status = error.statusCode || 500;
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                error: status < 500 ? error.message : 'An error occurred while saving this author.'
            }));
        }

        return;
    }
    else if (req.method === 'PUT' && url.pathname.startsWith('/authors/')) {
        const match = url.pathname.match(/^\/authors\/(\d+)$/);

        if (!match) {
            res.writeHead(404, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'Author not found.' }));
            return;
        }

        const author_id = Number(match[1]);

        try {
            const body = await readJson(req);
            const database = await sql.connect(await getSqlConfig());

            await updateAuthor(database, author_id, body);

            res.writeHead(204);
            res.end();
        } catch (error) {
            console.error('Error updating author:', error);
            const status = error.statusCode || 500;
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                error: status < 500 ? error.message : 'An error occurred while updating this author.'
            }));
        }

        return;
    }
    else if (req.method === 'DELETE' && url.pathname.startsWith('/authors/')) {
        const match = url.pathname.match(/^\/authors\/(\d+)$/);
        
        if (!match) {
            res.writeHead(404, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'Author not found.' }));
            return;
        }

        const author_id = Number(match[1]);

        try {
            const database = await sql.connect(await getSqlConfig());
            await deleteAuthor(database, author_id);

            res.writeHead(204);
            res.end();
        } catch (error) {
            console.error('Error deleting author:', error);
            const status = error.statusCode || 500;
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                error: status < 500 ? error.message : 'An error occurred while deleting this author.'
            }));
        }

        return;
    }

    // Route handlers for media
    else if (req.method === 'GET' && url.pathname === '/media') {
        try {
            const database = await sql.connect(await getSqlConfig());
            const media = await listMedia(database, url.searchParams.get('search') || '');
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(media));
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error fetching media:', error);
            res.writeHead(status, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({ 
                error: status === 400
                    ? error.message
                    : 'An error occurred while fetching media.'
             }));
        }
        return;
    }
    else if (req.method === 'POST' && url.pathname === '/media') {
        try {
            const body = await readJson(req);
            const database = await sql.connect(await getSqlConfig());

            const media = await addMedia(database, body);

            res.writeHead(201, { 'content-type': 'application/json' });
            res.end(JSON.stringify(media));
        } catch (error) {
            console.error('Error saving media:', error);
            const status = error.statusCode || 500;
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                error: status < 500 ? error.message : 'An error occurred while saving this media.'
            }));

        }
        return;
    }
    else if (req.method === 'PUT' && url.pathname.startsWith('/media/')) {
        const match = url.pathname.match(/^\/media\/(\d+)$/);

        if (!match) {
            res.writeHead(404, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'Media not found.' }));
            return;
        }

        const media_id = Number(match[1]);

        try {
            const body = await readJson(req);
            const database = await sql.connect(await getSqlConfig());

            await updateMedia(database, media_id, body);

            res.writeHead(204);
            res.end();
        } catch (error) {
            console.error('Error updating media:', error);
            const status = error.statusCode || 500;
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                error: status < 500 ? error.message : 'An error occurred while updating this media.'
            }));
        }

        return;
    }
    else if (req.method === 'PATCH' && url.pathname.startsWith('/media/')) {
        const match = url.pathname.match(/^\/media\/(\d+)$/);
        if (!match) {
            res.writeHead(404, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'Media not found.' }));
            return;
        }

        const media_id = Number(match[1]);

        try {
            const database = await sql.connect(await getSqlConfig());

            await deleteMedia(database, media_id);

            res.writeHead(204);
            res.end();
        } catch (error) {
            console.error('Error deleting media:', error);
            const status = error.statusCode || 500;
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                error: status < 500 ? error.message : 'An error occurred while deleting this media.'
            }));
        }

        return;
    }

    // Route handlers for loans
    else if (req.method === 'GET' && url.pathname === '/loans') {
        try {
            const database = await sql.connect(await getSqlConfig());
            const userId = url.searchParams.get('user_id');
            assertSelf(user, userId);

            const loans = await listLoans(database, {
                userId: userId === null ? undefined : Number(userId),
                activeOnly: url.searchParams.get('active_only') === 'true',
            });
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(loans));
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error fetching loans:', error);
            res.writeHead(status, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                error: status === 400
                    ? error.message
                    : 'An error occurred while fetching loans.'
            }));
        }
        return;
    }
    else if (req.method === 'POST' && url.pathname === '/loans') {
        return respond(res, 201, 'An error occurred while checking out this item.', async (database) => {
            const body = await readJson(req);
            return checkout(database, body);
        });
    }
    else if (req.method === 'POST' && /^\/loans\/\d+\/return$/.test(url.pathname)) {
        const loanId = Number(url.pathname.split('/')[2]);
        return respond(res, 200, 'An error occurred while returning this item.', (database) => returnLoan(database, loanId));
    }
        
    // Route handlers for rooms
    else if (req.method === 'GET' && url.pathname === '/rooms') {
        try {
            const database = await sql.connect(await getSqlConfig());
            const rooms = await listRooms(database, url.searchParams.get('search') || '');
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(rooms));
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error fetching rooms:', error);
            res.writeHead(status, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                error: status === 400
                    ? error.message
                    : 'An error occurred while fetching rooms.'
            }));
        }
        return;
    }
    else if (req.method === 'POST' && url.pathname === '/rooms') {
        try {
            const body = await readJson(req);
            const database = await sql.connect(await getSqlConfig());

            const room = await saveRoom(database, body);

            res.writeHead(201, { 'content-type': 'application/json' });
            res.end(JSON.stringify(room));
        } catch (error) {
            console.error('Error saving room:', error);
            const { status, message } = describeError(error, 'An error occurred while saving this room.');
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: message }));
        }

        return;
    }
    else if (req.method === 'PUT' && url.pathname.startsWith('/rooms/')) {
        const match = url.pathname.match(/^\/rooms\/(\d+)$/);

        if (!match) {
            res.writeHead(404, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'Room not found.' }));
            return;
        }

        const room_id = Number(match[1]);

        try {
            const body = await readJson(req);
            const database = await sql.connect(await getSqlConfig());

            await updateRoom(database, room_id, body);

            res.writeHead(204);
            res.end();
        } catch (error) {
            console.error('Error updating room:', error);
            const status = error.statusCode || 500;
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                error: status < 500 ? error.message : 'An error occurred while updating the room.'
            }));
        }

        return;
    }
    else if (req.method === 'PATCH' && url.pathname.startsWith('/rooms/')) {
        const match = url.pathname.match(/^\/rooms\/(\d+)$/);
        
        if (!match) {
            res.writeHead(404, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'Room not found.' }));
            return;
        }

        const room_id = Number(match[1]);

        try {
            const database = await sql.connect(await getSqlConfig());

            await deleteRoom(database, room_id);

            res.writeHead(204);
            res.end();
        } catch (error) {
            console.error('Error deleting room:', error);
            const status = error.statusCode || 500;
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                error: status < 500 ? error.message : 'An error occurred while deleting this media.'
            }));
        }

        return;
    }

    // Route handlers for reservations
    else if (req.method === 'GET' && url.pathname === '/reservations') {
        const rawUserId = url.searchParams.get('user_id');
        const userId = rawUserId === null ? undefined : Number(rawUserId);

        try {
            assertSelf(user, rawUserId);
            const database = await sql.connect(await getSqlConfig());
            const reservations = await listReservations(database, userId);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(reservations));
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error fetching reservations:', error);
            res.writeHead(status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'An error occurred while fetching reservations.' }));
        }

        return;
    }
    else if (req.method === 'POST' && url.pathname === '/reservations') {
        try {
            const body = await readJson(req);
            body.reservation_id = null; // Ensure reservation_id is null for new reservations
            assertSelf(user, body.userId);

            const database = await sql.connect(await getSqlConfig());
            await saveRoomReservation(database, body);
            
            res.writeHead(201);
            res.end();
        } catch (error) {
            console.error('Error creating reservation:', error);
            const { status, message } = describeError(error, 'An error occurred while creating the reservation.');
            res.writeHead(status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: message }));
        }

        return;
    }
    else if (req.method === 'PATCH' && url.pathname.startsWith('/reservations/')) {
        const match = url.pathname.match(/^\/reservations\/(\d+)$/);
        if (!match) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Reservation not found.' }));
            return;
        }

        try {
            const database = await sql.connect(await getSqlConfig());
            const reservation_id = Number(match[1]);
            assertSelf(user, await reservationOwner(database, reservation_id));
            await cancelRoomReservation(database, reservation_id);

            res.writeHead(204);
            res.end();
        } catch (error) {
            console.error('Error cancelling reservation:', error);
            const { status, message } = describeError(error, 'An error occurred while cancelling the reservation.');
            res.writeHead(status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: message }));
        }
        return;
    }
    // Route handlers for members
    else if (req.method === 'GET' && url.pathname === '/members') {
        try {
            const database = await sql.connect(await getSqlConfig());
            const members = await listMembers(database);
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(members));
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error fetching members:', error);
            res.writeHead(status, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                error: status === 400
                    ? error.message
                    : 'An error occurred while fetching members.'
            }));
        }
        return;
    }
    else if (req.method === 'POST' && url.pathname === '/members') {
        return respond(res, 201, 'An error occurred while saving this member.', async (database) => {
            const body = await readJson(req);
            return saveMember(database, body);
        });
    }
    else if (req.method === 'PUT' && /^\/members\/\d+$/.test(url.pathname)) {
        const userId = Number(url.pathname.split('/')[2]);
        return respond(res, 204, 'An error occurred while updating this member.', async (database) => {
            const body = await readJson(req);
            return updateMember(database, userId, body);
        });
    }
    else if (req.method === 'PATCH' && /^\/members\/\d+$/.test(url.pathname)) {
        const userId = Number(url.pathname.split('/')[2]);
        return respond(res, 204, 'An error occurred while deactivating this member.', (database) => deleteMember(database, userId));
    }

    // Route handlers for staff
    else if (req.method === 'GET' && url.pathname === '/staff') {
        try {
            const database = await sql.connect(await getSqlConfig());
            const staff = await listStaff(database);
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(staff));
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error fetching staff:', error);
            res.writeHead(status, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                error: status === 400
                    ? error.message
                    : 'An error occurred while fetching staff.'
            }));
        }
        return;
    }
    
    else if (req.method === 'POST' && url.pathname === '/staff') {
        return respond(res, 201, 'An error occurred while saving this staff member.', async (database) => {
            const body = await readJson(req);
            return saveStaff(database, body);
        });
    }
    else if (req.method === 'PUT' && /^\/staff\/\d+$/.test(url.pathname)) {
        const staffId = Number(url.pathname.split('/')[2]);
        return respond(res, 204, 'An error occurred while updating this staff member.', async (database) => {
            const body = await readJson(req);
            return updateStaff(database, staffId, body);
        });
    }
    else if (req.method === 'PATCH' && /^\/staff\/\d+$/.test(url.pathname)) {
        const staffId = Number(url.pathname.split('/')[2]);
        return respond(res, 204, 'An error occurred while deactivating this staff member.', (database) => deleteStaff(database, staffId));
    }

    // Route handlers for the audit log and dashboard
    else if (req.method === 'GET' && url.pathname === '/audit') {
        return respond(res, 200, 'An error occurred while fetching the audit log.', listAudit);
    }
    else if (req.method === 'GET' && url.pathname === '/stats') {
        return respond(res, 200, 'An error occurred while fetching dashboard stats.', dashboardStats);
    }

    // Route handlers for notifications
    else if (req.method === 'GET' && url.pathname === '/notifications') {
        const userId = Number(url.searchParams.get('user_id'));
        return respond(res, 200, 'An error occurred while fetching notifications.', (database) => {
            assertSelf(user, userId);
            return listNotifications(database, userId);
        });
    }
    else if (req.method === 'GET' && url.pathname === '/notifications/unread') {
        const userId = Number(url.searchParams.get('user_id'));
        return respond(res, 200, 'An error occurred while fetching the notification count.', (database) => {
            assertSelf(user, userId);
            return unreadCount(database, userId);
        });
    }
    else if (req.method === 'POST' && url.pathname === '/notifications/read') {
        return respond(res, 204, 'An error occurred while updating notifications.', async (database) => {
            const body = await readJson(req);
            assertSelf(user, body.userId);
            return markRead(database, Number(body.userId));
        });
    }

    // Route handlers for receipts
    else if (req.method === 'GET' && url.pathname === '/receipts') {
        const rawUserId = url.searchParams.get('user_id');
        return respond(res, 200, 'An error occurred while fetching receipts.', (database) => {
            assertSelf(user, rawUserId);
            return listReceipts(database, {
                userId: rawUserId === null ? undefined : Number(rawUserId),
                search: url.searchParams.get('search') || '',
            });
        });
    }
    
    else if (req.method === 'GET' && url.pathname === '/report-authors') {
        try {
            const database = await sql.connect(await getSqlConfig());
            const authors = await listReportAuthors(database);
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(authors));
        } catch (error) {
            console.error('Error fetching authors:', error);
            res.writeHead(500, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({ error: 'An error occurred while fetching authors.' }));
        }
        return;
    }
    else if (req.method === 'GET' && url.pathname.startsWith('/queries/')) {
        try {
            const database = await sql.connect(await getSqlConfig());
            const id = url.pathname.slice('/queries/'.length);
            const table = await runQuery(database, id, Object.fromEntries(url.searchParams));
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(table));
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error running query:', error);
            res.writeHead(status, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                error: status === 400
                    ? error.message
                    : 'An error occurred while running the query.'
            }));
        }
        return;
    }
    else if (req.method === 'GET' && url.pathname.startsWith('/reports/')) {
        try {
            const database = await sql.connect(await getSqlConfig());
            const id = url.pathname.slice('/reports/'.length);
            const report = await runReport(database, id, Object.fromEntries(url.searchParams));
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(report));
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error running report:', error);
            res.writeHead(status, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                error: status === 400
                    ? error.message
                    : 'An error occurred while running the report.'
            }));
        }
        return;
    }
        //added
    else if (req.method === 'POST' && url.pathname === '/holds') {
    try {
        const database = await sql.connect(await getSqlConfig());
        const body = await readJson(req);
        assertSelf(user, body.userId);
        const hold = await placeHold(database, body);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(hold));
    } catch (error) {
        console.error('Error placing hold:', error);
        const { status, message } = describeError(error, 'An error occurred while placing the hold.');
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: message }));
    }
    return;
    }
    else if (req.method === 'POST' && url.pathname === '/holds/expire') {
        return respond(res, 200, 'An error occurred while expiring holds.', expireHolds);
    }
    else if (req.method === 'POST' && /^\/holds\/\d+\/cancel$/.test(url.pathname)) {
        const holdId = Number(url.pathname.split('/')[2]);
        return respond(res, 200, 'An error occurred while cancelling the hold.', async (database) => {
            assertSelf(user, await holdOwner(database, holdId));
            return cancelHold(database, holdId);
        });
    }
    else if (req.method === 'GET' && url.pathname.startsWith('/holds')) {
        try {
            const database = await sql.connect(await getSqlConfig());
            const userId = url.searchParams.get('user_id');
            assertSelf(user, userId);
            const activeOnly = url.searchParams.get('active_only') === 'true';
            const waitlist = await listWaitlist(database, { userId, activeOnly });
          //  const holds = await listWaitlist(database);
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(waitlist));
        }catch(error){
            const status = error.statusCode || 500;
            console.error('Error listing waitlist:', error);
            res.writeHead(status, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                error: status === 400
                    ? error.message
                    : 'An error occurred while listing the waitlist.'
            }));
        }
        return;
    }
    else if (req.method === 'POST' && /^\/fines\/\d+\/pay$/.test(url.pathname)) {
        const fineId = Number(url.pathname.split('/')[2]);
        return respond(res, 200, 'An error occurred while recording the payment.', async (database) => {
            const body = await readJson(req);
            return payFine(database, fineId, { method: body.method, staffId: user.id });
        });
    }
    else if (req.method === 'GET' && url.pathname.startsWith('/fines')) {
        try {
            const database = await sql.connect(await getSqlConfig());
            const userId = url.searchParams.get('user_id');
            assertSelf(user, userId);
            const fines = await listFines(database, { userId });
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(fines));
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error listing fines:', error);
            res.writeHead(status, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                error: status === 400
                    ? error.message
                    : 'An error occurred while listing the fines.'
            }));
        }
        return;
    }
    else if (req.method === 'POST' && url.pathname === '/login') {
        try {
            const database = await sql.connect(await getSqlConfig());
            const body = await readJson(req);
            const session = await login(database, body.email, body.password);
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(session));
        } catch (error) {
            const status = error.statusCode || 500;
            console.error('Error logging in:', error);
            res.writeHead(status, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                error: status === 400
                    ? error.message
                    : 'An error occurred while logging in.'
            }));
        }
        return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Route not found' }));
});


server.listen(port, () => {
    console.log(`Server started on port ${port}`);
});


