package com.example.googledrive.repository;

import com.example.googledrive.model.DriveFile;
import com.example.googledrive.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DriveFileRepository extends JpaRepository<DriveFile, Long> {
    List<DriveFile> findByUser(User user);
    List<DriveFile> findByUserId(Long userId);
    Optional<DriveFile> findByUserAndGoogleFileId(User user, String googleFileId);
}
