package com.squatmap.backend.service;

import com.squatmap.backend.domain.Region;
import com.squatmap.backend.dto.ranking.RankingResponse;
import com.squatmap.backend.dto.record.RecordResponse;
import com.squatmap.backend.repository.SquatRecordRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RankingService {

    private final SquatRecordRepository squatRecordRepository;
    private final RecordService recordService;

    @Transactional(readOnly = true)
    public RankingResponse getRankings() {
        List<RecordResponse> national = squatRecordRepository.findTop10ByOrderByRecordKgDescCreatedAtDesc().stream()
                .map(recordService::toResponse)
                .toList();

        Map<String, List<RecordResponse>> byRegion = new LinkedHashMap<>();
        for (Region region : Region.values()) {
            byRegion.put(region.name(), squatRecordRepository.findTop10ByRegionOrderByRecordKgDescCreatedAtDesc(region).stream()
                    .map(recordService::toResponse)
                    .toList());
        }

        return new RankingResponse(national, byRegion);
    }
}
