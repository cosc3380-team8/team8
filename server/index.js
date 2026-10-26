import http from 'http';
import sql from 'mssql';
import { getSqlConfig } from './config.js';
import { listBooks } from './api/books.js';
import { listLoans } from './api/loans.js';
import { listMedia } from './api/media.js';
import { listRooms } from './api/rooms.js';
import { listMembers } from './api/members.js';
import { runQuery, runReport } from './api/reports.js';

const port = Number(process.env.PORT) || 3000;
const allowedOrigins = new Set(['http://localhost','https://umas-library.vercel.app']);

// Create the server and handle requests
const server = http.createServer(async (req, res) => {
    let baseUrl = "http://localhost";
    const origin = req.headers.origin;

    if (origin && allowedOrigins.has(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        baseUrl = origin;
    }
    
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    const url = new URL(req.url, baseUrl);

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
            const fines = await listFines(database);
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
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Route not found' }));
});


server.listen(port, () => {
    console.log(`Server started on port ${port}`);
});


