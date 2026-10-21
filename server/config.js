import * as dotenv from 'dotenv';

if(process.env.NODE_ENV === 'development') {
  dotenv.config({ path: `.env.${process.env.NODE_ENV}`, debug: true });
}

const server = process.env.AZURE_SQL_SERVER;
const database = process.env.AZURE_SQL_DATABASE;
const port = +process.env.AZURE_SQL_PORT;
const type = process.env.AZURE_SQL_AUTHENTICATIONTYPE;

// Create configuration object for Azure SQL connection with Entra ID authentication
export const databaseConfig = {
    server,
    database,
    port,
    authentication: {
        type
    },
    options: {
        encrypt: true
    }
};