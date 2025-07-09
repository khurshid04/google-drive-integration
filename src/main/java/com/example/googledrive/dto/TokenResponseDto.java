package com.example.googledrive.dto;

import java.time.LocalDateTime;

public class TokenResponseDto {
    private String accessToken;
    private String refreshToken;
    private Long expiresIn;
    private LocalDateTime expiresTime;
    private String tokenType;

    // Default constructor
    public TokenResponseDto() {}

    // Constructor
    public TokenResponseDto(String accessToken, String refreshToken, Long expiresIn, String tokenType, LocalDateTime expiresTime) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.expiresIn = expiresIn;
        this.expiresTime = expiresTime;
        this.tokenType = tokenType;
    }

    // Getters and setters
    public String getAccessToken() {
        return accessToken;
    }

    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public void setRefreshToken(String refreshToken) {
        this.refreshToken = refreshToken;
    }

    public Long getExpiresIn() {
        return expiresIn;
    }

    public void setExpiresIn(Long expiresIn) {
        this.expiresIn = expiresIn;
    }

    public String getTokenType() {
        return tokenType;
    }

    public void setTokenType(String tokenType) {
        this.tokenType = tokenType;
    }

    public LocalDateTime getExpiresTime() {
        return expiresTime;
    }

    public void setExpiresTime(LocalDateTime expiresTime) {
        this.expiresTime = expiresTime;
    }
}
