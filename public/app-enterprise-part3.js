// ========================================
// ENTERPRISE FEATURES PART 3
// Comments, Tasks, Audit Logs, Sessions, Compliance, Security Lab
// ========================================

// ==================== COMMENTS ====================

async function loadComments(documentId) {
    try {
        const response = await fetch(`${API_BASE}/comments/${documentId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const comments = await response.json();
            renderComments(comments);
        }
    } catch (error) {
        console.error('Error loading comments:', error);
    }
}

function renderComments(comments) {
    const container = document.getElementById('comments-container');
    container.innerHTML = '';
    
    if (comments.length === 0) {
        container.innerHTML = '<p>No comments yet</p>';
        return;
    }
    
    comments.forEach(comment => {
        const div = document.createElement('div');
        div.className = 'comment-item' + (comment.isResolved ? ' resolved' : '');
        div.innerHTML = `
            <div class="comment-header">
                <strong>${comment.authorName}</strong>
                <span>${new Date(comment.createdAt).toLocaleString()}</span>
            </div>
            <p>${comment.content}</p>
            ${!comment.isResolved ? `<button onclick="resolveComment('${comment._id}')">✓ Resolve</button>` : '<span class="badge">Resolved</span>'}
        `;
        container.appendChild(div);
    });
}

async function addComment() {
    const content = document.getElementById('new-comment').value;
    if (!content) return;
    
    try {
        const response = await fetch(`${API_BASE}/comments/${currentDocumentId}`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content })
        });

        if (response.ok) {
            document.getElementById('new-comment').value = '';
            await loadComments(currentDocumentId);
        }
    } catch (error) {
        console.error('Error adding comment:', error);
    }
}

async function resolveComment(commentId) {
    try {
        await fetch(`${API_BASE}/comments/${commentId}/resolve`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        await loadComments(currentDocumentId);
    } catch (error) {
        console.error('Error resolving comment:', error);
    }
}

// ==================== TASKS & APPROVALS ====================

function showTasksModal() {
    closeModals();
    document.getElementById('tasks-modal').classList.add('active');
    document.getElementById('modal-overlay').classList.add('active');
    loadTasks();
}

async function loadTasks(filter = 'all') {
    try {
        const url = filter === 'assigned' 
            ? `${API_BASE}/tasks?assignedToMe=true`
            : `${API_BASE}/tasks`;
            
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const tasks = await response.json();
            renderTasks(tasks);
        }
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

function renderTasks(tasks) {
    const container = document.getElementById('tasks-container');
    container.innerHTML = '';
    
    if (tasks.length === 0) {
        container.innerHTML = '<p>No tasks found</p>';
        return;
    }
    
    tasks.forEach(task => {
        const div = document.createElement('div');
        div.className = `task-item priority-${task.priority} status-${task.status}`;
        div.innerHTML = `
            <div class="task-header">
                <h4>${task.title}</h4>
                <span class="badge">${task.status}</span>
            </div>
            <p>${task.description || ''}</p>
            <div class="task-meta">
                <span>Priority: ${task.priority}</span>
                <span>Type: ${task.type}</span>
                ${task.dueDate ? `<span>Due: ${new Date(task.dueDate).toLocaleDateString()}</span>` : ''}
            </div>
            ${task.type === 'approval' && task.status === 'pending' ? `
                <div class="task-actions">
                    <button onclick="approveTask('${task._id}')">✓ Approve</button>
                    <button onclick="rejectTask('${task._id}')">✗ Reject</button>
                </div>
            ` : ''}
        `;
        container.appendChild(div);
    });
}

async function approveTask(taskId) {
    const comments = prompt('Approval comments (optional):');
    
    try {
        await fetch(`${API_BASE}/tasks/${taskId}/approve`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ approved: true, comments })
        });
        
        showMessage('Task approved', 'success');
        await loadTasks();
    } catch (error) {
        console.error('Error approving task:', error);
    }
}

async function rejectTask(taskId) {
    const comments = prompt('Rejection reason:');
    if (!comments) return;
    
    try {
        await fetch(`${API_BASE}/tasks/${taskId}/approve`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ approved: false, comments })
        });
        
        showMessage('Task rejected', 'success');
        await loadTasks();
    } catch (error) {
        console.error('Error rejecting task:', error);
    }
}

async function createTask() {
    const title = document.getElementById('task-title')?.value;
    const description = document.getElementById('task-description')?.value;
    const priority = document.getElementById('task-priority')?.value || 'medium';
    const type = document.getElementById('task-type')?.value || 'general';
    
    if (!title) {
        showMessage('Task title is required', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/tasks`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, description, priority, type })
        });
        
        if (response.ok) {
            showMessage('Task created', 'success');
            document.getElementById('task-title').value = '';
            document.getElementById('task-description').value = '';
            await loadTasks();
        }
    } catch (error) {
        console.error('Error creating task:', error);
        showMessage('Failed to create task', 'error');
    }
}

async function updateTaskStatus(taskId, status) {
    try {
        await fetch(`${API_BASE}/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        showMessage('Task updated', 'success');
        await loadTasks();
    } catch (error) {
        console.error('Error updating task:', error);
    }
}

// ==================== AUDIT LOGS ====================

function showAuditLogsModal() {
    closeModals();
    document.getElementById('audit-logs-modal').classList.add('active');
    document.getElementById('modal-overlay').classList.add('active');
    loadAuditLogs();
}

async function loadAuditLogs() {
    const action = document.getElementById('audit-action-filter')?.value;
    const startDate = document.getElementById('audit-start-date')?.value;
    const endDate = document.getElementById('audit-end-date')?.value;
    
    let url = `${API_BASE}/audit-logs?limit=100`;
    if (action) url += `&action=${action}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    
    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const logs = await response.json();
            renderAuditLogs(logs);
        }
    } catch (error) {
        console.error('Error loading audit logs:', error);
    }
}

function renderAuditLogs(logs) {
    const container = document.getElementById('audit-logs-container');
    container.innerHTML = '';
    
    if (logs.length === 0) {
        container.innerHTML = '<p>No audit logs found</p>';
        return;
    }
    
    logs.forEach(log => {
        const div = document.createElement('div');
        div.className = `audit-log-item severity-${log.severity}`;
        div.innerHTML = `
            <div class="log-header">
                <span class="log-action">${log.action}</span>
                <span class="log-result badge ${log.result}">${log.result}</span>
            </div>
            <div class="log-details">
                <p><strong>User:</strong> ${log.userEmail}</p>
                <p><strong>Time:</strong> ${new Date(log.timestamp).toLocaleString()}</p>
                <p><strong>Resource:</strong> ${log.resourceType} - ${log.resourceName || log.resourceId}</p>
                <p><strong>IP:</strong> ${log.ipAddress}</p>
                ${log.severity === 'high' || log.severity === 'critical' ? `<p class="warning">⚠️ ${log.severity.toUpperCase()} SEVERITY</p>` : ''}
            </div>
            <details>
                <summary>Hash Chain Info</summary>
                <p><strong>Sequence:</strong> ${log.sequenceNumber}</p>
                <p><strong>Hash:</strong> <code>${log.currentHash}</code></p>
                <p><strong>Previous Hash:</strong> <code>${log.previousLogHash}</code></p>
            </details>
        `;
        container.appendChild(div);
    });
}

function filterAuditLogs() {
    loadAuditLogs();
}

async function verifyAuditChain() {
    const logs = Array.from(document.querySelectorAll('.audit-log-item'));
    if (logs.length < 2) {
        showMessage('Need at least 2 logs to verify chain', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/audit-logs/verify/chain?fromSequence=1&toSequence=1000`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const result = await response.json();
        
        if (result.valid) {
            showMessage('✅ Audit chain verified! No tampering detected.', 'success');
        } else {
            showMessage(`❌ Chain broken at sequence ${result.brokenAt}!`, 'error');
        }
    } catch (error) {
        console.error('Error verifying audit chain:', error);
    }
}

// ==================== SESSIONS ====================

function showSessionsModal() {
    closeModals();
    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('sessions-modal').classList.add('active');
    loadSessions();
}

async function loadSessions() {
    try {
        const response = await fetch(`${API_BASE}/sessions`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const sessions = await response.json();
            renderSessions(sessions);
        }
    } catch (error) {
        console.error('Error loading sessions:', error);
    }
}

function renderSessions(sessions) {
    const container = document.getElementById('sessions-container');
    container.innerHTML = '';
    
    if (sessions.length === 0) {
        container.innerHTML = '<p>No active sessions</p>';
        return;
    }
    
    sessions.forEach(session => {
        const div = document.createElement('div');
        div.className = `session-item trust-${session.trustLevel}`;
        div.innerHTML = `
            <div class="session-header">
                <h4>🖥️ ${session.deviceInfo.browser || 'Unknown Browser'}</h4>
                <span class="badge ${session.trustLevel}">${session.trustLevel}</span>
            </div>
            <div class="session-details">
                <p><strong>IP:</strong> ${session.ipAddress}</p>
                <p><strong>Location:</strong> ${session.location?.city || 'Unknown'}, ${session.location?.country || 'Unknown'}</p>
                <p><strong>Last Active:</strong> ${new Date(session.lastActivityAt).toLocaleString()}</p>
                <p><strong>Risk Score:</strong> ${session.riskScore}/100</p>
                ${session.anomalies && session.anomalies.length > 0 ? `
                    <p class="warning">⚠️ ${session.anomalies.length} anomalies detected</p>
                ` : ''}
            </div>
            <button onclick="terminateSession('${session._id}')" class="btn-danger">❌ Terminate</button>
            ${session.trustLevel !== 'trusted' ? `<button onclick="trustSession('${session._id}')">✓ Trust Device</button>` : ''}
        `;
        container.appendChild(div);
    });
}

async function terminateSession(sessionId) {
    if (!confirm('Terminate this session?')) return;
    
    try {
        await fetch(`${API_BASE}/sessions/${sessionId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        showMessage('Session terminated', 'success');
        await loadSessions();
    } catch (error) {
        console.error('Error terminating session:', error);
    }
}

async function trustSession(sessionId) {
    const name = prompt('Name this device:');
    if (!name) return;
    
    try {
        await fetch(`${API_BASE}/sessions/${sessionId}/trust`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ deviceName: name })
        });
        
        showMessage('Device trusted', 'success');
        await loadSessions();
    } catch (error) {
        console.error('Error trusting device:', error);
    }
}

// ==================== COMPLIANCE ====================

function showComplianceModal() {
    closeModals();
    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('compliance-modal').classList.add('active');
    loadComplianceData();
}

async function loadComplianceData() {
    try {
        const response = await fetch(`${API_BASE}/compliance/dashboard?days=30`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            renderComplianceData(data);
        }
    } catch (error) {
        console.error('Error loading compliance data:', error);
    }
}

function renderComplianceData(data) {
    document.getElementById('compliance-score').textContent = data.complianceScore;
    
    const container = document.getElementById('compliance-data');
    container.innerHTML = `
        <div class="compliance-section">
            <h4>⚠️ Security Violations</h4>
            <p>Total: ${data.violations.total} (${data.violations.critical} critical, ${data.violations.high} high)</p>
        </div>
        
        <div class="compliance-section">
            <h4>📊 User Activity</h4>
            <p>Top active users in the last ${data.timeRange.days} days</p>
        </div>
        
        <div class="compliance-section">
            <h4>📋 Expired Permissions</h4>
            <p>${data.expiredPermissions.count} documents with expired permissions</p>
        </div>
        
        <div class="compliance-section">
            <h4>🔍 Suspicious Sessions</h4>
            <p>${data.suspiciousSessions.count} suspicious sessions detected</p>
        </div>
        
        <div class="compliance-section">
            <h4>💡 Recommendations</h4>
            ${data.recommendations.map(rec => `
                <div class="recommendation ${rec.severity}">
                    <strong>${rec.title}</strong>
                    <p>${rec.message}</p>
                    <small>${rec.action}</small>
                </div>
            `).join('')}
        </div>
    `;
}

// ==================== SECURITY LAB ====================

function showSecurityLabModal() {
    closeModals();
    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('security-lab-modal').classList.add('active');
}

async function simulateReplayAttack() {
    if (!currentDocumentId) {
        showMessage('Please select a document first', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/security-lab/simulate/replay-attack`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                targetDocumentId: currentDocumentId,
                oldSignature: { documentHash: 'fake-old-hash' }
            })
        });

        const result = await response.json();
        displayLabResult(result);
    } catch (error) {
        console.error('Error simulating attack:', error);
    }
}

async function simulatePrivilegeEscalation() {
    if (!currentDocumentId) {
        showMessage('Please select a document first', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/security-lab/simulate/privilege-escalation`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                targetDocumentId: currentDocumentId,
                attemptedPermission: 'delete' // Try to escalate to delete
            })
        });

        const result = await response.json();
        displayLabResult(result);
    } catch (error) {
        console.error('Error simulating attack:', error);
    }
}

async function simulateTamperedUpload() {
    if (!currentDocumentId) {
        showMessage('Please select a document first', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/security-lab/simulate/tampered-upload`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                documentId: currentDocumentId,
                tamperedContent: 'This is tampered content that should fail hash check'
            })
        });

        const result = await response.json();
        displayLabResult(result);
    } catch (error) {
        console.error('Error simulating attack:', error);
    }
}

function displayLabResult(result) {
    const container = document.getElementById('lab-results');
    const div = document.createElement('div');
    div.className = `lab-result ${result.blocked ? 'blocked' : 'success'}`;
    div.innerHTML = `
        <h4>${result.attackType.replace(/_/g, ' ').toUpperCase()}</h4>
        <p><strong>Detected:</strong> ${result.detected ? '✅ Yes' : '❌ No'}</p>
        <p><strong>Blocked:</strong> ${result.blocked ? '✅ Yes' : '❌ No'}</p>
        <p><strong>Outcome:</strong> ${result.details.outcome}</p>
        <details>
            <summary>Details</summary>
            <pre>${JSON.stringify(result.details, null, 2)}</pre>
        </details>
    `;
    container.prepend(div);
}

// Export functions to global scope
window.showTasksModal = showTasksModal;
window.createTask = createTask;
window.updateTaskStatus = updateTaskStatus;
window.showAuditLogsModal = showAuditLogsModal;
window.loadAuditLogs = loadAuditLogs;
window.filterAuditLogs = filterAuditLogs;
window.verifyAuditChain = verifyAuditChain;
window.showSessionsModal = showSessionsModal;
window.loadSessions = loadSessions;
window.terminateSession = terminateSession;
window.trustSession = trustSession;
window.showComplianceModal = showComplianceModal;
window.loadComplianceData = loadComplianceData;
window.showSecurityLabModal = showSecurityLabModal;
window.simulateReplayAttack = simulateReplayAttack;
window.simulatePrivilegeEscalation = simulatePrivilegeEscalation;
window.simulateTamperedUpload = simulateTamperedUpload;

// Continue with notifications and utilities...

