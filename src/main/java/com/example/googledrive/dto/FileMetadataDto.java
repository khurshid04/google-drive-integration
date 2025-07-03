package com.example.googledrive.dto;

public class FileMetadataDto {
    private String id;
    private String name;
    private String mimeType;
    private Long size;
    private String downloadUrl;
    private String thumbnailUrl;

    // Default constructor
    public FileMetadataDto() {}

    // Constructor
    public FileMetadataDto(String id, String name, String mimeType, Long size, String downloadUrl) {
        this.id = id;
        this.name = name;
        this.mimeType = mimeType;
        this.size = size;
        this.downloadUrl = downloadUrl;
    }

    // Getters and setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getMimeType() {
        return mimeType;
    }

    public void setMimeType(String mimeType) {
        this.mimeType = mimeType;
    }

    public Long getSize() {
        return size;
    }

    public void setSize(Long size) {
        this.size = size;
    }

    public String getDownloadUrl() {
        return downloadUrl;
    }

    public void setDownloadUrl(String downloadUrl) {
        this.downloadUrl = downloadUrl;
    }

    public String getThumbnailUrl() {
        return thumbnailUrl;
    }

    public void setThumbnailUrl(String thumbnailUrl) {
        this.thumbnailUrl = thumbnailUrl;
    }
}
