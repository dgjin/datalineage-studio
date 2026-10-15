package com.datalineage.config;

import com.datalineage.security.JwtAuthFilter;
import com.datalineage.security.OpsTokenAuthFilter;
import com.datalineage.security.RestAccessDeniedHandler;
import com.datalineage.security.RestAuthEntryPoint;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

/**
 * Stateless JWT security with three-role RBAC:
 * - GET endpoints stay public so read-only browsing works without a session,
 *   except the requirement-feedback management views and /requirements/export.
 * - Write endpoints (POST/PUT/DELETE) require an ADMIN or GOVERNOR bearer token;
 *   a VIEWER token is authenticated but denied (403).
 * - Requirement feedback: submission and own-list endpoints are open to any
 *   authenticated user; management views / review / delete are ADMIN-only.
 * - /auth/login, actuator and swagger stay public.
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final OpsTokenAuthFilter opsTokenAuthFilter;
    private final RestAuthEntryPoint authEntryPoint;
    private final RestAccessDeniedHandler accessDeniedHandler;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/auth/login", "/actuator/**", "/swagger-ui/**",
                        "/swagger-ui.html", "/v3/api-docs/**", "/error").permitAll()
                .requestMatchers("/auth/me").authenticated()
                // 需求反馈：提交 / 我的视图对全部登录用户开放；管理视图与决策仅 ADMIN；
                // 导出接口另接受服务令牌通道（OpsTokenAuthFilter 注入 ADMIN 身份）
                .requestMatchers(HttpMethod.GET, "/requirements/export").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/requirements/mine", "/requirements/ops-progress").authenticated()
                .requestMatchers(HttpMethod.GET, "/requirements", "/requirements/summary").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/requirements").authenticated()
                .requestMatchers(HttpMethod.POST, "/requirements/*/review").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/requirements/*").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/**").permitAll()
                .anyRequest().hasAnyRole("ADMIN", "GOVERNOR"))
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(authEntryPoint)
                .accessDeniedHandler(accessDeniedHandler))
            .addFilterBefore(opsTokenAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowCredentials(true);
        config.setAllowedOriginPatterns(Arrays.asList("http://localhost:*", "http://127.0.0.1:*"));
        config.setAllowedHeaders(Arrays.asList("*"));
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
