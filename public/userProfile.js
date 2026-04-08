/**
 * userProfile.js
 * Handles saving changes to the user's profile (username, password, privacy).
 * Validates that confirm password matches before sending to the server.
 */

function saveProfile() {
    const username = document.getElementById("profileUsername").value.trim();
    const password = document.getElementById("profilePassword").value;
    const confirm  = document.getElementById("profileConfirm").value;
    const privacy  = document.getElementById("profilePrivacy").checked;

    // Validate fields are filled
    if (!username || !password || !confirm) {
        alert("All fields must be filled in.");
        return;
    }

    // Validate password match
    if (password !== confirm) {
        alert("Passwords do not match.");
        return;
    }

    fetch(`/users/${profileUserID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, privacy })
    })
    .then(res => {
        if (!res.ok) throw new Error("Update failed");
        return res.json();
    })
    .then(() => {
        alert("Profile updated successfully.");
        location.reload();
    })
    .catch(() => {
        alert("Error updating profile.");
    });
}
