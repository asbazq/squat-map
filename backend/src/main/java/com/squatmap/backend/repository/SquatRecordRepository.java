package com.squatmap.backend.repository;

import com.squatmap.backend.domain.Region;
import com.squatmap.backend.entity.SquatRecord;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SquatRecordRepository extends JpaRepository<SquatRecord, String> {
    List<SquatRecord> findAllByOrderByCreatedAtDesc();
    List<SquatRecord> findTop10ByOrderByRecordKgDescCreatedAtDesc();
    List<SquatRecord> findTop10ByRegionOrderByRecordKgDescCreatedAtDesc(Region region);
}
