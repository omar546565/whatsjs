const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');

if (!token || user.role !== 'admin') {
    window.location.href = '/';
}

const usersList = document.getElementById('users-list');
const addUserForm = document.getElementById('add-user-form');
const editUserModal = document.getElementById('edit-user-modal');
const editUserForm = document.getElementById('edit-user-form');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

async function loadUsers() {
    try {
        const res = await fetch('/auth/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            usersList.innerHTML = data.users.map(u => `
                <tr>
                    <td>${u.id}</td>
                    <td>${u.username}</td>
                    <td><span class="role-badge role-${u.role}">${u.role}</span></td>
                    <td><span class="mono">${u.app_secret}</span></td>
                    <td>
                        <button onclick="openEditModal('${u.id}', '${u.username}', '${u.role}')" class="btn-sm btn-secondary">Edit</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (err) {
        console.error('Failed to load users', err);
        if (err.status === 401 || err.status === 403) {
            window.location.href = '/';
        }
    }
}

// Add User
addUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('new-username').value;
    const password = document.getElementById('new-password').value;

    try {
        const res = await fetch('/auth/create_user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (data.success) {
            alert('User created successfully!');
            document.getElementById('new-username').value = '';
            document.getElementById('new-password').value = '';
            loadUsers();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (err) {
        alert('Failed to create user');
    }
});

// Edit User
window.openEditModal = (id, username, role) => {
    document.getElementById('edit-user-id').value = id;
    document.getElementById('edit-username').value = username;
    document.getElementById('edit-role').value = role;
    document.getElementById('edit-password').value = '';
    editUserModal.classList.add('active');
};

cancelEditBtn.addEventListener('click', () => {
    editUserModal.classList.remove('active');
});

editUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-user-id').value;
    const password = document.getElementById('edit-password').value;
    const role = document.getElementById('edit-role').value;

    try {
        const res = await fetch(`/auth/users/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ password, role })
        });
        const data = await res.json();

        if (data.success) {
            alert('User updated successfully!');
            editUserModal.classList.remove('active');
            loadUsers();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (err) {
        alert('Failed to update user');
    }
});

// Initial load
loadUsers();
