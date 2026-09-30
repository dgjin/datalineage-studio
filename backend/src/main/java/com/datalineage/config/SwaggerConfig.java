package com.datalineage.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI dataLineageOpenAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("DataLineage Studio API")
                .description("Universal Data Lineage and Governance Platform Backend API")
                .version("v1.0.0")
                .contact(new Contact()
                    .name("Data Governance Team")
                    .email("data-governance@company.com"))
                .license(new License()
                    .name("Apache 2.0")
                    .url("https://www.apache.org/licenses/LICENSE-2.0")));
    }
}
