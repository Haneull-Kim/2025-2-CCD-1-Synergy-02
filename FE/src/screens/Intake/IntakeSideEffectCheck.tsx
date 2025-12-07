import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import responsive from '../../utils/responsive';
import { createCondition } from '../../api/conditionApi';
import { getSideEffectPresets } from '../../api/presetApi';
import PinchZoomScrollView from '../../components/PinchZoomScrollView';

interface SideEffect {
  id: string;
  efno: number;
  name: string;
  icon: any;
}

interface IntakeSideEffectCheckProps {
  onComplete?: () => void;
}

// 아이콘 매핑
const iconMap: { [key: string]: any } = {
  '소화불량, 속쓰림': require('../../../assets/images/IndigestionHeartburn.png'),
  '변비, 소변불편': require('../../../assets/images/ConstipationUrinationDifficulty.png'),
  '졸림, 진정작용': require('../../../assets/images/DrowsinessSedation.png'),
  '피로감': require('../../../assets/images/Fatigue.png'),
  '어지러움': require('../../../assets/images/Dizziness.png'),
  '부종': require('../../../assets/images/SwellingEdema.png'),
  '입마름': require('../../../assets/images/DryMouth.png'),
};

export default function IntakeSideEffectCheck({ onComplete }: IntakeSideEffectCheckProps) {
  const { width } = useWindowDimensions();
  const isTablet = width > 600;
  const MAX_WIDTH = responsive(isTablet ? 420 : 360);
  const insets = useSafeAreaInsets();

  const [sideEffects, setSideEffects] = useState<SideEffect[]>([]);
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 부작용 프리셋 로드
  useEffect(() => {
    const loadSideEffectPresets = async () => {
      try {
        setIsLoading(true);
        const response = await getSideEffectPresets();
        if (response.header?.resultCode === 1000 && response.body?.effects) {
          const effects: SideEffect[] = response.body.effects.map((preset) => ({
            id: preset.efno.toString(),
            efno: preset.efno,
            name: preset.name,
            icon: iconMap[preset.name] || null,
          }));
          // 부작용 없음 추가
          effects.push({ id: 'none', efno: 0, name: '부작용\n없음', icon: null });
          setSideEffects(effects);
        }
      } catch (error: any) {
        console.error('부작용 프리셋 로드 실패:', error);
        Alert.alert('오류', '부작용 목록을 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };
    loadSideEffectPresets();
  }, []);

  const isNextButtonActive = selectedEffects.length > 0;

  const handleEffectSelect = (id: string) => {
    if (id === 'none') {
      // "부작용 없음" 선택 시 다른 모든 선택 해제
      if (selectedEffects.includes('none')) {
        setSelectedEffects([]);
      } else {
        setSelectedEffects(['none']);
      }
    } else {
      // 다른 부작용 선택 시
      if (selectedEffects.includes(id)) {
        // 이미 선택된 경우 해제
        setSelectedEffects(selectedEffects.filter(effect => effect !== id));
      } else {
        // 선택되지 않은 경우 추가 (부작용 없음은 제거)
        setSelectedEffects([...selectedEffects.filter(effect => effect !== 'none'), id]);
      }
    }
  };

  const handleNext = async () => {
    if (!isNextButtonActive || isSubmitting) return;

    try {
      setIsSubmitting(true);
      
      console.log('[IntakeSideEffectCheck] 선택 완료 버튼 클릭');
      console.log('[IntakeSideEffectCheck] 선택된 부작용:', selectedEffects);
      
      // 부작용 없음을 선택한 경우 빈 배열 전송
      const effectIds = selectedEffects.includes('none') 
        ? [] 
        : selectedEffects.map(id => {
            const effect = sideEffects.find(e => e.id === id);
            return effect?.efno || 0;
          }).filter(efno => efno > 0);

      console.log('[IntakeSideEffectCheck] 전송할 effectIds:', effectIds);
      console.log(`[IntakeSideEffectCheck] createCondition 호출 시작`);
      
      const response = await createCondition(effectIds);
      
      console.log('[IntakeSideEffectCheck] createCondition 응답:', {
        resultCode: response.header?.resultCode,
        resultMsg: response.header?.resultMsg,
        body: response.body
      });
      
      if (response.header?.resultCode === 1000) {
        console.log('[IntakeSideEffectCheck] ✅ 부작용 저장 성공');
        onComplete?.();
      } else {
        const errorMsg = response.header?.resultMsg || '부작용 저장에 실패했습니다.';
        console.error(`[IntakeSideEffectCheck] ❌ resultCode가 1000이 아님: ${response.header?.resultCode}, 메시지: ${errorMsg}`);
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error('=== [IntakeSideEffectCheck] 부작용 저장 실패 ===');
      console.error('에러 타입:', error.constructor.name);
      console.error('에러 메시지:', error.message);
      
      if (error.response) {
        console.error('응답 상태:', error.response.status);
        console.error('응답 데이터:', JSON.stringify(error.response.data, null, 2));
      }
      
      const errorMessage = error.response?.data?.header?.resultMsg 
        || error.response?.data?.message 
        || error.message 
        || '부작용 저장 중 오류가 발생했습니다.';
      
      Alert.alert(
        '저장 실패',
        `${errorMessage}\n\n에러 코드: ${error.response?.status || 'N/A'}`,
        [
          {
            text: '확인',
            onPress: () => {
              // 에러가 발생해도 화면은 유지 (사용자가 다시 시도할 수 있도록)
            }
          }
        ]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <StatusBar style="dark" />

      {/* 헤더 */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerText}>부작용 체크</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#60584d" />
          <Text style={styles.loadingText}>부작용 목록 불러오는 중...</Text>
        </View>
      ) : (
        <PinchZoomScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.pageWrapper, { maxWidth: MAX_WIDTH }]}>
            {/* 부작용 버튼 그리드 */}
            <View style={styles.effectButtonsContainer}>
              {sideEffects.map((effect) => {
              const isSelected = selectedEffects.includes(effect.id);
              return (
                <TouchableOpacity
                  key={effect.id}
                  style={[
                    styles.effectButton,
                    isSelected ? styles.effectButtonSelected : styles.effectButtonUnselected,
                  ]}
                  onPress={() => handleEffectSelect(effect.id)}
                  activeOpacity={0.8}
                >
                  {/* 아이콘 영역 */}
                  {effect.icon && (
                    <View style={styles.iconCircle}>
                      <Image 
                        source={effect.icon}
                        style={styles.iconImage}
                        resizeMode="contain"
                      />
                    </View>
                  )}
                  
                  {/* 부작용 없음은 아이콘 없이 텍스트만 */}
                  {!effect.icon && (
                    <View style={styles.noEffectTextContainer}>
                      <Text style={[
                        styles.noEffectText,
                        isSelected && styles.effectButtonTextSelected,
                      ]}>{effect.name}</Text>
                    </View>
                  )}
                  
                  {/* 텍스트 (아이콘 있는 경우) */}
                  {effect.icon && (
                    <Text style={[
                      styles.effectButtonText,
                      isSelected && styles.effectButtonTextSelected,
                    ]}>{effect.name}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          </View>
        </PinchZoomScrollView>
      )}

      {/* 선택 완료 버튼 */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.nextButton,
            isNextButtonActive && !isSubmitting ? styles.nextButtonActive : styles.nextButtonInactive,
          ]}
          onPress={handleNext}
          disabled={!isNextButtonActive || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text
              style={[
                styles.nextButtonText,
                isNextButtonActive && !isSubmitting ? styles.nextButtonTextActive : styles.nextButtonTextInactive,
              ]}
            >
              선택 완료
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: responsive(1),
    borderBottomColor: '#EAEAEA',
  },
  headerContent: {
    minHeight: responsive(56),
    justifyContent: 'center' as any,
    alignItems: 'center' as any,
  },
  headerText: {
    fontSize: responsive(27),
    fontWeight: '700' as any,
    color: '#1A1A1A',
    lineHeight: responsive(32.4),
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: responsive(16),
    paddingTop: responsive(48),
    paddingBottom: responsive(120), // 버튼 높이 + 여백
    alignItems: 'center' as any,
    flexGrow: 1,
  },
  pageWrapper: {
    width: '100%',
    alignSelf: 'center',
  },
  effectButtonsContainer: {
    width: '100%',
    flexDirection: 'row' as any,
    flexWrap: 'wrap' as any,
    justifyContent: 'space-between' as any,
  },
  effectButton: {
    width: responsive(164),
    height: responsive(144),
    borderRadius: responsive(25),
    borderWidth: responsive(1),
    borderColor: '#ffcc02',
    justifyContent: 'center' as any,
    alignItems: 'center' as any,
    marginBottom: responsive(24),
    paddingHorizontal: responsive(8),
    paddingVertical: responsive(12),
  },
  effectButtonSelected: {
    backgroundColor: '#60584d', // 원래 갈색으로 복원
    borderColor: '#60584d',
  },
  effectButtonUnselected: {
    backgroundColor: '#ffffff',
    borderColor: '#ffcc02', // 원래 노란색으로 복원
  },
  iconCircle: {
    width: responsive(70),
    height: responsive(70),
    borderRadius: responsive(35),
    backgroundColor: '#ffffff',
    justifyContent: 'center' as any,
    alignItems: 'center' as any,
    marginBottom: responsive(8),
    overflow: 'hidden' as any,
  },
  iconImage: {
    width: responsive(70),
    height: responsive(70),
  },
  noEffectTextContainer: {
    flex: 1,
    justifyContent: 'center' as any,
    alignItems: 'center' as any,
  },
  effectButtonText: {
    fontSize: responsive(18),
    fontWeight: '500' as any,
    color: '#5e5b50',
    lineHeight: responsive(20),
    textAlign: 'center',
  },
  noEffectText: {
    fontSize: responsive(27),
    fontWeight: '700' as any,
    color: '#60584d',
    lineHeight: responsive(32.4),
    textAlign: 'center',
  },
  effectButtonTextSelected: {
    color: '#ffffff', // 원래 흰색으로 복원
  },
  buttonContainer: {
    position: 'absolute' as any,
    left: responsive(16),
    right: responsive(16),
    bottom: 0, // SafeAreaView의 bottom edge 사용
    paddingBottom: responsive(20), // 하단 여백
    alignItems: 'center' as any,
    backgroundColor: '#f9fafb', // 배경색 추가로 스크롤 시 버튼이 보이도록
  },
  nextButton: {
    width: '100%',
    maxWidth: responsive(360),
    height: responsive(66),
    borderRadius: responsive(200),
    justifyContent: 'center' as any,
    alignItems: 'center' as any,
  },
  nextButtonActive: {
    backgroundColor: '#60584d', // 원래 갈색으로 복원
  },
  nextButtonInactive: {
    backgroundColor: '#c4bcb1',
  },
  nextButtonText: {
    fontSize: responsive(27),
    fontWeight: '700' as any,
    lineHeight: responsive(32.4),
  },
  nextButtonTextActive: {
    color: '#ffffff', // 원래 흰색으로 복원
  },
  nextButtonTextInactive: {
    color: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center' as any,
    justifyContent: 'center' as any,
    paddingVertical: responsive(40),
  },
  loadingText: {
    marginTop: responsive(12),
    fontSize: responsive(18),
    color: '#99a1af',
  },
});

