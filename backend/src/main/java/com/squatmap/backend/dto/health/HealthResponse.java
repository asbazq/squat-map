package com.squatmap.backend.dto.health;

import java.time.OffsetDateTime;

public record HealthResponse(
        String status,
        OffsetDateTime timestamp
) {
}
