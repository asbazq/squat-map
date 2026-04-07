package com.squatmap.backend.entity;

import com.squatmap.backend.domain.Region;
import com.squatmap.backend.domain.VerificationSummary;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "squat_records")
public class SquatRecord {

    @Id
    private String id;

    @Column(nullable = false, length = 60)
    private String nickname;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Region region;

    @Column(nullable = false, precision = 8, scale = 2)
    private BigDecimal recordKg;

    @Column(nullable = false, length = 50)
    private String locationName;

    @Column(length = 500)
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private VerificationSummary verificationSummary;

    @Column(nullable = false)
    private int passCount;

    @Column(nullable = false)
    private int failCount;

    @Column(nullable = false)
    private int unsureCount;

    @Column(precision = 6, scale = 3)
    private BigDecimal depthRatioMax;

    @Column(precision = 6, scale = 3)
    private BigDecimal thresholdValue;

    @Column(nullable = false)
    private int holdFrames;

    @Column(nullable = false)
    private OffsetDateTime verifiedAt;

    @Column(nullable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
        if (verifiedAt == null) {
            verifiedAt = createdAt;
        }
        if (locationName == null && region != null) {
            locationName = region.name();
        }
    }
}
