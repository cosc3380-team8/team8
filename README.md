# team 8 - library database (cosc 3380, section 17184)

our project is a library system for students and faculty. you can borrow books, media and devices, put holds on stuff thats checked out, book study rooms, and staff can do checkouts, returns, fines and reports. the database is on azure sql and the website is on vercel.

- website: https://umas-library.vercel.app
- api (server): https://umas-library-server.vercel.app

## logins for testing

| role | email | password |
|---|---|---|
| admin | azael@library.edu | admin123 |
| employee (staff) | clark@library.edu | staff123 |
| faculty | dan@uni.edu | faculty123 |
| student | esther@library.edu | student123 |

admin can see everything (reports, staff page). employee does the desk stuff (checkout, return, holds, fines, members, manage books/media/rooms). students and faculty can search the catalog, place holds, book rooms and see their own loans, fines, receipts and notifications.

## whats in this repo

| file / folder | what it is |
|---|---|
| `client/` | the website (react + typescript, built with vite) |
| `server/` | the api (node.js, runs as vercel functions, talks to azure sql) |
| `team8_dump.sql` | full dump of our azure database with all the data. use this one to install the database |
| `team8_azure.sql` | the tables, keys and constraints we started with on azure |
| `team8_azure_procedures.sql`, `team8_azure_seed.sql`, `team8_demo_accounts.sql` | stored procedures, starter data and the demo logins |
| `team8_azure_migration*.sql` | changes we made after (triggers, fines, holds, etc). they are numbered in the order we ran them |
| `*_test*.sql` | test scripts we ran before each change. they end with ROLLBACK so they dont change anything |
| `team8_queries_reports.sql` | the sql behind the queries and reports |
| `team8.sql` | old mysql version from checkpoint 1, not used anymore |

## how to install it

you need node.js 20 or newer and an sql server or azure sql database.

### 1. database

1. make a new empty database (azure sql or sql server 2019+)
2. open `team8_dump.sql` in vs code (mssql extension), datagrip or ssms, connect to the new database and run the whole file
3. it makes all 17 tables, the fine_status view, the stored procedures and the 5 triggers, then puts in all our data

### 2. website (client)

```
cd client
npm install
npm run dev
```

then open http://localhost:5173. by default it talks to our live api, so you can log in with the accounts above right away.

### 3. server (api), only if you want to run your own

```
cd server
npm install
```

it needs these environment variables: `AZURE_SQL_SERVER`, `AZURE_SQL_DATABASE`, `AZURE_SQL_PORT` (1433), `AZURE_SQL_AUTHENTICATIONTYPE`, `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `JWT_SECRET`, and `CRON_SECRET` (optional, for the daily job).

the server logs in to azure with a vercel token (oidc), so the easy way is to deploy the `server` folder to vercel and put the variables in the vercel project settings. `server/vercel.json` also sets up the daily job (every day 5 am houston time) that expires old holds, sends due-date reminders and updates overdue fines. if you run your own server, change `API` at the top of `client/src/api/api.ts` to your server url.

## team

clark nguyen (database), azael (server), esther (website), aliza (website), uriel (server)
