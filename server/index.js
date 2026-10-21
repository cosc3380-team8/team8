import http from 'http';
import {
    databaseConfig
} from './config.js';
import { createDatabaseConnection } from './database.js';
import { listBooks } from './books.js';

const port = Number(process.env.PORT) || 3000;
const database = await createDatabaseConnection(databaseConfig);

// Create the server and handle requests
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/books') {
        try {
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

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Route not found' }));
});

server.listen(port, () => {
    console.log(`Server started on port ${port}`);
});
