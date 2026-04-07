package com.squatmap.backend.dto.record;

import com.squatmap.backend.domain.VerificationSummary;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record RecordResponse(
        String id,
        String nickname,
        String region,
        String locationName,
        BigDecimal recordKg,
        String notes,
        VerificationSummary verificationSummary,
        int passCount,
        int failCount,
        int unsureCount,
        BigDecimal depthRatioMax,
        BigDecimal thresholdValue,
        int holdFrames,
        OffsetDateTime verifiedAt,
        OffsetDateTime createdAt
) {
}
