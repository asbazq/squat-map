package com.squatmap.backend.dto.ranking;

import com.squatmap.backend.dto.record.RecordResponse;
import java.util.List;
import java.util.Map;

public record RankingResponse(
        List<RecordResponse> national,
        Map<String, List<RecordResponse>> byRegion
) {
}
