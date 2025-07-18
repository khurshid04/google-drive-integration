# Google Drive Integration Application

## Overview

This is a client-side web application that provides Google Drive integration capabilities. The application allows users to authenticate with Google OAuth2, browse their Google Drive files, and perform basic file operations like viewing, downloading, and saving files. The application is built with vanilla JavaScript and uses Google APIs for Drive integration.

## System Architecture

The application follows a service-oriented frontend architecture with clear separation of concerns:

- **Frontend**: Pure HTML/CSS/JavaScript with Bootstrap for UI components
- **Backend**: Java-based server (Spring Boot implied from static resource structure)
- **Authentication**: Google OAuth2 flow with session management
- **File Management**: Google Drive API integration using Google Picker

## Key Components

### Frontend Services

1. **AuthService** (`auth.service.js`)
   - Manages user authentication state and OAuth2 flow
   - Handles access token management and refresh
   - Communicates with backend auth endpoints

2. **DriveService** (`drive.service.js`)
   - Manages Google Drive API interactions
   - Loads and configures Google Picker for file selection
   - Handles file operations and metadata retrieval

3. **App Controller** (`app.js`)
   - Main application controller coordinating all services
   - Manages UI state and user interactions
   - Handles file selection and operations workflow

### UI Components

1. **Main Interface** (`index.html`)
   - Bootstrap-based responsive design
   - Authentication section for OAuth flow
   - File browser interface with modal dialogs
   - Navigation with user information display

2. **Styling** (`style.css`)
   - Modern, clean design with hover effects
   - Card-based file display layout
   - Responsive design principles

## Data Flow

1. **Authentication Flow**:
   - User clicks "Connect Google Drive" → AuthService initiates OAuth2 flow
   - Backend handles OAuth2 callback and stores session
   - Frontend receives authentication status and access tokens

2. **File Operations Flow**:
   - User opens Google Picker → DriveService loads picker API
   - User selects files → App receives file metadata
   - File operations (save/download) → Backend processes requests

3. **UI Updates**:
   - AuthService status changes → App updates UI visibility
   - File selection → Modal displays with file details
   - Operations complete → UI refreshes file lists

## External Dependencies

### Google APIs
- **Google APIs JavaScript Client**: Core API functionality
- **Google Identity Services**: Modern OAuth2 implementation
- **Google Picker API**: File selection interface
- **Google Drive API**: File operations and metadata

### Frontend Libraries
- **Bootstrap 5.1.3**: UI framework and responsive design
- **Font Awesome 6.0.0**: Icon library for UI elements

### Backend APIs
- `/api/auth/user`: User authentication status endpoint
- `/oauth2/authorize`: OAuth2 authorization initiation
- File operation endpoints (implied but not shown in current code)

## Deployment Strategy

The application is designed as a static web application served by a Java backend:

- **Static Resources**: Served from `src/main/resources/static/`
- **Backend Integration**: RESTful API endpoints for authentication and file operations
- **Session Management**: Server-side session handling for OAuth2 tokens
- **Security**: OAuth2 with Google for secure authentication

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### July 9, 2025 - Migration to Replit with Microsoft OneDrive Integration
- ✅ Spring Boot backend with full OAuth2 Google authentication
- ✅ PostgreSQL database models for users, tokens, and drive files 
- ✅ Complete REST API endpoints for Drive operations
- ✅ Frontend integration with Google Picker API
- ✅ Secure configuration management for Google API credentials
- ✅ File browsing, saving, and downloading functionality
- ✅ Token refresh handling for long-lived access
- ✅ Responsive Bootstrap UI with clean design
- ✅ **NEW:** Automatic Google Picker launch after authentication
- ✅ **NEW:** Smart consent handling - returning users skip repeated auth screens
- ✅ **NEW:** Automatic file saving to database when selected via Picker
- ✅ **NEW:** Improved user workflow with seamless file selection process
- ✅ **NEW:** Enhanced Google Picker with multiple views (My Drive, Shared, Folders)
- ✅ **NEW:** Full folder navigation and shared file access in picker
- ✅ **NEW:** Multi-select capability for choosing multiple files at once
- ✅ **NEW:** Successfully migrated from Replit Agent to standard Replit environment
- ✅ **NEW:** Added Microsoft Graph API integration for OneDrive file access
- ✅ **NEW:** Created separate authentication buttons for Google Drive and Microsoft OneDrive
- ✅ **NEW:** Updated database models to support both Google and Microsoft user authentication
- ✅ **NEW:** Fixed frontend JavaScript initialization issues for better error handling
- ✅ **NEW:** Implemented Microsoft OneDrive file picker with JavaScript-based modal interface
- ✅ **NEW:** Added comprehensive Microsoft API endpoints (/api/microsoft/files, /files/save, /files/{id}/download)
- ✅ **NEW:** Created refresh token handling specifically for Microsoft authentication
- ✅ **NEW:** JavaScript picker uses backend access tokens like Google Picker for secure file access

### Key Features Implemented
1. **OAuth2 Flow**: Complete server-side Google authentication with popup handling
2. **Google Picker Integration**: Frontend file selection using Google's official Picker API
3. **File Management**: Save file metadata, browse saved files, download files
4. **Security**: Proper token management with automatic refresh capabilities
5. **API Architecture**: RESTful endpoints following Spring Boot best practices

### Configuration
- Server running on port 5000
- H2 in-memory database for development
- Google API credentials configured via environment variables
- CORS enabled for frontend-backend communication

## Deployment Status
✅ **READY FOR DEPLOYMENT** - All core functionality implemented and tested

## Migration Status
✅ **MIGRATION COMPLETE** - Successfully migrated from Replit Agent to Replit environment
- **Date:** July 16, 2025
- **Spring Boot Dev Server:** Running on port 5000 with live reload
- **Database:** H2 in-memory database configured
- **JavaScript:** Fixed Google API loading issues and initialization
- **Frontend:** Serving directly from source with both Google Drive and Microsoft OneDrive buttons
- **Security:** Proper client/server separation maintained
- **Static Resources:** Configured to serve from both classpath and file system for development

### Post-Migration Fixes (July 16, 2025)
- ✅ **Fixed Microsoft OneDrive loading popup issue** - Removed persistent loading text from modal
- ✅ **Fixed file icons displaying as text** - Updated getFileIcon() to return proper HTML instead of CSS classes
- ✅ **Added SharePoint API endpoints** - Created /api/microsoft/sites and /api/microsoft/sites/{id}/files endpoints
- ✅ **Enhanced error handling** - Added retry buttons and better error messages for both OneDrive and SharePoint
- ✅ **Improved loading states** - Proper loading spinner management without overlapping content

### Latest Fixes (July 17, 2025)
- ✅ **Fixed double popup issue** - Removed duplicate loading states in Microsoft OneDrive picker
- ✅ **Added granular logout functionality** - Separate logout buttons for Google Drive, Microsoft OneDrive, and logout all
- ✅ **Implemented automatic token refresh** - Added /api/microsoft/auth/refresh endpoint with retry logic
- ✅ **Enhanced authentication persistence** - System now remembers login state and refreshes tokens automatically
- ✅ **Improved user experience** - Better error handling when users are not authenticated before accessing pickers