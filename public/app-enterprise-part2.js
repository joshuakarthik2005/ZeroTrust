// ========================================
// ENTERPRISE FEATURES PART 2
// Documents, Folders, Versions, Comments, etc.
// ========================================

// ==================== FOLDERS ====================

async function loadFolders() {
    try {
        const response = await fetch(`${API_BASE}/folders`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            folders = await response.json();
            renderFolderTree();
            populateFolderDropdown();
        }
    } catch (error) {
        console.error('Error loading folders:', error);
    }
}

function renderFolderTree() {
    const container = document.getElementById('folder-tree');
    container.innerHTML = '<div class="folder-item" onclick="loadDocuments()">📁 All Documents</div>';
    
    function renderFolder(folder, level = 0) {
        const div = document.createElement('div');
        div.className = 'folder-item';
        div.style.paddingLeft = `${level * 20}px`;
        div.innerHTML = `📁 ${folder.name}`;
        div.onclick = () => loadDocumentsByFolder(folder._id);
        container.appendChild(div);
        
        folder.children?.forEach(child => renderFolder(child, level + 1));
    }
    
    folders.forEach(folder => renderFolder(folder));
}

function populateFolderDropdown() {
    const select = document.getElementById('new-doc-folder');
    select.innerHTML = '<option value="">No folder (root)</option>';
    
    folders.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder._id;
        option.textContent = folder.path || folder.name;
        select.appendChild(option);
    });
}

async function createFolder() {
    const name = prompt('Enter folder name:');
    if (!name) return;
    
    try {
        const response = await fetch(`${API_BASE}/folders`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name })
        });

        if (response.ok) {
            showMessage('Folder created', 'success');
            await loadFolders();
        }
    } catch (error) {
        console.error('Error creating folder:', error);
    }
}

// ==================== DOCUMENTS ====================

async function loadDocuments() {
    try {
        // Build query params with current org/workspace
        const params = new URLSearchParams();
        if (currentOrganization) {
            params.append('organizationId', currentOrganization);
        }
        if (currentWorkspace) {
            params.append('workspaceId', currentWorkspace);
        }
        
        const response = await fetch(`${API_BASE}/documents?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            documents = Array.isArray(data) ? data : (data.documents || []);
            renderDocuments(documents);
        }
    } catch (error) {
        console.error('Error loading documents:', error);
    }
}

async function loadDocumentsByFolder(folderId) {
    const filtered = documents.filter(doc => doc.folderId === folderId);
    renderDocuments(filtered);
}

function renderDocuments(docs) {
    const container = document.getElementById('documents-container');
    container.innerHTML = '';
    
    if (docs.length === 0) {
        container.innerHTML = '<p>No documents found. Create your first document!</p>';
        return;
    }
    
    docs.forEach(doc => {
        const div = document.createElement('div');
        div.className = 'document-card';
        div.innerHTML = `
            <div class="doc-header">
                <h3>${doc.title}</h3>
                ${doc.encrypted ? '🔒' : ''}
                ${doc.signed ? '✍️' : ''}
            </div>
            <p class="doc-meta">
                Created: ${new Date(doc.createdAt).toLocaleDateString()}
                ${doc.currentVersion ? `| Version ${doc.currentVersion}` : ''}
            </p>
            <div class="doc-actions">
                <button onclick="viewDocument('${doc.id}')">View</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function searchDocuments() {
    const query = document.getElementById('doc-search').value.toLowerCase();
    const filtered = documents.filter(doc => 
        doc.title.toLowerCase().includes(query) ||
        doc.content?.toLowerCase().includes(query)
    );
    renderDocuments(filtered);
}

function showCreateDocModal() {
    closeModals();
    document.getElementById('create-doc-modal').classList.add('active');
    document.getElementById('modal-overlay').classList.add('active');
}

async function createDocument() {
    const title = document.getElementById('new-doc-title').value;
    const encrypted = document.getElementById('new-doc-encrypted').checked;
    const folderId = document.getElementById('new-doc-folder').value;
    const docType = document.querySelector('input[name="doc-type"]:checked').value;
    
    if (!title) {
        showMessage('Please enter a document title', 'error');
        return;
    }
    
    try {
        let response;
        
        if (docType === 'upload' && selectedFile) {
            // File upload
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('title', title);
            formData.append('encrypted', encrypted);
            if (folderId) formData.append('folderId', folderId);
            // Include current org/workspace
            if (currentOrganization) formData.append('organizationId', currentOrganization);
            if (currentWorkspace) formData.append('workspaceId', currentWorkspace);
            
            response = await fetch(`${API_BASE}/documents/upload`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${authToken}`
                },
                body: formData
            });
        } else {
            // Text document
            const content = document.getElementById('new-doc-content').value;
            
            if (!content) {
                showMessage('Please enter document content', 'error');
                return;
            }
            
            response = await fetch(`${API_BASE}/documents`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title, content, encrypted, folderId: folderId || null })
            });
        }

        if (response.ok) {
            showMessage('Document created successfully', 'success');
            await loadDocuments();
            closeModals();
            
            // Reset form
            document.getElementById('new-doc-title').value = '';
            document.getElementById('new-doc-content').value = '';
            removeUploadedFile();
        } else {
            const error = await response.json();
            showMessage(error.error || 'Failed to create document', 'error');
        }
    } catch (error) {
        console.error('Error creating document:', error);
        showMessage('Failed to create document', 'error');
    }
}

async function viewDocument(docId) {
    console.log('viewDocument called with ID:', docId);
    currentDocumentId = docId;
    
    if (!docId) {
        console.error('viewDocument: No document ID provided!');
        showMessage('Error: No document ID', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/documents/${docId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const doc = await response.json();
            console.log('Document fetched:', doc.id, doc.title);
            displayDocument(doc);
            await loadComments(docId);
        } else {
            const error = await response.json();
            console.error('Error response:', error);
            showMessage(error.error || 'Failed to load document', 'error');
        }
    } catch (error) {
        console.error('Error viewing document:', error);
        showMessage('Failed to load document', 'error');
    }
}

function displayDocument(doc) {
    document.getElementById('document-list-view').classList.remove('active');
    document.getElementById('document-view').classList.add('active');
    
    document.getElementById('doc-title').textContent = doc.title;
    
    // Check if this is an uploaded file
    if (doc.hasFile && doc.filePath) {
        // Display file information and download/view button
        const contentDiv = document.getElementById('doc-content');
        contentDiv.innerHTML = `
            <div class="uploaded-file-view">
                <div class="file-icon">📄</div>
                <h3>${doc.fileName || doc.title}</h3>
                <p>File Type: ${doc.fileType || 'Unknown'}</p>
                <p>Size: ${formatFileSize(doc.fileSize || 0)}</p>
                <p>MIME Type: ${doc.mimeType || 'Unknown'}</p>
                <br>
                <button onclick="downloadDocument('${doc.id}')" class="btn-primary">📥 Download/View File</button>
            </div>
        `;
    } else {
        // Display text content
        document.getElementById('doc-content').textContent = doc.content;
    }
    
    // Show/hide action buttons based on permissions
    const perms = doc.permissions || [];
    document.getElementById('edit-btn').style.display = perms.includes('write') && !doc.hasFile ? 'block' : 'none';
    document.getElementById('sign-btn').style.display = perms.includes('sign') ? 'block' : 'none';
    document.getElementById('share-btn').style.display = perms.includes('share') ? 'block' : 'none';
    document.getElementById('download-btn').style.display = perms.includes('download') ? 'block' : 'none';
    
    // Display signatures
    const sigList = document.getElementById('signatures-list');
    sigList.innerHTML = '';
    if (doc.signatures && doc.signatures.length > 0) {
        doc.signatures.forEach(sig => {
            const div = document.createElement('div');
            div.className = 'signature-item';
            div.innerHTML = `
                <span>✍️ ${sig.username}</span>
                <span>${new Date(sig.timestamp).toLocaleString()}</span>
                ${sig.invalidated ? '<span class="badge error">Invalidated</span>' : '<span class="badge success">Valid</span>'}
            `;
            sigList.appendChild(div);
        });
    } else {
        sigList.innerHTML = '<p>No signatures</p>';
    }
    
    // Display metadata
    document.getElementById('doc-metadata').innerHTML = `
        <p><strong>Owner:</strong> ${doc.ownerId}</p>
        <p><strong>Created:</strong> ${new Date(doc.createdAt).toLocaleString()}</p>
        <p><strong>Modified:</strong> ${new Date(doc.updatedAt).toLocaleString()}</p>
        <p><strong>Version:</strong> ${doc.currentVersion || 1}</p>
        <p><strong>Encrypted:</strong> ${doc.encrypted ? 'Yes' : 'No'}</p>
        <p><strong>Hash:</strong> <code>${doc.hash ? doc.hash.substring(0, 16) + '...' : 'N/A'}</code></p>
    `;
}

function backToList() {
    document.getElementById('document-view').classList.remove('active');
    document.getElementById('document-list-view').classList.add('active');
    currentDocumentId = null;
}

function editDocument() {
    const content = document.getElementById('doc-content').textContent;
    document.getElementById('doc-content').style.display = 'none';
    document.getElementById('doc-content-edit').style.display = 'block';
    document.getElementById('doc-content-edit').value = content;
    document.getElementById('save-btn').style.display = 'block';
}

async function saveDocument() {
    const content = document.getElementById('doc-content-edit').value;
    
    try {
        const response = await fetch(`${API_BASE}/documents/${currentDocumentId}`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content })
        });

        if (response.ok) {
            showMessage('Document saved', 'success');
            document.getElementById('doc-content').textContent = content;
            document.getElementById('doc-content').style.display = 'block';
            document.getElementById('doc-content-edit').style.display = 'none';
            document.getElementById('save-btn').style.display = 'none';
            await viewDocument(currentDocumentId); // Reload to get new version
        }
    } catch (error) {
        console.error('Error saving document:', error);
    }
}

async function signDocument() {
    if (!confirm('Sign this document? This action will be recorded in the audit log.')) return;
    
    try {
        const response = await fetch(`${API_BASE}/documents/${currentDocumentId}/sign`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            showMessage('Document signed successfully', 'success');
            await viewDocument(currentDocumentId);
        } else {
            const data = await response.json();
            if (data.reAuthRequired) {
                await handleReAuth('sign');
            } else {
                showMessage(data.error || 'Failed to sign document', 'error');
            }
        }
    } catch (error) {
        console.error('Error signing document:', error);
    }
}

async function downloadDocument(docId) {
    console.log('downloadDocument called with ID:', docId, 'currentDocumentId:', currentDocumentId);
    const id = docId || currentDocumentId;
    if (!id) {
        console.error('downloadDocument: No document ID available!');
        showMessage('Error: No document ID', 'error');
        return;
    }
    
    console.log('Using document ID:', id);
    
    try {
        // First check if it's an uploaded file
        const docResponse = await fetch(`${API_BASE}/documents/${id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (docResponse.ok) {
            const doc = await docResponse.json();
            
            if (doc.hasFile && doc.filePath) {
                // Download uploaded file with authentication
                console.log('Fetching file for document:', id);
                const fileResponse = await fetch(`${API_BASE}/documents/${id}/file`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                
                console.log('File response status:', fileResponse.status);
                
                if (fileResponse.ok) {
                    const blob = await fileResponse.blob();
                    console.log('Blob received, size:', blob.size, 'type:', blob.type);
                    const url = URL.createObjectURL(blob);
                    
                    // Open in new tab for viewing
                    const newWindow = window.open(url, '_blank');
                    if (!newWindow) {
                        // Fallback: trigger download
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = doc.fileName || doc.title;
                        a.click();
                    }
                    
                    // Clean up URL after a delay
                    setTimeout(() => URL.revokeObjectURL(url), 60000);
                } else {
                    console.error('File download failed:', fileResponse.status);
                    try {
                        const error = await fileResponse.json();
                        showMessage(error.error || 'Failed to download file', 'error');
                    } catch (e) {
                        showMessage('Failed to download file: Server error', 'error');
                    }
                }
            } else {
                // Download text content
                const blob = new Blob([doc.content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${doc.title}.txt`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } else {
            const error = await docResponse.json();
            showMessage(error.error || 'Failed to load document', 'error');
        }
    } catch (error) {
        console.error('Error downloading document:', error);
        showMessage('Failed to download document', 'error');
    }
}

// ==================== SHARING ====================

function showShareModal() {
    closeModals();
    document.getElementById('share-modal').classList.add('active');
    document.getElementById('modal-overlay').classList.add('active');
}

async function shareDocument() {
    const email = document.getElementById('share-email').value;
    const permissions = Array.from(document.querySelectorAll('.perm-check:checked')).map(cb => cb.value);
    
    if (!email || permissions.length === 0) {
        showMessage('Please enter email and select at least one permission', 'error');
        return;
    }
    
    // Find user by email first
    try {
        const userResponse = await fetch(`${API_BASE}/users/search?email=${email}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!userResponse.ok) {
            showMessage('User not found', 'error');
            return;
        }
        
        const user = await userResponse.json();
        
        const response = await fetch(`${API_BASE}/documents/${currentDocumentId}/share`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                userId: user.id, 
                permissions 
            })
        });

        if (response.ok) {
            showMessage('Document shared successfully', 'success');
            closeModals();
        } else {
            const data = await response.json();
            if (data.reAuthRequired) {
                await handleReAuth('share');
            }
        }
    } catch (error) {
        console.error('Error sharing document:', error);
    }
}

// Export functions to global scope
window.loadFolders = loadFolders;
window.createFolder = createFolder;
window.loadDocuments = loadDocuments;
window.loadDocumentsByFolder = loadDocumentsByFolder;
window.showNewDocumentModal = showNewDocumentModal;
window.createDocument = createDocument;
window.viewDocument = viewDocument;
window.backToList = backToList;
window.editDocument = editDocument;
window.saveDocument = saveDocument;
window.signDocument = signDocument;
window.downloadDocument = downloadDocument;
window.showShareModal = showShareModal;
window.shareDocument = shareDocument;
window.selectDocType = selectDocType;
window.handleFileSelect = handleFileSelect;
window.removeUploadedFile = removeUploadedFile;

