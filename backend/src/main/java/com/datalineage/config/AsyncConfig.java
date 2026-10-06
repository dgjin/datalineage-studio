package com.datalineage.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Dedicated executor for asynchronous metadata collection runs.
 * A JDBC collection can scan a remote database for tens of seconds, so it must
 * not block the HTTP request thread nor the cron scheduler thread; the manual
 * trigger endpoint returns immediately and callers poll the run-status endpoint.
 */
@Configuration
public class AsyncConfig {

    @Bean(name = "collectTaskExecutor")
    public ThreadPoolTaskExecutor collectTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("collect-task-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(15);
        executor.initialize();
        return executor;
    }
}
