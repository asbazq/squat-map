package com.squatmap.backend.service;

import com.squatmap.backend.config.AppProperties;
import com.squatmap.backend.dto.admin.AdminLoginResponse;
import com.squatmap.backend.entity.AdminAccount;
import com.squatmap.backend.repository.AdminAccountRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AdminAuthService {

    private final AdminAccountRepository adminAccountRepository;
    private final AppProperties appProperties;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @PostConstruct
    void bootstrapAdmin() {
        String username = appProperties.getAdmin().getBootstrapUsername();
        String password = appProperties.getAdmin().getBootstrapPassword();
        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            return;
        }
        if (adminAccountRepository.existsByUsername(username)) {
            return;
        }
        AdminAccount account = new AdminAccount();
        account.setUsername(username);
        account.setPasswordHash(passwordEncoder.encode(password));
        adminAccountRepository.save(account);
    }

    public AdminLoginResponse login(String username, String password) {
        boolean authenticated = isAuthorized(username, password);
        return new AdminLoginResponse(
                authenticated,
                authenticated ? username : null,
                authenticated ? "관리자 인증에 성공했습니다." : "관리자 인증에 실패했습니다."
        );
    }

    public boolean isAuthorized(String username, String password) {
        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            return false;
        }
        return adminAccountRepository.findByUsername(username)
                .map(account -> passwordEncoder.matches(password, account.getPasswordHash()))
                .orElse(false);
    }
}
