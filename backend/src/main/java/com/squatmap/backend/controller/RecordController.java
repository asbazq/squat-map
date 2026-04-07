package com.squatmap.backend.controller;

import com.squatmap.backend.dto.record.CreateRecordRequest;
import com.squatmap.backend.dto.record.RecordResponse;
import com.squatmap.backend.service.AdminAuthService;
import com.squatmap.backend.service.RecordService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/records")
@RequiredArgsConstructor
public class RecordController {

    private final RecordService recordService;
    private final AdminAuthService adminAuthService;

    @GetMapping
    public List<RecordResponse> getRecords() {
        return recordService.getAllRecords();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RecordResponse createRecord(@Valid @RequestBody CreateRecordRequest request) {
        return recordService.createRecord(request);
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
