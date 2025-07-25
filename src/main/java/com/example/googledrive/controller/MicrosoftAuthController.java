package com.example.googledrive.controller;

import com.example.googledrive.dto.TokenResponseDto;
import com.example.googledrive.model.TokenProvider;
import com.example.googledrive.model.User;
import com.example.googledrive.model.UserToken;
import com.example.googledrive.repository.UserRepository;
import com.example.googledrive.service.MicrosoftTokenService;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/microsoft")
public class MicrosoftAuthController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MicrosoftTokenService microsoftTokenService;

    @Value("${microsoft.client.id}")
    private String microsoftClientId;

    @GetMapping("/auth/url")
    public ResponseEntity<Map<String, String>> getAuthUrl() {
        String authUrl = microsoftTokenService.getAuthorizationUrl();
        Map<String, String> response = new HashMap<>();
        response.put("authUrl", authUrl);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/token")
    public ResponseEntity<TokenResponseDto> getAccessToken(HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).build();
        }

        User user = userOpt.get();
        
        try {
            String accessToken = microsoftTokenService.getValidAccessToken(user);
            Optional<UserToken> tokenOpt = microsoftTokenService.getTokenByUser(user);
            
            if (tokenOpt.isPresent()) {
                UserToken userToken = tokenOpt.get();
                long expiresIn = java.time.Duration.between(
                        java.time.LocalDateTime.now(),
                        userToken.getExpiresAt()
                ).getSeconds();
                
                TokenResponseDto response = new TokenResponseDto(
                        accessToken,
                        null, // Don't expose refresh token to frontend
                        expiresIn,
                        "Bearer",
                        userToken.getExpiresAt()
                );
                
                return ResponseEntity.ok(response);
            }
            
            return ResponseEntity.status(404).build();
            
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }

    @GetMapping("/files")
    public ResponseEntity<?> getUserFiles(HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        try {
            String accessToken = microsoftTokenService.getValidAccessToken(userOpt.get());
            
            RestTemplate restTemplate = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            HttpEntity<String> entity = new HttpEntity<>(headers);
            
            ResponseEntity<Map> response = restTemplate.exchange(
                    "https://graph.microsoft.com/v1.0/me/drive/root/children",
                    HttpMethod.GET,
                    entity,
                    Map.class
            );
            
            return ResponseEntity.ok(response.getBody());
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to fetch files: " + e.getMessage()));
        }
    }


    @PostMapping("/sharepoint-token")
    public ResponseEntity<TokenResponseDto> getSharePointToken(
            @RequestBody Map<String, Object> request,
            HttpSession session) {

        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).build();
        }

        try {
            User user = userOpt.get();
            java.util.List<String> scopes = (java.util.List<String>) request.get("scopes");

            if (scopes == null || scopes.isEmpty()) {
                return ResponseEntity.badRequest().build();
            }

            // Get SharePoint-specific token using the requested scopes
            String sharePointToken = microsoftTokenService.getSharePointToken(user, scopes);

            if (sharePointToken != null) {
                // Create token response (expires in 1 hour by default for SharePoint tokens)
                long expiresIn = 3600; // 1 hour in seconds
                LocalDateTime expiresAt = LocalDateTime.now().plusSeconds(expiresIn);

                TokenResponseDto response = new TokenResponseDto(
                        sharePointToken,
                        null, // No refresh token for SharePoint-specific tokens
                        expiresIn,
                        "Bearer",
                        expiresAt
                );

                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(500).build();
            }

        } catch (Exception e) {
            System.err.println("Error getting SharePoint token: " + e.getMessage());
            return ResponseEntity.status(500).build();
        }
    }

    @PostMapping("/files/save")
    public ResponseEntity<Map<String, String>> saveFileMetadata(
            @RequestBody Map<String, Object> fileMetadata,
            HttpSession session) {
        
        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        try {
            // Save file metadata to database
            // This would be implemented similar to Google Drive file saving
            return ResponseEntity.ok(Map.of("message", "File metadata saved successfully"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to save file metadata"));
        }
    }

    @GetMapping("/files/{fileId}/download")
    public ResponseEntity<?> downloadFile(@PathVariable String fileId, HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        try {
            String accessToken = microsoftTokenService.getValidAccessToken(userOpt.get());
            
            RestTemplate restTemplate = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            HttpEntity<String> entity = new HttpEntity<>(headers);
            
            ResponseEntity<Map> response = restTemplate.exchange(
                    "https://graph.microsoft.com/v1.0/me/drive/items/" + fileId + "/content",
                    HttpMethod.GET,
                    entity,
                    Map.class
            );
            
            return ResponseEntity.ok(response.getBody());
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to download file: " + e.getMessage()));
        }
    }

    @GetMapping("/sites")
    public ResponseEntity<?> getSharePointSites(HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        try {
            String accessToken = microsoftTokenService.getValidAccessToken(userOpt.get());
            
            RestTemplate restTemplate = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            HttpEntity<String> entity = new HttpEntity<>(headers);
            
            ResponseEntity<Map> response = restTemplate.exchange(
                    "https://graph.microsoft.com/v1.0/sites?search=*",
                    HttpMethod.GET,
                    entity,
                    Map.class
            );
            
            return ResponseEntity.ok(response.getBody());
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to fetch SharePoint sites: " + e.getMessage()));
        }
    }

    @GetMapping("/sites/{siteId}/files")
    public ResponseEntity<?> getSiteFiles(@PathVariable String siteId, HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        try {
            String accessToken = microsoftTokenService.getValidAccessToken(userOpt.get());
            
            RestTemplate restTemplate = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            HttpEntity<String> entity = new HttpEntity<>(headers);
            
            ResponseEntity<Map> response = restTemplate.exchange(
                    "https://graph.microsoft.com/v1.0/sites/" + siteId + "/drive/root/children",
                    HttpMethod.GET,
                    entity,
                    Map.class
            );
            
            return ResponseEntity.ok(response.getBody());
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to fetch SharePoint site files: " + e.getMessage()));
        }
    }

    @GetMapping("/sites/{siteId}/folders/{folderId}/children")
    public ResponseEntity<?> getSharePointFolderContents(@PathVariable String siteId, @PathVariable String folderId, HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        try {
            String accessToken = microsoftTokenService.getValidAccessToken(userOpt.get());

            RestTemplate restTemplate = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            HttpEntity<String> entity = new HttpEntity<>(headers);

            ResponseEntity<Map> response = restTemplate.exchange(
                    "https://graph.microsoft.com/v1.0/sites/" + siteId + "/drive/items/" + folderId + "/children",
                    HttpMethod.GET,
                    entity,
                    Map.class
            );

            return ResponseEntity.ok(response.getBody());
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to fetch SharePoint folder contents: " + e.getMessage()));
        }
    }

    @PostMapping("/auth/refresh")
    public ResponseEntity<TokenResponseDto> refreshAccessToken(HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).build();
        }

        try {
            // Get the existing token first
            Optional<UserToken> tokenOpt = microsoftTokenService.getTokenByUser(userOpt.get());
            
            if (tokenOpt.isEmpty()) {
                return ResponseEntity.status(404).build();
            }
            
            UserToken userToken = tokenOpt.get();
            
            // Refresh the access token
            microsoftTokenService.refreshAccessToken(userToken);
            
            // Get the updated token
            Optional<UserToken> updatedTokenOpt = microsoftTokenService.getTokenByUser(userOpt.get());
            if (updatedTokenOpt.isPresent()) {
                UserToken updatedToken = updatedTokenOpt.get();
                long expiresIn = java.time.Duration.between(
                        java.time.LocalDateTime.now(),
                        updatedToken.getExpiresAt()
                ).getSeconds();
                
                TokenResponseDto response = new TokenResponseDto(
                        updatedToken.getAccessToken(),
                        null, // Don't expose refresh token to frontend
                        expiresIn,
                        "Bearer",
                        updatedToken.getExpiresAt()
                );
                
                return ResponseEntity.ok(response);
            }
            
            return ResponseEntity.status(500).build();
            
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId != null) {
            Optional<User> userOpt = userRepository.findById(userId);
            if (userOpt.isPresent()) {
                microsoftTokenService.deleteTokens(userOpt.get());
            }
        }
        
        return ResponseEntity.ok(Map.of("message", "Microsoft account disconnected"));
    }
}