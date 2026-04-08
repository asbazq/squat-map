package com.squatmap.backend.controller;

import com.squatmap.backend.dto.record.CreateRecordRequest;
import com.squatmap.backend.dto.record.RecordResponse;
import com.squatmap.backend.dto.review.ReviewVideoResponse;
import com.squatmap.backend.service.AdminAuthService;
import com.squatmap.backend.service.RecordService;
import com.squatmap.backend.service.ReviewVideoStorageService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/records")
@RequiredArgsConstructor
public class RecordController {

    private final RecordService recordService;
    private final AdminAuthService adminAuthService;
    private final ReviewVideoStorageService reviewVideoStorageService;

    @GetMapping
    public List<RecordResponse> getRecords() {
        return recordService.getAllRecords();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RecordResponse createRecord(@Valid @RequestBody CreateRecordRequest request) {
        return recordService.createRecord(request);
    }

    @PostMapping(path = "/{recordId}/review-video", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ReviewVideoResponse uploadReviewVideo(
            @org.springframework.web.bind.annotation.PathVariable String recordId,
            @RequestPart("file") MultipartFile file
    ) {
        String reviewVideoUrl = reviewVideoStorageService.uploadReviewVideo(recordId, file);
        return new ReviewVideoResponse(recordId, reviewVideoUrl);
    }

    @DeleteMapping("/{recordId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRecord(
            @org.springframework.web.bind.annotation.PathVariable String recordId,
            @RequestHeader("X-Admin-Username") String username,
            @RequestHeader("X-Admin-Password") String password
    ) {
        ensureAdmin(username, password);
        recordService.deleteRecord(recordId);
    }

    private void ensureAdmin(String username, String password) {
        if (!adminAuthService.isAuthorized(username, password)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "관리자 인증이 필요합니다.");
        }
    }
}
