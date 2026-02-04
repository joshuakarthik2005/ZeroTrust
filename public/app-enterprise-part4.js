// ========================================
// ENTERPRISE FEATURES PART 4
// Notifications, Version History, Re-Auth, Utilities
// ========================================

// ==================== NOTIFICATIONS ====================

let notificationInterval = null;

function initNotifications() {
    loadNotifications();
    // Poll every 30 seconds
    notificationInterval = setInterval(loadNotifications, 30000);
}

async function loadNotifications() {
    try {
        const response = await fetch(`${API_BASE}/notifications?unreadOnly=true`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            const notifications = Array.isArray(data) ? data : (data.notifications || []);
            updateNotificationBadge(notifications.length);
            renderNotificationsDropdown(notifications);
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

function updateNotificationBadge(count) {
    const badge = document.getElementById('notification-badge');
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'block';
    } else {
        badge.style.display = 'none';
    }
}

function toggleNotifications() {
    const dropdown = document.getElementById('notifications-dropdown');
    dropdown.classList.toggle('active');
}

function renderNotificationsDropdown(notifications) {
    const container = document.getElementById('notifications-list');
    container.innerHTML = '';
    
    if (notifications.length === 0) {
        container.innerHTML = '<p class="no-notifications">No new notifications</p>';
        return;
    }
    
    notifications.forEach(notif => {
        const div = document.createElement('div');
        div.className = `notification-item priority-${notif.priority}`;
        div.innerHTML = `
            <div class="notification-header">
                <strong>${notif.title}</strong>
                <span class="badge ${notif.priority}">${notif.priority}</span>
            </div>
            <p>${notif.message}</p>
            <small>${new Date(notif.createdAt).toLocaleString()}</small>
            <button onclick="markNotificationRead('${notif._id}')">✓ Mark Read</button>
        `;
        container.appendChild(div);
    });
}

async function markNotificationRead(notificationId) {
    try {
        await fetch(`${API_BASE}/notifications/${notificationId}/read`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        await loadNotifications();
    } catch (error) {
        console.error('Error marking notification read:', error);
    }
}

async function markAllRead() {
    try {
        await fetch(`${API_BASE}/notifications/read-all`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        await loadNotifications();
    } catch (error) {
        console.error('Error marking all notifications read:', error);
    }
}

// ==================== VERSION HISTORY ====================

function showVersionHistory(documentId) {
    const id = documentId || currentDocumentId;
    if (!id) {
        showMessage('Open a document first to view versions', 'error');
        return;
    }
    closeModals();
    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('version-history-modal').classList.add('active');
    loadVersionHistory(id);
}

async function loadVersionHistory(documentId) {
    try {
        const response = await fetch(`${API_BASE}/versions/${documentId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const versions = await response.json();
            renderVersionHistory(versions, documentId);
        }
    } catch (error) {
        console.error('Error loading version history:', error);
    }
}

function renderVersionHistory(versions, documentId) {
    const container = document.getElementById('version-history-container');
    container.innerHTML = '';
    
    if (versions.length === 0) {
        container.innerHTML = '<p>No version history available</p>';
        return;
    }
    
    versions.forEach((version, index) => {
        const div = document.createElement('div');
        div.className = 'version-item' + (index === 0 ? ' current-version' : '');
        div.innerHTML = `
            <div class="version-header">
                <h4>Version ${version.version}</h4>
                ${index === 0 ? '<span class="badge">Current</span>' : ''}
            </div>
            <div class="version-details">
                <p><strong>Changed by:</strong> ${version.changedBy?.name || 'Unknown'}</p>
                <p><strong>Date:</strong> ${new Date(version.createdAt).toLocaleString()}</p>
                <p><strong>Description:</strong> ${version.changeDescription || 'No description'}</p>
                <p><strong>Hash:</strong> <code>${version.contentHash.substring(0, 16)}...</code></p>
                ${version.signatures && version.signatures.length > 0 ? `
                    <p><strong>Signatures:</strong> ${version.signatures.filter(s => !s.invalidated).length} valid</p>
                ` : ''}
            </div>
            <div class="version-actions">
                ${index > 0 ? `<button onclick="restoreVersion('${documentId}', '${version._id}')">↻ Restore</button>` : ''}
                ${index > 0 ? `<button onclick="compareVersions('${documentId}', '${versions[index-1]._id}', '${version._id}')">🔍 Compare</button>` : ''}
                <button onclick="downloadVersion('${version._id}')">⬇ Download</button>
            </div>
        `;
        container.appendChild(div);
    });
}

async function restoreVersion(documentId, versionId) {
    if (!confirm('Restore this version? This will create a new version.')) return;
    
    try {
        const response = await fetch(`${API_BASE}/versions/${documentId}/restore/${versionId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            showMessage('Version restored successfully', 'success');
            closeModals();
            await loadDocuments();
        }
    } catch (error) {
        console.error('Error restoring version:', error);
    }
}

async function compareVersions(documentId, version1Id, version2Id) {
    try {
        const response = await fetch(
            `${API_BASE}/versions/${documentId}/compare?v1=${version1Id}&v2=${version2Id}`,
            { headers: { 'Authorization': `Bearer ${authToken}` } }
        );

        if (response.ok) {
            const diff = await response.json();
            displayVersionDiff(diff);
        }
    } catch (error) {
        console.error('Error comparing versions:', error);
    }
}

function displayVersionDiff(diff) {
    const container = document.getElementById('version-diff-container');
    container.innerHTML = `
        <div class="diff-view">
            <h4>Changes</h4>
            <p><strong>Content Hash Changed:</strong> ${diff.contentHashChanged ? 'Yes' : 'No'}</p>
            ${diff.diff ? `<pre>${diff.diff}</pre>` : '<p>No detailed diff available</p>'}
        </div>
    `;
}

async function downloadVersion(versionId) {
    try {
        const response = await fetch(`${API_BASE}/versions/download/${versionId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `version-${versionId}.txt`;
            a.click();
        }
    } catch (error) {
        console.error('Error downloading version:', error);
    }
}

// ==================== RE-AUTHENTICATION ====================

let reAuthResolve = null;

async function handleReAuth() {
    return new Promise((resolve) => {
        reAuthResolve = resolve;
        document.getElementById('reauth-modal').classList.add('active');
        document.getElementById('modal-overlay').classList.add('active');
    });
}

async function submitReAuth() {
    const password = document.getElementById('reauth-password').value;
    if (!password) return;
    
    try {
        const response = await fetch(`${API_BASE}/auth/verify-password`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        });

        if (response.ok) {
            document.getElementById('reauth-password').value = '';
            closeModals();
            if (reAuthResolve) {
                reAuthResolve(true);
                reAuthResolve = null;
            }
        } else {
            showMessage('Invalid password', 'error');
            if (reAuthResolve) {
                reAuthResolve(false);
                reAuthResolve = null;
            }
        }
    } catch (error) {
        console.error('Error during re-auth:', error);
        if (reAuthResolve) {
            reAuthResolve(false);
            reAuthResolve = null;
        }
    }
}

// Handle 401 with reauth requirement
async function handleApiResponse(response) {
    if (response.status === 401) {
        const data = await response.json();
        if (data.requireReAuth) {
            const reAuthed = await handleReAuth();
            if (!reAuthed) {
                throw new Error('Re-authentication failed');
            }
            return 'retry'; // Signal to retry the request
        } else {
            // Token expired, redirect to login
            logout();
            throw new Error('Session expired');
        }
    }
    return response;
}

// ==================== HELPER UTILITIES ====================

function closeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
    document.getElementById('modal-overlay')?.classList.remove('active');
}

function showMessage(message, type = 'info') {
    const container = document.getElementById('message-container');
    if (!container) {
        const div = document.createElement('div');
        div.id = 'message-container';
        div.style.cssText = 'position:fixed;top:20px;right:20px;z-index:10000;';
        document.body.appendChild(div);
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        padding: 12px 20px;
        margin-bottom: 10px;
        border-radius: 4px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease;
    `;
    
    document.getElementById('message-container').appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}

// Prevent copy-paste for DLP (if enabled on document)
function enforceDLP(document) {
    if (document.dlpSettings?.preventCopyPaste) {
        document.getElementById('document-viewer').addEventListener('copy', (e) => {
            e.preventDefault();
            showMessage('Copying is disabled for this document', 'warning');
        });
    }
    
    if (document.dlpSettings?.watermark) {
        addWatermark(document.dlpSettings.watermarkText || 'CONFIDENTIAL');
    }
}

function addWatermark(text) {
    const watermark = document.createElement('div');
    watermark.className = 'watermark';
    watermark.textContent = text;
    watermark.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-45deg);
        font-size: 72px;
        color: rgba(0,0,0,0.1);
        pointer-events: none;
        z-index: 9999;
        user-select: none;
    `;
    document.body.appendChild(watermark);
}

// Export for use in other files
window.enterpriseApp = {
    loadComments,
    addComment,
    resolveComment,
    showTasksModal,
    loadTasks,
    approveTask,
    rejectTask,
    showAuditLogsModal,
    loadAuditLogs,
    verifyAuditChain,
    showSessionsModal,
    loadSessions,
    terminateSession,
    trustSession,
    showComplianceModal,
    loadComplianceData,
    showSecurityLabModal,
    simulateReplayAttack,
    simulatePrivilegeEscalation,
    simulateTamperedUpload,
    initNotifications,
    toggleNotifications,
    markNotificationRead,
    showVersionHistory,
    restoreVersion,
    compareVersions,
    downloadVersion,
    handleReAuth,
    submitReAuth,
    closeModals,
    showMessage,
    enforceDLP,
    switchDocType,
    handleFileSelect,
    removeUploadedFile,
    formatFileSize
};

// ==================== FILE UPLOAD & DOCUMENT TYPE ====================

let selectedFile = null;

function switchDocType(type) {
    const textFields = document.getElementById('text-doc-fields');
    const uploadFields = document.getElementById('upload-doc-fields');
    const options = document.querySelectorAll('.doc-type-option');
    
    options.forEach(opt => {
        if (opt.dataset.type === type) {
            opt.classList.add('active');
        } else {
            opt.classList.remove('active');
        }
    });
    
    if (type === 'text') {
        textFields.style.display = 'block';
        uploadFields.style.display = 'none';
        selectedFile = null;
    } else {
        textFields.style.display = 'none';
        uploadFields.style.display = 'block';
    }
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
        showMessage('File size exceeds 50MB limit', 'error');
        return;
    }
    
    // Validate file type
    const allowedTypes = [
        'application/pdf',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
    ];
    
    if (!allowedTypes.includes(file.type)) {
        showMessage('Unsupported file type. Please upload PDF, PPT, PPTX, DOC, DOCX, or TXT', 'error');
        return;
    }
    
    selectedFile = file;
    
    // Update UI
    document.getElementById('upload-placeholder').style.display = 'none';
    document.getElementById('uploaded-file-info').style.display = 'flex';
    document.getElementById('uploaded-file-name').textContent = file.name;
    document.getElementById('uploaded-file-size').textContent = formatFileSize(file.size);
    
    // Auto-fill title if empty
    const titleInput = document.getElementById('new-doc-title');
    if (!titleInput.value) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        titleInput.value = nameWithoutExt;
    }
}

function removeUploadedFile() {
    selectedFile = null;
    document.getElementById('doc-file-upload').value = '';
    document.getElementById('upload-placeholder').style.display = 'flex';
    document.getElementById('uploaded-file-info').style.display = 'none';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Export functions to global scope
window.toggleNotifications = toggleNotifications;
window.markNotificationRead = markNotificationRead;
window.markAllRead = markAllRead;
window.showVersionHistory = showVersionHistory;
window.restoreVersion = restoreVersion;
window.compareVersions = compareVersions;
window.downloadVersion = downloadVersion;
window.handleReAuth = handleReAuth;
window.submitReAuth = submitReAuth;
window.closeModals = closeModals;
window.showMessage = showMessage;
window.enforceDLP = enforceDLP;
window.switchDocType = switchDocType;
window.handleFileSelect = handleFileSelect;
window.removeUploadedFile = removeUploadedFile;
window.formatFileSize = formatFileSize;

console.log('Enterprise App Part 4 loaded: Notifications, Versioning, Re-Auth, Utilities, File Upload');

