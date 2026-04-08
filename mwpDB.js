const { MongoClient } = require("mongodb");

// Use environment variable instead of localhost
const url = process.env.MONGO_URI;

// Database name
const dbName = "mwp";

let client = null;
let db = null;

// Connect to the database
async function connectToDatabase() {
    try {
        // If already connected, reuse it
        if (db) return db;

        if (!url) {
            throw new Error("MONGO_URI is not defined. Did you add it to your environment variables?");
        }

        client = new MongoClient(url);

        await client.connect();

        db = client.db(dbName);

        console.log("✅ Connected to MongoDB Atlas");

        return db;

    } catch (err) {
        console.error("❌ Error connecting to MongoDB:", err);
        throw err;
    }
}

// Disconnect from the database
async function disconnectFromDatabase() {
    try {
        if (client) {
            await client.close();
            client = null;
            db = null;
            console.log("Disconnected from MongoDB");
        }
    } catch (err) {
        console.error("Error disconnecting from MongoDB:", err);
    }
}

module.exports = {
    connectToDatabase,
    disconnectFromDatabase
};
