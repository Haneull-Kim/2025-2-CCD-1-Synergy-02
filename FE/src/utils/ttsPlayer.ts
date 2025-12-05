import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { audioManager } from './audioManager';

// 현재 재생 중인 Sound 인스턴스와 파일 경로를 추적 (하위 호환성 유지)
let currentSound: Audio.Sound | null = null;
let currentFileUri: string | null = null;
// 순차 재생 취소 플래그
let isSequentialCancelled = false;

// 화면별 오디오 ID 관리 (화면 전환 시 자동 정리용)
const SCREEN_AUDIO_ID_PREFIX = 'screen-tts-';

/**
 * 오디오 모드를 안전하게 설정합니다.
 */
const setAudioModeSafe = async (): Promise<void> => {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
  } catch (error) {
    console.warn('⚠️ [TTS] 오디오 모드 설정 실패 (재시도):', error);
    // 재시도
    try {
      await new Promise(resolve => setTimeout(resolve, 100)); // 짧은 대기
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
    } catch (retryError) {
      console.error('❌ [TTS] 오디오 모드 설정 재시도 실패:', retryError);
      // 마지막 시도
      try {
        await new Promise(resolve => setTimeout(resolve, 200));
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      } catch (finalError) {
        console.error('❌ [TTS] 오디오 모드 설정 최종 실패:', finalError);
      }
    }
  }
};

/**
 * 현재 재생 중인 오디오를 중지하고 정리합니다.
 * @param cancelSequential 순차 재생을 취소할지 여부 (기본값: true)
 */
const stopCurrentAudio = async (cancelSequential: boolean = true): Promise<void> => {
  try {
    // 순차 재생 취소 플래그 설정 (순차 재생 중 다음 오디오로 넘어갈 때는 false)
    if (cancelSequential) {
      isSequentialCancelled = true;
    }
    
    if (currentSound) {
      try {
        const status = await currentSound.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await currentSound.stopAsync();
            console.log('⏹️ [TTS] 이전 오디오 재생 중지');
          }
          await currentSound.unloadAsync();
        }
      } catch (soundError) {
        console.warn('⚠️ [TTS] Sound 상태 확인/정리 중 에러 (무시하고 계속):', soundError);
        // 이미 정리된 sound일 수 있으므로 무시하고 계속 진행
      }
      currentSound = null;
    }
    
    // 이전 파일 정리
    if (currentFileUri) {
      try {
        await FileSystem.deleteAsync(currentFileUri, { idempotent: true });
      } catch (fileError) {
        console.warn('⚠️ [TTS] 파일 삭제 실패 (무시하고 계속):', fileError);
      }
      currentFileUri = null;
    }
  } catch (error) {
    console.error('❌ [TTS] 이전 오디오 중지 실패:', error);
    // 에러가 발생해도 계속 진행
    currentSound = null;
    currentFileUri = null;
  }
};

/**
 * Base64 인코딩된 오디오 데이터를 재생합니다.
 * 이전에 재생 중인 오디오가 있으면 자동으로 중지하고 새로운 오디오를 재생합니다.
 * @param base64Audio Base64 인코딩된 오디오 문자열
 * @param onFinish 재생 완료 시 호출될 콜백 함수 (선택적)
 * @param screenId 화면 식별자 (선택적, 화면별 오디오 관리용)
 * @param isMountedRef 마운트 상태 참조 (선택적, 화면 전환 감지용)
 * @returns 재생 성공 여부
 */
export const playBase64Audio = async (
  base64Audio: string, 
  onFinish?: () => void,
  screenId?: string,
  isMountedRef?: React.MutableRefObject<boolean>
): Promise<boolean> => {
  const maxRetries = 2;
  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (!base64Audio || base64Audio.trim().length === 0) {
        console.warn('⚠️ [TTS] Base64 오디오 데이터가 없습니다.');
        return false;
      }

      // 이전 재생 중지 (재시도 시에도 정리)
      await stopCurrentAudio();

      // Base64 데이터를 디코딩하여 임시 파일로 저장
      const base64Data = base64Audio.trim();
      
      // Base64 문자열이 data URI 형식인지 확인 (예: "data:audio/mp3;base64,...")
      let audioBase64 = base64Data;
      if (base64Data.startsWith('data:')) {
        // data URI에서 base64 부분만 추출
        const commaIndex = base64Data.indexOf(',');
        if (commaIndex !== -1) {
          audioBase64 = base64Data.substring(commaIndex + 1);
        }
      }

      // 임시 파일 경로 생성 (재시도 시 고유한 파일명)
      const tempFileUri = `${FileSystem.cacheDirectory}tts_${Date.now()}_${attempt}.mp3`;
      currentFileUri = tempFileUri;
      
      // 파일로 저장
      try {
        await FileSystem.writeAsStringAsync(tempFileUri, audioBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (fileError) {
        console.error(`❌ [TTS] 파일 저장 실패 (시도 ${attempt + 1}/${maxRetries + 1}):`, fileError);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms 대기 후 재시도
          continue;
        }
        throw fileError;
      }

      // 오디오 재생 설정 (안전한 설정 함수 사용)
      await setAudioModeSafe();

      // 화면이 여전히 마운트되어 있는지 확인
      if (isMountedRef && !isMountedRef.current) {
        console.log('⚠️ [TTS] 화면이 언마운트되어 재생 취소');
        try {
          await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
        } catch {}
        return false;
      }

      // Sound 객체 생성 및 재생
      let sound: Audio.Sound;
      try {
        const result = await Audio.Sound.createAsync(
          { uri: tempFileUri },
          { 
            shouldPlay: true,
            volume: 1.0,
          }
        );
        sound = result.sound;
      } catch (soundError) {
        console.error(`❌ [TTS] Sound 생성 실패 (시도 ${attempt + 1}/${maxRetries + 1}):`, soundError);
        // 파일 정리
        try {
          await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
        } catch {}
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 200)); // 200ms 대기 후 재시도
          continue;
        }
        throw soundError;
      }
      
      // 화면이 여전히 마운트되어 있는지 다시 확인
      if (isMountedRef && !isMountedRef.current) {
        console.log('⚠️ [TTS] Sound 생성 후 화면 언마운트 감지, 정리');
        await sound.unloadAsync().catch(console.error);
        await FileSystem.deleteAsync(tempFileUri, { idempotent: true }).catch(console.error);
        return false;
      }
      
      // 현재 재생 중인 Sound 인스턴스 저장
      currentSound = sound;
      
      // audioManager에 등록 (화면별 관리)
      if (screenId) {
        audioManager.register(`${SCREEN_AUDIO_ID_PREFIX}${screenId}`, sound, tempFileUri);
      }

      // 재생 상태 확인
      try {
        const initialStatus = await sound.getStatusAsync();
        if (!initialStatus.isLoaded) {
          console.warn('⚠️ [TTS] Sound가 로드되지 않았습니다. 재시도...');
          await sound.unloadAsync();
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 200));
            continue;
          }
        }
      } catch (statusError) {
        console.warn('⚠️ [TTS] 초기 상태 확인 실패:', statusError);
      }

      // 재생 완료 후 정리
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          // 재생 완료 시 파일 삭제 및 리소스 해제
          sound.unloadAsync().catch((err) => {
            console.warn('⚠️ [TTS] 재생 완료 후 정리 실패:', err);
          });
          FileSystem.deleteAsync(tempFileUri, { idempotent: true }).catch((err) => {
            console.warn('⚠️ [TTS] 파일 삭제 실패:', err);
          });
          
          // 현재 재생 중인 인스턴스 초기화
          if (currentSound === sound) {
            currentSound = null;
            currentFileUri = null;
            console.log('✅ [TTS] 오디오 재생 완료 및 정리');
            
            // 재생 완료 콜백 호출
            if (onFinish) {
              onFinish();
            }
          }
        }
      });

      console.log(`✅ [TTS] 오디오 재생 시작 (시도 ${attempt + 1}/${maxRetries + 1})`);
      return true;
    } catch (error) {
      lastError = error;
      console.error(`❌ [TTS] 오디오 재생 실패 (시도 ${attempt + 1}/${maxRetries + 1}):`, error);
      
      // 마지막 시도가 아니면 재시도
      if (attempt < maxRetries) {
        // 정리
        currentSound = null;
        currentFileUri = null;
        // 재시도 전 대기
        await new Promise(resolve => setTimeout(resolve, 300));
        continue;
      }
    }
  }

  // 모든 재시도 실패
  console.error('❌ [TTS] 모든 재시도 실패:', lastError);
  currentSound = null;
  currentFileUri = null;
  return false;
};

/**
 * 여러 오디오를 순차적으로 재생합니다.
 * @param audioUrls Base64 인코딩된 오디오 문자열 배열
 * @param screenId 화면 식별자 (선택적, 화면별 오디오 관리용)
 */
export const playSequentialAudio = async (audioUrls: string[], screenId?: string): Promise<void> => {
  // 취소 플래그 초기화
  isSequentialCancelled = false;
  
  // 이전 화면의 오디오가 있으면 먼저 정리
  if (screenId) {
    console.log(`[TTS] 화면 ${screenId}의 이전 오디오 정리`);
    await audioManager.unregister(`${SCREEN_AUDIO_ID_PREFIX}${screenId}`);
  }
  
  // 다른 화면의 오디오도 정리 (화면 전환 시)
  await stopCurrentAudio(false);
  
  for (let i = 0; i < audioUrls.length; i++) {
    // 취소되었는지 확인
    if (isSequentialCancelled) {
      console.log('⏹️ [TTS] 순차 재생이 취소되었습니다.');
      break;
    }
    
    const audioUrl = audioUrls[i];
    if (!audioUrl || audioUrl.trim().length === 0) {
      continue;
    }

    try {
      // 이전 재생 중지 (첫 번째 오디오가 아닌 경우)
      // 순차 재생 중이므로 cancelSequential을 false로 설정하여 계속 재생
      if (i > 0) {
        await stopCurrentAudio(false);
      } else {
        // 첫 번째 오디오 재생 전에 이전 오디오가 있으면 정리 (순차 재생 취소하지 않음)
        if (currentSound) {
          await stopCurrentAudio(false);
        }
      }
      
      // 취소되었는지 다시 확인
      if (isSequentialCancelled) {
        console.log('⏹️ [TTS] 순차 재생이 취소되었습니다.');
        break;
      }

      const base64Data = audioUrl.trim();
      let audioBase64 = base64Data;
      if (base64Data.startsWith('data:')) {
        const commaIndex = base64Data.indexOf(',');
        if (commaIndex !== -1) {
          audioBase64 = base64Data.substring(commaIndex + 1);
        }
      }

      const tempFileUri = `${FileSystem.cacheDirectory}tts_${Date.now()}_${i}.mp3`;
      currentFileUri = tempFileUri;

      await FileSystem.writeAsStringAsync(tempFileUri, audioBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await setAudioModeSafe();

      const { sound } = await Audio.Sound.createAsync(
        { uri: tempFileUri },
        { 
          shouldPlay: true,
          volume: 1.0,
        }
      );

      currentSound = sound;
      
      // 화면별 오디오 관리에 등록
      if (screenId) {
        audioManager.register(`${SCREEN_AUDIO_ID_PREFIX}${screenId}`, sound, tempFileUri);
      }

      // 재생 완료를 기다림
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('재생 타임아웃'));
        }, 60000); // 60초 타임아웃
        
        sound.setOnPlaybackStatusUpdate((status) => {
          // 취소되었는지 확인
          if (isSequentialCancelled) {
            clearTimeout(timeout);
            // audioManager에서도 제거
            if (screenId) {
              audioManager.unregister(`${SCREEN_AUDIO_ID_PREFIX}${screenId}`).catch(console.error);
            }
            sound.stopAsync().catch(console.error);
            sound.unloadAsync().catch(console.error);
            FileSystem.deleteAsync(tempFileUri, { idempotent: true }).catch(console.error);
            if (currentSound === sound) {
              currentSound = null;
              currentFileUri = null;
            }
            resolve();
            return;
          }
          
          if (status.isLoaded) {
            if (status.didJustFinish) {
              clearTimeout(timeout);
              // audioManager에서도 제거
              if (screenId) {
                audioManager.unregister(`${SCREEN_AUDIO_ID_PREFIX}${screenId}`).catch(console.error);
              }
              sound.unloadAsync().catch(console.error);
              FileSystem.deleteAsync(tempFileUri, { idempotent: true }).catch(console.error);
              if (currentSound === sound) {
                currentSound = null;
                currentFileUri = null;
              }
              resolve();
            }
          } else {
            // 로드되지 않은 경우 에러로 처리
            clearTimeout(timeout);
            reject(new Error('오디오 로드 실패'));
          }
        });
      });
    } catch (error) {
      console.error(`❌ [TTS] ${i + 1}번째 오디오 재생 실패:`, error);
      console.error('에러 상세:', error);
      // audioManager에서도 제거
      if (screenId) {
        audioManager.unregister(`${SCREEN_AUDIO_ID_PREFIX}${screenId}`).catch(console.error);
      }
      // 에러가 발생해도 다음 오디오 재생 시도 (취소되지 않은 경우)
      if (!isSequentialCancelled) {
        currentSound = null;
        currentFileUri = null;
      }
    }
  }
  
  // 순차 재생 완료 또는 취소 후 플래그 초기화 및 audioManager 정리
  isSequentialCancelled = false;
  if (screenId) {
    await audioManager.unregister(`${SCREEN_AUDIO_ID_PREFIX}${screenId}`);
  }
  console.log(`[TTS] 순차 재생 완료 - 화면 ${screenId || '알 수 없음'} 정리`);
};

/**
 * 현재 재생 중인 오디오를 중지합니다.
 * @param screenId 화면 식별자 (선택적, 특정 화면의 오디오만 정리)
 */
export const stopAudio = async (screenId?: string): Promise<void> => {
  // 순차 재생 취소 플래그 설정
  isSequentialCancelled = true;
  
  // 특정 화면의 오디오만 정리
  if (screenId) {
    await audioManager.unregister(`${SCREEN_AUDIO_ID_PREFIX}${screenId}`);
  }
  
  await stopCurrentAudio();
};

/**
 * 특정 화면의 모든 오디오를 정리합니다.
 * @param screenId 화면 식별자
 */
export const stopScreenAudio = async (screenId: string): Promise<void> => {
  await stopAudio(screenId);
};


