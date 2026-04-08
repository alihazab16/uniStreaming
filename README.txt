COMP2406 Assignment 4 - README
==============================

HOW TO RUN
----------

1. Install MongoDB and make sure it is set up on your system.

2. Start the MongoDB daemon in a separate terminal window:
      "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe" --dbpath="C:\data\db"
   (Replace C:\data\db with the path where you installed MongoDB.)
   Leave this terminal open the entire time you work on the assignment.

3. Open a second terminal window and navigate to the project folder.

4. Install dependencies (only needs to be done once):
      npm install

   This will install: express, pug, express-session, mongodb

5. Initialize the database (run once, or any time you want to reset it):
      node initializeDatabase.js

   This creates:
   - services collection (populated from streamingServices/ folder)
   - users collection (10 users: admin/admin through Jen/Jen; admin has admin=true)
   - orders collection (starts empty)

6. Start the server:
      node server.js

7. Open your browser and go to:
      http://localhost:3000

TEST ACCOUNTS
-------------
  Username: admin    Password: admin    (admin privileges)
  Username: Jen      Password: Jen      (regular user)
  (All other users also have password = username)

DESIGN DECISIONS
----------------

- Sessions: express-session stores the logged-in user's _id, username, and
  admin flag. This is used to pass user info into every rendered Pug template
  via a `user` variable, which drives the navigation header.

- Authorization: Two Express middleware functions are used:
    requireLogin  — redirects to /login if not authenticated
    requireAdmin  — returns 403 if the user is not an admin
  These are applied per-route according to the authorization table in the spec.

- Services stored in MongoDB: All in-memory arrays (streamingServices, 
  orderHistory) have been removed. Every route that previously used them now
  queries MongoDB. Helper functions getAllServices(), getServiceById(), and
  updateService() keep the DB access clean and DRY.

- Orders store user._id: When an order is submitted via POST /submit-order,
  the logged-in user's MongoDB ObjectId is attached to the order document.

- User Profile: GET /users/:uID renders the profile page showing the user's
  info and all of their past orders (fetched from the orders collection by
  matching the user field). The Profile link in the nav always points to the
  currently logged-in user's own profile.

- User Directory (admin only): Private users are shown faded (opacity: 0.4)
  and are not clickable links. Public users are clickable links to their 
  profile. The remove icon triggers a DELETE /users/:uID request.

- Password on profile page: The password field is type="password" with 
  placeholder "*****" so the actual password is not shown. The user must
  type a new value and confirm it before saving.

FILE STRUCTURE
--------------
  server.js              - Main Express server
  mwpDB.js               - MongoDB connection helper
  initializeDatabase.js  - DB initialization script
  views/
    partials/header.pug  - Dynamic navigation header
    home.pug
    login.pug
    register.pug
    orderForm.pug
    stats.pug
    services.pug         - Admin services list
    serviceInfo.pug      - Admin service editor
    users.pug            - Admin user directory
    userProfile.pug      - User profile + order history
  public/
    style.css
    web.js               - Order form client logic
    admin.js             - Add/delete services (admin)
    serviceInfo.js       - Edit service details (admin)
    userProfile.js       - Save profile changes
    users.js             - Delete users (admin)
  streamingServices/
    streamIt.json
    movieVerse.json
    cinemaTime.json
