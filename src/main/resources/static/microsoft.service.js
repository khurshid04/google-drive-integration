class MicrosoftService {
    constructor() {
        this.graphBaseUrl = "https://graph.microsoft.com/v1.0";
        this.isInitialized = false;
        this.microsoftClientId = null;
        this.accessToken = null;
        this.currentPath = "/";
        this.currentView = "onedrive"; // 'onedrive' or 'sharepoint'
        this.currentSiteId = null; // Track current SharePoint site
        this.isPickerOpen = false; // Track if picker is already open
        this.sharePointScope = null; // SharePoint scope for tokens
        window.microsoftService = this; // Make globally accessible
    }

    async init() {
        if (this.isInitialized) return;

        try {
            const response = await fetch("/api/auth/config");
            const config = await response.json();
            this.microsoftClientId = config.microsoftClientId;
            this.isInitialized = true;
        } catch (error) {
            console.error("Failed to initialize Microsoft service:", error);
        }
    }

    async connectMicrosoft() {
        if (!this.isInitialized) {
            await this.init();
        }

        try {
            const response = await fetch("/api/microsoft/auth/url");
            const data = await response.json();

            // Open Microsoft OAuth in popup
            const popup = window.open(
                data.authUrl,
                "microsoft-auth",
                "width=600,height=700,scrollbars=yes,resizable=yes",
            );

            return new Promise((resolve, reject) => {
                const checkClosed = setInterval(() => {
                    if (popup.closed) {
                        clearInterval(checkClosed);
                        reject(new Error("Authentication cancelled"));
                    }
                }, 1000);

                const handleMessage = (event) => {
                    if (event.data.type === "MICROSOFT_AUTH_SUCCESS") {
                        clearInterval(checkClosed);
                        window.removeEventListener("message", handleMessage);
                        resolve(event.data.user);
                    }
                };

                window.addEventListener("message", handleMessage);
            });
        } catch (error) {
            console.error("Failed to connect Microsoft:", error);
            throw error;
        }
    }

    async getUserFiles() {
        try {
            const response = await fetch("/api/microsoft/files", {
                credentials: "include",
            });

            if (!response.ok) {
                // If unauthorized, try to refresh token and retry
                if (response.status === 401) {
                    await this.refreshAccessToken();
                    const retryResponse = await fetch("/api/microsoft/files", {
                        credentials: "include",
                    });
                    if (!retryResponse.ok) {
                        throw new Error(
                            "Failed to fetch OneDrive files after token refresh",
                        );
                    }
                    const retryData = await retryResponse.json();
                    return retryData.value || [];
                }
                throw new Error("Failed to fetch OneDrive files");
            }

            const data = await response.json();
            return data.value || [];
        } catch (error) {
            console.error("Error fetching OneDrive files:", error);
            throw error;
        }
    }

    async refreshAccessToken() {
        try {
            const response = await fetch("/api/microsoft/auth/refresh", {
                method: "POST",
                credentials: "include",
            });

            if (!response.ok) {
                throw new Error("Failed to refresh Microsoft access token");
            }

            const tokenData = await response.json();
            this.accessToken = tokenData.accessToken;
            return tokenData;
        } catch (error) {
            console.error("Error refreshing Microsoft token:", error);
            throw error;
        }
    }

    async getSharePointSites() {
        try {
            const response = await fetch("/api/microsoft/sites", {
                credentials: "include",
            });

            if (!response.ok) {
                throw new Error("Failed to fetch SharePoint sites");
            }

            const data = await response.json();
            return data.value || [];
        } catch (error) {
            console.error("Error fetching SharePoint sites:", error);
            throw error;
        }
    }

    async getSiteFiles(siteId) {
        try {
            const response = await fetch(
                `/api/microsoft/sites/${siteId}/files`,
                {
                    credentials: "include",
                },
            );

            if (!response.ok) {
                throw new Error("Failed to fetch SharePoint files");
            }

            const data = await response.json();
            return data.value || [];
        } catch (error) {
            console.error("Error fetching SharePoint files:", error);
            throw error;
        }
    }

    async openMicrosoftPicker() {
        // Prevent multiple pickers from opening simultaneously
        if (this.isPickerOpen) {
            console.log(
                "Microsoft picker is already open, ignoring duplicate request",
            );
            return;
        }

        try {
            this.isPickerOpen = true;

            // Check if user is already authenticated, if not prompt to connect
            const authCheckResponse = await fetch("/api/microsoft/token", {
                credentials: "include",
            });

            if (!authCheckResponse.ok) {
                // Not authenticated, prompt user to connect first
                if (window.app && window.app.showError) {
                    window.app.showError(
                        "Please connect to Microsoft OneDrive first",
                    );
                }
                this.isPickerOpen = false;
                return;
            }

            const tokenData = await authCheckResponse.json();
            this.accessToken = tokenData.accessToken;

            // Open the native Microsoft OneDrive file picker with full navigation
            await this.openNativeOneDriveFilePicker();
        } catch (error) {
            console.error("Error opening Microsoft picker:", error);
            this.isPickerOpen = false;
            throw error;
        }
    }

    setupPickerWindowMonitoring(pickerWindow) {
        // Listen for messages from the picker window for file selection
        const messageHandler = (event) => {
            // Check if message is from Microsoft SharePoint/OneDrive picker
            if (
                event.origin.includes(".sharepoint.com") ||
                event.origin.includes(".onedrive.com") ||
                event.origin.includes("onedrive.live.com")
            ) {
                console.log(
                    "Received message from OneDrive picker:",
                    event.data,
                );

                // Handle different types of picker messages
                if (event.data && event.data.type === "selection") {
                    // File selection from picker
                    this.handleNativePickerSelection(event.data);
                    pickerWindow.close();
                    window.removeEventListener("message", messageHandler);
                    this.isPickerOpen = false;
                } else if (event.data && event.data.type === "cancel") {
                    // User cancelled the picker
                    console.log("User cancelled OneDrive picker");
                    pickerWindow.close();
                    window.removeEventListener("message", messageHandler);
                    this.isPickerOpen = false;
                }
            }
        };

        window.addEventListener("message", messageHandler);

        // Monitor if picker window was closed manually
        const checkClosed = setInterval(() => {
            if (pickerWindow.closed) {
                clearInterval(checkClosed);
                window.removeEventListener("message", messageHandler);
                this.isPickerOpen = false;

                console.log("OneDrive picker window was closed");

                // Refresh files list to show any changes
                if (window.app && window.app.loadFiles) {
                    setTimeout(() => {
                        window.app.loadFiles();
                    }, 1000);
                }
            }
        }, 1000);
    }

    async openNativeOneDriveFilePicker() {
        try {
            // First get the user's MySite data to determine the proper endpoint
            await this.getMySiteData();

        } catch (error) {
            console.error("Failed to open OneDrive picker:", error);
            this.isPickerOpen = false;
            throw error;
        }
    }

    async getMySiteData() {
        try {
            // Get user's MySite information from Microsoft Graph
            const response = await fetch('https://graph.microsoft.com/v1.0/me?$select=mySite', {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            let endpointHint = "";

            if (response.ok) {
                const result = await response.json();
                if (result.mySite) {
                    endpointHint = result.mySite;
                    this.sharePointScope = endpointHint.split('personal')[0];
                } else {
                    // Fallback to direct OneDrive endpoint
                    endpointHint = "api.onedrive.com";
                }
            } else if (response.status === 500) {
                // Fallback for OneDrive personal accounts
                endpointHint = "api.onedrive.com";
            } else {
                throw new Error(`Failed to get MySite data: ${response.statusText}`);
            }

            console.log("Using OneDrive endpoint:", endpointHint);
            await this.openFilePickerPopup(endpointHint);

        } catch (error) {
            console.error("Error getting MySite data:", error);
            // Fallback to basic OneDrive endpoint
            await this.openFilePickerPopup("api.onedrive.com");
        }
    }

    async openFilePickerPopup(endpointHint) {
        try {
            // Load OneDrive SDK if not already loaded
            await this.loadOneDriveSDK();

            // Get SharePoint token for the specific scope
            const token = await this.getSharePointToken();

            // Configure OneDrive picker options based on your sample code
            const odOptions = {
                clientId: this.microsoftClientId,
                action: "share",
                advanced: {
                    endpointHint: endpointHint,
                    accessToken: token || this.accessToken,
                },
                multiSelect: true,
                success: this.oneDriveSuccessCallback.bind(this),
                cancel: this.oneDriveCancelCallback.bind(this),
                error: (error) => {
                    console.error("OneDrive picker error:", error);
                    this.isPickerOpen = false;
                    if (window.app && window.app.showError) {
                        window.app.showError("Failed to open OneDrive picker");
                    }
                }
            };

            console.log("Opening OneDrive picker with options:", odOptions);

            // Open the OneDrive picker with proper delay
            setTimeout(() => {
                if (window.OneDrive) {
                    window.OneDrive.open(odOptions);
                } else {
                    console.error("OneDrive SDK not loaded");
                    this.isPickerOpen = false;
                }
            }, 1000);

        } catch (error) {
            console.error("Failed to open OneDrive file picker popup:", error);
            this.isPickerOpen = false;
            throw error;
        }
    }

    async loadOneDriveSDK() {
        // Load Microsoft OneDrive SDK if not already loaded
        if (window.OneDrive) {
            console.log("OneDrive SDK already loaded");
            return;
        }

        console.log("Loading Microsoft OneDrive SDK...");
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://js.live.net/v7.2/OneDrive.js";
            script.onload = () => {
                console.log("OneDrive SDK loaded successfully");
                // Give the SDK a moment to initialize
                setTimeout(() => {
                    if (window.OneDrive) {
                        console.log("OneDrive SDK initialized and ready");
                        resolve();
                    } else {
                        console.error("OneDrive SDK loaded but not initialized");
                        reject("OneDrive SDK not properly initialized");
                    }
                }, 100);
            };
            script.onerror = (error) => {
                console.error("Failed to load OneDrive SDK:", error);
                reject("Failed to load OneDrive SDK");
            };
            document.head.appendChild(script);
        });
    }

    async getSharePointToken() {
        try {
            if (!this.sharePointScope) {
                return this.accessToken; // Use existing token if no SharePoint scope
            }

            // Try to get SharePoint-specific token from backend
            const response = await fetch('/api/microsoft/sharepoint-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    scopes: [this.sharePointScope + '.default']
                })
            });

            if (response.ok) {
                const tokenData = await response.json();
                return tokenData.accessToken;
            } else {
                console.warn("Failed to get SharePoint token, using existing token");
                return this.accessToken;
            }
        } catch (error) {
            console.error("Error getting SharePoint token:", error);
            return this.accessToken; // Fallback to existing token
        }
    }

    oneDriveSuccessCallback(data) {
        this.isPickerOpen = false;
        console.log("OneDrive picker success:", data);

        if (data && data.value && Array.isArray(data.value)) {
            const selectedFiles = data.value.map(doc => ({
                id: doc.id || doc.webUrl || doc.name,
                name: doc.name,
                webUrl: doc.webUrl,
                size: doc.size || 0,
                mimeType: doc.file?.mimeType || 'application/octet-stream',
                downloadUrl: doc['@microsoft.graph.downloadUrl'] || doc.webUrl
            }));

            // Save selected files to backend
            this.saveSelectedFiles(selectedFiles);

            // Show success message
            if (window.app && window.app.showSuccess) {
                window.app.showSuccess(`Selected ${selectedFiles.length} file(s) from OneDrive`);
            }
        }
    }

    oneDriveCancelCallback() {
        this.isPickerOpen = false;
        console.log("OneDrive picker cancelled");
    }

    async saveSelectedFiles(files) {
        try {
            for (const file of files) {
                await this.saveSelectedFile(file);
            }

            // Refresh the UI to show saved files
            if (window.app && window.app.updateUI) {
                await window.app.updateUI();
            }
        } catch (error) {
            console.error("Failed to save selected files:", error);
            if (window.app && window.app.showError) {
                window.app.showError("Failed to save some files");
            }
        }
    }



    async handleNativePickerSelection(selectionData) {
        try {
            console.log("Files selected from native picker:", selectionData);

            // Extract file information from selection
            let files = [];

            if (selectionData.files && Array.isArray(selectionData.files)) {
                files = selectionData.files;
            } else if (
                selectionData.items &&
                Array.isArray(selectionData.items)
            ) {
                files = selectionData.items;
            } else if (
                selectionData.value &&
                Array.isArray(selectionData.value)
            ) {
                files = selectionData.value;
            }

            if (files.length === 0) {
                console.log("No files selected");
                return;
            }

            // Process selected files
            for (const file of files) {
                await this.saveSelectedFile(file);
            }

            // Show success message
            if (window.app) {
                window.app.showSuccess(
                    `Selected ${files.length} file(s) from OneDrive`,
                );
                await window.app.updateUI();
            }
        } catch (error) {
            console.error("Failed to handle native picker selection:", error);
            if (window.app) {
                window.app.showError("Failed to process selected files");
            }
        }
    }

    async saveSelectedFile(file) {
        try {
            // Convert file info to our format and save
            const fileMetadata = {
                id: file.id || file.webUrl || file.name,
                name: file.name,
                mimeType: file.file?.mimeType || "application/octet-stream",
                size: file.size || 0,
                webUrl: file.webUrl,
                downloadUrl:
                    file["@microsoft.graph.downloadUrl"] || file.webUrl,
            };

            // Save to backend
            const response = await fetch("/api/microsoft/files/save", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify(fileMetadata),
            });

            if (!response.ok) {
                throw new Error(`Failed to save file: ${response.statusText}`);
            }

            console.log("File saved successfully:", fileMetadata.name);
        } catch (error) {
            console.error("Failed to save selected file:", error);
            throw error;
        }
    }

    async loadOneDriveFiles() {
        try {
            // Use backend API for better reliability
            const files = await this.getUserFiles();
            return files;
        } catch (error) {
            console.error("Error loading OneDrive files:", error);

            const filesList = document.getElementById("microsoftFilesList");
            if (filesList) {
                filesList.innerHTML = `
                    <div class="col-12 text-center">
                        <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
                        <p>Failed to load OneDrive files</p>
                        <button class="btn btn-primary btn-sm mt-2" onclick="window.microsoftService.loadOneDriveFiles()">
                            <i class="fas fa-redo"></i> Retry
                        </button>
                    </div>
                `;
            }
            throw error;
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
                                <!-- Files will be loaded here -->
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
        const existingModal = document.getElementById("microsoftPickerModal");
        if (existingModal) {
            existingModal.remove();
        }

        // Clear any existing bootstrap modal backdrop
        const backdrops = document.querySelectorAll(".modal-backdrop");
        backdrops.forEach((backdrop) => backdrop.remove());

        // Add modal to page
        document.body.insertAdjacentHTML("beforeend", modalHtml);

        // Show modal
        const modal = new bootstrap.Modal(
            document.getElementById("microsoftPickerModal"),
        );
        modal.show();

        // Reset picker flag when modal is closed
        document
            .getElementById("microsoftPickerModal")
            .addEventListener("hidden.bs.modal", () => {
                this.isPickerOpen = false;
            });

        // Set up select button handler
        document
            .getElementById("selectMicrosoftFilesBtn")
            .addEventListener("click", () => {
                this.handleFileSelection();
                modal.hide();
            });
    }

    displayFilesInPicker(files, currentPath = "/") {
        const filesList = document.getElementById("microsoftFilesList");

        // Clear any existing content first
        if (filesList) {
            filesList.innerHTML = "";
        }

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

        filesList.innerHTML = files
            .map((file) => {
                const isFolder = file.folder !== undefined;
                const icon = isFolder
                    ? '<i class="fas fa-folder fa-2x text-warning"></i>'
                    : this.getFileIcon(
                          file.file?.mimeType || "application/octet-stream",
                      );

                return `
                <div class="col-md-6 col-lg-4 mb-3">
                    <div class="card file-card ${isFolder ? "folder-card" : ""}"
                         data-file-id="${file.id}"
                         data-file-type="${isFolder ? "folder" : "file"}"
                         ${isFolder ? `onclick="window.microsoftService.navigateToFolder('${file.id}', '${file.name}')"` : ""}>
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
                            ${
                                !isFolder
                                    ? `
                                <div class="form-check mt-2">
                                    <input class="form-check-input file-checkbox" type="checkbox"
                                           data-file='${JSON.stringify(file)}' id="file-${file.id}">
                                    <label class="form-check-label" for="file-${file.id}">
                                        Select
                                    </label>
                                </div>
                            `
                                    : `
                                <div class="mt-2">
                                    <small class="text-primary"><i class="fas fa-mouse-pointer"></i> Click to open</small>
                                </div>
                            `
                            }
                        </div>
                    </div>
                </div>
            `;
            })
            .join("");

        // Enable/disable select button based on selections
        const checkboxes = filesList.querySelectorAll(".file-checkbox");
        checkboxes.forEach((checkbox) => {
            checkbox.addEventListener("change", () => {
                const selectedCount = filesList.querySelectorAll(
                    ".file-checkbox:checked",
                ).length;
                document.getElementById("selectMicrosoftFilesBtn").disabled =
                    selectedCount === 0;
            });
        });
    }

    updateBreadcrumb(currentPath) {
        const breadcrumbContainer = document.getElementById(
            "microsoftBreadcrumb",
        );
        if (!breadcrumbContainer) return;

        const pathParts = currentPath.split("/").filter((part) => part);
        let breadcrumb =
            '<nav aria-label="breadcrumb"><ol class="breadcrumb mb-2">';

        breadcrumb +=
            '<li class="breadcrumb-item"><a href="#" onclick="window.microsoftService.navigateToRoot()">OneDrive</a></li>';

        pathParts.forEach((part, index) => {
            if (index === pathParts.length - 1) {
                breadcrumb += `<li class="breadcrumb-item active">${part}</li>`;
            } else {
                const partialPath =
                    "/" + pathParts.slice(0, index + 1).join("/");
                breadcrumb += `<li class="breadcrumb-item"><a href="#" onclick="window.microsoftService.navigateToPath('${partialPath}')">${part}</a></li>`;
            }
        });

        breadcrumb += "</ol></nav>";
        breadcrumbContainer.innerHTML = breadcrumb;
    }

    async navigateToFolder(folderId, folderName) {
        try {
            const loadingDiv = document.getElementById("microsoftFilesList");
            loadingDiv.innerHTML = `
                <div class="col-12 text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Loading folder contents...</p>
                </div>
            `;

            let response;
            if (this.currentView === "sharepoint" && this.currentSiteId) {
                // For SharePoint, use the backend API which handles proper folder navigation
                response = await fetch(
                    `/api/microsoft/sites/${this.currentSiteId}/folders/${folderId}/children`,
                    {
                        credentials: "include",
                    },
                );
            } else {
                // For OneDrive, use the direct Graph API
                response = await fetch(
                    `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children`,
                    {
                        headers: {
                            Authorization: `Bearer ${this.accessToken}`,
                            "Content-Type": "application/json",
                        },
                    },
                );
            }

            if (!response.ok) {
                throw new Error("Failed to load folder contents");
            }

            const data = await response.json();
            this.currentPath = this.currentPath + "/" + folderName;
            this.displayFilesInPicker(data.value || data, this.currentPath);
        } catch (error) {
            console.error("Error navigating to folder:", error);
            if (window.app && window.app.showError) {
                window.app.showError("Failed to load folder contents");
            }
        }
    }

    async navigateToRoot() {
        this.currentPath = "/";
        const files = await this.loadOneDriveFiles();
        this.displayFilesInPicker(files, this.currentPath);
    }

    async handleFileSelection() {
        const selectedCheckboxes = document.querySelectorAll(
            "#microsoftFilesList .file-checkbox:checked",
        );
        const selectedFiles = Array.from(selectedCheckboxes).map((checkbox) =>
            JSON.parse(checkbox.dataset.file),
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
                window.app.showSuccess(
                    `Selected ${selectedFiles.length} file(s) from OneDrive`,
                );
            }
        } catch (error) {
            console.error("Error handling file selection:", error);
            if (window.app && window.app.showError) {
                window.app.showError("Failed to save selected files");
            }
        }
    }

    async saveFileMetadata(fileMetadata) {
        try {
            const response = await fetch("/api/microsoft/files/save", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify(fileMetadata),
            });

            if (!response.ok) {
                throw new Error("Failed to save file metadata");
            }

            return await response.json();
        } catch (error) {
            console.error("Error saving Microsoft file metadata:", error);
            throw error;
        }
    }

    async downloadFile(fileId, fileName) {
        try {
            const response = await fetch(
                `/api/microsoft/files/${fileId}/download`,
                {
                    credentials: "include",
                },
            );

            if (!response.ok) {
                throw new Error("Failed to download file");
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error downloading file:", error);
            throw error;
        }
    }

    getFileIcon(mimeType) {
        if (!mimeType)
            return '<i class="fas fa-file fa-2x text-secondary"></i>';

        if (mimeType.includes("image"))
            return '<i class="fas fa-file-image fa-2x text-info"></i>';
        if (mimeType.includes("video"))
            return '<i class="fas fa-file-video fa-2x text-danger"></i>';
        if (mimeType.includes("audio"))
            return '<i class="fas fa-file-audio fa-2x text-success"></i>';
        if (mimeType.includes("pdf"))
            return '<i class="fas fa-file-pdf fa-2x text-danger"></i>';
        if (mimeType.includes("word") || mimeType.includes("document"))
            return '<i class="fas fa-file-word fa-2x text-primary"></i>';
        if (mimeType.includes("excel") || mimeType.includes("spreadsheet"))
            return '<i class="fas fa-file-excel fa-2x text-success"></i>';
        if (
            mimeType.includes("powerpoint") ||
            mimeType.includes("presentation")
        )
            return '<i class="fas fa-file-powerpoint fa-2x text-warning"></i>';
        if (mimeType.includes("zip") || mimeType.includes("archive"))
            return '<i class="fas fa-file-archive fa-2x text-dark"></i>';
        if (mimeType.includes("text"))
            return '<i class="fas fa-file-alt fa-2x text-secondary"></i>';

        return '<i class="fas fa-file fa-2x text-secondary"></i>';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }

    getFileTypeLabel(mimeType) {
        if (!mimeType) return "Unknown";

        const typeMap = {
            image: "Image",
            video: "Video",
            audio: "Audio",
            pdf: "PDF",
            word: "Word Document",
            excel: "Excel Spreadsheet",
            powerpoint: "PowerPoint",
            text: "Text File",
            zip: "Archive",
            archive: "Archive",
        };

        for (const [key, value] of Object.entries(typeMap)) {
            if (mimeType.includes(key)) {
                return value;
            }
        }

        return "File";
    }

    async switchToOneDrive() {
        this.currentView = "onedrive";
        document.getElementById("oneDriveTab").classList.add("active");
        document.getElementById("sharePointTab").classList.remove("active");

        this.currentPath = "/";
        const files = await this.loadOneDriveFiles();
        this.displayFilesInPicker(files, this.currentPath);
    }

    async switchToSharePoint() {
        this.currentView = "sharepoint";
        document.getElementById("sharePointTab").classList.add("active");
        document.getElementById("oneDriveTab").classList.remove("active");

        const filesList = document.getElementById("microsoftFilesList");

        try {
            // Show loading state
            if (filesList) {
                filesList.innerHTML = `
                    <div class="col-12 text-center">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-2">Loading SharePoint sites...</p>
                    </div>
                `;
            }

            const sites = await this.getSharePointSites();
            this.displaySharePointSites(sites);
        } catch (error) {
            console.error("Error loading SharePoint sites:", error);

            if (filesList) {
                filesList.innerHTML = `
                    <div class="col-12 text-center">
                        <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
                        <p>Failed to load SharePoint sites</p>
                        <small class="text-muted">Make sure you have access to SharePoint sites</small>
                        <br>
                        <button class="btn btn-primary btn-sm mt-2" onclick="window.microsoftService.switchToSharePoint()">
                            <i class="fas fa-redo"></i> Retry
                        </button>
                    </div>
                `;
            }

            if (window.app && window.app.showError) {
                window.app.showError("Failed to load SharePoint sites");
            }
        }
    }

    displaySharePointSites(sites) {
        const filesList = document.getElementById("microsoftFilesList");
        const breadcrumbContainer = document.getElementById(
            "microsoftBreadcrumb",
        );

        breadcrumbContainer.innerHTML =
            '<nav aria-label="breadcrumb"><ol class="breadcrumb mb-2"><li class="breadcrumb-item active">SharePoint Sites</li></ol></nav>';

        if (!sites || sites.length === 0) {
            filesList.innerHTML = `
                <div class="col-12 text-center">
                    <i class="fas fa-sitemap fa-3x text-muted mb-3"></i>
                    <p>No SharePoint sites found</p>
                </div>
            `;
            return;
        }

        filesList.innerHTML = sites
            .map(
                (site) => `
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
        `,
            )
            .join("");
    }

    async navigateToSharePointSite(siteId, siteName) {
        try {
            const loadingDiv = document.getElementById("microsoftFilesList");
            loadingDiv.innerHTML = `
                <div class="col-12 text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Loading SharePoint files...</p>
                </div>
            `;

            const files = await this.getSiteFiles(siteId);

            const breadcrumbContainer = document.getElementById(
                "microsoftBreadcrumb",
            );
            breadcrumbContainer.innerHTML = `
                <nav aria-label="breadcrumb">
                    <ol class="breadcrumb mb-2">
                        <li class="breadcrumb-item"><a href="#" onclick="window.microsoftService.switchToSharePoint()">SharePoint</a></li>
                        <li class="breadcrumb-item active">${siteName}</li>
                    </ol>
                </nav>
            `;

            this.displayFilesInPicker(files, "/" + siteName);
        } catch (error) {
            console.error("Error loading SharePoint site:", error);
            if (window.app && window.app.showError) {
                window.app.showError("Failed to load SharePoint site files");
            }
        }
    }
}

// Global instance
const microsoftService = new MicrosoftService();
