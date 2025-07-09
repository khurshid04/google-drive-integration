class MicrosoftService {
    constructor() {
        this.graphBaseUrl = 'https://graph.microsoft.com/v1.0';
        this.isInitialized = false;
        this.microsoftClientId = null;
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
}

// Global instance
const microsoftService = new MicrosoftService();