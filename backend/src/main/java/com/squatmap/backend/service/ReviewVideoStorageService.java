package com.squatmap.backend.service;

import com.squatmap.backend.config.AppProperties;
import com.squatmap.backend.domain.ReviewStatus;
import com.squatmap.backend.entity.ReviewQueueItem;
import com.squatmap.backend.entity.ReviewVideo;
import com.squatmap.backend.repository.ReviewQueueItemRepository;
import com.squatmap.backend.repository.ReviewVideoRepository;
import com.squatmap.backend.repository.SquatRecordRepository;
import java.io.IOException;
import java.net.URL;
import java.time.Duration;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

@Service
@RequiredArgsConstructor
public class ReviewVideoStorageService {

    private final AppProperties appProperties;
    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final ReviewVideoRepository reviewVideoRepository;
    private final ReviewQueueItemRepository reviewQueueItemRepository;
    private final SquatRecordRepository squatRecordRepository;

    @Transactional
    public String uploadReviewVideo(String recordId, MultipartFile file) {
        ensureS3Enabled();
        validateUploadTarget(recordId, file);

        String key = buildStorageKey(recordId, file.getOriginalFilename());
        String bucket = appProperties.getS3().getBucket();
        String contentType = normalizeContentType(file.getContentType());

        try {
            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .contentType(contentType)
                    .build();
            s3Client.putObject(putObjectRequest, RequestBody.fromBytes(file.getBytes()));
        } catch (IOException exception) {
            throw new IllegalArgumentException("검수 영상을 읽는 데 실패했습니다.");
        }

        ReviewVideo reviewVideo = reviewVideoRepository.findByRecordId(recordId)
                .map(existing -> {
                    deleteObjectQuietly(existing);
                    return existing;
                })
                .orElseGet(ReviewVideo::new);
        reviewVideo.setRecordId(recordId);
        reviewVideo.setStorageKey(key);
        reviewVideo.setContentType(contentType);
        reviewVideo.setSizeBytes(file.getSize());
        reviewVideoRepository.save(reviewVideo);

        return createPresignedUrl(key);
    }

    @Transactional(readOnly = true)
    public String getReviewVideoUrl(String recordId) {
        if (!appProperties.getS3().isEnabled()) {
            return null;
        }
        return reviewVideoRepository.findByRecordId(recordId)
                .map(ReviewVideo::getStorageKey)
                .map(this::createPresignedUrl)
                .orElse(null);
    }

    @Transactional
    public void deleteReviewVideo(String recordId) {
        reviewVideoRepository.findByRecordId(recordId).ifPresent(reviewVideo -> {
            deleteObjectQuietly(reviewVideo);
            reviewVideoRepository.delete(reviewVideo);
        });
    }

    private void validateUploadTarget(String recordId, MultipartFile file) {
        if (recordId == null || recordId.isBlank()) {
            throw new IllegalArgumentException("recordId가 필요합니다.");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("업로드할 영상 파일이 필요합니다.");
        }
        if (!squatRecordRepository.existsById(recordId)) {
            throw new IllegalArgumentException("존재하지 않는 기록입니다.");
        }

        Optional<ReviewQueueItem> queueItem = reviewQueueItemRepository.findByRecordId(recordId);
        if (queueItem.isEmpty() || queueItem.get().getStatus() != ReviewStatus.PENDING) {
            throw new IllegalArgumentException("검수 대기 중인 기록만 영상을 업로드할 수 있습니다.");
        }
    }

    private String buildStorageKey(String recordId, String originalFilename) {
        String prefix = appProperties.getS3().getReviewVideoPrefix();
        String safePrefix = (prefix == null || prefix.isBlank()) ? "review-videos" : prefix.replaceAll("/+$", "");
        String extension = extractExtension(originalFilename);
        return safePrefix + "/" + recordId + "/" + UUID.randomUUID() + extension;
    }

    private String extractExtension(String originalFilename) {
        if (originalFilename == null || originalFilename.isBlank()) {
            return ".webm";
        }
        int lastDot = originalFilename.lastIndexOf('.');
        if (lastDot < 0 || lastDot == originalFilename.length() - 1) {
            return ".webm";
        }
        return originalFilename.substring(lastDot);
    }

    private String normalizeContentType(String contentType) {
        return (contentType == null || contentType.isBlank()) ? "application/octet-stream" : contentType;
    }

    private String createPresignedUrl(String key) {
        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(appProperties.getS3().getBucket())
                .key(key)
                .build();
        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(appProperties.getS3().getPresignedUrlMinutes()))
                .getObjectRequest(getObjectRequest)
                .build();
        URL url = s3Presigner.presignGetObject(presignRequest).url();
        return url.toString();
    }

    private void deleteObjectQuietly(ReviewVideo reviewVideo) {
        try {
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(appProperties.getS3().getBucket())
                    .key(reviewVideo.getStorageKey())
                    .build());
        } catch (RuntimeException ignored) {
            // Object cleanup should not block record state transitions.
        }
    }

    private void ensureS3Enabled() {
        if (!appProperties.getS3().isEnabled()) {
            throw new IllegalArgumentException("S3 review video storage is disabled.");
        }
        if (appProperties.getS3().getBucket() == null || appProperties.getS3().getBucket().isBlank()) {
            throw new IllegalArgumentException("S3 bucket 설정이 필요합니다.");
        }
    }
}
