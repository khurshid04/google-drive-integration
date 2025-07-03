package com.example.googledrive.controller;

import com.example.googledrive.config.GoogleOAuth2Config;
import com.example.googledrive.model.User;
import com.example.googledrive.repository.UserRepository;
import com.example.googledrive.service.TokenService;
import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.googleapis.auth.oauth2.GoogleAuthorizationCodeFlow;
import com.google.api.client.googleapis.auth.oauth2.GoogleTokenResponse;
import com.google.api.services.oauth2.Oauth2;
import com.google.api.services.oauth2.model.Userinfo;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

@RestController
@RequestMapping("/oauth2")
public class OAuth2Controller {

    @Autowired
    private GoogleOAuth2Config googleConfig;

    @Autowired
    private GoogleAuthorizationCodeFlow googleAuthFlow;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TokenService tokenService;

    @GetMapping("/authorize")
    public ResponseEntity<Map<String, String>> authorize() {
        String authorizationUrl = googleAuthFlow.newAuthorizationUrl()
            .setRedirectUri(googleConfig.getRedirectUri())
            .setAccessType("offline")
            .setApprovalPrompt("force")
            .build();

        Map<String, String> response = new HashMap<>();
        response.put("authorizationUrl", authorizationUrl);
        
        return ResponseEntity.ok(response);
    }

    @GetMapping("/callback")
    public ResponseEntity<String> callback(@RequestParam("code") String code, 
                                         @RequestParam(value = "error", required = false) String error,
                                         HttpSession session) {
        if (error != null) {
            return ResponseEntity.badRequest().body("Authorization failed: " + error);
        }

        try {
            // Exchange authorization code for tokens
            GoogleTokenResponse tokenResponse = googleAuthFlow
                .newTokenRequest(code)
                .setRedirectUri(googleConfig.getRedirectUri())
                .execute();

            String accessToken = tokenResponse.getAccessToken();
            String refreshToken = tokenResponse.getRefreshToken();
            Long expiresIn = tokenResponse.getExpiresInSeconds();

            // Get user info from Google using direct HTTP request
            String userInfoUrl = "https://www.googleapis.com/oauth2/v2/userinfo?access_token=" + accessToken;
            
            java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient();
            java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                .uri(java.net.URI.create(userInfoUrl))
                .build();
            
            java.net.http.HttpResponse<String> response = client.send(request, 
                java.net.http.HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() != 200) {
                throw new RuntimeException("Failed to get user info: " + response.body());
            }
            
            // Parse JSON response manually
            String responseBody = response.body();
            com.google.gson.JsonObject jsonObject = com.google.gson.JsonParser.parseString(responseBody).getAsJsonObject();
            
            String userId = jsonObject.get("id").getAsString();
            String email = jsonObject.get("email").getAsString();
            String name = jsonObject.get("name").getAsString();

            // Save or update user
            User user;
            Optional<User> existingUser = userRepository.findByGoogleUserId(userId);
            if (existingUser.isPresent()) {
                user = existingUser.get();
                user.setEmail(email);
                user.setName(name);
            } else {
                user = new User(email, name, userId);
            }
            user = userRepository.save(user);

            // Save tokens
            tokenService.saveTokens(user, accessToken, refreshToken, expiresIn);

            // Store user in session
            session.setAttribute("userId", user.getId());
            session.setAttribute("userEmail", user.getEmail());

            // Redirect to frontend with success
            return ResponseEntity.ok("""
                <html>
                <head><title>Authorization Successful</title></head>
                <body>
                    <h1>Authorization Successful!</h1>
                    <p>You can now close this window and return to the application.</p>
                    <script>
                        window.opener.postMessage({
                            type: 'GOOGLE_AUTH_SUCCESS',
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

        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body("Failed to process authorization: " + e.getMessage());
        }
    }
}
