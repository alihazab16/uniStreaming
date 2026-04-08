const express = require("express");
const path = require("path");
const session = require("express-session");
const { ObjectId } = require("mongodb");
const { connectToDatabase } = require("./mwpDB");

const app = express();
const PORT = 3000;

app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// ─── Session Setup ────────────────────────────────────────────────────────────
app.use(session({
    secret: "mwp-secret-key-2406",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}));

// ─── Database Helpers ─────────────────────────────────────────────────────────

/** Return all services from the DB */
async function getAllServices() {
    const db = await connectToDatabase();
    return db.collection("services").find().toArray();
}

/** Return one service by numeric id field */
async function getServiceById(id) {
    const db = await connectToDatabase();
    return db.collection("services").findOne({ id: Number(id) });
}

/** Persist service updates back to DB */
async function updateService(id, updatedFields) {
    const db = await connectToDatabase();
    return db.collection("services").updateOne(
        { id: Number(id) },
        { $set: updatedFields }
    );
}

/** Return a user by MongoDB _id */
async function getUserById(uID) {
    const db = await connectToDatabase();
    return db.collection("users").findOne({ _id: new ObjectId(uID) });
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────

/** Allow only logged-in users (any role) */
function requireLogin(req, res, next) {
    if (req.session && req.session.user) return next();
    res.redirect("/login");
}

/** Allow only admin users */
function requireAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.admin) return next();
    res.status(403).send("Forbidden – admins only.");
}

// Helper: build the user object to pass to all views
function sessionUser(req) {
    return req.session.user || null;
}

// ─── Routes: Public ───────────────────────────────────────────────────────────

app.get("/", (req, res) => {
    res.render("home", { page: "home", user: sessionUser(req) });
});

app.get("/login", (req, res) => {
    res.render("login", { page: "login", user: null, error: null });
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const db = await connectToDatabase();
    const found = await db.collection("users").findOne({ username, password });

    if (!found) {
        return res.render("login", {
            page: "login",
            user: null,
            error: "Invalid username or password."
        });
    }

    // Store a safe subset in the session
    req.session.user = {
        _id: found._id.toString(),
        username: found.username,
        admin: found.admin
    };
    res.redirect("/");
});

app.get("/register", (req, res) => {
    res.render("register", { page: "login", user: null, error: null });
});

app.post("/register", async (req, res) => {
    const { username, password, privacy } = req.body;
    const db = await connectToDatabase();

    // Check if username is taken
    const existing = await db.collection("users").findOne({ username });
    if (existing) {
        return res.render("register", {
            page: "login",
            user: null,
            error: "Username is already taken. Please choose another."
        });
    }

    const newUser = {
        username,
        password,
        admin: false,
        privacy: privacy === "on" // checkbox sends "on" when checked
    };

    const result = await db.collection("users").insertOne(newUser);

    // Auto-login after registration
    req.session.user = {
        _id: result.insertedId.toString(),
        username,
        admin: false
    };
    res.redirect("/");
});

app.get("/logout", requireLogin, (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

// ─── Routes: Order & Stats ───────────────────────────────────────────────────

app.get("/order", requireLogin, async (req, res) => {
    const services = await getAllServices();
    res.render("orderForm", {
        page: "order",
        user: sessionUser(req),
        services
    });
});

app.post("/submit-order", requireLogin, async (req, res) => {
    const db = await connectToDatabase();
    const order = {
        ...req.body,
        user: new ObjectId(req.session.user._id)
    };
    await db.collection("orders").insertOne(order);
    res.redirect("/stats");
});

app.get("/stats", requireLogin, async (req, res) => {
    const db = await connectToDatabase();
    const services = await getAllServices();
    const orderHistory = await db.collection("orders").find().toArray();

    const stats = services.map(service => {
        let totalMovies = 0;
        let totalRevenue = 0;
        let orderCount = 0;
        const movieCounts = {};

        orderHistory.forEach(order => {
            if (order.movies && order.movies[service.name]) {
                orderCount++;
                order.movies[service.name].forEach(movie => {
                    totalMovies++;
                    totalRevenue += Number(movie.price);
                    movieCounts[movie.title] = (movieCounts[movie.title] || 0) + 1;
                });
                if (order.fees && order.fees[service.name]) {
                    totalRevenue += Number(order.fees[service.name]);
                }
            }
        });

        let mostPopular = "None yet";
        let max = 0;
        for (const title in movieCounts) {
            if (movieCounts[title] > max) {
                max = movieCounts[title];
                mostPopular = title;
            }
        }

        const avgOrder = orderCount ? totalRevenue / orderCount : 0;
        return {
            name: service.name,
            totalMovies,
            totalRevenue: totalRevenue.toFixed(2),
            avgOrder: avgOrder.toFixed(2),
            mostPopular
        };
    });

    res.render("stats", { page: "stats", user: sessionUser(req), stats });
});

// ─── Routes: Users ────────────────────────────────────────────────────────────

app.get("/users", requireAdmin, async (req, res) => {
    const db = await connectToDatabase();
    const users = await db.collection("users").find().toArray();

    if (req.headers.accept && req.headers.accept.includes("application/json")) {
        return res.json(users.map(u => ({
            id: u._id,
            username: u.username,
            privacy: u.privacy
        })));
    }

    res.render("users", { page: "users", user: sessionUser(req), users });
});

app.delete("/users/:uID", requireAdmin, async (req, res) => {
    const db = await connectToDatabase();
    let oid;
    try { oid = new ObjectId(req.params.uID); } catch { return res.status(400).json({ error: "Invalid ID" }); }

    const result = await db.collection("users").deleteOne({ _id: oid });
    if (result.deletedCount === 0) return res.status(404).json({ error: "User not found" });
    res.json({ success: true });
});

app.get("/users/:uID", requireLogin, async (req, res) => {
    let targetUser;
    try { targetUser = await getUserById(req.params.uID); } catch { return res.status(404).send("User not found"); }
    if (!targetUser) return res.status(404).send("User not found");

    const db = await connectToDatabase();
    const orders = await db.collection("orders")
        .find({ user: targetUser._id })
        .toArray();

    res.render("userProfile", {
        page: "profile",
        user: sessionUser(req),
        profileUser: targetUser,
        orders
    });
});

app.put("/users/:uID", requireLogin, async (req, res) => {
    const { username, password, privacy } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing fields" });

    let oid;
    try { oid = new ObjectId(req.params.uID); } catch { return res.status(400).json({ error: "Invalid ID" }); }

    const db = await connectToDatabase();
    await db.collection("users").updateOne(
        { _id: oid },
        { $set: { username, password, privacy: privacy === true || privacy === "true" } }
    );

    // Update session if user edited their own profile
    if (req.session.user._id === req.params.uID) {
        req.session.user.username = username;
    }

    res.json({ message: "Profile updated successfully" });
});

// ─── Routes: Services ─────────────────────────────────────────────────────────

app.get("/services", requireAdmin, async (req, res) => {
    const services = await getAllServices();
    const serviceList = services.map(s => ({ id: s.id, name: s.name }));

    if (req.headers.accept && req.headers.accept.includes("application/json")) {
        return res.json({ count: serviceList.length, services: serviceList });
    }
    res.render("services", { page: "admin", user: sessionUser(req), services: serviceList });
});

app.post("/services", requireAdmin, async (req, res) => {
    const name = req.body.name;
    if (!name || name.trim() === "") return res.status(400).json({ error: "Service name cannot be blank" });

    const db = await connectToDatabase();
    const all = await db.collection("services").find().toArray();
    const maxId = all.reduce((m, s) => Math.max(m, s.id || 0), 0);

    const newService = {
        id: maxId + 1,
        name: name.trim(),
        serviceFee: 0,
        minOrder: 0,
        genres: {}
    };

    await db.collection("services").insertOne(newService);
    res.json({ success: true });
});

app.delete("/services/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const db = await connectToDatabase();
    const result = await db.collection("services").deleteOne({ id });
    if (result.deletedCount === 0) return res.status(404).json({ error: "Service not found" });
    res.json({ success: true });
});

app.get("/services/:id", requireLogin, async (req, res) => {
    const service = await getServiceById(req.params.id);
    if (!service) return res.status(404).send("Service not found");

    if (req.headers.accept && req.headers.accept.includes("text/html")) {
        return res.render("serviceInfo", { user: sessionUser(req), service });
    }
    res.json(service);
});

app.put("/services/:sID", requireAdmin, async (req, res) => {
    const id = Number(req.params.sID);
    const { name, serviceFee, minOrder } = req.body;
    if (!name || serviceFee == null || minOrder == null) return res.status(400).send("Missing fields");

    const service = await getServiceById(id);
    if (!service) return res.status(404).send("Service not found");

    await updateService(id, {
        name,
        serviceFee: Number(serviceFee),
        minOrder: Number(minOrder)
    });
    res.json({ message: "Service updated successfully" });
});

app.post("/services/:sID/genres", requireAdmin, async (req, res) => {
    const id = Number(req.params.sID);
    const service = await getServiceById(id);
    if (!service) return res.status(404).send("Service not found");

    const genre = req.body.genre;
    if (!genre || genre.trim() === "") return res.status(400).send("Genre name missing");
    if (service.genres[genre]) return res.status(400).send("Genre already exists");

    service.genres[genre] = [];
    await updateService(id, { genres: service.genres });
    res.json({ message: "Genre added" });
});

app.post("/services/:sID/movies", requireAdmin, async (req, res) => {
    const id = Number(req.params.sID);
    const service = await getServiceById(id);
    if (!service) return res.status(404).send("Service not found");

    const { genre, title, description, year, price } = req.body;
    if (!genre || !title || !description || !year || !price) return res.status(400).send("Missing movie fields");
    if (!service.genres[genre]) return res.status(400).send("Genre does not exist");

    const newMovie = {
        id: Date.now(),
        title,
        description,
        year: Number(year),
        price: Number(price)
    };

    service.genres[genre].push(newMovie);
    await updateService(id, { genres: service.genres });
    res.json({ message: "Movie added" });
});

app.delete("/services/:sID/movies/:mID", requireAdmin, async (req, res) => {
    const sID = Number(req.params.sID);
    const mID = Number(req.params.mID);

    const service = await getServiceById(sID);
    if (!service) return res.status(404).send("Service not found");

    let found = false;
    for (const genre in service.genres) {
        const idx = service.genres[genre].findIndex(m => m.id === mID);
        if (idx !== -1) {
            service.genres[genre].splice(idx, 1);
            found = true;
            break;
        }
    }

    if (!found) return res.status(404).send("Movie not found");
    await updateService(sID, { genres: service.genres });
    res.json({ message: "Movie deleted" });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Verify DB connection on startup
    const db = await connectToDatabase();
    const sCount = await db.collection("services").countDocuments();
    const uCount = await db.collection("users").countDocuments();
    console.log(`DB ready: ${sCount} services, ${uCount} users.`);
});
