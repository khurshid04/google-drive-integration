class AuthService {
    constructor() {
        this.currentUser = null;
        this.accessToken = null;
        this.expiresTime = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            await this.checkAuthStatus();
            this.isInitialized = true;
        } catch (error) {
            console.error('Failed to initialize auth service:', error);
        }
    }

    async checkAuthStatus() {
        try {
            const response = await fetch('/api/auth/user', {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const user = await response.json();
                this.currentUser = user;
                
                if (user.isConnected) {
                    await this.refreshAccessToken();
                }
                
                return user;
            } else {
                this.currentUser = null;
                this.expiresTime = null;
                this.accessToken = null;
                return null;
            }
        } catch (error) {
            console.error('Failed to check auth status:', error);
            this.currentUser = null;
            this.accessToken = null;
            this.expiresTime = null;
            return null;
        }
    }

    async startOAuthFlow() {
        try {
            const response = await fetch('/oauth2/authorize', {
                method: 'GET',
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to get authorization URL');
            }
            
            const data = await response.json();
            
            // Open OAuth popup
            const popup = window.open(
                data.authorizationUrl,
                'google-oauth',
                'width=500,height=600,scrollbars=yes,resizable=yes'
            );

            return new Promise((resolve, reject) => {
                const checkClosed = setInterval(() => {
                    if (popup.closed) {
                        clearInterval(checkClosed);
                        reject(new Error('OAuth popup was closed'));
                    }
                }, 1000);

                // Listen for message from popup
                const messageHandler = (event) => {
                    if (event.data && event.data.type === 'GOOGLE_AUTH_SUCCESS') {
                        clearInterval(checkClosed);
                        window.removeEventListener('message', messageHandler);
                        
                        this.currentUser = event.data.user;
                        this.refreshAccessToken().then(() => {
                            resolve(event.data.user);
                        }).catch(reject);
                    }
                };

                window.addEventListener('message', messageHandler);
            });
        } catch (error) {
            console.error('OAuth flow failed:', error);
            throw error;
        }
    }

    async refreshAccessToken() {
        try {
            const response = await fetch('/api/auth/token', {
                method: 'GET',
                credentials: 'include'
            });

            if (response.ok) {
                const tokenData = await response.json();
                this.accessToken = tokenData.accessToken;
                this.expiresTime = tokenData.expiresTime;
                return tokenData.accessToken;
            } else {
                this.accessToken = null;
                this.expiresTime = null;
                throw new Error('Failed to get access token');
            }
        } catch (error) {
            console.error('Failed to refresh access token:', error);
            this.accessToken = null;
            this.expiresTime = null;
            throw error;
        }
    }

    async logout() {
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });

            this.currentUser = null;
            this.accessToken = null;
            this.expiresTime = null;

            return response.ok;
        } catch (error) {
            console.error('Logout failed:', error);
            return false;
        }
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }

    isConnected() {
        return this.currentUser && this.currentUser.isConnected && this.accessToken;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getAccessToken() {
        return this.accessToken;
    }

    getExpiresTime() {
        return this.expiresTime;
    }
}

// Global instance
window.authService = new AuthService();
