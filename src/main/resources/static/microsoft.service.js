class MicrosoftService {
    constructor() {
        this.graphBaseUrl = 'https://graph.microsoft.com/v1.0';
        this.isInitialized = false;
        this.microsoftClientId = null;
        this.accessToken = null;
        this.currentPath = '/';
        this.currentView = 'onedrive'; // 'onedrive' or 'sharepoint'
        window.microsoftService = this; // Make globally accessible
    }

    async init() {
        if (this.isInitialized) return;

        try {
            const response = await fetch('/api/auth/config');
            const config = await response.json();
            this.microsoftClientId = config.microsoftClientId;
            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize Microsoft service:', error);
        }
    }

    async connectMicrosoft() {
        if (!this.isInitialized) {
            await this.init();
        }

        try {
            const response = await fetch('/api/microsoft/auth/url');
            const data = await response.json();
            
            // Open Microsoft OAuth in popup
            const popup = window.open(
                data.authUrl,
                'microsoft-auth',
                'width=600,height=700,scrollbars=yes,resizable=yes'
            );

            return new Promise((resolve, reject) => {
                const checkClosed = setInterval(() => {
                    if (popup.closed) {
                        clearInterval(checkClosed);
                        reject(new Error('Authentication cancelled'));
                    }
                }, 1000);

                const handleMessage = (event) => {
                    if (event.data.type === 'MICROSOFT_AUTH_SUCCESS') {
                        clearInterval(checkClosed);
                        window.removeEventListener('message', handleMessage);
                        resolve(event.data.user);
                    }
                };

                window.addEventListener('message', handleMessage);
            });
        } catch (error) {
            console.error('Failed to connect Microsoft:', error);
            throw error;
        }
    }

    async getUserFiles() {
        try {
            const response = await fetch('/api/microsoft/files', {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch OneDrive files');
            }
            
            const data = await response.json();
            return data.value || [];
        } catch (error) {
            console.error('Error fetching OneDrive files:', error);
            throw error;
        }
    }

    async getSharePointSites() {
        try {
            const response = await fetch('/api/microsoft/sites', {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch SharePoint sites');
            }
            
            const data = await response.json();
            return data.value || [];
        } catch (error) {
            console.error('Error fetching SharePoint sites:', error);
            throw error;
        }
    }

    async getSiteFiles(siteId) {
        try {
            const response = await fetch(`/api/microsoft/sites/${siteId}/files`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch SharePoint files');
            }
            
            const data = await response.json();
            return data.value || [];
        } catch (error) {
            console.error('Error fetching SharePoint files:', error);
            throw error;
        }
    }

    async openMicrosoftPicker() {
        try {
            // Get access token from backend
            const tokenResponse = await fetch('/api/microsoft/token', {
                credentials: 'include'
            });
            
            if (!tokenResponse.ok) {
                throw new Error('Failed to get Microsoft access token');
            }
            
            const tokenData = await tokenResponse.json();
            this.accessToken = tokenData.accessToken;
            
            // Show file picker modal
            this.showFilePickerModal();
            
            // Load files from OneDrive using Graph API directly
            const files = await this.loadOneDriveFiles();
            this.displayFilesInPicker(files);
            
        } catch (error) {
            console.error('Error opening Microsoft picker:', error);
            throw error;
        }
    }

    async loadOneDriveFiles() {
        try {
            if (!this.accessToken) {
                throw new Error('No access token available');
            }
            
            const response = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch OneDrive files');
            }
            
            const data = await response.json();
            return data.value || [];
        } catch (error) {
            console.error('Error loading OneDrive files:', error);
            // Fallback to backend API
            return await this.getUserFiles();
        }
    }

    showFilePickerModal() {
        // Create modal HTML
        const modalHtml = `
            <div class="modal fade" id="microsoftPickerModal" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fab fa-microsoft me-2"></i>
                                Select Files from OneDrive & SharePoint
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row mb-3">
                                <div class="col-12">
                                    <div class="btn-group" role="group">
                                        <button type="button" class="btn btn-outline-primary active" id="oneDriveTab" onclick="window.microsoftService.switchToOneDrive()">
                                            <i class="fab fa-microsoft me-1"></i> OneDrive
                                        </button>
                                        <button type="button" class="btn btn-outline-primary" id="sharePointTab" onclick="window.microsoftService.switchToSharePoint()">
                                            <i class="fas fa-sitemap me-1"></i> SharePoint
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div id="microsoftBreadcrumb"></div>
                            <div id="microsoftFilesList" class="row">
                                <div class="col-12 text-center">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                    <p class="mt-2">Loading OneDrive files...</p>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" id="selectMicrosoftFilesBtn" class="btn btn-primary" disabled>
                                Select Files
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if present and prevent duplicate popups
        const existingModal = document.getElementById('microsoftPickerModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Clear any existing bootstrap modal backdrop
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(backdrop => backdrop.remove());
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('microsoftPickerModal'));
        modal.show();
        
        // Set up select button handler
        document.getElementById('selectMicrosoftFilesBtn').addEventListener('click', () => {
            this.handleFileSelection();
            modal.hide();
        });
    }

    displayFilesInPicker(files, currentPath = '/') {
        const filesList = document.getElementById('microsoftFilesList');
        
        // Update breadcrumb
        this.updateBreadcrumb(currentPath);
        
        if (!files || files.length === 0) {
            filesList.innerHTML = `
                <div class="col-12 text-center">
                    <i class="fas fa-folder-open fa-3x text-muted mb-3"></i>
                    <p>No files found in this location</p>
                </div>
            `;
            return;
        }
        
        filesList.innerHTML = files.map(file => {
            const isFolder = file.folder !== undefined;
            const icon = isFolder ? '<i class="fas fa-folder fa-2x text-warning"></i>' : this.getFileIcon(file.file?.mimeType || 'application/octet-stream');
            
            return `
                <div class="col-md-6 col-lg-4 mb-3">
                    <div class="card file-card ${isFolder ? 'folder-card' : ''}" 
                         data-file-id="${file.id}" 
                         data-file-type="${isFolder ? 'folder' : 'file'}"
                         ${isFolder ? `onclick="window.microsoftService.navigateToFolder('${file.id}', '${file.name}')"` : ''}>
                        <div class="card-body text-center">
                            <div class="file-icon mb-2">
                                ${icon}
                            </div>
                            <h6 class="card-title text-truncate" title="${file.name}">${file.name}</h6>
                            <small class="text-muted">
                                ${isFolder ? `${file.folder.childCount || 0} items` : this.formatFileSize(file.size)}
                                <br>
                                ${new Date(file.lastModifiedDateTime).toLocaleDateString()}
                            </small>
                            ${!isFolder ? `
                                <div class="form-check mt-2">
                                    <input class="form-check-input file-checkbox" type="checkbox" 
                                           data-file='${JSON.stringify(file)}' id="file-${file.id}">
                                    <label class="form-check-label" for="file-${file.id}">
                                        Select
                                    </label>
                                </div>
                            ` : `
                                <div class="mt-2">
                                    <small class="text-primary"><i class="fas fa-mouse-pointer"></i> Click to open</small>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Enable/disable select button based on selections
        const checkboxes = filesList.querySelectorAll('.file-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const selectedCount = filesList.querySelectorAll('.file-checkbox:checked').length;
                document.getElementById('selectMicrosoftFilesBtn').disabled = selectedCount === 0;
            });
        });
    }

    updateBreadcrumb(currentPath) {
        const breadcrumbContainer = document.getElementById('microsoftBreadcrumb');
        if (!breadcrumbContainer) return;
        
        const pathParts = currentPath.split('/').filter(part => part);
        let breadcrumb = '<nav aria-label="breadcrumb"><ol class="breadcrumb mb-2">';
        
        breadcrumb += '<li class="breadcrumb-item"><a href="#" onclick="window.microsoftService.navigateToRoot()">OneDrive</a></li>';
        
        pathParts.forEach((part, index) => {
            if (index === pathParts.length - 1) {
                breadcrumb += `<li class="breadcrumb-item active">${part}</li>`;
            } else {
                const partialPath = '/' + pathParts.slice(0, index + 1).join('/');
                breadcrumb += `<li class="breadcrumb-item"><a href="#" onclick="window.microsoftService.navigateToPath('${partialPath}')">${part}</a></li>`;
            }
        });
        
        breadcrumb += '</ol></nav>';
        breadcrumbContainer.innerHTML = breadcrumb;
    }

    async navigateToFolder(folderId, folderName) {
        try {
            const loadingDiv = document.getElementById('microsoftFilesList');
            loadingDiv.innerHTML = `
                <div class="col-12 text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Loading folder contents...</p>
                </div>
            `;
            
            const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load folder contents');
            }
            
            const data = await response.json();
            this.currentPath = this.currentPath + '/' + folderName;
            this.displayFilesInPicker(data.value || [], this.currentPath);
        } catch (error) {
            console.error('Error navigating to folder:', error);
            if (window.app && window.app.showError) {
                window.app.showError('Failed to load folder contents');
            }
        }
    }

    async navigateToRoot() {
        this.currentPath = '/';
        const files = await this.loadOneDriveFiles();
        this.displayFilesInPicker(files, this.currentPath);
    }

    async handleFileSelection() {
        const selectedCheckboxes = document.querySelectorAll('#microsoftFilesList .file-checkbox:checked');
        const selectedFiles = Array.from(selectedCheckboxes).map(checkbox => 
            JSON.parse(checkbox.dataset.file)
        );
        
        if (selectedFiles.length === 0) {
            return;
        }
        
        try {
            // Save selected files to backend
            for (const file of selectedFiles) {
                await this.saveFileMetadata(file);
            }
            
            // Trigger app refresh
            if (window.app && window.app.loadSavedFiles) {
                await window.app.loadSavedFiles();
            }
            
            // Show success message
            if (window.app && window.app.showSuccess) {
                window.app.showSuccess(`Selected ${selectedFiles.length} file(s) from OneDrive`);
            }
            
        } catch (error) {
            console.error('Error handling file selection:', error);
            if (window.app && window.app.showError) {
                window.app.showError('Failed to save selected files');
            }
        }
    }

    async saveFileMetadata(fileMetadata) {
        try {
            const response = await fetch('/api/microsoft/files/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(fileMetadata)
            });
            
            if (!response.ok) {
                throw new Error('Failed to save file metadata');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error saving Microsoft file metadata:', error);
            throw error;
        }
    }

    async downloadFile(fileId, fileName) {
        try {
            const response = await fetch(`/api/microsoft/files/${fileId}/download`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to download file');
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading file:', error);
            throw error;
        }
    }

    getFileIcon(mimeType) {
        if (!mimeType) return 'fas fa-file';
        
        if (mimeType.includes('image')) return 'fas fa-file-image';
        if (mimeType.includes('video')) return 'fas fa-file-video';
        if (mimeType.includes('audio')) return 'fas fa-file-audio';
        if (mimeType.includes('pdf')) return 'fas fa-file-pdf';
        if (mimeType.includes('word')) return 'fas fa-file-word';
        if (mimeType.includes('excel')) return 'fas fa-file-excel';
        if (mimeType.includes('powerpoint')) return 'fas fa-file-powerpoint';
        if (mimeType.includes('zip') || mimeType.includes('archive')) return 'fas fa-file-archive';
        if (mimeType.includes('text')) return 'fas fa-file-alt';
        
        return 'fas fa-file';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getFileTypeLabel(mimeType) {
        if (!mimeType) return 'Unknown';
        
        const typeMap = {
            'image': 'Image',
            'video': 'Video',
            'audio': 'Audio',
            'pdf': 'PDF',
            'word': 'Word Document',
            'excel': 'Excel Spreadsheet',
            'powerpoint': 'PowerPoint',
            'text': 'Text File',
            'zip': 'Archive',
            'archive': 'Archive'
        };
        
        for (const [key, value] of Object.entries(typeMap)) {
            if (mimeType.includes(key)) {
                return value;
            }
        }
        
        return 'File';
    }

    async switchToOneDrive() {
        this.currentView = 'onedrive';
        document.getElementById('oneDriveTab').classList.add('active');
        document.getElementById('sharePointTab').classList.remove('active');
        
        this.currentPath = '/';
        const files = await this.loadOneDriveFiles();
        this.displayFilesInPicker(files, this.currentPath);
    }

    async switchToSharePoint() {
        this.currentView = 'sharepoint';
        document.getElementById('sharePointTab').classList.add('active');
        document.getElementById('oneDriveTab').classList.remove('active');
        
        try {
            const sites = await this.getSharePointSites();
            this.displaySharePointSites(sites);
        } catch (error) {
            console.error('Error loading SharePoint sites:', error);
            if (window.app && window.app.showError) {
                window.app.showError('Failed to load SharePoint sites');
            }
        }
    }

    displaySharePointSites(sites) {
        const filesList = document.getElementById('microsoftFilesList');
        const breadcrumbContainer = document.getElementById('microsoftBreadcrumb');
        
        breadcrumbContainer.innerHTML = '<nav aria-label="breadcrumb"><ol class="breadcrumb mb-2"><li class="breadcrumb-item active">SharePoint Sites</li></ol></nav>';
        
        if (!sites || sites.length === 0) {
            filesList.innerHTML = `
                <div class="col-12 text-center">
                    <i class="fas fa-sitemap fa-3x text-muted mb-3"></i>
                    <p>No SharePoint sites found</p>
                </div>
            `;
            return;
        }
        
        filesList.innerHTML = sites.map(site => `
            <div class="col-md-6 col-lg-4 mb-3">
                <div class="card site-card" onclick="window.microsoftService.navigateToSharePointSite('${site.id}', '${site.displayName}')">
                    <div class="card-body text-center">
                        <div class="site-icon mb-2">
                            <i class="fas fa-sitemap fa-2x text-info"></i>
                        </div>
                        <h6 class="card-title text-truncate" title="${site.displayName}">${site.displayName}</h6>
                        <small class="text-muted">
                            SharePoint Site
                            <br>
                            ${new Date(site.lastModifiedDateTime).toLocaleDateString()}
                        </small>
                        <div class="mt-2">
                            <small class="text-primary"><i class="fas fa-mouse-pointer"></i> Click to open</small>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async navigateToSharePointSite(siteId, siteName) {
        try {
            const loadingDiv = document.getElementById('microsoftFilesList');
            loadingDiv.innerHTML = `
                <div class="col-12 text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Loading SharePoint files...</p>
                </div>
            `;
            
            const files = await this.getSiteFiles(siteId);
            
            const breadcrumbContainer = document.getElementById('microsoftBreadcrumb');
            breadcrumbContainer.innerHTML = `
                <nav aria-label="breadcrumb">
                    <ol class="breadcrumb mb-2">
                        <li class="breadcrumb-item"><a href="#" onclick="window.microsoftService.switchToSharePoint()">SharePoint</a></li>
                        <li class="breadcrumb-item active">${siteName}</li>
                    </ol>
                </nav>
            `;
            
            this.displayFilesInPicker(files, '/' + siteName);
        } catch (error) {
            console.error('Error loading SharePoint site:', error);
            if (window.app && window.app.showError) {
                window.app.showError('Failed to load SharePoint site files');
            }
        }
    }
}

// Global instance
const microsoftService = new MicrosoftService();