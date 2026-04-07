package com.squatmap.backend.service;

import com.squatmap.backend.domain.Region;
import com.squatmap.backend.dto.record.CreateRecordRequest;
import com.squatmap.backend.dto.record.RecordResponse;
import com.squatmap.backend.entity.SquatRecord;
import com.squatmap.backend.repository.ReviewQueueItemRepository;
import com.squatmap.backend.repository.ReviewVideoRepository;
import com.squatmap.backend.repository.SquatRecordRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RecordService {

    private final SquatRecordRepository squatRecordRepository;
    private final ReviewQueueItemRepository reviewQueueItemRepository;
    private final ReviewVideoRepository reviewVideoRepository;

    @Transactional(readOnly = true)
    public List<RecordResponse> getAllRecords() {
        return squatRecordRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public RecordResponse createRecord(CreateRecordRequest request) {
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

        return toResponse(squatRecordRepository.save(record));
    }

    @Transactional
    public void deleteRecord(String recordId) {
        squatRecordRepository.deleteById(recordId);
        reviewQueueItemRepository.deleteByRecordId(recordId);
        reviewVideoRepository.deleteByRecordId(recordId);
    }

    public RecordResponse toResponse(SquatRecord record) {
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
                record.getCreatedAt()
        );
    }
}
