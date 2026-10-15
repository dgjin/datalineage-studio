package com.datalineage.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;

/**
 * 需求基线标准导出接口（servlet 路径 /requirements/export）的服务令牌通道
 * （移植自源系统 requireOpsAccess 双通道）：Authorization Bearer 值与该配置
 * 恒时比较（先各自 SHA-256 摘要再 MessageDigest.isEqual，规避长度/前缀时序泄露），
 * 匹配时注入 ops-agent（ROLE_ADMIN）身份，供「AIOps 自动运维智能体」直接拉取；
 * 不匹配时不设置身份，回退 JwtAuthFilter（ADMIN JWT）通道；OPS_API_TOKEN 未配置
 * 时本通道关闭（fail-safe，不因缺配置放开访问）。
 */
@Component
public class OpsTokenAuthFilter extends OncePerRequestFilter {

    /** 仅拦截标准导出端点（servlet 路径相对 context-path=/api/v1）。 */
    private static final String EXPORT_PATH = "/requirements/export";
    private static final String BEARER_PREFIX = "Bearer ";

    /** 期望令牌的 SHA-256 摘要；null 表示未配置（通道关闭）。 */
    private final byte[] expectedDigest;

    public OpsTokenAuthFilter(@Value("${aiops.ops-api-token:}") String opsApiToken) {
        String token = opsApiToken == null ? "" : opsApiToken.trim();
        this.expectedDigest = token.isEmpty() ? null : sha256(token);
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        if (expectedDigest != null
                && EXPORT_PATH.equals(request.getServletPath())
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            String header = request.getHeader("Authorization");
            String provided = header != null && header.startsWith(BEARER_PREFIX)
                    ? header.substring(BEARER_PREFIX.length()) : null;
            if (provided != null && MessageDigest.isEqual(sha256(provided), expectedDigest)) {
                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                        "ops-agent", null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        }
        filterChain.doFilter(request, response);
    }

    private static byte[] sha256(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
