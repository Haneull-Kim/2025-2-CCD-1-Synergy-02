import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  ScrollView,
  useWindowDimensions,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Audio } from 'expo-av';
import { CallButton } from '../../components/CallButtons';
import responsive from '../../utils/responsive';

interface IncomingCallScreenProps {
  onAccept?: () => void;
  onDecline?: () => void;
}

export const IncomingCallScreen = React.memo(({
  onAccept,
  onDecline,
}: IncomingCallScreenProps) => {
  const { width } = useWindowDimensions();
  const isTablet = width > 600;
  const MAX_WIDTH = isTablet ? 420 : 360;
  const [isInteractionComplete, setIsInteractionComplete] = useState(false);
  const soundRef = React.useRef<Audio.Sound | null>(null);

  // 배경음악 재생 (랜덤 선택)
  useEffect(() => {
    let isMounted = true;
    
    const playBackgroundMusic = async () => {
      try {
        // 랜덤하게 music1 또는 music2 선택
        const musicNumber = Math.random() < 0.5 ? 1 : 2;
        const musicSource = musicNumber === 1 
          ? require('../../../assets/music/music1.mp3')
          : require('../../../assets/music/music2.mp3');
        
        console.log(`[IncomingCallScreen] 배경음악 재생 시작: music${musicNumber}.mp3`);
        
        // 오디오 모드 설정 (재시도 로직 포함)
        let audioModeSet = false;
        for (let retry = 0; retry < 3 && !audioModeSet; retry++) {
          try {
            await Audio.setAudioModeAsync({
              // IOS
              playsInSilentModeIOS: true,
              // Android
              staysActiveInBackground: false,
              playThroughEarpieceAndroid: false,
              shouldDuckAndroid: true, // TTS와 함께 재생 가능하도록
            });
            audioModeSet = true;
          } catch (error) {
            console.warn(`[IncomingCallScreen] 오디오 모드 설정 실패 (시도 ${retry + 1}/3):`, error);
            if (retry < 2) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        }
        
        // 오디오 로드 및 재생 (재시도 로직 포함)
        let audioSound: Audio.Sound | null = null;
        for (let retry = 0; retry < 3 && !audioSound; retry++) {
          try {
            const result = await Audio.Sound.createAsync(
              musicSource,
              { 
                shouldPlay: true,
                isLooping: true, // 반복 재생
                volume: 0.5, // 볼륨 50%
              }
            );
            audioSound = result.sound;
            
            // 재생 상태 확인
            const status = await audioSound.getStatusAsync();
            if (!status.isLoaded) {
              console.warn('[IncomingCallScreen] 배경음악 로드 실패, 재시도...');
              await audioSound.unloadAsync();
              audioSound = null;
              if (retry < 2) {
                await new Promise(resolve => setTimeout(resolve, 200));
              }
              continue;
            }
          } catch (error) {
            console.error(`[IncomingCallScreen] 배경음악 재생 실패 (시도 ${retry + 1}/3):`, error);
            if (retry < 2) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          }
        }
        
        if (audioSound && isMounted) {
          soundRef.current = audioSound;
          console.log('[IncomingCallScreen] 배경음악 재생 성공');
        } else if (audioSound) {
          // 컴포넌트가 언마운트된 경우 즉시 정리
          audioSound.unloadAsync().catch(console.error);
        } else {
          console.error('[IncomingCallScreen] 배경음악 재생 실패 - 모든 재시도 실패');
        }
      } catch (error) {
        console.error('[IncomingCallScreen] 배경음악 재생 실패:', error);
      }
    };
    
    playBackgroundMusic();
    
    return () => {
      isMounted = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(console.error);
        soundRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const interactionPromise = InteractionManager.runAfterInteractions(() => {
      setIsInteractionComplete(true);
      console.log('IncomingCallScreen: Interactions complete');
    });

    return () => interactionPromise.cancel();
  }, []);

  const handleAccept = useCallback(() => {
    console.log('통화 수락');
    onAccept?.();
  }, [onAccept]);

  const handleDecline = useCallback(() => {
    console.log('통화 거절');
    onDecline?.();
  }, [onDecline]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#60584d" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.pageWrapper, { maxWidth: MAX_WIDTH }]}>
          {/* App Logo - 232x232 */}
          <Image
            source={require('../../../assets/images/icon.png')}
            style={styles.appLogo}
            contentFit="contain"
            cachePolicy="disk"
            priority="high"
            transition={150}
          />
        </View>
      </ScrollView>
      
      {/* 하단 고정 버튼 */}
      <View style={styles.callActionContainer}>
        {/* Accept Button (초록색) - 왼쪽 */}
        <CallButton type="accept" onPress={handleAccept} />
        
        {/* Decline Button (빨간색) - 오른쪽 */}
        <CallButton type="decline" onPress={handleDecline} />
      </View>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#60584d',
  },
  scrollContent: {
    paddingHorizontal: responsive(16),
    paddingTop: responsive(70),
    paddingBottom: responsive(120),
    alignItems: 'center' as any,
    flexGrow: 1,
  },
  pageWrapper: {
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center' as any,
  },
  appLogo: {
    width: responsive(232),
    height: responsive(232),
    marginTop: responsive(100),
  },
  callActionContainer: {
    position: 'absolute',
    left: responsive(16),
    right: responsive(16),
    bottom: responsive(86),
    flexDirection: 'row' as any,
    alignItems: 'center' as any,
    justifyContent: 'center' as any,
    height: responsive(80),
    gap: responsive(116),
  },
});

