package com.example.googledrive.service;

import com.example.googledrive.dto.FileMetadataDto;
import com.example.googledrive.model.DriveFile;
import com.example.googledrive.model.User;
import com.example.googledrive.repository.DriveFileRepository;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.model.File;
import com.google.api.services.drive.model.FileList;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class GoogleDriveService {

    @Autowired
    private TokenService tokenService;

    @Autowired
    private DriveFileRepository driveFileRepository;

    @Autowired
    private NetHttpTransport httpTransport;

    @Autowired
    private JsonFactory jsonFactory;

    public List<FileMetadataDto> getUserFiles(User user) throws Exception {
        String accessToken = tokenService.getValidAccessToken(user);
        
        Drive drive = new Drive.Builder(httpTransport, jsonFactory, null)
            .setApplicationName("Google Drive Integration")
            .setHttpRequestInitializer(request -> {
                request.getHeaders().setAuthorization("Bearer " + accessToken);
            })
            .build();

        try {
            FileList result = drive.files().list()
                .setPageSize(100)
                .setFields("nextPageToken, files(id, name, size, mimeType, webContentLink, thumbnailLink)")
                .execute();
                
            List<File> files = result.getFiles();
            
            return files.stream()
                .map(file -> new FileMetadataDto(
                    file.getId(),
                    file.getName(),
                    file.getMimeType(),
                    file.getSize(),
                    file.getWebContentLink()
                ))
                .collect(Collectors.toList());
                
        } catch (IOException e) {
            throw new RuntimeException("Failed to fetch files from Google Drive", e);
        }
    }

    public FileMetadataDto getFileMetadata(User user, String fileId) throws Exception {
        String accessToken = tokenService.getValidAccessToken(user);
        
        Drive drive = new Drive.Builder(httpTransport, jsonFactory, null)
            .setApplicationName("Google Drive Integration")
            .setHttpRequestInitializer(request -> {
                request.getHeaders().setAuthorization("Bearer " + accessToken);
            })
            .build();

        try {
            File file = drive.files().get(fileId)
                .setFields("id, name, size, mimeType, webContentLink, thumbnailLink")
                .execute();
                
            return new FileMetadataDto(
                file.getId(),
                file.getName(),
                file.getMimeType(),
                file.getSize(),
                file.getWebContentLink()
            );
            
        } catch (IOException e) {
            throw new RuntimeException("Failed to fetch file metadata from Google Drive", e);
        }
    }

    public DriveFile saveFileMetadata(User user, FileMetadataDto fileMetadata) {
        // Check if file already exists
        Optional<DriveFile> existingFile = driveFileRepository
            .findByUserAndGoogleFileId(user, fileMetadata.getId());
            
        DriveFile driveFile;
        if (existingFile.isPresent()) {
            driveFile = existingFile.get();
            driveFile.setFileName(fileMetadata.getName());
            driveFile.setMimeType(fileMetadata.getMimeType());
            driveFile.setFileSize(fileMetadata.getSize());
            driveFile.setDownloadUrl(fileMetadata.getDownloadUrl());
        } else {
            driveFile = new DriveFile(
                user,
                fileMetadata.getId(),
                fileMetadata.getName(),
                fileMetadata.getMimeType(),
                fileMetadata.getSize(),
                fileMetadata.getDownloadUrl()
            );
        }
        
        return driveFileRepository.save(driveFile);
    }

    public List<DriveFile> getUserSavedFiles(User user) {
        return driveFileRepository.findByUser(user);
    }

    public byte[] downloadFile(User user, String fileId) throws Exception {
        String accessToken = tokenService.getValidAccessToken(user);
        
        Drive drive = new Drive.Builder(httpTransport, jsonFactory, null)
            .setApplicationName("Google Drive Integration")
            .setHttpRequestInitializer(request -> {
                request.getHeaders().setAuthorization("Bearer " + accessToken);
            })
            .build();

        try {
            return drive.files().get(fileId).executeMediaAsInputStream().readAllBytes();
        } catch (IOException e) {
            throw new RuntimeException("Failed to download file from Google Drive", e);
        }
    }
}
