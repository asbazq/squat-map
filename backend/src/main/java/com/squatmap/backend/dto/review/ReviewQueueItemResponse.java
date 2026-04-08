package com.squatmap.backend.dto.review;

import com.squatmap.backend.domain.ReviewStatus;
import java.time.OffsetDateTime;

public record ReviewQueueItemResponse(
        Long id,
        String recordId,
        ReviewStatus status,
        OffsetDateTime createdAt,
        String reviewVideoUrl
) {
}
