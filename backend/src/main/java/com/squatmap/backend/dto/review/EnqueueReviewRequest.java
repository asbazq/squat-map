package com.squatmap.backend.dto.review;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record EnqueueReviewRequest(
        @NotEmpty List<String> recordIds
) {
}
