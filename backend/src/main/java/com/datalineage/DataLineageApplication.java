package com.datalineage;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * DataLineage Studio Backend Application
 * Universal Data Lineage and Governance Platform
 */
@SpringBootApplication
@EnableScheduling
@MapperScan("com.datalineage.mapper")
public class DataLineageApplication {

    public static void main(String[] args) {
        SpringApplication.run(DataLineageApplication.class, args);
    }
}
