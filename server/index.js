import http from 'http';
import sql from 'mssql';
import { getSqlConfig } from './config.js';
import { listBooks } from './api/books.js';
import { listLoans } from './api/loans.js';
import { listMedia } from './api/media.js';
import { listRooms } from './api/rooms.js';
import { listMembers } from './api/members.js';
import { runQuery, runReport, listReportAuthors } from './api/reports.js';
import { login, signup } from './api/auth.js';

const port = Number(process.env.PORT) || 3000;
const allowedOrigins = new Set(['http://localhost','https://umas-library.vercel.app']);

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
    
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
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
        return;
    }
    else if (req.method === 'DELETE' && url.pathname.startsWith('/books')) {
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
        return;
    }
    else if (req.method === 'DELETE' && url.pathname.startsWith('/media')) {
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
        return;
    }
    else if (req.method === 'DELETE' && url.pathname.startsWith('/rooms')) {
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
    else if (req.method === 'GET' && url.pathname.startsWith('/holds')) {
        try {
            const database = await sql.connect(await getSqlConfig());
            const userId = url.searchParams.get('user_id');
            const activeOnly = url.searchParams.get('active_only') === 'true';
            const waitlist = await listWaitlist(database, { userId, activeOnly });
            const holds = await listWaitlist(database);
            res.writeHead(200, { 'Content-Type': 'application/json'});
            res.end(JSON.stringify(holds));
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


