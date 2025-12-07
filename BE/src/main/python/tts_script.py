import sys
import json
import base64
from google.cloud import texttospeech

# --- 1. Google Cloud TTS ---
# 환경변수 GOOGLE_APPLICATION_CREDENTIALS에 서비스 계정 키 파일 경로 설정 필요

# --- 2. 텍스트 전처리 함수 (마침표, 쉼표 뒤 일시정지 추가) ---
def add_pauses_after_punctuation(text):
    """
    마침표(.)와 쉼표(,) 뒤에 0.5초 일시정지를 추가합니다.
    SSML의 <break> 태그를 사용합니다.
    이미 SSML 태그가 있는 경우는 건드리지 않습니다.
    """
    import re
    
    # 이미 break 태그가 있는 경우를 제외하기 위한 패턴
    # 마침표나 쉼표 뒤에 <break 또는 </ 같은 태그가 오는 경우는 건드리지 않음
    
    # 마침표(.) 뒤 처리 - break 태그가 없는 경우만
    # . 뒤에 공백이 있으면 공백 유지, 없으면 break만 추가
    # 단, 이미 <break 또는 </ 같은 태그가 있으면 건드리지 않음
    text = re.sub(r'\.(\s*)(?!<)', r'.<break time="500ms"/>\1', text)
    
    # 쉼표(,) 뒤 처리 - break 태그가 없는 경우만
    text = re.sub(r',(\s*)(?!<)', r',<break time="500ms"/>\1', text)
    
    return text

# --- 3. TTS 함수 정의 ---
def text_to_speech(text, language_code="ko-KR", voice_name="ko-KR-Neural2-C", audio_encoding="MP3", speaking_rate=0.95, pitch=0.0, use_ssml=False, add_pauses=True):
    """
    텍스트를 음성으로 변환하여 Base64 인코딩된 오디오 데이터를 반환합니다.
    
    Args:
        text: 변환할 텍스트
        language_code: 언어 코드 (기본값: "ko-KR")
        voice_name: 음성 이름 (기본값: "ko-KR-Neural2-C")
        audio_encoding: 오디오 인코딩 (기본값: "MP3")
        speaking_rate: 말하기 속도 (기본값: 0.95)
        pitch: 음높이 (기본값: 0.0)
        use_ssml: SSML 사용 여부 (기본값: False)
        add_pauses: 마침표/쉼표 뒤 일시정지 추가 여부 (기본값: True)
    """
    try:
        # TTS 클라이언트 생성
        client = texttospeech.TextToSpeechClient()
        
        # 입력 텍스트 설정
        if use_ssml or add_pauses:
            # SSML을 사용하는 경우 (일시정지 추가를 위해 SSML 필요)
            processed_text = add_pauses_after_punctuation(text) if add_pauses else text
            
            if abs(pitch) < 0.1:
                ssml_text = f'<speak><prosody rate="{speaking_rate}">{processed_text}</prosody></speak>'
            else:
                pitch_value = int(round(pitch))
                ssml_text = f'<speak><prosody rate="{speaking_rate}" pitch="{pitch_value:+d}st">{processed_text}</prosody></speak>'
            synthesis_input = texttospeech.SynthesisInput(ssml=ssml_text)
        else:
            # 일반 텍스트 사용
            synthesis_input = texttospeech.SynthesisInput(text=text)
        
        # 음성 선택 파라미터 (Neural2 음성 사용)
        voice = texttospeech.VoiceSelectionParams(
            language_code=language_code,
            name=voice_name
        )
        
        # 오디오 설정
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3 if audio_encoding == "MP3" else texttospeech.AudioEncoding.LINEAR16,
            speaking_rate=speaking_rate,
            pitch=pitch
        )
        
        # TTS 요청 실행
        response = client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config
        )
        
        # 오디오 데이터를 Base64로 인코딩
        audio_base64 = base64.b64encode(response.audio_content).decode('utf-8')
        
        return audio_base64
        
    except Exception as e:
        print(f"Error in text_to_speech: {e}", file=sys.stderr)
        sys.exit(1)


# --- 3. (메인 실행부) Java에서 호출 ---
if __name__ == "__main__":
    try:
        mode = sys.argv[1]  # Java가 넘겨준 첫 번째 인자 (mode)
        
        output = None
        
        if mode == "tts":
            # 인자: text (필수), language_code (선택), voice_name (선택), audio_encoding (선택), speaking_rate (선택), pitch (선택), use_ssml (선택), add_pauses (선택)
            text = sys.argv[2]
            
            language_code = sys.argv[3] if len(sys.argv) > 3 else "ko-KR"
            voice_name = sys.argv[4] if len(sys.argv) > 4 else "ko-KR-Neural2-C"
            audio_encoding = sys.argv[5] if len(sys.argv) > 5 else "MP3"
            speaking_rate = float(sys.argv[6]) if len(sys.argv) > 6 else 0.95
            pitch = float(sys.argv[7]) if len(sys.argv) > 7 else 0.0  # 자연스러운 음높이
            use_ssml = sys.argv[8].lower() == "true" if len(sys.argv) > 8 else False
            add_pauses = sys.argv[9].lower() == "true" if len(sys.argv) > 9 else True  # 기본값: True (일시정지 추가)
            
            # TTS 변환
            audio_base64 = text_to_speech(text, language_code, voice_name, audio_encoding, speaking_rate, pitch, use_ssml, add_pauses)
            
            # 결과를 JSON 형식으로 반환 
            output = {
                "audio_base64": audio_base64,
                "format": audio_encoding.lower()
            }
            
        else:
            print(f"Invalid mode: {mode}", file=sys.stderr)
            sys.exit(1)
        
        # Java가 읽을 수 있도록 최종 결과를 JSON 형식으로 stdout에 출력
        print(json.dumps(output, ensure_ascii=False))
        
    except Exception as e:
        print(f"Python script failed: {e}", file=sys.stderr)
        sys.exit(1)

