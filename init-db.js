const { initializeDatabase } = require("../initializeDatabase");

module.exports = async (req, res) => {
    // 🔒 Protect it! Only allow in development or with a secret
    if (process.env.NODE_ENV === "production" && req.query.secret !== process.env.INIT_SECRET) {
        return res.status(403).json({ error: "Forbidden" });
    }

    try {
        await initializeDatabase();
        res.json({ success: true, message: "Database initialized" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};