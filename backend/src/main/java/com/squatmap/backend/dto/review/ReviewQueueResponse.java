package com.squatmap.backend.dto.review;

import java.util.List;

public record ReviewQueueResponse(
        List<String> recordIds,
        List<ReviewQueueItemResponse> items
) {
}
