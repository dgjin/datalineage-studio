package com.datalineage.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.datalineage.entity.UserEntity;
import com.datalineage.exception.BusinessException;
import com.datalineage.mapper.UserMapper;
import com.datalineage.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * Authentication service: verifies credentials against the users table
 * (BCrypt-hashed passwords) and issues JWT access tokens.
 */
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public Map<String, Object> login(String username, String password) {
        if (username == null || password == null || username.isBlank() || password.isBlank()) {
            throw new BusinessException("用户名与密码不能为空");
        }
        UserEntity user = userMapper.selectOne(new QueryWrapper<UserEntity>().eq("username", username));
        if (user == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new BusinessException("用户名或密码错误");
        }
        if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
            throw new BusinessException("账号已停用，请联系平台管理员");
        }
        Map<String, Object> result = new HashMap<>();
        result.put("token", jwtService.issue(user));
        result.put("expiresInMs", jwtService.getExpiryMs());
        result.put("user", describe(user));
        return result;
    }

    public UserEntity findByUsername(String username) {
        return userMapper.selectOne(new QueryWrapper<UserEntity>().eq("username", username));
    }

    /** Public-safe view of a user account (never exposes the password hash). */
    public Map<String, Object> describe(UserEntity user) {
        Map<String, Object> info = new HashMap<>();
        info.put("username", user.getUsername());
        info.put("displayName", user.getDisplayName());
        info.put("role", user.getRoleCode());
        return info;
    }
}
