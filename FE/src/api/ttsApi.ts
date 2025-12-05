import { api } from './api';
import { BaseResponse } from './types';

// TTS 요청 타입
export interface TtsRequest {
  text: string;
}

// TTS 응답 타입
export interface TtsResponse {
  audio_base64: string;
}

/**
 * TTS API 호출
 * @param text TTS로 변환할 텍스트
 * @returns Base64 인코딩된 오디오 데이터
 */
export const generateTts = async (text: string): Promise<BaseResponse<TtsResponse>> => {
  try {
    // 백엔드 엔드포인트: POST /audio/tts (또는 실제 엔드포인트에 맞게 수정 필요)
    const response = await api.post<BaseResponse<TtsResponse>>('/audio/tts', { text });
    return response.data;
  } catch (error: any) {
    console.error('TTS 생성 실패:', error);
    throw error;
  }
};



