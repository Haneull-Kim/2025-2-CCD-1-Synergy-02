package com.synergy.bokja.controller;

import com.synergy.bokja.dto.TtsRequestDTO;
import com.synergy.bokja.dto.TtsResponseDTO;
import com.synergy.bokja.response.BaseResponse;
import com.synergy.bokja.service.TtsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/audio/tts")
@RequiredArgsConstructor
public class TTSController {

    private final TtsService ttsService;

    @PostMapping("")
    // ⭐️ [수정] 반환 타입을 ResponseEntity로 감싸야 합니다.
    public ResponseEntity<BaseResponse<TtsResponseDTO>> generateTts(@RequestBody TtsRequestDTO request) {

        // 1. 서비스 호출
        String audioData = ttsService.generateTtsFromText(request.getText());

        // 2. 응답 DTO 생성
        TtsResponseDTO responseDTO = new TtsResponseDTO(audioData);

        // 3. 공통 응답 객체 생성
        BaseResponse<TtsResponseDTO> response =
                new BaseResponse<>(1000, "TTS 생성에 성공하였습니다.", responseDTO);

        // 4. ResponseEntity에 담아서 반환 (200 OK)
        return ResponseEntity.ok(response);
    }
}