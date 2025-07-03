package com.example.googledrive.config;

import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeFlow;
import com.google.api.client.googleapis.auth.oauth2.GoogleClientSecrets;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.drive.DriveScopes;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.Arrays;

@Configuration
public class GoogleOAuth2Config {

    @Value("${google.client.id:your-google-client-id}")
    private String clientId;

    @Value("${google.client.secret:your-google-client-secret}")
    private String clientSecret;

    @Value("${google.redirect.uri:http://localhost:8000/oauth2/callback}")
    private String redirectUri;

    private static final JsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance();

    @Bean
    public NetHttpTransport httpTransport() throws GeneralSecurityException, IOException {
        return GoogleNetHttpTransport.newTrustedTransport();
    }

    @Bean
    public JsonFactory jsonFactory() {
        return JSON_FACTORY;
    }

    @Bean
    public GoogleClientSecrets googleClientSecrets() {
        GoogleClientSecrets.Details details = new GoogleClientSecrets.Details();
        details.setClientId(clientId);
        details.setClientSecret(clientSecret);
        
        GoogleClientSecrets clientSecrets = new GoogleClientSecrets();
        clientSecrets.setInstalled(details);
        
        return clientSecrets;
    }

    @Bean
    public GoogleAuthorizationCodeFlow googleAuthorizationCodeFlow(
            NetHttpTransport httpTransport, 
            JsonFactory jsonFactory, 
            GoogleClientSecrets clientSecrets) {
        
        return new GoogleAuthorizationCodeFlow.Builder(
                httpTransport, 
                jsonFactory, 
                clientSecrets,
                Arrays.asList(DriveScopes.DRIVE_READONLY, DriveScopes.DRIVE_FILE))
                .setAccessType("offline")
                .setApprovalPrompt("force")
                .build();
    }

    public String getClientId() {
        return clientId;
    }

    public String getRedirectUri() {
        return redirectUri;
    }
}
