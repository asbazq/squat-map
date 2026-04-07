package com.squatmap.backend.service;

import com.squatmap.backend.domain.ReviewStatus;
import com.squatmap.backend.dto.review.ReviewQueueItemResponse;
import com.squatmap.backend.dto.review.ReviewQueueResponse;
import com.squatmap.backend.entity.ReviewQueueItem;
import com.squatmap.backend.repository.ReviewQueueItemRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ReviewQueueService {

    private final ReviewQueueItemRepository reviewQueueItemRepository;

    @Transactional(readOnly = true)
    public ReviewQueueResponse getPendingQueue() {
        List<ReviewQueueItemResponse> items = reviewQueueItemRepository.findAllByStatusOrderByCreatedAtDesc(ReviewStatus.PENDING)
                .stream()
                .map(this::toResponse)
                .toList();
        List<String> recordIds = items.stream().map(ReviewQueueItemResponse::recordId).toList();
        return new ReviewQueueResponse(recordIds, items);
    }

    @Transactional
    public ReviewQueueResponse enqueue(List<String> recordIds) {
        for (String recordId : recordIds) {
            reviewQueueItemRepository.findByRecordId(recordId).ifPresentOrElse(
                    existing -> {
                        existing.setStatus(ReviewStatus.PENDING);
                        reviewQueueItemRepository.save(existing);
                    },
                    () -> {
                        ReviewQueueItem item = new ReviewQueueItem();
                        item.setRecordId(recordId);
                        item.setStatus(ReviewStatus.PENDING);
                        reviewQueueItemRepository.save(item);
                    }
            );
        }
        return getPendingQueue();
    }

    @Transactional
    public ReviewQueueResponse approve(String recordId) {
        reviewQueueItemRepository.findByRecordId(recordId).ifPresent(item -> {
            item.setStatus(ReviewStatus.APPROVED);
            reviewQueueItemRepository.save(item);
        });
        return getPendingQueue();
    }

    @Transactional
    public ReviewQueueResponse reject(String recordId) {
        reviewQueueItemRepository.findByRecordId(recordId).ifPresent(item -> {
            item.setStatus(ReviewStatus.REJECTED);
            reviewQueueItemRepository.save(item);
        });
        return getPendingQueue();
    }

    @Transactional
    public ReviewQueueResponse remove(String recordId) {
        reviewQueueItemRepository.deleteByRecordId(recordId);
        return getPendingQueue();
    }

    private ReviewQueueItemResponse toResponse(ReviewQueueItem item) {
        return new ReviewQueueItemResponse(item.getId(), item.getRecordId(), item.getStatus(), item.getCreatedAt());
    }
}
