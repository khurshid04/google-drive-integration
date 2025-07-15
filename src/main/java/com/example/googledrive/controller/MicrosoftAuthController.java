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
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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