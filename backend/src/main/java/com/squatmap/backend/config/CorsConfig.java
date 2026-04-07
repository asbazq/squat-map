package com.squatmap.backend.config;

import java.util.List;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class CorsConfig implements WebMvcConfigurer {

    private final AppProperties appProperties;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        List<String> allowedOrigins = appProperties.getCors().getAllowedOrigins().stream()
                .flatMap(origin -> Stream.of(origin.split(",")))
                .map(String::trim)
                .filter(origin -> !origin.isBlank())
                .distinct()
                .toList();

        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins.toArray(String[]::new))
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(appProperties.getCors().isAllowCredentials())
                .maxAge(appProperties.getCors().getMaxAgeSeconds());
    }
}
