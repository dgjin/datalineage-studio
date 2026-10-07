package com.datalineage.parser;

import java.util.List;

/**
 * Design-model format adapter. Implementations parse one design-time model
 * format (ERMaster .erm, PowerDesigner .pdm, ...) into the shared table model
 * so downstream logic (import, diff, version compare) stays format-agnostic.
 */
public interface ModelParser {

    /** Stable format identifier persisted in data_models.source_format. */
    String format();

    /** Whether this parser can handle the given file (by name suffix and/or content sniffing). */
    boolean supports(String fileName, String content);

    /** Parse raw file content into model tables; never returns null. */
    List<ModelTable> parse(String content);
}
