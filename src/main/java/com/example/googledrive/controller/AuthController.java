package com.example.googledrive.controller;

import com.example.googledrive.dto.TokenResponseDto;
import com.example.googledrive.model.User;
import com.example.googledrive.model.UserToken;
import com.example.googledrive.repository.UserRepository;
import com.example.googledrive.service.TokenService;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TokenService tokenService;

    @Value("${google.client.id}")
    private String googleClientId;

    @Value("${GOOGLE_API_KEY:}")
    private String googleApiKey;

    @GetMapping("/user")
    public ResponseEntity<Map<String, Object>> getCurrentUser(HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        User user = userOpt.get();
        Map<String, Object> response = new HashMap<>();
        response.put("id", user.getId());
        response.put("email", user.getEmail());
        response.put("name", user.getName());
        response.put("isConnected", tokenService.getTokenByUser(user).isPresent());

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
            String accessToken = tokenService.getValidAccessToken(user);
            Optional<UserToken> tokenOpt = tokenService.getTokenByUser(user);
            
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
                    "Bearer"
                );
                
                return ResponseEntity.ok(response);
            }
            
            return ResponseEntity.status(404).build();
            
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
                tokenService.deleteTokens(userOpt.get());
            }
        }
        
        session.invalidate();
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    @GetMapping("/config")
    public ResponseEntity<Map<String, String>> getConfig() {
        Map<String, String> config = new HashMap<>();
        config.put("googleClientId", googleClientId);
        config.put("googleApiKey", googleApiKey);
        return ResponseEntity.ok(config);
    }
}
