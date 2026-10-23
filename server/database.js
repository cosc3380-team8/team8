import sql from 'mssql';

export default class Database {
    config = {};

    constructor(config) {
        this.config = config;
    }

    async connect() {
        try {
            const pool = await sql.connect(this.config);
            console.log('Database connected successfully');
            return pool;
        } catch (error) {
            console.error('Error connecting to the database: ', error);
            throw error;
        }
    }
}

export async function createDatabaseConnection(databaseConfig) {
  const database = new Database(databaseConfig);
  return await database.connect();
};
