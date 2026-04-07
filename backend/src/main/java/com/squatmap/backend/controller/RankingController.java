package com.squatmap.backend.controller;

import com.squatmap.backend.dto.ranking.RankingResponse;
import com.squatmap.backend.service.RankingService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/rankings")
@RequiredArgsConstructor
public class RankingController {

    private final RankingService rankingService;

    @GetMapping
    public RankingResponse getRankings() {
        return rankingService.getRankings();
    }
}
