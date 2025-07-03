package com.example.googledrive.controller;

import com.example.googledrive.dto.FileMetadataDto;
import com.example.googledrive.model.DriveFile;
import com.example.googledrive.model.User;
import com.example.googledrive.repository.UserRepository;
import com.example.googledrive.service.GoogleDriveService;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/drive")
public class DriveController {

    @Autowired
    private GoogleDriveService googleDriveService;

    @Autowired
    private UserRepository userRepository;

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
            List<FileMetadataDto> files = googleDriveService.getUserFiles(userOpt.get());
            return ResponseEntity.ok(files);
        } catch (Exception e) {
            return ResponseEntity.status(500)
                .body(Map.of("error", "Failed to fetch files: " + e.getMessage()));
        }
    }

    @GetMapping("/files/{fileId}")
    public ResponseEntity<?> getFileMetadata(@PathVariable String fileId, HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        try {
            FileMetadataDto file = googleDriveService.getFileMetadata(userOpt.get(), fileId);
            return ResponseEntity.ok(file);
        } catch (Exception e) {
            return ResponseEntity.status(500)
                .body(Map.of("error", "Failed to fetch file metadata: " + e.getMessage()));
        }
    }

    @PostMapping("/files")
    public ResponseEntity<?> saveFileMetadata(@RequestBody FileMetadataDto fileMetadata, 
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
            DriveFile savedFile = googleDriveService.saveFileMetadata(userOpt.get(), fileMetadata);
            return ResponseEntity.ok(Map.of(
                "id", savedFile.getId(),
                "googleFileId", savedFile.getGoogleFileId(),
                "fileName", savedFile.getFileName(),
                "message", "File metadata saved successfully"
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500)
                .body(Map.of("error", "Failed to save file metadata: " + e.getMessage()));
        }
    }

    @GetMapping("/saved-files")
    public ResponseEntity<?> getSavedFiles(HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        }

        try {
            List<DriveFile> savedFiles = googleDriveService.getUserSavedFiles(userOpt.get());
            return ResponseEntity.ok(savedFiles);
        } catch (Exception e) {
            return ResponseEntity.status(500)
                .body(Map.of("error", "Failed to fetch saved files: " + e.getMessage()));
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
            byte[] fileContent = googleDriveService.downloadFile(userOpt.get(), fileId);
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            headers.setContentDispositionFormData("attachment", "file-" + fileId);
            
            return ResponseEntity.ok()
                .headers(headers)
                .body(fileContent);
                
        } catch (Exception e) {
            return ResponseEntity.status(500)
                .body(Map.of("error", "Failed to download file: " + e.getMessage()));
        }
    }
}
