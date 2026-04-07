package com.squatmap.backend.repository;

import com.squatmap.backend.entity.ReviewVideo;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReviewVideoRepository extends JpaRepository<ReviewVideo, Long> {
    Optional<ReviewVideo> findByRecordId(String recordId);
    void deleteByRecordId(String recordId);
}
