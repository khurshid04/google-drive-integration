package com.example.googledrive.service;

import com.example.googledrive.model.User;
import com.example.googledrive.model.UserToken;
import com.example.googledrive.repository.UserTokenRepository;
import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeFlow;
import com.google.api.client.googleapis.auth.oauth2.GoogleTokenResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
public class TokenService {

    @Autowired
    private UserTokenRepository userTokenRepository;

    @Autowired
    private GoogleAuthorizationCodeFlow googleAuthorizationCodeFlow;

    public UserToken saveTokens(User user, String accessToken, String refreshToken, Long expiresIn) {
        Optional<UserToken> existingToken = userTokenRepository.findByUser(user);
        
        UserToken userToken;
        if (existingToken.isPresent()) {
            userToken = existingToken.get();
            userToken.setAccessToken(accessToken);
            if (refreshToken != null) {
                userToken.setRefreshToken(refreshToken);
            }
            userToken.setExpiresAt(LocalDateTime.now().plusSeconds(expiresIn));
            userToken.setUpdatedAt(LocalDateTime.now());
        } else {
            userToken = new UserToken(user, accessToken, refreshToken, 
                                    LocalDateTime.now().plusSeconds(expiresIn));
        }
        
        return userTokenRepository.save(userToken);
    }

    public Optional<UserToken> getTokenByUser(User user) {
        return userTokenRepository.findByUser(user);
    }

    public String getValidAccessToken(User user) throws Exception {
        Optional<UserToken> tokenOpt = userTokenRepository.findByUser(user);
        
        if (tokenOpt.isEmpty()) {
            throw new RuntimeException("No tokens found for user");
        }
        
        UserToken userToken = tokenOpt.get();
        
        // Check if token is expired or will expire in the next 5 minutes
        if (userToken.getExpiresAt().isBefore(LocalDateTime.now().plusMinutes(5))) {
            // Refresh the token
            return refreshAccessToken(userToken);
        }
        
        return userToken.getAccessToken();
    }

    private String refreshAccessToken(UserToken userToken) throws Exception {
        try {
            GoogleTokenResponse response = googleAuthorizationCodeFlow
                .newTokenRequest(userToken.getRefreshToken())
                .setGrantType("refresh_token")
                .execute();
            
            String newAccessToken = response.getAccessToken();
            Long expiresIn = response.getExpiresInSeconds();
            
            // Update the stored token
            userToken.setAccessToken(newAccessToken);
            userToken.setExpiresAt(LocalDateTime.now().plusSeconds(expiresIn));
            userToken.setUpdatedAt(LocalDateTime.now());
            
            // If a new refresh token is provided, update it too
            if (response.getRefreshToken() != null) {
                userToken.setRefreshToken(response.getRefreshToken());
            }
            
            userTokenRepository.save(userToken);
            
            return newAccessToken;
        } catch (Exception e) {
            throw new RuntimeException("Failed to refresh access token", e);
        }
    }

    public void deleteTokens(User user) {
        Optional<UserToken> tokenOpt = userTokenRepository.findByUser(user);
        tokenOpt.ifPresent(userTokenRepository::delete);
    }
}
