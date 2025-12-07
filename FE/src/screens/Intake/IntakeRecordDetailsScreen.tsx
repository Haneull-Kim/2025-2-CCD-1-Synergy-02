import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  InteractionManager,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import Svg, { Circle } from 'react-native-svg';
import responsive from '../../utils/responsive';
import { getReportDetail } from '../../api/reportApi';
import { getMedicineImageSource } from '../../utils/medicineImageMap';
import { generateTts } from '../../api/ttsApi';
import { playBase64Audio, stopAudio } from '../../utils/ttsPlayer';


// 원형 진행률 그래프 컴포넌트
const CircularProgress = ({ percentage }: { percentage: number }) => {
  const size = responsive(60);
  const strokeWidth = responsive(4);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (percentage / 100) * circumference;
  const strokeDashoffset = circumference - progress;

  return (
    <View style={styles.circularProgressContainer}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        {/* 배경 원 */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#FFF4C9"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* 진행률 원 */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#FFCC02"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      <View style={styles.percentageTextContainer}>
        <Text style={styles.progressPercentage}>{percentage}%</Text>
      </View>
    </View>
  );
};

interface IntakeRecordDetailsScreenProps {
  onExit?: () => void;
  rno?: number;
}

const IntakeRecordDetailsScreen = React.memo(({ onExit, rno }: IntakeRecordDetailsScreenProps) => {
  const [isInteractionComplete, setIsInteractionComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);
  const { width } = useWindowDimensions();
  const isTablet = width > 600;
  const MAX_WIDTH = responsive(isTablet ? 420 : 360);
  const insets = useSafeAreaInsets();
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const isMountedRef = useRef(true);
  const SCREEN_ID = 'IntakeRecordDetailsScreen';

  // 리포트 상세 데이터 로드
  useEffect(() => {
    if (!rno) {
      setIsLoading(false);
      return;
    }

    const loadReportDetail = async () => {
      try {
        setIsLoading(true);
        const response = await getReportDetail(rno);
        if (response.header?.resultCode === 1000 && response.body) {
          setReportData(response.body);
        }
      } catch (error: any) {
        console.error('리포트 상세 로드 실패:', error);
        Alert.alert('오류', '리포트 상세 정보를 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    loadReportDetail();
  }, [rno]);

  // 화면 전환 애니메이션 이후에 실행
  useEffect(() => {
    const interactionPromise = InteractionManager.runAfterInteractions(() => {
      setIsInteractionComplete(true);
    });

    return () => interactionPromise.cancel();
  }, []);

  // 총평 TTS 재생 - 화면이 준비되고 총평 데이터가 로드되면 재생
  useEffect(() => {
    if (!isLoading && reportData?.description && reportData.description.trim() !== '' && isInteractionComplete) {
      const playTTS = async () => {
        // 화면이 여전히 마운트되어 있는지 확인
        if (!isMountedRef.current) {
          console.log('[IntakeRecordDetailsScreen] 화면 언마운트 감지, TTS 재생 취소');
          return;
        }

        try {
          setIsTtsPlaying(true);
          console.log('[IntakeRecordDetailsScreen] 총평 TTS 생성 시작');
          
          // 총평 텍스트로 TTS 생성
          const ttsResponse = await generateTts(reportData.description);
          
          // API 응답 후에도 화면이 여전히 마운트되어 있는지 확인
          if (!isMountedRef.current) {
            console.log('[IntakeRecordDetailsScreen] API 응답 후 화면 언마운트 감지, TTS 재생 취소');
            setIsTtsPlaying(false);
            return;
          }
          
          if (ttsResponse.header?.resultCode === 1000 && ttsResponse.body?.audio_base64) {
            console.log('[IntakeRecordDetailsScreen] 총평 TTS 생성 성공, 재생 시작');
            await playBase64Audio(
              ttsResponse.body.audio_base64, 
              () => {
                if (isMountedRef.current) {
                  console.log('[IntakeRecordDetailsScreen] 총평 TTS 재생 완료');
                  setIsTtsPlaying(false);
                }
              },
              SCREEN_ID,
              isMountedRef
            );
          } else {
            console.warn('[IntakeRecordDetailsScreen] 총평 TTS 생성 실패:', ttsResponse.header?.resultMsg);
            if (isMountedRef.current) {
              setIsTtsPlaying(false);
            }
          }
        } catch (error) {
          console.error('[IntakeRecordDetailsScreen] 총평 TTS 재생 실패:', error);
          if (isMountedRef.current) {
            setIsTtsPlaying(false);
          }
        }
      };
      
      // 약간의 지연 후 TTS 재생 (화면 렌더링 완료 후)
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          playTTS();
        }
      }, 500);
      
      return () => {
        clearTimeout(timer);
        // 화면을 이탈할 때만 TTS 종료
        stopAudio(SCREEN_ID);
        setIsTtsPlaying(false);
      };
    }
  }, [isLoading, reportData?.description, isInteractionComplete]);

  // 컴포넌트 언마운트 시 TTS 종료 (화면을 벗어날 때)
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      stopAudio(SCREEN_ID);
      setIsTtsPlaying(false);
    };
  }, []);

  const handleExit = useCallback(() => {
    console.log('나가기 버튼 클릭');
    onExit?.();
  }, [onExit]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <StatusBar barStyle="dark-content" />
      
      {/* 상단 헤더 - 고정 */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>상세 기록</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#60584d" />
          <Text style={styles.loadingText}>리포트 상세 정보 불러오는 중...</Text>
        </View>
      ) : reportData ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + responsive(66) + responsive(16) + responsive(16) }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.pageWrapper, { maxWidth: MAX_WIDTH }]}>
            {/* 약 정보 섹션 */}
            <View style={styles.medicineInfoSection}>
              {/* 카테고리 태그 */}
              <View style={styles.medicineTag}>
                <Text style={styles.medicineTagText}>{reportData.category}</Text>
              </View>

              {/* 병원 정보 */}
              <Text style={styles.hospitalInfo}>{reportData.hospital} - 1일 {reportData.taken}회</Text>
              
              {/* 날짜 정보 */}
              {reportData.cycle && reportData.cycle.length > 0 && (
                <Text style={styles.dateText}>
                  {reportData.cycle[0].start_date} - {reportData.cycle[0].end_date}
                </Text>
              )}
            </View>

            {/* 진행률 카드 */}
            {reportData.cycle && reportData.cycle.length > 0 && (
              <View style={styles.progressCard}>
                <View style={styles.progressContent}>
                  {/* 진행률 원형 차트 */}
                  <View style={styles.progressCircleWrapper}>
                    <Text style={styles.progressLabel}>진행률</Text>
                    <CircularProgress 
                      percentage={reportData.cycle[0].save_cycle && reportData.cycle[0].cur_cycle 
                        ? Math.round((reportData.cycle[0].save_cycle / reportData.cycle[0].cur_cycle) * 100)
                        : 0} 
                    />
                  </View>

                  {/* 통계 정보 */}
                  <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>총 복용 횟수</Text>
                      <Text style={styles.statValue}>{reportData.cycle[0].total_cycle || 0}회</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>현재 복용 회차</Text>
                      <Text style={styles.statValue}>{reportData.cycle[0].cur_cycle || 0}회</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>실 복용 횟수</Text>
                      <Text style={styles.statValue}>{reportData.cycle[0].save_cycle || 0}회</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* 약 카드 섹션 */}
            {reportData.medicine && reportData.medicine.length > 0 && (
              <View style={styles.medicationCard}>
                {reportData.medicine.map((med: any, index: number) => (
                  <View key={med.mdno} style={styles.medicationItemWrapper}>
                    <View style={styles.medicationLeftBar} />
                    <View style={styles.medicationContentWrapper}>
                      <View style={styles.medicationItem}>
                        <View style={styles.medicationContent}>
                          <View style={styles.medicationHeaderWithImage}>
                            <View style={styles.medicationTextContainer}>
                              <View style={styles.medicationHeader}>
                                <Text style={styles.medicationNumber}>#{index + 1}</Text>
                                <View style={styles.medicationTypeTag}>
                                  <Text style={styles.medicationTypeText}>{med.classification}</Text>
                                </View>
                              </View>
                              <Text style={styles.medicationName}>{med.name}</Text>
                            </View>
                            {/* 약 이미지 - 오른쪽 상단 */}
                            <View style={styles.medicationImageContainer}>
                              <Image
                                source={getMedicineImageSource(med.mdno)}
                                style={styles.medicationImage}
                                resizeMode="contain"
                              />
                            </View>
                          </View>
                        </View>
                      </View>
                      
                      {/* 약 설명 */}
                      {med.information && (
                        <View style={styles.descriptionSection}>
                          <Text style={styles.descriptionText}>{med.information}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* 부작용 기록 카드 */}
            {reportData.effects && reportData.effects.length > 0 && (
              <View style={styles.sideEffectCard}>
                <View style={styles.sideEffectSection}>
                  {reportData.effects.map((weekEffect: any, index: number) => (
                    <React.Fragment key={weekEffect.week}>
                      <View style={styles.sideEffectItem}>
                        <Text style={styles.sideEffectWeek}>{weekEffect.week}주차 부작용</Text>
                        <View style={styles.sideEffectContent}>
                          <Text style={styles.sideEffectText}>
                            {weekEffect.effect_list.map((eff: any) => `${eff.name}(${eff.count}회)`).join(', ')}
                          </Text>
                        </View>
                      </View>
                      {index < reportData.effects.length - 1 && <View style={styles.sideEffectDivider} />}
                    </React.Fragment>
                  ))}
                </View>
              </View>
            )}

            {/* 총평 카드 */}
            {/* 사이클 종료일 다음 날 이후에만 총평 표시 (백엔드에서 자동 생성) */}
            {reportData.description && reportData.description.trim() !== '' && (
              <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <View style={styles.summaryLogo}>
                    <Image
                      source={require('../../../assets/images/PillImage.png')}
                      style={styles.summaryLogoImage}
                      contentFit="contain"
                    />
                  </View>
                  <Text style={styles.summaryTitle}>총평</Text>
                </View>
                <Text style={styles.summaryText}>{reportData.description}</Text>
              </View>
            )}
            
            {/* 사이클이 아직 진행 중인 경우 안내 메시지 */}
            {reportData.cycle && reportData.cycle.length > 0 && 
             (!reportData.description || reportData.description.trim() === '') && (
              <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <View style={styles.summaryLogo}>
                    <Image
                      source={require('../../../assets/images/PillImage.png')}
                      style={styles.summaryLogoImage}
                      contentFit="contain"
                    />
                  </View>
                  <Text style={styles.summaryTitle}>총평</Text>
                </View>
                <Text style={styles.summaryText}>
                  복약 기간이 종료된 후 총평이 생성됩니다.{'\n'}
                  (종료일: {reportData.cycle[0].end_date})
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>리포트 정보를 불러올 수 없습니다.</Text>
        </View>
      )}

      {/* 하단 전체를 덮는 그라데이션 (버튼 포함!) */}
      <View style={[styles.bottomFadeContainer, { paddingBottom: insets.bottom + responsive(16) }]}>
        <LinearGradient
          colors={['transparent', '#F6F7F8']}
          style={styles.gradient}
        />
        {/* 버튼은 그라데이션 내부에 배치 */}
        <TouchableOpacity style={styles.exitButton} onPress={handleExit}>
          <Text style={styles.exitButtonText}>나가기</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
});

IntakeRecordDetailsScreen.displayName = 'IntakeRecordDetailsScreen';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F7F8',
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
  headerTitle: {
    fontWeight: '700' as '700',
    fontSize: responsive(27),
    color: '#1A1A1A',
    lineHeight: responsive(32.4),
  },
  scrollContent: {
    paddingHorizontal: responsive(16),
    paddingTop: responsive(24),
    alignItems: 'center' as any,
  },
  pageWrapper: {
    width: '100%',
    alignSelf: 'center',
  },
  medicineInfoSection: {
    width: '100%',
    marginBottom: responsive(15),
  },
  medicineTag: {
    backgroundColor: '#FFF4C9',
    borderWidth: responsive(1),
    borderColor: '#545045',
    borderRadius: responsive(15),
    paddingHorizontal: responsive(16),
    paddingVertical: responsive(8),
    alignSelf: 'flex-start',
    marginBottom: responsive(8),
  },
  medicineTagText: {
    fontWeight: '700' as '700',
    fontSize: responsive(24),
    color: '#545045',
    lineHeight: responsive(28.8),
  },
  hospitalInfo: {
    fontWeight: '700' as '700',
    fontSize: responsive(32),
    color: '#666666',
    lineHeight: responsive(38.4),
    marginBottom: responsive(4),
  },
  dateText: {
    fontWeight: '400' as '400',
    fontSize: responsive(14),
    color: '#6A7282',
    lineHeight: responsive(16.8),
  },
  progressCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: responsive(12),
    paddingVertical: responsive(9),
    paddingHorizontal: responsive(19),
    marginBottom: responsive(8),
  },
  progressContent: {
    flexDirection: 'row' as any,
    alignItems: 'center' as any,
    justifyContent: 'space-between' as any,
  },
  progressCircleWrapper: {
    alignItems: 'center' as any,
  },
  progressLabel: {
    fontWeight: '700' as '700',
    fontSize: responsive(14),
    color: '#364153',
    lineHeight: responsive(16.8),
    marginBottom: responsive(2),
  },
  circularProgressContainer: {
    position: 'relative',
    width: responsive(60),
    height: responsive(60),
    justifyContent: 'center' as any,
    alignItems: 'center' as any,
  },
  percentageTextContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center' as any,
    alignItems: 'center' as any,
  },
  progressPercentage: {
    fontWeight: '700' as '700',
    fontSize: responsive(24),
    color: '#101828',
    lineHeight: responsive(28.8),
  },
  statsContainer: {
    flexDirection: 'row' as any,
    gap: responsive(12),
    flex: 1,
    justifyContent: 'space-around',
    marginLeft: responsive(16),
  },
  statItem: {
    alignItems: 'center' as any,
    flex: 1,
    minWidth: 0,
  },
  statLabel: {
    fontWeight: '400' as '400',
    fontSize: responsive(11),
    color: '#364153',
    lineHeight: responsive(13),
    marginBottom: responsive(6),
    textAlign: 'center',
  },
  statValue: {
    fontWeight: '700' as '700',
    fontSize: responsive(28),
    color: '#101828',
    lineHeight: responsive(33.6),
  },
  medicationCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: responsive(11),
    paddingVertical: responsive(12),
    paddingHorizontal: responsive(18),
    marginBottom: responsive(8),
  },
  medicationItemWrapper: {
    flexDirection: 'row' as any,
    marginBottom: responsive(12),
  },
  medicationLeftBar: {
    width: responsive(3),
    alignSelf: 'stretch',
    backgroundColor: '#60584D',
    marginRight: responsive(14),
  },
  medicationContentWrapper: {
    flex: 1,
  },
  medicationItem: {
    paddingVertical: 14,
  },
  medicationContent: {
    flex: 1,
  },
  medicationHeaderWithImage: {
    flexDirection: 'row' as any,
    alignItems: 'flex-start' as any,
    justifyContent: 'space-between' as any,
  },
  medicationTextContainer: {
    flex: 1,
    marginRight: responsive(12),
  },
  medicationHeader: {
    flexDirection: 'row' as any,
    alignItems: 'center' as any,
    marginBottom: responsive(6),
  },
  medicationNumber: {
    fontWeight: '400' as '400',
    fontSize: responsive(20),
    color: '#99A1AF',
    lineHeight: responsive(28),
    marginRight: responsive(10),
  },
  medicationTypeTag: {
    backgroundColor: '#FFEDA5',
    borderRadius: responsive(25),
    paddingHorizontal: responsive(16),
    paddingVertical: responsive(6),
  },
  medicationTypeText: {
    fontWeight: '700' as '700',
    fontSize: responsive(16),
    color: '#60584D',
    lineHeight: responsive(20),
  },
  medicationName: {
    fontWeight: '700' as '700',
    fontSize: responsive(20),
    color: '#364153',
    lineHeight: responsive(24),
  },
  medicationImageContainer: {
    width: responsive(60),
    height: responsive(60),
    borderRadius: responsive(8),
    backgroundColor: '#F3F4F6',
    justifyContent: 'center' as any,
    alignItems: 'center' as any,
    marginLeft: responsive(12),
  },
  medicationImage: {
    width: responsive(60),
    height: responsive(60),
    borderRadius: responsive(8),
  },
  descriptionSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: responsive(4),
    padding: responsive(8),
    marginBottom: responsive(8),
  },
  descriptionText: {
    fontSize: responsive(14),
    fontWeight: '400' as '400',
    color: '#364153',
    lineHeight: responsive(20),
  },
  medicationDescription: {
    backgroundColor: '#F9FAFB',
    borderRadius: responsive(4),
    paddingHorizontal: responsive(18),
    paddingVertical: responsive(10),
    marginTop: responsive(8),
  },
  medicationDescriptionText: {
    fontWeight: '400' as '400',
    fontSize: responsive(15),
    color: '#364153',
    lineHeight: responsive(21),
  },
  sideEffectCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: responsive(12),
    paddingVertical: responsive(10),
    paddingHorizontal: responsive(15),
    marginBottom: responsive(8),
  },
  sideEffectSection: {
    width: '100%',
  },
  sideEffectItem: {
    paddingVertical: responsive(8),
  },
  sideEffectWeek: {
    fontWeight: '700' as '700',
    fontSize: responsive(14),
    color: '#364153',
    lineHeight: responsive(19),
    marginBottom: responsive(8),
  },
  sideEffectContent: {
    backgroundColor: '#EAEAEA',
    borderRadius: responsive(18),
    paddingHorizontal: responsive(18),
    paddingVertical: responsive(8),
  },
  sideEffectText: {
    fontWeight: '400' as '400',
    fontSize: responsive(14),
    color: '#364153',
    lineHeight: responsive(16.8),
  },
  sideEffectDivider: {
    height: responsive(1),
    backgroundColor: '#B8B5B5',
    marginVertical: responsive(8),
  },
  summaryCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: responsive(12),
    paddingVertical: responsive(14),
    paddingHorizontal: responsive(15),
    marginBottom: responsive(20),
  },
  summaryHeader: {
    flexDirection: 'row' as any,
    alignItems: 'center' as any,
    marginBottom: responsive(16),
  },
  summaryLogo: {
    width: responsive(60),
    height: responsive(60),
    borderRadius: responsive(30),
    backgroundColor: '#60584D',
    marginRight: responsive(16),
    justifyContent: 'center' as any,
    alignItems: 'center' as any,
  },
  summaryLogoImage: {
    width: responsive(48),
    height: responsive(48),
  },
  summaryTitle: {
    fontWeight: '700' as '700',
    fontSize: responsive(22),
    color: '#000000',
    lineHeight: responsive(26.4),
  },
  summaryText: {
    fontWeight: '700' as '700',
    fontSize: responsive(16),
    color: '#141313',
    lineHeight: responsive(20),
  },
  bottomFadeContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: responsive(32),
    alignItems: 'center' as any,
    zIndex: 10,
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
  },
  exitButton: {
    width: '90%',
    maxWidth: responsive(360),
    height: responsive(66),
    backgroundColor: '#60584D',
    borderRadius: responsive(200),
    justifyContent: 'center' as any,
    alignItems: 'center' as any,
    zIndex: 20,
  },
  exitButtonText: {
    fontWeight: '700' as '700',
    fontSize: responsive(27),
    color: '#FFFFFF',
    lineHeight: responsive(32.4),
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center' as any,
    justifyContent: 'center' as any,
    paddingVertical: responsive(40),
  },
  emptyText: {
    fontSize: responsive(18),
    color: '#99a1af',
  },
});

export default IntakeRecordDetailsScreen;

