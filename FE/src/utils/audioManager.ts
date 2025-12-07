import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * 전역 오디오 재생 관리자
 * 화면 전환 시 모든 오디오를 안전하게 정리
 */
class AudioManager {
  private sounds: Map<string, Audio.Sound> = new Map();
  private fileUris: Map<string, string> = new Map();

  /**
   * 오디오를 등록합니다.
   * @param id 고유 식별자 (예: 'background-music', 'tts-123')
   * @param sound Audio.Sound 인스턴스
   * @param fileUri 임시 파일 경로 (선택적)
   */
  register(id: string, sound: Audio.Sound, fileUri?: string) {
    // 기존 오디오가 있으면 먼저 정리 (동기적으로만 처리, async는 호출자에서 처리)
    const existingSound = this.sounds.get(id);
    const existingFileUri = this.fileUris.get(id);
    
    if (existingSound) {
      // 기존 sound는 나중에 async로 정리하도록 Map에서만 제거
      this.sounds.delete(id);
      // 기존 sound 정리는 비동기로 처리 (await 없이)
      this.unregister(id).catch(console.error);
    }
    
    if (existingFileUri) {
      this.fileUris.delete(id);
    }

    this.sounds.set(id, sound);
    if (fileUri) {
      this.fileUris.set(id, fileUri);
    }
  }

  /**
   * 특정 오디오를 중지하고 정리합니다.
   */
  async unregister(id: string) {
    const sound = this.sounds.get(id);
    const fileUri = this.fileUris.get(id);

    if (sound) {
      try {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await sound.stopAsync();
          }
          await sound.unloadAsync();
        }
      } catch (error) {
        console.error(`[AudioManager] 오디오 ${id} 정리 실패:`, error);
      }
      this.sounds.delete(id);
    }

    if (fileUri) {
      try {
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
      } catch (error) {
        console.error(`[AudioManager] 파일 ${fileUri} 삭제 실패:`, error);
      }
      this.fileUris.delete(id);
    }
  }

  /**
   * 모든 오디오를 중지하고 정리합니다.
   */
  async clearAll() {
    const ids = Array.from(this.sounds.keys());
    await Promise.all(ids.map((id) => this.unregister(id)));
  }

  /**
   * 특정 오디오가 재생 중인지 확인합니다.
   */
  async isPlaying(id: string): Promise<boolean> {
    const sound = this.sounds.get(id);
    if (!sound) return false;

    try {
      const status = await sound.getStatusAsync();
      return status.isLoaded && status.isPlaying;
    } catch {
      return false;
    }
  }
}

// 싱글톤 인스턴스
export const audioManager = new AudioManager();


