package com.datalineage.audit;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a controller method (or an entire controller class) for full-chain audit.
 * The aspect already audits every POST/PUT/DELETE by default; this annotation only
 * refines the semantics (action / resourceType / summary) or opts an endpoint out.
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface AuditLog {

    /** Semantic action name, e.g. NAMING_CHECK. Empty = derived from HTTP method + path. */
    String action() default "";

    /** Resource type, e.g. STANDARD. Empty = derived from the first path segment. */
    String resourceType() default "";

    /** Human summary template. Empty = derived from method + path. */
    String summary() default "";

    /** When true the endpoint is excluded from auditing (e.g. health probes). */
    boolean skip() default false;
}
