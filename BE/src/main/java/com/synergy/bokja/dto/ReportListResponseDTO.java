package com.synergy.bokja.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import java.util.List;

@Getter
@AllArgsConstructor
public class ReportListResponseDTO {
    private List<ReportItemDTO> report_list;
}