package com.squatmap.backend.domain;

import java.util.Arrays;
import java.util.List;

public enum Region {
    서울,
    경기,
    인천,
    강원,
    충북,
    충남,
    세종,
    대전,
    경북,
    대구,
    전북,
    전남,
    광주,
    경남,
    울산,
    부산,
    제주;

    public static final List<String> NAMES = Arrays.stream(values()).map(Region::name).toList();

    public static Region from(String value) {
        return Arrays.stream(values())
                .filter(region -> region.name().equals(value))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unsupported region: " + value));
    }
}
