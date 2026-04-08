/**
 * users.js
 * Handles deletion of users from the user directory (admin only).
 * Confirms before deleting, then sends DELETE /users/:uID to the server.
 */

document.querySelectorAll(".remove").forEach(img => {
    img.addEventListener("click", async (e) => {
        e.stopPropagation(); // prevent row click from firing

        const id = img.dataset.id;

        if (!confirm("Are you sure you want to delete this user?")) return;

        try {
            const resp = await fetch(`/users/${id}`, { method: "DELETE" });

            if (resp.ok) {
                alert("User deleted successfully.");
                // Remove the row from the DOM immediately
                img.closest(".serviceRow").remove();
            } else {
                alert("Failed to delete user.");
            }
        } catch (err) {
            alert("Error deleting user.");
        }
    });
});
