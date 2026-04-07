package com.squatmap.backend.dto.record;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record CreateRecordRequest(
        @NotBlank String nickname,
        @NotBlank String region,
        @NotNull @DecimalMin("0.1") BigDecimal recordKg,
        String notes,
        @Valid @NotNull VerificationPayload verification
) {
}
