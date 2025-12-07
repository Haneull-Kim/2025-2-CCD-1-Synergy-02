package com.synergy.bokja.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class TtsResponseDTO {

    // 프론트엔드가 'audio_base64'를 기대하므로 매핑 설정
    @JsonProperty("audio_base64")
    private String audioBase64;
}