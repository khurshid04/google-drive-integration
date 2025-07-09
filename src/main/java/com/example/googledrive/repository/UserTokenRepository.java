package com.example.googledrive.repository;

import com.example.googledrive.model.TokenProvider;
import com.example.googledrive.model.User;
import com.example.googledrive.model.UserToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserTokenRepository extends JpaRepository<UserToken, Long> {
    Optional<UserToken> findByUser(User user);
    Optional<UserToken> findByUserId(Long userId);
    Optional<UserToken> findByUserAndProvider(User user, TokenProvider provider);
    List<UserToken> findByUserAndProviderIn(User user, List<TokenProvider> providers);
}
