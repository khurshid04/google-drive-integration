package com.example.googledrive.service;

import com.example.googledrive.model.TokenProvider;
import com.example.googledrive.model.User;
import com.example.googledrive.model.UserToken;
import com.example.googledrive.repository.UserTokenRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
public class MicrosoftTokenService {

    @Autowired
    private UserTokenRepository userTokenRepository;

    @Value("${microsoft.client.id}")
    private String microsoftClientId;

    @Value("${microsoft.client.secret}")
    private String microsoftClientSecret;

    @Value("${microsoft.redirect.uri}")
    private String microsoftRedirectUri;

    private static final String MICROSOFT_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
    private static final String MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
    private static final String SCOPES = "https://graph.microsoft.com/Files.ReadWrite.All https://graph.microsoft.com/Sites.ReadWrite.All offline_access";

    public String getAuthorizationUrl() {
        return MICROSOFT_AUTH_URL + 
               "?client_id=" + microsoftClientId +
               "&response_type=code" +
               "&redirect_uri=" + microsoftRedirectUri +
               "&response_mode=query" +
               "&scope=" + SCOPES.replace(" ", "%20");
    }

    public UserToken saveTokens(User user, String accessToken, String refreshToken, Long expiresIn) {
        Optional<UserToken> existingToken = userTokenRepository.findByUserAndProvider(user, TokenProvider.MICROSOFT);
        
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
                                    LocalDateTime.now().plusSeconds(expiresIn), TokenProvider.MICROSOFT);
        }
        
        return userTokenRepository.save(userToken);
    }

    public Optional<UserToken> getTokenByUser(User user) {
        return userTokenRepository.findByUserAndProvider(user, TokenProvider.MICROSOFT);
    }

    public String getValidAccessToken(User user) throws Exception {
        Optional<UserToken> tokenOpt = userTokenRepository.findByUserAndProvider(user, TokenProvider.MICROSOFT);
        
        if (tokenOpt.isEmpty()) {
            throw new RuntimeException("No Microsoft tokens found for user");
        }
        
        UserToken userToken = tokenOpt.get();
        
        // Check if token is expired or will expire in the next 5 minutes
        if (userToken.getExpiresAt().isBefore(LocalDateTime.now().plusMinutes(5))) {
            // Try to refresh the token
            if (userToken.getRefreshToken() != null) {
                refreshAccessToken(userToken);
                userToken = userTokenRepository.findByUserAndProvider(user, TokenProvider.MICROSOFT).orElseThrow();
            } else {
                throw new RuntimeException("Access token expired and no refresh token available");
            }
        }
        
        return userToken.getAccessToken();
    }

    public void refreshAccessToken(UserToken userToken) throws Exception {
        if (userToken.getRefreshToken() == null) {
            throw new RuntimeException("No refresh token available");
        }

        RestTemplate restTemplate = new RestTemplate();
        
        // Prepare request headers
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        
        // Prepare request body
        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "refresh_token");
        body.add("refresh_token", userToken.getRefreshToken());
        body.add("client_id", microsoftClientId);
        body.add("client_secret", microsoftClientSecret);
        body.add("scope", SCOPES);
        
        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);
        
        try {
            String response = restTemplate.postForObject(MICROSOFT_TOKEN_URL, request, String.class);
            
            // Parse response
            ObjectMapper mapper = new ObjectMapper();
            JsonNode responseNode = mapper.readTree(response);
            
            String newAccessToken = responseNode.get("access_token").asText();
            String newRefreshToken = responseNode.has("refresh_token") ? 
                responseNode.get("refresh_token").asText() : userToken.getRefreshToken();
            long expiresIn = responseNode.get("expires_in").asLong();
            
            // Update token in database
            userToken.setAccessToken(newAccessToken);
            userToken.setRefreshToken(newRefreshToken);
            userToken.setExpiresAt(LocalDateTime.now().plusSeconds(expiresIn));
            userToken.setUpdatedAt(LocalDateTime.now());
            
            userTokenRepository.save(userToken);
            
        } catch (Exception e) {
            throw new RuntimeException("Failed to refresh Microsoft access token: " + e.getMessage(), e);
        }
    }

    public void deleteTokens(User user) {
        Optional<UserToken> tokenOpt = userTokenRepository.findByUserAndProvider(user, TokenProvider.MICROSOFT);
        tokenOpt.ifPresent(userTokenRepository::delete);
    }
}