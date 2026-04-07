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
}
