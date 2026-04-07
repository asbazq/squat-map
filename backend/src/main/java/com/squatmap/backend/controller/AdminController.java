package com.squatmap.backend.controller;

import com.squatmap.backend.dto.admin.AdminLoginRequest;
import com.squatmap.backend.dto.admin.AdminLoginResponse;
import com.squatmap.backend.dto.review.EnqueueReviewRequest;
import com.squatmap.backend.dto.review.ReviewQueueResponse;
import com.squatmap.backend.service.AdminAuthService;
import com.squatmap.backend.service.ReviewQueueService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminAuthService adminAuthService;
    private final ReviewQueueService reviewQueueService;

    @PostMapping("/auth/login")
    public AdminLoginResponse login(@Valid @RequestBody AdminLoginRequest request) {
        return adminAuthService.login(request.username(), request.password());
    }

    @GetMapping("/review-queue")
    public ReviewQueueResponse getReviewQueue(
            @RequestHeader("X-Admin-Username") String username,
            @RequestHeader("X-Admin-Password") String password
    ) {
        ensureAdmin(username, password);
        return reviewQueueService.getPendingQueue();
    }

    @PostMapping("/review-queue")
    @ResponseStatus(HttpStatus.CREATED)
    public ReviewQueueResponse enqueue(
            @RequestHeader("X-Admin-Username") String username,
            @RequestHeader("X-Admin-Password") String password,
            @Valid @RequestBody EnqueueReviewRequest request
    ) {
        ensureAdmin(username, password);
        return reviewQueueService.enqueue(request.recordIds());
    }

    @PostMapping("/review-queue/{recordId}/approve")
    public ReviewQueueResponse approve(
            @RequestHeader("X-Admin-Username") String username,
            @RequestHeader("X-Admin-Password") String password,
            @PathVariable String recordId
    ) {
        ensureAdmin(username, password);
        return reviewQueueService.approve(recordId);
    }

    @PostMapping("/review-queue/{recordId}/reject")
    public ReviewQueueResponse reject(
            @RequestHeader("X-Admin-Username") String username,
            @RequestHeader("X-Admin-Password") String password,
            @PathVariable String recordId
    ) {
        ensureAdmin(username, password);
        return reviewQueueService.reject(recordId);
    }

    @DeleteMapping("/review-queue/{recordId}")
    public ReviewQueueResponse remove(
            @RequestHeader("X-Admin-Username") String username,
            @RequestHeader("X-Admin-Password") String password,
            @PathVariable String recordId
    ) {
        ensureAdmin(username, password);
        return reviewQueueService.remove(recordId);
    }

    private void ensureAdmin(String username, String password) {
        if (!adminAuthService.isAuthorized(username, password)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "관리자 인증이 필요합니다.");
        }
    }
}
