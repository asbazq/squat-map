package com.squatmap.backend.service;

import com.squatmap.backend.domain.Region;
import com.squatmap.backend.dto.record.CreateRecordRequest;
import com.squatmap.backend.dto.record.RecordResponse;
import com.squatmap.backend.entity.SquatRecord;
import com.squatmap.backend.repository.ReviewQueueItemRepository;
import com.squatmap.backend.repository.SquatRecordRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RecordService {

    private final SquatRecordRepository squatRecordRepository;
    private final ReviewQueueItemRepository reviewQueueItemRepository;
    private final ReviewQueueService reviewQueueService;
    private final ReviewVideoStorageService reviewVideoStorageService;

    @Transactional(readOnly = true)
    public List<RecordResponse> getAllRecords() {
        return squatRecordRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(record -> toResponse(record, false))
                .toList();
    }

    @Transactional
    public RecordResponse createRecord(CreateRecordRequest request) {
        Set<String> previousTopFive = getNationalTopFiveIds();

        SquatRecord record = new SquatRecord();
        record.setNickname(request.nickname().trim());
        record.setRegion(Region.from(request.region()));
        record.setLocationName(request.region());
        record.setRecordKg(request.recordKg());
        record.setNotes(request.notes() == null || request.notes().isBlank() ? null : request.notes().trim());
        record.setVerificationSummary(request.verification().summary());
        record.setPassCount(request.verification().pass());
        record.setFailCount(request.verification().fail());
        record.setUnsureCount(request.verification().unsure());
        record.setDepthRatioMax(request.verification().depthRatioMax());
        record.setThresholdValue(request.verification().threshold());
        record.setHoldFrames(request.verification().hold());
        record.setVerifiedAt(request.verification().verifiedAt());

        SquatRecord saved = squatRecordRepository.save(record);
        boolean requiresReviewVideoUpload = enteredNationalTopFive(saved.getId(), previousTopFive);
        if (requiresReviewVideoUpload) {
            reviewQueueService.enqueueRecord(saved.getId());
        }

        return toResponse(saved, requiresReviewVideoUpload);
    }

    @Transactional
    public void deleteRecord(String recordId) {
        reviewQueueItemRepository.deleteByRecordId(recordId);
        reviewVideoStorageService.deleteReviewVideo(recordId);
        squatRecordRepository.deleteById(recordId);
    }

    public RecordResponse toResponse(SquatRecord record) {
        return toResponse(record, false);
    }

    public RecordResponse toResponse(SquatRecord record, boolean requiresReviewVideoUpload) {
        return new RecordResponse(
                record.getId(),
                record.getNickname(),
                record.getRegion().name(),
                record.getLocationName(),
                record.getRecordKg(),
                record.getNotes(),
                record.getVerificationSummary(),
                record.getPassCount(),
                record.getFailCount(),
                record.getUnsureCount(),
                record.getDepthRatioMax(),
                record.getThresholdValue(),
                record.getHoldFrames(),
                record.getVerifiedAt(),
                record.getCreatedAt(),
                requiresReviewVideoUpload
        );
    }

    private boolean enteredNationalTopFive(String recordId, Set<String> previousTopFive) {
        Set<String> nextTopFive = getNationalTopFiveIds();
        return nextTopFive.contains(recordId) && !previousTopFive.contains(recordId);
    }

    private Set<String> getNationalTopFiveIds() {
        return new HashSet<>(squatRecordRepository.findTop10ByOrderByRecordKgDescCreatedAtDesc().stream()
                .limit(5)
                .map(SquatRecord::getId)
                .toList());
    }
}
