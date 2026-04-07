package com.squatmap.backend.dto.admin;

public record AdminLoginResponse(
        boolean authenticated,
        String username,
        String message
) {
}
