package com.squatmap.backend.repository;

import com.squatmap.backend.entity.AdminAccount;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminAccountRepository extends JpaRepository<AdminAccount, String> {
    Optional<AdminAccount> findByUsername(String username);
    boolean existsByUsername(String username);
}
