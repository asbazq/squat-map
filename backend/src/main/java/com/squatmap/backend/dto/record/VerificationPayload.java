package com.squatmap.backend.dto.record;

import com.squatmap.backend.domain.VerificationSummary;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record VerificationPayload(
        @NotNull VerificationSummary summary,
        int pass,
        int fail,
        int unsure,
        BigDecimal depthRatioMax,
        BigDecimal threshold,
        int hold,
        OffsetDateTime verifiedAt
) {
}
