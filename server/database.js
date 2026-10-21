import sql from 'mssql';

let database = null;

export default class Database {
    config = {};
    poolconnection = null;
    connected = false;

    constructor(config) {
        this.config = config;
    }

    async connect() {
        try {
            this.poolconnection = await sql.connect(this.config);
            this.connected = true;
            console.log('Database connected successfully');
            return this.poolconnection;
        } catch (error) {
            console.error('Error connecting to the database: ', error);
            this.connected = false;
        }
    }

    async disconnect() {
        try {
            if (this.connected) {
                await this.poolconnection.close();
                this.connected = false;
                console.log('Database disconnected successfully.');
            }
        } catch (error) {
            console.error('Error disconnecting from the database', error);
        }
    }
}

export async function createDatabaseConnection() {
    const pool = new sql.ConnectionPool(databaseConfig);
    await pool.connect();
    return pool;
};
