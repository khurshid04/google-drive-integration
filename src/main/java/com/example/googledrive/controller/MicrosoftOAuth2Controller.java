package com.example.googledrive.controller;

import com.example.googledrive.model.TokenProvider;
import com.example.googledrive.model.User;
import com.example.googledrive.repository.UserRepository;
import com.example.googledrive.service.MicrosoftTokenService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.util.Optional;

@RestController
@RequestMapping("/oauth2/microsoft")
public class MicrosoftOAuth2Controller {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MicrosoftTokenService microsoftTokenService;

    @Value("${microsoft.client.id}")
    private String microsoftClientId;

    @Value("${microsoft.client.secret}")
    private String microsoftClientSecret;

    @Value("${microsoft.redirect.uri}")
    private String microsoftRedirectUri;

    private static final String MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
    private static final String MICROSOFT_USER_INFO_URL = "https://graph.microsoft.com/v1.0/me";

    @GetMapping("/callback")
    public ResponseEntity<String> handleCallback(@RequestParam("code") String code, HttpSession session) {
        try {
            // Exchange code for access token
            RestTemplate restTemplate = new RestTemplate();
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            
            MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
            body.add("client_id", microsoftClientId);
            body.add("client_secret", microsoftClientSecret);
            body.add("code", code);
            body.add("redirect_uri", microsoftRedirectUri);
            body.add("grant_type", "authorization_code");
            
            HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);
            
            ResponseEntity<String> response = restTemplate.postForEntity(MICROSOFT_TOKEN_URL, request, String.class);
            
            if (response.getStatusCode() == HttpStatus.OK) {
                ObjectMapper mapper = new ObjectMapper();
                JsonNode tokenResponse = mapper.readTree(response.getBody());
                
                String accessToken = tokenResponse.get("access_token").asText();
                String refreshToken = tokenResponse.has("refresh_token") ? tokenResponse.get("refresh_token").asText() : null;
                long expiresIn = tokenResponse.get("expires_in").asLong();
                
                // Get user info from Microsoft Graph
                HttpHeaders userHeaders = new HttpHeaders();
                userHeaders.setBearerAuth(accessToken);
                HttpEntity<String> userRequest = new HttpEntity<>(userHeaders);
                
                ResponseEntity<String> userResponse = restTemplate.exchange(
                    MICROSOFT_USER_INFO_URL,
                    org.springframework.http.HttpMethod.GET,
                    userRequest,
                    String.class
                );
                
                if (userResponse.getStatusCode() == HttpStatus.OK) {
                    JsonNode userInfo = mapper.readTree(userResponse.getBody());
                    
                    String email = userInfo.get("mail").asText();
                    String name = userInfo.get("displayName").asText();
                    String oneDriveId = userInfo.get("id").asText();
                    
                    // Find or create user
                    User user = userRepository.findByEmail(email)
                        .orElseGet(() -> {
                            User newUser = new User();
                            newUser.setEmail(email);
                            newUser.setName(name);
                            newUser.setOneDriveId(oneDriveId);
                            return userRepository.save(newUser);
                        });
                    
                    // Update OneDrive ID if not set
                    if (user.getOneDriveId() == null) {
                        user.setOneDriveId(oneDriveId);
                        userRepository.save(user);
                    }
                    
                    // Save tokens
                    microsoftTokenService.saveTokens(user, accessToken, refreshToken, expiresIn);
                    
                    // Set user in session
                    session.setAttribute("userId", user.getId());
                    
                    // Return success response
                    return ResponseEntity.ok("""
                        <html>
                        <head><title>Microsoft Authorization Successful</title></head>
                        <body>
                            <h1>Microsoft Authorization Successful!</h1>
                            <p>You can now close this window and return to the application.</p>
                            <script>
                                window.opener.postMessage({
                                    type: 'MICROSOFT_AUTH_SUCCESS',
                                    user: {
                                        id: %d,
                                        email: '%s',
                                        name: '%s'
                                    }
                                }, '*');
                                window.close();
                            </script>
                        </body>
                        </html>
                        """.formatted(user.getId(), user.getEmail(), user.getName()));
                }
            }
            
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Failed to authenticate with Microsoft");
                
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Failed to process Microsoft authorization: " + e.getMessage());
        }
    }
}