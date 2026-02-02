// Global state
let authToken = null;
let currentUser = null;
let tempUserId = null;
let tempMfaSecret = null;
let currentDocumentId = null;

// API Base URL
const API_BASE = '/api';

// Initialize from localStorage
function initFromStorage() {
    try {
        authToken = localStorage.getItem('authToken');
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser && storedUser !== 'undefined') {
            currentUser = JSON.parse(storedUser);
        }
    } catch (e) {
        console.error('Error reading from localStorage:', e);
        authToken = null;
        currentUser = null;
    }
}

// Check if already logged in on page load
window.addEventListener('DOMContentLoaded', async () => {
    initFromStorage();
    
    console.log('Page loaded. Token:', authToken ? 'exists' : 'null', 'User:', currentUser ? currentUser.email : 'null');
    
    if (authToken && currentUser) {
        // Verify token is still valid
        try {
            const res = await fetch(`${API_BASE}/auth/me`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            console.log('Token verification response:', res.status);
            
            if (res.ok) {
                const userData = await res.json();
                currentUser = userData;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                showDashboard();
            } else {
                console.log('Token invalid, logging out');
                // Token expired, clear and show login
                logout();
            }
        } catch (error) {
            console.error('Token verification failed:', error);
            logout();
        }
    }
});

// ==================== Auth Functions ====================

function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(`${tabName}-tab`).classList.add('active');
    event.target.classList.add('active');
}

// Register form handler
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('Registration successful! Please setup MFA.', 'success');
            tempUserId = data.userId;
            tempMfaSecret = data.mfaSetup.secret;
            
            // Show MFA setup
            document.getElementById('register-form').style.display = 'none';
            document.getElementById('mfa-setup').style.display = 'block';
            document.getElementById('qr-code-container').innerHTML = 
                `<img src="${data.mfaSetup.qrCode}" alt="QR Code">
                 <p>Secret: <code>${data.mfaSetup.secret}</code></p>`;
        } else {
            showMessage(data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        showMessage('Network error: ' + error.message, 'error');
    }
});

async function enableMFA() {
    const token = document.getElementById('mfa-setup-token').value;

    if (!token || token.length !== 6) {
        showMessage('Please enter a valid 6-digit code', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/auth/enable-mfa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: tempUserId, token })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('MFA enabled! You can now login.', 'success');
            setTimeout(() => {
                document.getElementById('mfa-setup').style.display = 'none';
                document.getElementById('register-form').style.display = 'block';
                document.getElementById('register-form').reset();
                showTab('login');
            }, 2000);
        } else {
            showMessage(data.error || 'Failed to enable MFA', 'error');
        }
    } catch (error) {
        showMessage('Network error: ' + error.message, 'error');
    }
}

// Login form handler
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            tempUserId = data.userId;
            
            if (data.mfaRequired) {
                // Show MFA verification
                document.getElementById('login-form').style.display = 'none';
                document.getElementById('mfa-verification').style.display = 'block';
            } else {
                showMessage('Login successful!', 'success');
                // Directly login without MFA (if MFA not enabled)
                authToken = data.token;
                currentUser = data.user;
                
                // Persist to localStorage
                localStorage.setItem('authToken', authToken);
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                
                showDashboard();
            }
        } else {
            showMessage(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        showMessage('Network error: ' + error.message, 'error');
    }
});

async function verifyMFA() {
    const token = document.getElementById('mfa-token').value;

    if (!token || token.length !== 6) {
        showMessage('Please enter a valid 6-digit code', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/auth/verify-mfa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: tempUserId, token })
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            
            // Persist to localStorage
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            showDashboard();
        } else {
            showMessage(data.error || 'MFA verification failed', 'error');
        }
    } catch (error) {
        showMessage('Network error: ' + error.message, 'error');
    }
}

function cancelMFA() {
    document.getElementById('mfa-verification').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('mfa-token').value = '';
}

function logout() {
    authToken = null;
    currentUser = null;
    
    // Clear localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    
    document.getElementById('auth-screen').classList.add('active');
    document.getElementById('dashboard-screen').classList.remove('active');
    document.getElementById('login-form').reset();
}

function showMessage(message, type) {
    const msgEl = document.getElementById('auth-message');
    msgEl.textContent = message;
    msgEl.className = `message ${type}`;
    
    setTimeout(() => {
        msgEl.className = 'message';
    }, 5000);
}

// ==================== Dashboard Functions ====================

function showDashboard() {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('dashboard-screen').classList.add('active');
    document.getElementById('user-info').textContent = 
        `👤 ${currentUser.username} (${currentUser.email})`;
    
    loadDocuments();
    loadInvites();
}

function showSection(section) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.remove('active');
    });
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // Show selected section
    document.getElementById(`${section}-section`).classList.add('active');
    event.target.classList.add('active');

    // Load section data
    if (section === 'documents') loadDocuments();
    if (section === 'invites') loadInvites();
}

// ==================== Documents Functions ====================

async function loadDocuments() {
    try {
        const response = await fetch(`${API_BASE}/documents`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (response.ok) {
            displayDocuments(data.documents);
        } else {
            console.error('Failed to load documents:', data.error);
        }
    } catch (error) {
        console.error('Network error:', error);
    }
}

function displayDocuments(documents) {
    const container = document.getElementById('documents-list');
    
    if (documents.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--secondary-color);">No documents yet. Create your first document!</p>';
        return;
    }

    container.innerHTML = documents.map(doc => `
        <div class="document-card" onclick="viewDocument('${doc.id}')">
            <h3>${escapeHtml(doc.title)}</h3>
            <div class="doc-meta">
                Created: ${new Date(doc.createdAt).toLocaleString()}
            </div>
            <div class="doc-badges">
                ${doc.encrypted ? '<span class="badge encrypted">🔐 Encrypted</span>' : ''}
                ${doc.signed ? '<span class="badge signed">✍️ Signed (${doc.signatureCount})</span>' : ''}
                ${doc.permissions.length > 0 ? '<span class="badge shared">👥 Shared</span>' : ''}
            </div>
            <div class="doc-meta" style="margin-top: 10px;">
                Permissions: ${doc.permissions.join(', ') || 'owner'}
            </div>
        </div>
    `).join('');
}

function showCreateDocument() {
    document.getElementById('document-modal-title').textContent = 'Create Document';
    document.getElementById('document-form').reset();
    currentDocumentId = null;
    document.getElementById('document-modal').classList.add('active');
}

function closeDocumentModal() {
    document.getElementById('document-modal').classList.remove('active');
}

document.getElementById('document-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('doc-title').value;
    const content = document.getElementById('doc-content').value;
    const encrypted = document.getElementById('doc-encrypted').checked;

    try {
        const response = await fetch(`${API_BASE}/documents`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, content, encrypted })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Document created successfully!');
            closeDocumentModal();
            loadDocuments();
        } else {
            alert('Error: ' + (data.error || 'Failed to create document'));
        }
    } catch (error) {
        alert('Network error: ' + error.message);
    }
});

async function viewDocument(documentId) {
    try {
        const response = await fetch(`${API_BASE}/documents/${documentId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (response.ok) {
            displayDocumentView(data);
        } else {
            alert('Error: ' + (data.error || 'Failed to load document'));
        }
    } catch (error) {
        alert('Network error: ' + error.message);
    }
}

function displayDocumentView(doc) {
    const canWrite = doc.permissions.includes('write') || doc.ownerId === currentUser.id;
    const canSign = doc.permissions.includes('sign') || doc.ownerId === currentUser.id;
    const canShare = doc.permissions.includes('share') || doc.ownerId === currentUser.id;
    const canDelete = doc.permissions.includes('delete') || doc.ownerId === currentUser.id;

    document.getElementById('document-view').innerHTML = `
        <h2 id="doc-title-display">${escapeHtml(doc.title)}</h2>
        <input type="text" id="doc-title-edit" value="${escapeHtml(doc.title)}" style="display: none; margin-bottom: 15px; width: 100%; padding: 10px; font-size: 1.2rem; font-weight: bold;">
        
        <div class="doc-meta">
            ${doc.encrypted ? '🔐 End-to-end encrypted' : ''}
            ${doc.signed ? `✍️ Signed by ${doc.signatures.length} user(s)` : ''}
        </div>
        <div class="doc-meta">Hash: ${doc.hash}</div>
        <div class="form-group" style="margin-top: 20px;">
            <label>Content</label>
            <textarea id="doc-content-view" readonly rows="10" style="background: var(--bg-color);">${escapeHtml(doc.content)}</textarea>
        </div>

        ${doc.signatures.length > 0 ? `
            <div class="signature-list">
                <h3>Digital Signatures</h3>
                ${doc.signatures.map(sig => `
                    <div class="signature-item">
                        <strong>${escapeHtml(sig.username)}</strong><br>
                        Signed: ${new Date(sig.timestamp).toLocaleString()}<br>
                        Hash: ${sig.documentHash}
                    </div>
                `).join('')}
            </div>
        ` : ''}

        <div class="document-actions">
            ${canWrite ? `
                <button id="edit-btn" onclick="enableEditMode('${doc.id}')" class="btn-primary">✏️ Edit</button>
                <button id="save-btn" onclick="saveDocumentEdit('${doc.id}')" class="btn-primary" style="display: none;">💾 Save Changes</button>
                <button id="cancel-btn" onclick="cancelEditMode('${doc.id}')" class="btn-secondary" style="display: none;">✖️ Cancel</button>
            ` : ''}
            ${canSign ? `<button onclick="signDocument('${doc.id}')" class="btn-primary">✍️ Sign Document</button>` : ''}
            ${canShare ? `<button onclick="shareDocument('${doc.id}')" class="btn-primary">👥 Share</button>` : ''}
            ${doc.signed ? `<button onclick="verifyDocument('${doc.id}')" class="btn-secondary">✓ Verify Signatures</button>` : ''}
            ${canDelete ? `<button onclick="deleteDocument('${doc.id}')" class="btn-secondary" style="background: var(--danger-color);">🗑️ Delete</button>` : ''}
        </div>
    `;

    document.getElementById('view-document-modal').classList.add('active');
}

function enableEditMode(documentId) {
    const titleDisplay = document.getElementById('doc-title-display');
    const titleEdit = document.getElementById('doc-title-edit');
    const contentView = document.getElementById('doc-content-view');
    const editBtn = document.getElementById('edit-btn');
    const saveBtn = document.getElementById('save-btn');
    const cancelBtn = document.getElementById('cancel-btn');

    // Switch to edit mode
    titleDisplay.style.display = 'none';
    titleEdit.style.display = 'block';
    contentView.removeAttribute('readonly');
    contentView.style.background = 'white';
    
    editBtn.style.display = 'none';
    saveBtn.style.display = 'inline-block';
    cancelBtn.style.display = 'inline-block';
}

function cancelEditMode(documentId) {
    // Reload the document to reset changes
    viewDocument(documentId);
}

async function saveDocumentEdit(documentId) {
    const title = document.getElementById('doc-title-edit').value;
    const content = document.getElementById('doc-content-view').value;

    if (!title || !content) {
        alert('Title and content cannot be empty');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/documents/${documentId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, content })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Document updated successfully!');
            closeViewDocumentModal();
            loadDocuments();
        } else {
            alert('Error: ' + (data.error || 'Failed to update document'));
        }
    } catch (error) {
        alert('Network error: ' + error.message);
    }
}

function closeViewDocumentModal() {
    document.getElementById('view-document-modal').classList.remove('active');
}

async function signDocument(documentId) {
    if (!confirm('Sign this document? This will create a permanent digital signature.')) return;

    try {
        const response = await fetch(`${API_BASE}/documents/${documentId}/sign`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (response.ok) {
            alert('Document signed successfully!');
            closeViewDocumentModal();
            loadDocuments();
        } else {
            alert('Error: ' + (data.error || 'Failed to sign document'));
        }
    } catch (error) {
        alert('Network error: ' + error.message);
    }
}

async function verifyDocument(documentId) {
    try {
        const response = await fetch(`${API_BASE}/documents/${documentId}/verify`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (response.ok) {
            const resultText = data.signatures.map(sig => 
                `${sig.username}: ${sig.valid && sig.hashMatch ? '✅ Valid' : '❌ Invalid'}`
            ).join('\n');
            
            alert(`Signature Verification:\n\n${resultText}\n\nAll signatures valid: ${data.allValid ? 'YES' : 'NO'}`);
        } else {
            alert('Error: ' + (data.error || 'Failed to verify signatures'));
        }
    } catch (error) {
        alert('Network error: ' + error.message);
    }
}

async function shareDocument(documentId) {
    const email = prompt('Enter user email to share with:');
    if (!email) return;

    // For demo purposes, you'd need to look up user by email
    alert('Share functionality requires user lookup. Use Invite system instead for sharing.');
}

async function deleteDocument(documentId) {
    if (!confirm('Delete this document? This action cannot be undone.')) return;

    try {
        const response = await fetch(`${API_BASE}/documents/${documentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (response.ok) {
            alert('Document deleted successfully!');
            closeViewDocumentModal();
            loadDocuments();
        } else {
            alert('Error: ' + (data.error || 'Failed to delete document'));
        }
    } catch (error) {
        alert('Network error: ' + error.message);
    }
}

// ==================== Invites Functions ====================

async function loadInvites() {
    try {
        const response = await fetch(`${API_BASE}/invites/my-invites`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (response.ok) {
            displayInvites(data.invites);
        }
    } catch (error) {
        console.error('Failed to load invites:', error);
    }

    // Also populate document selector
    const response = await fetch(`${API_BASE}/documents`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const docData = await response.json();
    
    const select = document.getElementById('invite-document');
    select.innerHTML = '<option value="">Workspace Only</option>' + 
        docData.documents.map(doc => 
            `<option value="${doc.id}">${escapeHtml(doc.title)}</option>`
        ).join('');
}

function displayInvites(invites) {
    const container = document.getElementById('invites-list');
    
    if (invites.length === 0) {
        container.innerHTML = '<p style="color: var(--secondary-color);">No invites created yet.</p>';
        return;
    }

    container.innerHTML = invites.map(invite => `
        <div class="invite-item ${!invite.active ? 'inactive' : ''}">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div>
                    <strong>Token ID:</strong> ${invite.tokenId}<br>
                    <strong>Permissions:</strong> ${invite.permissions.join(', ')}<br>
                    <strong>Uses:</strong> ${invite.uses} / ${invite.maxUses}<br>
                    <strong>Status:</strong> ${invite.active ? '✅ Active' : '❌ Inactive'}<br>
                    ${invite.expiresAt ? `<strong>Expires:</strong> ${new Date(invite.expiresAt).toLocaleString()}` : ''}
                </div>
                ${invite.active ? `
                    <button onclick="revokeInvite('${invite.tokenId}')" 
                            class="btn-secondary" style="width: auto; padding: 8px 16px;">
                        Revoke
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function showCreateInvite() {
    document.getElementById('invite-form').reset();
    document.getElementById('invite-result').style.display = 'none';
    document.getElementById('invite-modal').classList.add('active');
}

function closeInviteModal() {
    document.getElementById('invite-modal').classList.remove('active');
}

document.getElementById('invite-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const documentId = document.getElementById('invite-document').value;
    const expiresIn = parseInt(document.getElementById('invite-expires').value);
    const maxUses = parseInt(document.getElementById('invite-max-uses').value);
    
    const permissions = Array.from(document.querySelectorAll('input[name="permissions"]:checked'))
        .map(cb => cb.value);

    try {
        const response = await fetch(`${API_BASE}/invites/generate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                documentId: documentId || undefined,
                permissions,
                expiresIn: expiresIn || undefined,
                maxUses
            })
        });

        const data = await response.json();

        if (response.ok) {
            document.getElementById('invite-qr-code').innerHTML = 
                `<img src="${data.qrCode}" alt="QR Code" style="max-width: 200px;">`;
            document.getElementById('invite-token-display').value = data.token;
            document.getElementById('invite-url-display').value = data.inviteUrl;
            document.getElementById('invite-result').style.display = 'block';
            
            loadInvites();
        } else {
            alert('Error: ' + (data.error || 'Failed to generate invite'));
        }
    } catch (error) {
        alert('Network error: ' + error.message);
    }
});

function copyInviteToken() {
    const input = document.getElementById('invite-token-display');
    input.select();
    document.execCommand('copy');
    alert('Token copied to clipboard!');
}

function copyInviteUrl() {
    const input = document.getElementById('invite-url-display');
    input.select();
    document.execCommand('copy');
    alert('URL copied to clipboard!');
}

async function acceptInvite() {
    const token = document.getElementById('accept-invite-token').value.trim();
    
    if (!token) {
        alert('Please enter an invite token');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/invites/accept`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token })
        });

        const data = await response.json();

        if (response.ok) {
            alert(`Invite accepted! Permissions granted: ${data.permissions.join(', ')}`);
            document.getElementById('accept-invite-token').value = '';
            loadDocuments();
        } else {
            alert('Error: ' + (data.error || 'Failed to accept invite'));
        }
    } catch (error) {
        alert('Network error: ' + error.message);
    }
}

async function revokeInvite(tokenId) {
    if (!confirm('Revoke this invite?')) return;

    try {
        const response = await fetch(`${API_BASE}/invites/${tokenId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (response.ok) {
            alert('Invite revoked successfully!');
            loadInvites();
        } else {
            alert('Error: ' + (data.error || 'Failed to revoke invite'));
        }
    } catch (error) {
        alert('Network error: ' + error.message);
    }
}

// ==================== Utilities ====================

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Handle invite acceptance from URL
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const inviteToken = urlParams.get('token');
    
    if (inviteToken) {
        // Store for after login
        sessionStorage.setItem('pendingInvite', inviteToken);
        alert('Please login to accept this invite.');
    }
});
