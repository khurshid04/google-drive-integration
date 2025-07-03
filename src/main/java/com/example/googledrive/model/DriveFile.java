package com.example.googledrive.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "drive_files")
public class DriveFile {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    
    @Column(name = "google_file_id", nullable = false)
    private String googleFileId;
    
    @Column(name = "file_name", nullable = false)
    private String fileName;
    
    @Column(name = "mime_type")
    private String mimeType;
    
    @Column(name = "file_size")
    private Long fileSize;
    
    @Column(name = "download_url", columnDefinition = "TEXT")
    private String downloadUrl;
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    // Default constructor
    public DriveFile() {
        this.createdAt = LocalDateTime.now();
    }

    // Constructor
    public DriveFile(User user, String googleFileId, String fileName, String mimeType, Long fileSize, String downloadUrl) {
        this();
        this.user = user;
        this.googleFileId = googleFileId;
        this.fileName = fileName;
        this.mimeType = mimeType;
        this.fileSize = fileSize;
        this.downloadUrl = downloadUrl;
    }

    // Getters and setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getGoogleFileId() {
        return googleFileId;
    }

    public void setGoogleFileId(String googleFileId) {
        this.googleFileId = googleFileId;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getMimeType() {
        return mimeType;
    }

    public void setMimeType(String mimeType) {
        this.mimeType = mimeType;
    }

    public Long getFileSize() {
        return fileSize;
    }

    public void setFileSize(Long fileSize) {
        this.fileSize = fileSize;
    }

    public String getDownloadUrl() {
        return downloadUrl;
    }

    public void setDownloadUrl(String downloadUrl) {
        this.downloadUrl = downloadUrl;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
