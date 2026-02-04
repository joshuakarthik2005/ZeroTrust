// ========================================
// ENTERPRISE ZERO-TRUST WORKSPACE
// Complete Frontend Application
// ========================================

// Global State
let authToken = null;
let currentUser = null;
let tempUserId = null;
let tempMfaSecret = null;
let currentDocumentId = null;
let currentOrganization = null;
let currentWorkspace = null;
let documents = [];
let folders = [];
let notifications = [];

// API Base
const API_BASE = '/api';

// ==================== THEME ====================
function applySavedTheme() {
    try {
        const theme = localStorage.getItem('enterpriseTheme');
        if (theme === 'dark') {
            document.body.classList.add('theme-dark');
        } else {
            document.body.classList.remove('theme-dark');
        }
    } catch (_) { /* noop */ }
}

function toggleTheme() {
    const isDark = document.body.classList.toggle('theme-dark');
    try {
        localStorage.setItem('enterpriseTheme', isDark ? 'dark' : 'light');
    } catch (_) { /* noop */ }
}

// Apply theme early
document.addEventListener('DOMContentLoaded', applySavedTheme);

// ==================== INITIALIZATION ====================

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

window.addEventListener('DOMContentLoaded', async () => {
    initFromStorage();
    
    if (authToken && currentUser) {
        try {
            const res = await fetch(`${API_BASE}/auth/me`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            if (res.ok) {
                const userData = await res.json();
                currentUser = userData;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                await showDashboard();
                initRouter(); // Handle initial hash route
            } else {
                logout();
            }
        } catch (error) {
            console.error('Token verification failed:', error);
            logout();
        }
    }
});

// ==================== AUTH FUNCTIONS ====================

function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Find and activate the correct tab button
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        if (btn.textContent.toLowerCase() === tabName) {
            btn.classList.add('active');
        }
    });
}

document.getElementById('register-form')?.addEventListener('submit', async (e) => {
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
            
            document.getElementById('register-form').style.display = 'none';
            document.getElementById('mfa-setup').style.display = 'block';
            document.getElementById('qr-code-container').innerHTML = 
                `<img src="${data.mfaSetup.qrCode}" alt="QR Code">
                 <p>Secret: ${data.mfaSetup.secret}</p>`;
        } else {
            showMessage(data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showMessage('Registration failed', 'error');
    }
});

async function enableMFA() {
    const token = document.getElementById('mfa-setup-token').value;

    try {
        const response = await fetch(`${API_BASE}/auth/enable-mfa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: tempUserId, token })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage('MFA enabled successfully! Please login.', 'success');
            document.getElementById('mfa-setup').style.display = 'none';
            document.getElementById('register-form').style.display = 'block';
            document.getElementById('register-form').reset();
            showTab('login');
        } else {
            showMessage(data.error || 'MFA setup failed', 'error');
        }
    } catch (error) {
        console.error('MFA setup error:', error);
        showMessage('MFA setup failed', 'error');
    }
}

document.getElementById('login-form')?.addEventListener('submit', async (e) => {
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
            if (data.mfaRequired) {
                tempUserId = data.userId;
                document.getElementById('login-form').style.display = 'none';
                document.getElementById('mfa-verify').style.display = 'block';
            } else {
                // Should not happen, but handle it
                authToken = data.token;
                currentUser = data.user;
                localStorage.setItem('authToken', authToken);
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                await showDashboard();
            }
        } else {
            showMessage(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Login failed', 'error');
    }
});

async function verifyMFA() {
    const token = document.getElementById('mfa-token').value;

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
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            await showDashboard();
        } else {
            showMessage(data.error || 'MFA verification failed', 'error');
        }
    } catch (error) {
        console.error('MFA verification error:', error);
        showMessage('MFA verification failed', 'error');
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    
    document.getElementById('auth-screen').classList.add('active');
    document.getElementById('app-screen').classList.remove('active');
    
    document.getElementById('login-form').reset();
    document.getElementById('register-form').reset();
    document.getElementById('mfa-verify').style.display = 'none';
    document.getElementById('mfa-setup').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
}

// ==================== DASHBOARD ====================

async function showDashboard() {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('app-screen').classList.add('active');
    
    document.getElementById('user-info').textContent = `👤 ${currentUser.username}`;
    
    // Load initial data
    await Promise.all([
        loadOrganizations(),
        loadDocuments(),
        loadNotifications()
    ]);
    
    // Start notification polling
    setInterval(loadNotifications, 30000); // Every 30 seconds
}

// ==================== ORGANIZATIONS & WORKSPACES ====================

async function loadOrganizations() {
    try {
        const response = await fetch(`${API_BASE}/organizations`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const orgs = await response.json();
            const selector = document.getElementById('org-selector');
            selector.innerHTML = '<option value="">Select Organization</option>';
            
            orgs.forEach(org => {
                const option = document.createElement('option');
                option.value = org._id;
                option.textContent = org.name;
                selector.appendChild(option);
            });
            
            // Select current if exists
            if (currentUser.currentOrganizationId) {
                selector.value = currentUser.currentOrganizationId;
                await loadWorkspaces();
            }
        }
    } catch (error) {
        console.error('Error loading organizations:', error);
    }
}

async function switchOrganization() {
    const orgId = document.getElementById('org-selector').value;
    if (!orgId) return;
    
    try {
        const response = await fetch(`${API_BASE}/organizations/${orgId}/switch`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            currentOrganization = orgId;
            await loadWorkspaces();
            await loadDocuments();
            showMessage('Organization switched', 'success');
        }
    } catch (error) {
        console.error('Error switching organization:', error);
    }
}

async function loadWorkspaces() {
    try {
        // Only load workspaces for current organization
        let url = `${API_BASE}/workspaces`;
        if (currentOrganization) {
            url += `?organizationId=${currentOrganization}`;
        }
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const workspaces = await response.json();
            const selector = document.getElementById('workspace-selector');
            selector.innerHTML = '<option value="">Select Workspace</option>';
            
            workspaces.forEach(ws => {
                const option = document.createElement('option');
                option.value = ws._id;
                option.textContent = ws.name;
                selector.appendChild(option);
            });
            
            if (currentUser.currentWorkspaceId) {
                selector.value = currentUser.currentWorkspaceId;
                await loadFolders();
            }
        }
    } catch (error) {
        console.error('Error loading workspaces:', error);
    }
}

async function switchWorkspace() {
    const workspaceId = document.getElementById('workspace-selector').value;
    if (!workspaceId) return;
    
    try {
        const response = await fetch(`${API_BASE}/workspaces/${workspaceId}/switch`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            currentWorkspace = workspaceId;
            await loadDocuments();
            await loadFolders();
            showMessage('Workspace switched', 'success');
        }
    } catch (error) {
        console.error('Error switching workspace:', error);
    }
}

function showCreateOrgModal() {
    closeModals();
    document.getElementById('create-org-modal').classList.add('active');
    document.getElementById('modal-overlay').classList.add('active');
}

async function createOrganization() {
    const name = document.getElementById('org-name').value;
    const requireMFA = document.getElementById('org-require-mfa').checked;
    
    if (!name) return;
    
    try {
        const response = await fetch(`${API_BASE}/organizations`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                name, 
                settings: { requireMFA } 
            })
        });

        if (response.ok) {
            showMessage('Organization created successfully', 'success');
            await loadOrganizations();
            closeModals();
        } else {
            const data = await response.json();
            showMessage(data.error || 'Failed to create organization', 'error');
        }
    } catch (error) {
        console.error('Error creating organization:', error);
        showMessage('Failed to create organization', 'error');
    }
}

function showCreateWorkspaceModal() {
    closeModals();
    document.getElementById('create-workspace-modal').classList.add('active');
    document.getElementById('modal-overlay').classList.add('active');
    
    // Populate organization dropdown
    populateWorkspaceOrgDropdown();
}

async function populateWorkspaceOrgDropdown() {
    try {
        const response = await fetch(`${API_BASE}/organizations`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const orgs = await response.json();
            const select = document.getElementById('workspace-org-select');
            select.innerHTML = '<option value="">Select Organization</option>';
            
            orgs.forEach(org => {
                const option = document.createElement('option');
                option.value = org._id;
                option.textContent = org.name;
                if (currentOrganization && org._id === currentOrganization) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading organizations:', error);
    }
}

async function createWorkspace() {
    const name = document.getElementById('workspace-name').value;
    const orgId = document.getElementById('workspace-org-select')?.value || currentOrganization;
    
    if (!name) {
        showMessage('Please enter a workspace name', 'error');
        return;
    }
    
    if (!orgId) {
        showMessage('Please select an organization first', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/workspaces`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, organizationId: orgId })
        });

        if (response.ok) {
            showMessage('Workspace created successfully', 'success');
            await loadWorkspaces();
            closeModals();
        } else {
            const data = await response.json();
            showMessage(data.error || 'Failed to create workspace', 'error');
        }
    } catch (error) {
        console.error('Error creating workspace:', error);
        showMessage('Failed to create workspace', 'error');
    }
}

// ==================== INVITE FUNCTIONS ====================

function showInviteModal() {
    // Close any open modals first (inline to avoid dependency on part4.js)
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    document.getElementById('modal-overlay')?.classList.remove('active');
    
    // Show invite modal
    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('invite-modal').classList.add('active');
    updateInviteContext();
}

function updateInviteContext() {
    const inviteTypeElem = document.getElementById('invite-type');
    const permissionsGroup = document.getElementById('invite-permissions-group');
    const workspacesGroup = document.getElementById('invite-workspaces-group');
    
    if (!inviteTypeElem || !permissionsGroup) return;
    
    const inviteType = inviteTypeElem.value;
    
    if (inviteType === 'document') {
        permissionsGroup.style.display = 'block';
        if (workspacesGroup) workspacesGroup.style.display = 'none';
    } else if (inviteType === 'organization') {
        permissionsGroup.style.display = 'none';
        if (workspacesGroup) {
            workspacesGroup.style.display = 'block';
            populateInviteWorkspaces();
        }
    } else {
        permissionsGroup.style.display = 'none';
        if (workspacesGroup) workspacesGroup.style.display = 'none';
    }
}

async function populateInviteWorkspaces() {
    if (!currentOrganization) return;
    
    try {
        const response = await fetch(`${API_BASE}/workspaces?organizationId=${currentOrganization}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const workspaces = await response.json();
            const container = document.getElementById('invite-workspaces-list');
            container.innerHTML = '';
            
            if (workspaces.length === 0) {
                container.innerHTML = '<p class="text-muted">No workspaces in this organization</p>';
                return;
            }
            
            workspaces.forEach(ws => {
                const label = document.createElement('label');
                label.className = 'checkbox-label';
                label.innerHTML = `
                    <input type="checkbox" class="invite-workspace" value="${ws._id}">
                    ${ws.name}
                `;
                container.appendChild(label);
            });
        }
    } catch (error) {
        console.error('Error loading workspaces:', error);
    }
}

async function sendInvite() {
    const inviteType = document.getElementById('invite-type').value;
    const email = document.getElementById('invite-email').value;
    const role = document.getElementById('invite-role').value;
    const message = document.getElementById('invite-message').value;
    
    if (!email) {
        showMessage('Please enter an email address', 'error');
        return;
    }
    
    try {
        let endpoint = '';
        let body = { email, role, message };
        
        if (inviteType === 'organization' && currentOrganization) {
            endpoint = `${API_BASE}/organizations/${currentOrganization}/invite`;
            
            // Add selected workspaces
            const selectedWorkspaces = Array.from(document.querySelectorAll('.invite-workspace:checked'))
                .map(cb => cb.value);
            if (selectedWorkspaces.length > 0) {
                body.workspaceIds = selectedWorkspaces;
            }
        } else if (inviteType === 'workspace' && currentWorkspace) {
            endpoint = `${API_BASE}/workspaces/${currentWorkspace}/invite`;
        } else if (inviteType === 'document' && currentDocumentId) {
            const permissions = Array.from(document.querySelectorAll('.invite-perm:checked'))
                .map(cb => cb.value);
            body.permissions = permissions;
            endpoint = `${API_BASE}/documents/${currentDocumentId}/share`;
        } else {
            showMessage('Please select an organization, workspace, or document first', 'error');
            return;
        }
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        
        if (response.ok) {
            const data = await response.json();
            showMessage('Invitation sent successfully!', 'success');
            
            // Show invite link if available
            if (data.inviteLink || data.qrCode) {
                document.getElementById('invite-preview').style.display = 'block';
                if (data.inviteLink) {
                    document.getElementById('invite-link').value = data.inviteLink;
                }
                if (data.qrCode) {
                    document.getElementById('invite-qr').innerHTML = `<img src="${data.qrCode}" alt="QR Code">`;
                }
            } else {
                closeModals();
            }
        } else {
            const error = await response.json();
            showMessage(error.error || 'Failed to send invitation', 'error');
        }
    } catch (error) {
        console.error('Error sending invite:', error);
        showMessage('Failed to send invitation', 'error');
    }
}

function copyInviteLink() {
    const linkInput = document.getElementById('invite-link');
    linkInput.select();
    document.execCommand('copy');
    showMessage('Invite link copied to clipboard!', 'success');
}

// ==================== HASH-BASED ROUTER ====================

// Route mappings - use strings to resolve functions at call time from window
const routeMap = {
    'invite': 'showInviteModal',
    'notifications': 'toggleNotifications',
    'sessions': 'showSessionsModal',
    'compliance': 'showComplianceModal',
    'security-lab': 'showSecurityLabModal',
    'audit-logs': 'showAuditLogsModal',
    'version-history': 'showVersionHistory'
};

function navigateTo(route) {
    window.location.hash = route;
}

function handleRoute() {
    const hash = window.location.hash.slice(1); // Remove the #
    
    // Close any open modals first
    document.querySelectorAll('.modal-overlay').forEach(o => o.classList.remove('active'));
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    
    if (hash && routeMap[hash]) {
        const fnName = routeMap[hash];
        if (typeof window[fnName] === 'function') {
            window[fnName]();
        } else {
            console.warn(`Route handler "${fnName}" not found`);
        }
    }
}

// Listen for hash changes
window.addEventListener('hashchange', handleRoute);

// Handle initial route on page load (after dashboard is ready)
function initRouter() {
    if (window.location.hash) {
        // Small delay to ensure all script files have registered their window functions
        setTimeout(() => {
            handleRoute();
        }, 100);
    }
}

// Export functions to global scope
window.showTab = showTab;
window.enableMFA = enableMFA;
window.verifyMFA = verifyMFA;
window.logout = logout;
window.showDashboard = showDashboard;
window.loadOrganizations = loadOrganizations;
window.switchOrganization = switchOrganization;
window.loadWorkspaces = loadWorkspaces;
window.switchWorkspace = switchWorkspace;
window.showCreateOrgModal = showCreateOrgModal;
window.createOrganization = createOrganization;
window.showCreateWorkspaceModal = showCreateWorkspaceModal;
window.createWorkspace = createWorkspace;
window.showInviteModal = showInviteModal;
window.updateInviteContext = updateInviteContext;
window.sendInvite = sendInvite;
window.copyInviteLink = copyInviteLink;
window.toggleTheme = toggleTheme;
window.navigateTo = navigateTo;
window.handleRoute = handleRoute;
window.initRouter = initRouter;

// Continue in next part...

