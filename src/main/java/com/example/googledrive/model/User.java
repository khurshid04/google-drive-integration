package com.example.googledrive.model;

import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(unique = true, nullable = false)
    private String email;
    
    @Column(nullable = false)
    private String name;
    
    @Column(name = "google_user_id", unique = true)
    private String googleUserId;
    
    @Column(name = "onedrive_user_id", unique = true)
    private String oneDriveId;

    // Default constructor
    public User() {}

    // Constructor
    public User(String email, String name, String googleUserId) {
        this.email = email;
        this.name = name;
        this.googleUserId = googleUserId;
    }
    
    // Constructor with OneDrive support
    public User(String email, String name, String googleUserId, String oneDriveId) {
        this.email = email;
        this.name = name;
        this.googleUserId = googleUserId;
        this.oneDriveId = oneDriveId;
    }

    // Getters and setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getGoogleUserId() {
        return googleUserId;
    }

    public void setGoogleUserId(String googleUserId) {
        this.googleUserId = googleUserId;
    }
    
    public String getOneDriveId() {
        return oneDriveId;
    }
    
    public void setOneDriveId(String oneDriveId) {
        this.oneDriveId = oneDriveId;
    }
}
