package com.datalineage.audit;

import com.datalineage.entity.AuditLogEntity;
import com.datalineage.service.AuditLogService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Full-chain audit: every write request (POST/PUT/DELETE/PATCH) hitting a controller is
 * recorded with caller identity, path, semantic action, result, latency and client ip.
 * Failures are recorded as FAILED and rethrown untouched; audit persistence problems are
 * swallowed so they can never break the business call.
 */
@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class AuditLogAspect {

    /** Path tails that read better as a verb than the plain CREATE/UPDATE/DELETE. */
    private static final Set<String> ACTION_TAILS = Set.of(
            "approve", "reject", "submit", "publish", "test", "run", "pause", "resume",
            "disable", "enable", "sweep", "build", "preview", "validate", "validate-schema",
            "naming-check", "import", "simulate", "read", "read-all", "events", "login",
            "apply", "sync", "acks", "exemptions");

    /** Path segments that look like resource ids (uuid/uuid-with-dashes/numeric). */
    private static final Pattern ID_SEGMENT =
            Pattern.compile("^(?:[0-9a-fA-F]{16,64}|[0-9a-fA-F-]{20,64}|\\d+)$");

    private final AuditLogService auditLogService;

    @Around("execution(public * com.datalineage.controller..*.*(..))")
    public Object audit(ProceedingJoinPoint pjp) throws Throwable {
        HttpServletRequest request = currentRequest();
        if (request == null) {
            return pjp.proceed();
        }
        Method method = ((MethodSignature) pjp.getSignature()).getMethod();
        AuditLog annotation = resolveAnnotation(method);
        if (annotation != null && annotation.skip()) {
            return pjp.proceed();
        }
        String httpMethod = request.getMethod().toUpperCase();
        if (!isWrite(httpMethod)) {
            return pjp.proceed();
        }

        long startedAt = System.nanoTime();
        boolean success = true;
        try {
            return pjp.proceed();
        } catch (Throwable t) {
            success = false;
            throw t;
        } finally {
            long durationMs = (System.nanoTime() - startedAt) / 1_000_000;
            recordQuietly(request, httpMethod, annotation, success, durationMs);
        }
    }

    private void recordQuietly(HttpServletRequest request, String httpMethod,
                               AuditLog annotation, boolean success, long durationMs) {
        try {
            String path = request.getRequestURI();
            List<String> segments = pathSegments(path);

            AuditLogEntity entry = new AuditLogEntity();
            entry.setHttpMethod(httpMethod);
            entry.setPath(path);
            entry.setAction(annotation != null && !annotation.action().isBlank()
                    ? annotation.action()
                    : deriveAction(httpMethod, segments));
            entry.setResourceType(annotation != null && !annotation.resourceType().isBlank()
                    ? annotation.resourceType()
                    : (segments.isEmpty() ? "UNKNOWN" : segments.get(0).toUpperCase()));
            entry.setResourceId(findId(segments));
            entry.setSummary(annotation != null && !annotation.summary().isBlank()
                    ? annotation.summary()
                    : httpMethod + " " + path);
            entry.setResult(success ? "SUCCESS" : "FAILED");
            entry.setDurationMs(durationMs);
            entry.setClientIp(clientIp(request));
            entry.setCreatedAt(LocalDateTime.now());
            fillCaller(entry);
            auditLogService.record(entry);
        } catch (Exception e) {
            log.warn("Audit record skipped: {}", e.getMessage());
        }
    }

    private AuditLog resolveAnnotation(Method method) {
        AuditLog onMethod = AnnotationUtils.findAnnotation(method, AuditLog.class);
        if (onMethod != null) {
            return onMethod;
        }
        return AnnotationUtils.findAnnotation(method.getDeclaringClass(), AuditLog.class);
    }

    private boolean isWrite(String httpMethod) {
        return "POST".equals(httpMethod) || "PUT".equals(httpMethod)
                || "DELETE".equals(httpMethod) || "PATCH".equals(httpMethod);
    }

    private List<String> pathSegments(String path) {
        List<String> segments = new ArrayList<>();
        for (String seg : path.split("/")) {
            if (seg.isBlank() || "api".equals(seg) || "v1".equals(seg) || "v2".equals(seg)) {
                continue;
            }
            segments.add(seg);
        }
        return segments;
    }

    private String deriveAction(String httpMethod, List<String> segments) {
        if (!segments.isEmpty()) {
            String tail = segments.get(segments.size() - 1);
            if (ACTION_TAILS.contains(tail)) {
                return tail.toUpperCase().replace('-', '_');
            }
        }
        return switch (httpMethod) {
            case "POST" -> "CREATE";
            case "PUT", "PATCH" -> "UPDATE";
            case "DELETE" -> "DELETE";
            default -> httpMethod;
        };
    }

    private String findId(List<String> segments) {
        for (String seg : segments) {
            if (ID_SEGMENT.matcher(seg).matches()) {
                return seg;
            }
        }
        return null;
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }

    private void fillCaller(AuditLogEntity entry) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated()
                && auth.getPrincipal() != null
                && !"anonymousUser".equals(auth.getPrincipal())) {
            entry.setUsername(String.valueOf(auth.getPrincipal()));
            String role = auth.getAuthorities().stream()
                    .findFirst()
                    .map(a -> a.getAuthority().replace("ROLE_", ""))
                    .orElse(null);
            entry.setRole(role);
        } else {
            entry.setUsername("anonymous");
        }
    }

    private HttpServletRequest currentRequest() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) {
            return attrs.getRequest();
        }
        return null;
    }
}
