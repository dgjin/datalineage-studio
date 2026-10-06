package com.datalineage.controller;

import com.datalineage.dto.ApiResponse;
import com.datalineage.entity.UserEntity;
import com.datalineage.exception.BusinessException;
import com.datalineage.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@Tag(name = "认证", description = "登录与当前用户信息（JWT）")
public class AuthController {

    private final UserService userService;

    @PostMapping("/login")
    @Operation(summary = "登录并签发 JWT")
    public ApiResponse<Map<String, Object>> login(@RequestBody Map<String, String> req) {
        return ApiResponse.success(userService.login(req.get("username"), req.get("password")),
                "Login successful");
    }

    @GetMapping("/me")
    @Operation(summary = "获取当前登录用户信息")
    public ApiResponse<Map<String, Object>> me(Authentication authentication) {
        if (authentication == null) {
            throw new BusinessException("未登录");
        }
        UserEntity user = userService.findByUsername(authentication.getName());
        if (user == null) {
            throw new BusinessException("用户不存在: " + authentication.getName());
        }
        return ApiResponse.success(userService.describe(user));
    }
}
