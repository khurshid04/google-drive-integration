package com.example.googledrive.service;

import com.example.googledrive.model.TokenProvider;
import com.example.googledrive.model.User;
import com.example.googledrive.model.UserToken;
import com.example.googledrive.repository.UserTokenRepository;
import com.google.api.client.googleapis.auth.oauth2.*;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.gson.GsonFactory;
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

    @Autowired
    private GoogleClientSecrets googleClientSecrets;

    private static final JsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance();

    public UserToken saveTokens(User user, String accessToken, String refreshToken, Long expiresIn) {
        Optional<UserToken> existingToken = userTokenRepository.findByUserAndProvider(user, TokenProvider.GOOGLE);
        
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
                                    LocalDateTime.now().plusSeconds(expiresIn), TokenProvider.GOOGLE);
        }
        
        return userTokenRepository.save(userToken);
    }

    public Optional<UserToken> getTokenByUser(User user) {
        return userTokenRepository.findByUserAndProvider(user, TokenProvider.GOOGLE);
    }

    public String getValidAccessToken(User user) throws Exception {
        Optional<UserToken> tokenOpt = userTokenRepository.findByUserAndProvider(user, TokenProvider.GOOGLE);
        
        if (tokenOpt.isEmpty()) {
            throw new RuntimeException("No Google tokens found for user");
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
//            GoogleTokenResponse response = googleAuthorizationCodeFlow
//                .newTokenRequest(userToken.getRefreshToken())
//                .setGrantType("refresh_token")
//                .execute();

            GoogleTokenResponse response = new GoogleRefreshTokenRequest(
                    new NetHttpTransport(),
                    JSON_FACTORY,
                    userToken.getRefreshToken(),
                    googleClientSecrets.getDetails().getClientId(),
                    googleClientSecrets.getDetails().getClientSecret()
            ).execute();
            
            String newAccessToken = response.getAccessToken();
            Long expiresIn = response.getExpiresInSeconds();



            ///  Test
            // ✅ For testing, override with 5 minutes (300 seconds)
            Long testExpiresInSeconds = 300L;

            // Create Credential and override expiry
            GoogleCredential credential = new GoogleCredential.Builder()
                    .setTransport(googleAuthorizationCodeFlow.getTransport())
                    .setJsonFactory(googleAuthorizationCodeFlow.getJsonFactory())
                    .setClientSecrets(googleAuthorizationCodeFlow.getClientId(), "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")
                    .build()
                    .setFromTokenResponse(response);

            // Manually override the expiry time
            credential.setExpirationTimeMilliseconds(
                    System.currentTimeMillis() + (testExpiresInSeconds)
            );

            // Store credential and use it
            ///  Test

            
            // Update the stored token
            userToken.setAccessToken(newAccessToken);
//            userToken.setExpiresAt(LocalDateTime.now().plusSeconds(expiresIn));
            userToken.setExpiresAt(LocalDateTime.now().plusSeconds(testExpiresInSeconds));
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
        Optional<UserToken> tokenOpt = userTokenRepository.findByUserAndProvider(user, TokenProvider.GOOGLE);
        tokenOpt.ifPresent(userTokenRepository::delete);
    }
}
