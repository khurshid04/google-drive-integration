class App {
    constructor() {
        this.authService = window.authService;
        this.driveService = window.driveService;
        this.currentFiles = [];
        this.savedFiles = [];
        this.selectedFile = null;
    }

    async init() {
        try {
            await this.authService.init();
            await this.driveService.init();
            
            this.setupEventListeners();
            await this.updateUI();
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize application');
        }
    }

    setupEventListeners() {
        // Connect button
        document.getElementById('connectBtn').addEventListener('click', () => {
            this.connectGoogleDrive();
        });

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Open picker button
        document.getElementById('openPickerBtn').addEventListener('click', () => {
            this.openGooglePicker();
        });

        // Save file button in modal
        document.getElementById('saveFileBtn').addEventListener('click', () => {
            this.saveSelectedFile();
        });

        // Download file button in modal
        document.getElementById('downloadFileBtn').addEventListener('click', () => {
            this.downloadSelectedFile();
        });
    }

    async updateUI() {
        const user = this.authService.getCurrentUser();
        
        if (user && this.authService.isConnected()) {
            // Show main section
            document.getElementById('authSection').style.display = 'none';
            document.getElementById('mainSection').style.display = 'block';
            
            // Update user info
            document.getElementById('userInfo').style.display = 'block';
            document.getElementById('userName').textContent = user.name;
            
            // Load files
            await this.loadFiles();
            await this.loadSavedFiles();
        } else {
            // Show auth section
            document.getElementById('authSection').style.display = 'block';
            document.getElementById('mainSection').style.display = 'none';
            document.getElementById('userInfo').style.display = 'none';
        }
    }

    async connectGoogleDrive() {
        try {
            this.showLoading(true);
            
            // Check if user is already authenticated
            if (this.authService.isAuthenticated() && this.authService.isConnected()) {
                // User is already logged in, directly open Google Picker
                await this.openGooglePicker();
                return;
            }
            
            // Start OAuth flow for new users
            await this.authService.startOAuthFlow();
            await this.updateUI();
            
            this.showSuccess('Successfully connected to Google Drive!');
            
            // Automatically open Google Picker after successful authentication
            setTimeout(async () => {
                try {
                    await this.openGooglePicker();
                } catch (error) {
                    console.error('Failed to open picker after authentication:', error);
                }
            }, 1000); // Small delay to ensure UI updates are complete
            
        } catch (error) {
            console.error('Failed to connect to Google Drive:', error);
            this.showError('Failed to connect to Google Drive. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    async logout() {
        try {
            await this.authService.logout();
            await this.updateUI();
            this.showSuccess('Successfully logged out');
        } catch (error) {
            console.error('Failed to logout:', error);
            this.showError('Failed to logout');
        }
    }

    async openGooglePicker() {
        try {
            this.showLoading(true);
            
            const files = await this.driveService.openPicker();
            
            if (files && files.length > 0) {
                // Save each selected file to the database
                let savedCount = 0;
                for (const file of files) {
                    try {
                        const fileMetadata = {
                            googleFileId: file.id,
                            fileName: file.name,
                            mimeType: file.mimeType,
                            size: file.sizeBytes ? parseInt(file.sizeBytes) : 0,
                            webContentLink: file.url,
                            thumbnailLink: file.iconUrl || null
                        };
                        
                        await this.driveService.saveFileMetadata(fileMetadata);
                        savedCount++;
                    } catch (error) {
                        console.error('Failed to save file:', file.name, error);
                    }
                }
                
                if (savedCount > 0) {
                    this.showSuccess(`Successfully saved ${savedCount} file(s) to database`);
                    await this.loadFiles(); // Refresh the files list
                    await this.loadSavedFiles(); // Refresh saved files list
                } else {
                    this.showError('Failed to save selected files');
                }
            } else {
                this.showSuccess('No files selected');
            }
        } catch (error) {
            console.error('Failed to open Google Picker:', error);
            this.showError('Failed to open file picker');
        } finally {
            this.showLoading(false);
        }
    }

    async loadFiles() {
        // Only load files if user is authenticated and connected
        if (!this.authService.isAuthenticated() || !this.authService.isConnected()) {
            return;
        }
        
        try {
            const files = await this.driveService.getUserFiles();
            this.currentFiles = files;
            this.renderFiles(files, 'filesGrid');
        } catch (error) {
            console.error('Failed to load files:', error);
            this.showError('Failed to load files');
        }
    }

    async loadSavedFiles() {
        // Only load saved files if user is authenticated
        if (!this.authService.isAuthenticated()) {
            return;
        }
        
        try {
            const files = await this.driveService.getSavedFiles();
            this.savedFiles = files;
            this.renderSavedFiles(files, 'savedFilesGrid');
        } catch (error) {
            console.error('Failed to load saved files:', error);
            this.showError('Failed to load saved files');
        }
    }

    renderFiles(files, containerId) {
        const container = document.getElementById(containerId);
        
        if (!files || files.length === 0) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="empty-state">
                        <i class="fas fa-folder-open"></i>
                        <h5>No files found</h5>
                        <p>Use the "Select Files from Drive" button to browse your Google Drive files.</p>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = files.map(file => `
            <div class="col-md-4 col-lg-3 mb-3">
                <div class="card file-card" onclick="app.showFileDetails('${file.id}', 'drive')">
                    <div class="card-body text-center">
                        <i class="${this.driveService.getFileIcon(file.mimeType)} file-icon"></i>
                        <h6 class="card-title" title="${file.name}">${this.truncateText(file.name, 20)}</h6>
                        <p class="file-size">${this.driveService.formatFileSize(file.size)}</p>
                        <span class="file-type">${this.driveService.getFileTypeLabel(file.mimeType)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderSavedFiles(files, containerId) {
        const container = document.getElementById(containerId);
        
        if (!files || files.length === 0) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="empty-state">
                        <i class="fas fa-bookmark"></i>
                        <h5>No saved files</h5>
                        <p>Files you save will appear here for quick access.</p>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = files.map(file => `
            <div class="col-md-4 col-lg-3 mb-3">
                <div class="card file-card" onclick="app.showFileDetails('${file.googleFileId}', 'saved')">
                    <div class="card-body text-center">
                        <i class="${this.driveService.getFileIcon(file.mimeType)} file-icon"></i>
                        <h6 class="card-title" title="${file.fileName}">${this.truncateText(file.fileName, 20)}</h6>
                        <p class="file-size">${this.driveService.formatFileSize(file.fileSize)}</p>
                        <span class="file-type">${this.driveService.getFileTypeLabel(file.mimeType)}</span>
                        <small class="text-muted d-block mt-2">
                            Saved ${new Date(file.createdAt).toLocaleDateString()}
                        </small>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async showFileDetails(fileId, source) {
        try {
            let fileData;
            
            if (source === 'drive') {
                fileData = await this.driveService.getFileMetadata(fileId);
            } else {
                // For saved files, find from the saved files array
                const savedFile = this.savedFiles.find(f => f.googleFileId === fileId);
                if (savedFile) {
                    fileData = {
                        id: savedFile.googleFileId,
                        name: savedFile.fileName,
                        mimeType: savedFile.mimeType,
                        size: savedFile.fileSize,
                        downloadUrl: savedFile.downloadUrl
                    };
                } else {
                    // Fallback to API call
                    fileData = await this.driveService.getFileMetadata(fileId);
                }
            }

            this.selectedFile = fileData;
            
            const modalBody = document.getElementById('fileDetails');
            modalBody.innerHTML = `
                <div class="text-center mb-3">
                    <i class="${this.driveService.getFileIcon(fileData.mimeType)} fa-3x"></i>
                </div>
                <div class="file-metadata">
                    <strong>Name:</strong> ${fileData.name}
                </div>
                <div class="file-metadata">
                    <strong>Type:</strong> ${this.driveService.getFileTypeLabel(fileData.mimeType)}
                </div>
                <div class="file-metadata">
                    <strong>Size:</strong> ${this.driveService.formatFileSize(fileData.size)}
                </div>
                <div class="file-metadata">
                    <strong>ID:</strong> ${fileData.id}
                </div>
            `;

            // Show/hide save button based on source
            const saveBtn = document.getElementById('saveFileBtn');
            if (source === 'saved') {
                saveBtn.style.display = 'none';
            } else {
                saveBtn.style.display = 'inline-block';
            }

            const modal = new bootstrap.Modal(document.getElementById('fileModal'));
            modal.show();
        } catch (error) {
            console.error('Failed to load file details:', error);
            this.showError('Failed to load file details');
        }
    }

    async saveSelectedFile() {
        if (!this.selectedFile) return;

        try {
            await this.driveService.saveFileMetadata(this.selectedFile);
            this.showSuccess('File saved successfully!');
            
            // Refresh saved files
            await this.loadSavedFiles();
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('fileModal'));
            modal.hide();
        } catch (error) {
            console.error('Failed to save file:', error);
            this.showError('Failed to save file');
        }
    }

    async downloadSelectedFile() {
        if (!this.selectedFile) return;

        try {
            this.showLoading(true);
            
            const blob = await this.driveService.downloadFile(this.selectedFile.id);
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = this.selectedFile.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.showSuccess('File downloaded successfully!');
        } catch (error) {
            console.error('Failed to download file:', error);
            this.showError('Failed to download file');
        } finally {
            this.showLoading(false);
        }
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    showLoading(show) {
        const spinner = document.getElementById('loadingSpinner');
        spinner.style.display = show ? 'block' : 'none';
    }

    showError(message) {
        const alert = document.getElementById('errorAlert');
        const messageEl = document.getElementById('errorMessage');
        messageEl.textContent = message;
        alert.style.display = 'block';
        
        setTimeout(() => {
            alert.style.display = 'none';
        }, 5000);
    }

    showSuccess(message) {
        const alert = document.getElementById('successAlert');
        const messageEl = document.getElementById('successMessage');
        messageEl.textContent = message;
        alert.style.display = 'block';
        
        setTimeout(() => {
            alert.style.display = 'none';
        }, 3000);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    window.app.init();
});

// Handle Google API loading
function gapiLoaded() {
    console.log('Google API loaded');
}

function gisLoaded() {
    console.log('Google Identity Services loaded');
}
