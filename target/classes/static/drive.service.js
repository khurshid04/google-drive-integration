class DriveService {
    constructor() {
        this.authService = window.authService;
        this.isPickerLoaded = false;
        this.pickerApiLoaded = false;
        this.googleApiKey = null;
        this.googleClientId = null;
    }

    async init() {
        // Load configuration from backend
        await this.loadConfig();
        
        if (!this.pickerApiLoaded) {
            await this.loadPickerApi();
        }
    }

    async loadConfig() {
        try {
            const response = await fetch('/api/auth/config', {
                method: 'GET',
                credentials: 'include'
            });
            
            if (response.ok) {
                const config = await response.json();
                this.googleApiKey = config.googleApiKey;
                this.googleClientId = config.googleClientId;
            }
        } catch (error) {
            console.error('Failed to load configuration:', error);
        }
    }

    loadPickerApi() {
        return new Promise((resolve, reject) => {
            if (window.google && window.google.picker) {
                this.pickerApiLoaded = true;
                resolve();
                return;
            }

            gapi.load('picker', {
                callback: () => {
                    this.pickerApiLoaded = true;
                    resolve();
                },
                onerror: () => {
                    reject(new Error('Failed to load Google Picker API'));
                }
            });
        });
    }

    async openPicker() {
        if (!this.authService.isConnected()) {
            throw new Error('User is not connected to Google Drive');
        }

        if (!this.pickerApiLoaded) {
            await this.loadPickerApi();
        }

        const accessToken = this.authService.getAccessToken();
        
        return new Promise((resolve, reject) => {
            const picker = new google.picker.PickerBuilder()
                .addView(google.picker.ViewId.DOCS)
                .setOAuthToken(accessToken)
                .setDeveloperKey(this.googleApiKey)
                .setCallback((data) => {
                    if (data[google.picker.Response.ACTION] === google.picker.Action.PICKED) {
                        const files = data[google.picker.Response.DOCUMENTS];
                        resolve(files);
                    } else if (data[google.picker.Response.ACTION] === google.picker.Action.CANCEL) {
                        resolve([]);
                    }
                })
                .build();
            
            picker.setVisible(true);
        });
    }

    async getUserFiles() {
        try {
            const response = await fetch('/api/drive/files', {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to fetch files');
            }

            return await response.json();
        } catch (error) {
            console.error('Failed to get user files:', error);
            throw error;
        }
    }

    async getFileMetadata(fileId) {
        try {
            const response = await fetch(`/api/drive/files/${fileId}`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to fetch file metadata');
            }

            return await response.json();
        } catch (error) {
            console.error('Failed to get file metadata:', error);
            throw error;
        }
    }

    async saveFileMetadata(fileMetadata) {
        try {
            const response = await fetch('/api/drive/files', {
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
            console.error('Failed to save file metadata:', error);
            throw error;
        }
    }

    async getSavedFiles() {
        try {
            const response = await fetch('/api/drive/saved-files', {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to fetch saved files');
            }

            return await response.json();
        } catch (error) {
            console.error('Failed to get saved files:', error);
            throw error;
        }
    }

    async downloadFile(fileId) {
        try {
            const response = await fetch(`/api/drive/files/${fileId}/download`, {
                method: 'GET',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to download file');
            }

            return response.blob();
        } catch (error) {
            console.error('Failed to download file:', error);
            throw error;
        }
    }

    getFileIcon(mimeType) {
        const iconMap = {
            'application/vnd.google-apps.document': 'fas fa-file-alt file-doc',
            'application/vnd.google-apps.spreadsheet': 'fas fa-file-excel file-sheet',
            'application/vnd.google-apps.presentation': 'fas fa-file-powerpoint file-slide',
            'application/pdf': 'fas fa-file-pdf file-pdf',
            'image/': 'fas fa-file-image file-image',
            'video/': 'fas fa-file-video file-video',
            'audio/': 'fas fa-file-audio file-audio',
            'application/zip': 'fas fa-file-archive file-archive',
            'application/x-zip': 'fas fa-file-archive file-archive',
            'text/': 'fas fa-file-code file-code'
        };

        for (const [type, icon] of Object.entries(iconMap)) {
            if (mimeType && mimeType.startsWith(type)) {
                return icon;
            }
        }

        return 'fas fa-file file-default';
    }

    formatFileSize(bytes) {
        if (!bytes) return 'Unknown size';
        
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    }

    getFileTypeLabel(mimeType) {
        const typeMap = {
            'application/vnd.google-apps.document': 'Google Doc',
            'application/vnd.google-apps.spreadsheet': 'Google Sheet',
            'application/vnd.google-apps.presentation': 'Google Slides',
            'application/pdf': 'PDF',
            'application/msword': 'Word Document',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
            'application/vnd.ms-excel': 'Excel Spreadsheet',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel Spreadsheet',
            'text/plain': 'Text File',
            'image/jpeg': 'JPEG Image',
            'image/png': 'PNG Image',
            'image/gif': 'GIF Image'
        };

        return typeMap[mimeType] || 'File';
    }
}

// Global instance
window.driveService = new DriveService();
