import * as dotenv from 'dotenv';
import { ClientAssertionCredential } from '@azure/identity';
import { getVercelOidcToken } from '@vercel/oidc';

const server = process.env.AZURE_SQL_SERVER;
const database = process.env.AZURE_SQL_DATABASE;
const port = +process.env.AZURE_SQL_PORT;
const type = process.env.AZURE_SQL_AUTHENTICATIONTYPE;
const clientID = process.env.AZURE_CLIENT_ID;
const tenantID = process.env.AZURE_TENANT_ID;

const credential = new ClientAssertionCredential (
  tenantID,
  clientID,
  getVercelOidcToken
);

export async function getSqlConfig() {
  const { token } = await credential.getToken('https://database.windows.net/.default');
  if (!token) {
    throw new Error ('Could not obtain Azure SQL access token');
  }
  
  // Create configuration object for Azure SQL connection
  return {
      server,
      database,
      port,
      authentication: {
          type,
          options: {
            token
          },
      },
      options: {
          encrypt: true,
          trustServerCertificate: false
      }
  };
}
