import http from 'http';
import {
    databaseConfig
} from './config.js';
import { createDatabaseConnection } from './database.js';
import { listBooks } from './books.js';
import { readFile } from 'fs/promises';
import { dirname, extname, join, resolve, sep } from 'path';
import { fileURLToPath } from 'url';

const port = Number(process.env.PORT) || 3000;
const database = await createDatabaseConnection(databaseConfig);
const appDir = dirname(fileURLToPath(import.meta.url));

// Create the server and handle book requests
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');

    // Serve the frontend entry point so the browser can load the app.
    if (req.method == "GET" && url.pathname === '/') {
        try {
            const html = await readFile(
                join(appDir, 'client', 'index.html'),
                'utf8'
            );

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
        } catch (error) {
            console.error('Could not read client/index.html:', error);
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Could not load the page');
        }
        return;
    }

    // Return the book list as JSON for the client's fetch('/books') request.
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

    // Serve the built frontend files (JS, CSS, images) from the client folder.
    // Vite serves these automatically in development; the production Node server must serve them here.
    if (req.method === 'GET') {
        try {
            const pathname = decodeURIComponent(url.pathname);
            const clientDir = join(appDir, 'client');
            const filePath = resolve(clientDir, `.${pathname}`);

            // Prevent requests from escaping
            if (filePath !== clientDir && !filePath.startsWith(clientDir + sep)) {
                res.writeHead(403);
                res.end('Forbidden');
                return;
            }

            const file = await readFile(filePath);
            const contentTypes = {
                '.css': 'text/css; charset=utf-8',
                '.html': 'text/html; charset=utf-8',
                '.js': 'text/javascript; charset=utf-8',
                '.json': 'application/json; charset=utf-8',
                '.png': 'image/png',
                '.svg': 'image/svg+xml',
                '.ico': 'image/x-icon',
            };

            res.writeHead(200, { 
                'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream', 
            });
            res.end(file);
        } catch (error) {
            console.error('Could not serve client file:', url.pathname, error);
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not found');
        }
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Route not found' }));
});

server.listen(port, () => {
    console.log(`Server started on port ${port}`);
});
