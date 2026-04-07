package com.squatmap.backend.repository;

import com.squatmap.backend.domain.ReviewStatus;
import com.squatmap.backend.entity.ReviewQueueItem;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReviewQueueItemRepository extends JpaRepository<ReviewQueueItem, Long> {
    List<ReviewQueueItem> findAllByStatusOrderByCreatedAtDesc(ReviewStatus status);
    Optional<ReviewQueueItem> findByRecordId(String recordId);
    void deleteByRecordId(String recordId);
}
