package com.example.googledrive.service;

import com.example.googledrive.model.TokenProvider;
import com.example.googledrive.model.User;
import com.example.googledrive.model.UserToken;
import com.example.googledrive.repository.UserTokenRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

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
            // Refresh the token
            return refreshAccessToken(userToken);
        }
        
        return userToken.getAccessToken();
    }

    private String refreshAccessToken(UserToken userToken) throws Exception {
        // TODO: Implement Microsoft token refresh logic
        // For now, throw exception to indicate refresh is needed
        throw new RuntimeException("Microsoft token refresh not implemented yet");
    }

    public void deleteTokens(User user) {
        Optional<UserToken> tokenOpt = userTokenRepository.findByUserAndProvider(user, TokenProvider.MICROSOFT);
        tokenOpt.ifPresent(userTokenRepository::delete);
    }
}