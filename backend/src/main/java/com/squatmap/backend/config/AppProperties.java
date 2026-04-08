package com.squatmap.backend.config;

import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private final Cors cors = new Cors();
    private final Admin admin = new Admin();
    private final S3 s3 = new S3();

    @Getter
    @Setter
    public static class Cors {
        private List<String> allowedOrigins = new ArrayList<>();
        private boolean allowCredentials = false;
        private long maxAgeSeconds = 3600;
    }

    @Getter
    @Setter
    public static class Admin {
        private String bootstrapUsername;
        private String bootstrapPassword;
    }

    @Getter
    @Setter
    public static class S3 {
        private boolean enabled = false;
        private String region = "ap-northeast-2";
        private String bucket;
        private String accessKey;
        private String secretKey;
        private String endpoint;
        private String reviewVideoPrefix = "review-videos";
        private long presignedUrlMinutes = 30;
    }
}
