import React, { useState, useEffect } from 'react';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/Router';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  useWindowDimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import responsive from '../../utils/responsive';
import { updateMedicationCombination } from '../../api/medicationApi';
import PinchZoomScrollView from '../../components/PinchZoomScrollView';

type TimePeriod = 'breakfast' | 'lunch' | 'dinner' | 'bedtime';

interface TimeOption {
  id: TimePeriod;
  label: string;
  icon: any;
}

const timeOptions: TimeOption[] = [
  { id: 'breakfast', label: '아침', icon: require('../../../assets/images/MorningIcon.png') },
  { id: 'lunch', label: '점심', icon: require('../../../assets/images/LunchIcon.png') },
  { id: 'dinner', label: '저녁', icon: require('../../../assets/images/EveningIcon.png') },
  { id: 'bedtime', label: '취침 전', icon: require('../../../assets/images/BedTimeIcon.png') },
];

interface PrescriptionIntakeTimeSelectScreenProps {
  umno: number; // 복약 정보 ID
  taken?: number; // 복약 횟수 (1일 N회)
  comb?: string; // 백엔드에서 받은 복약 시간대 조합 (예: "breakfast,lunch,dinner")
  source?: 'prescription' | 'medicationEnvelope';
  onNext?: (timePeriods: TimePeriod[]) => void;
}

type PrescriptionIntakeTimeSelectScreenRouteProp = RouteProp<RootStackParamList, 'PrescriptionIntakeTimeSelect'>;
type PrescriptionIntakeTimeSelectScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PrescriptionIntakeTimeSelect'>;

export default function PrescriptionIntakeTimeSelectScreen({ 
  umno: propUmno, 
  taken: propTaken, 
  comb: propComb, 
  source: propSource = 'prescription',
  onNext 
}: PrescriptionIntakeTimeSelectScreenProps) {
  // 네비게이션 사용 시도
  let navigation: PrescriptionIntakeTimeSelectScreenNavigationProp | null = null;
  let route: PrescriptionIntakeTimeSelectScreenRouteProp | null = null;
  
  try {
    navigation = useNavigation<PrescriptionIntakeTimeSelectScreenNavigationProp>();
    route = useRoute<PrescriptionIntakeTimeSelectScreenRouteProp>();
  } catch (error: any) {
    navigation = null;
    route = null;
  }
  
  // route.params에서 값 가져오기
  const umno = route?.params?.umno || propUmno;
  const taken = route?.params?.taken !== undefined ? route.params.taken : propTaken;
  const comb = route?.params?.comb !== undefined ? route.params.comb : propComb;
  const source = route?.params?.source || propSource;

  // 초기 선택값 설정: 백엔드 comb가 있으면 사용, 없으면 taken 기반으로 설정
  // API에서 데이터를 받아오지 않았을 때는 빈 배열 반환 (기본값 선택 방지)
  const getInitialTimePeriods = (): TimePeriod[] => {
    // comb가 존재하고 빈 문자열이 아닐 때만 사용
    if (comb && comb.trim().length > 0) {
      // 백엔드에서 받은 조합 사용 (night -> bedtime 변환)
      const periods = comb.split(',').map(p => p.trim().toLowerCase());
      return periods
        .map(p => (p === 'night' ? 'bedtime' : p))
        .filter((p): p is TimePeriod => ['breakfast', 'lunch', 'dinner', 'bedtime'].includes(p as TimePeriod));
    }
    
    // taken이 명시적으로 존재할 때만 기반으로 기본값 설정 (0이 아닌 경우)
    if (taken !== undefined && taken !== null && taken > 0) {
      if (taken === 3) {
        return ['breakfast', 'lunch', 'dinner'];
      } else if (taken === 2) {
        return ['breakfast', 'dinner'];
      } else if (taken === 1) {
        return ['breakfast'];
      }
    }
    
    // comb도 없고 taken도 없으면 빈 배열 반환 (API에서 데이터를 받아오지 않은 경우)
    return [];
  };

  // 초기 상태는 항상 빈 배열로 시작 (API 데이터가 로드되면 useEffect에서 설정)
  const [selectedTimePeriods, setSelectedTimePeriods] = useState<TimePeriod[]>([]);
  
  // comb나 taken이 변경되면 초기값 업데이트
  // API에서 데이터를 받아온 경우에만 업데이트
  useEffect(() => {
    // comb가 존재하고 빈 문자열이 아니거나, taken이 명시적으로 존재하는 경우에만 설정
    const hasComb = comb !== undefined && comb !== null && comb.trim().length > 0;
    const hasTaken = taken !== undefined && taken !== null && taken > 0;
    
    if (hasComb || hasTaken) {
      const initialPeriods = getInitialTimePeriods();
      setSelectedTimePeriods(initialPeriods);
    } else {
      // API에서 데이터를 받아오지 않은 경우 빈 배열로 설정
      setSelectedTimePeriods([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comb, taken]);
  const [isLoading, setIsLoading] = useState(false);
  const { width } = useWindowDimensions();
  const isTablet = width > 600;
  const MAX_WIDTH = responsive(isTablet ? 420 : 360);
  const insets = useSafeAreaInsets();

  const isNextButtonActive = selectedTimePeriods.length > 0 && !isLoading;

  const handleTimePeriodSelect = (period: TimePeriod) => {
    if (isLoading) return;
    
    // 이미 선택된 경우 제거
    if (selectedTimePeriods.includes(period)) {
      setSelectedTimePeriods(selectedTimePeriods.filter(p => p !== period));
    } else {
      // taken 값이 있으면 개수 제한 검증
      if (taken !== undefined && taken !== null && taken > 0) {
        if (selectedTimePeriods.length >= taken) {
          Alert.alert(
            '선택 제한',
            `복약 횟수가 ${taken}회이므로 ${taken}개의 시간대만 선택할 수 있습니다.\n\n현재 선택: ${selectedTimePeriods.length}개`
          );
          return;
        }
      }
      // 선택되지 않은 경우 추가
      setSelectedTimePeriods([...selectedTimePeriods, period]);
    }
  };

  const handleNext = async () => {
    if (!isNextButtonActive) return;

    // taken 값과 선택한 시간대 개수 검증
    if (taken !== undefined && taken !== null && taken > 0) {
      if (selectedTimePeriods.length !== taken) {
        Alert.alert(
          '선택 오류',
          `복약 횟수가 ${taken}회이므로 정확히 ${taken}개의 시간대를 선택해주세요.\n\n현재 선택: ${selectedTimePeriods.length}개`
        );
        return;
      }
    }

    setIsLoading(true);
    try {
      // TimePeriod를 백엔드 형식으로 변환 (bedtime -> night)
      const combination = selectedTimePeriods
        .map((period) => (period === 'bedtime' ? 'night' : period))
        .join(',');

      // 🔍 디버그: 요청 데이터 확인
      console.log('[PrescriptionIntakeTimeSelectScreen] 🔍 복약 시간대 조합 수정 요청');
      console.log('[PrescriptionIntakeTimeSelectScreen] umno:', umno);
      console.log('[PrescriptionIntakeTimeSelectScreen] selectedTimePeriods:', selectedTimePeriods);
      console.log('[PrescriptionIntakeTimeSelectScreen] combination:', combination);
      console.log('[PrescriptionIntakeTimeSelectScreen] taken:', taken);
      console.log('[PrescriptionIntakeTimeSelectScreen] 선택된 시간대 개수:', selectedTimePeriods.length);

      const response = await updateMedicationCombination(umno, combination);
      
      console.log('[PrescriptionIntakeTimeSelectScreen] ✅ 응답:', JSON.stringify(response, null, 2));
      if (response.header?.resultCode === 1000) {
        // 분석 결과 화면으로 이동
        if (navigation) {
          navigation.navigate('PrescriptionAnalysisResult', {
            umno: umno,
            source: source,
          });
        } else {
          onNext?.(selectedTimePeriods);
        }
      } else {
        throw new Error(response.header?.resultMsg || '복약 시간대 조합 수정에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('[PrescriptionIntakeTimeSelectScreen] ❌ 복약 시간대 조합 수정 실패:', error);
      console.error('[PrescriptionIntakeTimeSelectScreen] 에러 타입:', error.constructor.name);
      console.error('[PrescriptionIntakeTimeSelectScreen] 에러 메시지:', error.message);
      
      if (error.response) {
        console.error('[PrescriptionIntakeTimeSelectScreen] 응답 상태:', error.response.status);
        console.error('[PrescriptionIntakeTimeSelectScreen] 응답 데이터:', JSON.stringify(error.response.data, null, 2));
      }
      
      // 백엔드 에러 메시지 추출
      let errorMessage = '복약 시간대 조합 수정 중 오류가 발생했습니다.';
      
      if (error.response?.data?.header?.resultMsg) {
        errorMessage = error.response.data.header.resultMsg;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // 500 에러인 경우 특별 처리
      if (error.response?.status === 500) {
        console.error('[PrescriptionIntakeTimeSelectScreen] 🚨 500 Internal Server Error');
        
        // 백엔드에서 발생 가능한 에러 메시지 확인
        const backendError = error.response?.data?.message || error.response?.data?.error || '';
        
        if (backendError.includes('AlarmCombEntity')) {
          errorMessage = `선택한 시간대 조합(아침, 점심, 저녁)에 해당하는 알람 조합이 데이터베이스에 없습니다.\n\n백엔드 관리자에게 문의해주세요.`;
        } else if (backendError.includes('알림 시간이 없습니다') || backendError.includes('alarm_time_table')) {
          errorMessage = `해당 복약 정보에 알람 시간이 설정되지 않았습니다.\n\n처방전을 다시 등록해주세요.`;
        } else if (backendError.includes('행 개수') || backendError.includes('alarm_time_table 행 개수')) {
          errorMessage = `알람 시간 개수와 복약 횟수가 일치하지 않습니다.\n\n처방전을 다시 등록해주세요.`;
        } else {
          errorMessage = `서버 내부 오류가 발생했습니다.\n\n에러 메시지: ${backendError || '알 수 없는 오류'}\n\n백엔드 로그를 확인해주세요.`;
        }
      }
      
      // taken 값과 관련된 에러인 경우 더 명확한 메시지
      if (errorMessage.includes('활성 타입 개수') || errorMessage.includes('복약 횟수')) {
        errorMessage = `복약 횟수(${taken || 'N/A'}회)와 선택한 시간대 개수(${selectedTimePeriods.length}개)가 일치하지 않습니다.\n\n정확히 ${taken || 'N/A'}개의 시간대를 선택해주세요.`;
      }
      
      Alert.alert(
        '수정 실패',
        `${errorMessage}\n\n에러 코드: ${error.response?.status || 'N/A'}\n선택된 시간대: ${selectedTimePeriods.join(', ')}\n복약 횟수: ${taken || 'N/A'}회\numno: ${umno}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerText}>복약 시간대 설정</Text>
        </View>
      </View>

      <PinchZoomScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + responsive(100) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.pageWrapper, { maxWidth: MAX_WIDTH }]}>
          {/* Time Period Buttons */}
          <View style={styles.timeButtonsContainer}>
            {timeOptions.map((option) => {
              const isSelected = selectedTimePeriods.includes(option.id); // 배열에 포함되어 있는지 체크
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.timeButton,
                    isSelected ? styles.timeButtonSelected : styles.timeButtonUnselected,
                  ]}
                  onPress={() => handleTimePeriodSelect(option.id)}
                >
                  {/* Icon - 왼쪽 고정 */}
                  <View style={styles.iconContainer}>
                    <Image 
                      source={option.icon}
                      style={styles.icon}
                      resizeMode="contain"
                    />
                  </View>
                  
                  {/* Text - 가운데 정렬 */}
                  <View style={styles.textContainer}>
                    <Text
                      style={[
                        styles.timeButtonText,
                        isSelected ? styles.timeButtonTextSelected : styles.timeButtonTextUnselected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          </View>
      </PinchZoomScrollView>

      {/* Next Button */}
      <View style={[styles.buttonContainer, { bottom: insets.bottom + responsive(36) }]}>
        <TouchableOpacity
          style={[
            styles.nextButton,
            isNextButtonActive ? styles.nextButtonActive : styles.nextButtonInactive,
          ]}
          onPress={handleNext}
          disabled={!isNextButtonActive}
        >
          {isLoading ? (
            <ActivityIndicator color="#545045" size="small" />
          ) : (
            <Text style={styles.nextButtonText}>다음으로</Text>
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
    alignItems: 'center' as any,
    flexGrow: 1,
  },
  pageWrapper: {
    width: '100%',
    alignSelf: 'center',
  },
  timeButtonsContainer: {
    width: '100%',
  },
  timeButton: {
    width: '100%',
    height: responsive(110),
    borderRadius: responsive(24),
    flexDirection: 'row' as any,
    alignItems: 'center' as any,
    paddingHorizontal: responsive(20),
    marginBottom: responsive(16),
    position: 'relative' as any,
  },
  timeButtonSelected: {
    backgroundColor: '#ffcc02', // 노란색으로 변경
  },
  timeButtonUnselected: {
    backgroundColor: '#60584d', // 갈색으로 변경
  },
  iconContainer: {
    width: responsive(35),
    height: responsive(35),
    justifyContent: 'center' as any,
    alignItems: 'center' as any,
  },
  icon: {
    width: responsive(32),
    height: responsive(32),
  },
  textContainer: {
    flex: 1,
    alignItems: 'center' as any,
    justifyContent: 'center' as any,
    marginLeft: responsive(-47), // 아이콘 너비(35) + 여백(12) = 47, 음수로 설정하여 가운데 정렬
  },
  timeButtonText: {
    fontSize: responsive(48),
    fontWeight: '700' as '700',
    lineHeight: responsive(57.6),
  },
  timeButtonTextSelected: {
    color: '#545045', // 갈색으로 변경
  },
  timeButtonTextUnselected: {
    color: '#ffffff', // 흰색으로 변경
  },
  buttonContainer: {
    position: 'absolute' as any,
    left: responsive(16),
    right: responsive(16),
    alignItems: 'center' as any,
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
    backgroundColor: '#ffcc02', // 노란색으로 변경
  },
  nextButtonInactive: {
    backgroundColor: '#c4bcb1',
  },
  nextButtonText: {
    fontSize: responsive(27),
    fontWeight: '700' as any,
    color: '#545045', // 갈색으로 변경
    lineHeight: responsive(32.4),
  },
});
