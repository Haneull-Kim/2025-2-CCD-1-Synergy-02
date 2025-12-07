import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import responsive from '../../utils/responsive';
import { getUserMedications } from '../../api/userApi';
import { useMedicationStore } from '../../stores/medicationStore';

interface Medication {
  id: number;
  category: string;
  hospital: string;
  frequency: number;
  startDate: string;
}

interface HomeScreenListProps {
  onPrescriptionRegister?: () => void;
  onPillEnvelopeRegister?: () => void;
  onEditInfo?: () => void;
  onMedicationRecord?: () => void;
  onMedicationPress?: (id: number) => void;
}

export default function HomeScreenList({
  onPrescriptionRegister,
  onPillEnvelopeRegister,
  onEditInfo,
  onMedicationRecord,
  onMedicationPress,
}: HomeScreenListProps) {
  const { medications: storeMedications, setMedications: setStoreMedications } = useMedicationStore();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 복약 목록 로드
  useEffect(() => {
    const loadMedications = async () => {
      try {
        setIsLoading(true);
        const response = await getUserMedications();
        if (response.header?.resultCode === 1000 && response.body?.medications) {
          const medicationList: Medication[] = response.body.medications.map((med) => ({
            id: med.umno,
            category: med.category,
            hospital: med.hospital,
            frequency: med.taken,
            startDate: med.startAt,
          }));
          
          // 로컬 state 업데이트
          setMedications(medicationList);
          
          // Store에 복약 목록 저장 (백엔드 형식으로 변환)
          const storeMedicationList = response.body.medications.map((med) => ({
            umno: med.umno,
            category: med.category,
            hospital: med.hospital,
            taken: med.taken,
            startAt: med.startAt,
          }));
          setStoreMedications(storeMedicationList);
          console.log('[HomeScreenList] 복약 목록 Store에 저장 완료:', storeMedicationList.length, '개');
        } else {
          setMedications([]);
          setStoreMedications([]);
        }
      } catch (error: any) {
        console.error('복약 목록 로드 실패:', error);
        Alert.alert('오류', '복약 목록을 불러오는데 실패했습니다.');
        setMedications([]);
        setStoreMedications([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadMedications();
  }, [setStoreMedications]);

  const handleMedicationPress = (id: number) => {
    console.log('약 상세 페이지로 이동:', id);
    onMedicationPress?.(id);
  };

  // 오늘 날짜 포맷팅 함수 (MM월 DD일 (요일))
  const getTodayDate = (): string => {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[today.getDay()];
    
    return `${month}월 ${day}일 (${weekday})`;
  };

  // 날짜 포맷팅 함수 (YYYY-MM-DD -> YYYY년 MM월 DD일)
  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    
    try {
      // YYYY-MM-DD 형식 파싱
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        // 날짜 파싱 실패 시 원본 반환
        return dateString;
      }
      
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      
      return `${year}년 ${month}월 ${day}일`;
    } catch (error) {
      console.error('날짜 포맷팅 오류:', error);
      return dateString;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Main Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.headingContainer}>
            <Text style={styles.dateText}>{getTodayDate()}</Text>
            <Text style={styles.greetingText}>오늘도 건강한 하루 되세요</Text>
          </View>
          {/* 복약 기록 버튼 - 항상 표시 */}
          <TouchableOpacity 
            style={styles.recordButton} 
            activeOpacity={0.8}
            onPress={onMedicationRecord}
          >
            <Text style={styles.recordButtonText}>복약 기록</Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons Grid */}
        <View style={styles.actionButtonsContainer}>
          {/* Prescription Button */}
          <TouchableOpacity 
            style={styles.actionButton} 
            activeOpacity={0.8}
            onPress={onPrescriptionRegister}
          >
            <LinearGradient
              colors={['#6b6558', '#5a5347']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.actionButtonGradient}
            >
              <View style={styles.iconContainer}>
                <Image 
                  source={require('../../../assets/images/HomeScreenPrescriptionRegistration.png')} 
                  style={styles.iconImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.actionButtonText}>처방전 등록</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Pill Envelope Button */}
          <TouchableOpacity 
            style={styles.actionButton} 
            activeOpacity={0.8}
            onPress={onPillEnvelopeRegister}
          >
            <LinearGradient
              colors={['#6b6558', '#5a5347']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.actionButtonGradient}
            >
              <View style={styles.iconContainer}>
                <Image 
                  source={require('../../../assets/images/HomeScreenPrescriptionBag.png')} 
                  style={styles.iconImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.actionButtonText}>약봉투 등록</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Edit Info Button */}
        <TouchableOpacity 
          style={styles.editInfoButton} 
          activeOpacity={0.8}
          onPress={onEditInfo}
        >
          <LinearGradient
            colors={['#6b6558', '#5a5347']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.editInfoGradient}
          >
            <View style={styles.editIconContainer}>
              <Image 
                source={require('../../../assets/images/HomeScreenMyInfo.png')} 
                style={styles.editIconImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.editInfoButtonText}>내 정보 수정</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* 로딩 중 */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#60584d" />
            <Text style={styles.loadingText}>복약 목록 불러오는 중...</Text>
          </View>
        ) : medications.length > 0 ? (
          /* 복용 중인 약 섹션 */
          <View style={styles.medicationListSection}>
            <Text style={styles.sectionTitle}>복용 중인 약</Text>
            
            {/* 약 목록 */}
            {medications.map((medication) => (
              <TouchableOpacity 
                key={medication.id}
                style={styles.medicationCard}
                activeOpacity={0.8}
                onPress={() => handleMedicationPress(medication.id)}
              >
                <View style={styles.medicationCardContent}>
                  {/* 왼쪽 정보 */}
                  <View style={styles.medicationInfo}>
                    {/* 카테고리 태그 */}
                    <View style={styles.categoryTag}>
                      <Text style={styles.categoryTagText}>{medication.category}</Text>
                    </View>
                    {/* 병원 정보 */}
                    <Text style={styles.hospitalText}>
                      {medication.hospital} - 1일 {medication.frequency}회
                    </Text>
                    {/* 날짜 (생성일 기준) */}
                    <Text style={styles.dateInfoText}>{formatDate(medication.startDate)}</Text>
                  </View>
                  
                  {/* 오른쪽 화살표 아이콘 */}
                  <View style={styles.arrowContainer}>
                    <Text style={styles.arrowText}>›</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          /* 빈 상태 */
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyIconCircle}>
              <Image 
                source={require('../../../assets/images/HomeScreenEmptyPill.png')} 
                style={styles.emptyIconImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.emptyTextContainer}>
              <Text style={styles.emptyTitle}>등록된 약이 없습니다</Text>
              <Text style={styles.emptySubtitle}>처방전을 등록해주세요</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: responsive(16),
    paddingTop: responsive(57), // 81 - 24 (status bar height)
    paddingBottom: responsive(40),
    alignItems: 'center' as any,
  },
  headerSection: {
    width: '100%',
    maxWidth: responsive(368),
    marginBottom: responsive(24),
    flexDirection: 'row' as any,
    justifyContent: 'space-between' as any,
    alignItems: 'flex-start' as any,
  },
  headingContainer: {
    flex: 1,
  },
  dateText: {
    fontSize: responsive(27),
    fontWeight: '700' as any,
    color: '#1e2939',
    lineHeight: responsive(32.4),
    marginBottom: responsive(5),
  },
  greetingText: {
    fontSize: responsive(16),
    fontWeight: '400' as any,
    color: '#6a7282',
    lineHeight: responsive(24),
  },
  recordButton: {
    backgroundColor: '#FFCC02',
    borderRadius: responsive(14),
    paddingHorizontal: responsive(19),
    paddingVertical: responsive(10),
    height: responsive(40),
    justifyContent: 'center' as any,
    alignItems: 'center' as any,
  },
  recordButtonText: {
    fontSize: responsive(17),
    fontWeight: '700' as any,
    color: '#545045',
    lineHeight: responsive(20.4),
  },
  actionButtonsContainer: {
    width: '100%',
    maxWidth: responsive(368),
    flexDirection: 'row' as any,
    justifyContent: 'space-between' as any,
    marginBottom: responsive(24),
  },
  actionButton: {
    width: responsive(172),
    height: responsive(172),
    borderRadius: responsive(16),
    overflow: 'hidden' as any,
  },
  actionButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end' as any,
    alignItems: 'center' as any,
    paddingBottom: responsive(21),
  },
  iconContainer: {
    width: responsive(80),
    height: responsive(80),
    borderRadius: responsive(40),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: responsive(18),
    justifyContent: 'center' as any,
    alignItems: 'center' as any,
  },
  iconImage: {
    width: responsive(48),
    height: responsive(48),
  },
  actionButtonText: {
    fontSize: responsive(24),
    fontWeight: '700' as any,
    color: '#ffffff',
    lineHeight: responsive(28.8),
  },
  editInfoButton: {
    width: '100%',
    maxWidth: responsive(368),
    height: responsive(100),
    borderRadius: responsive(16),
    overflow: 'hidden' as any,
    marginBottom: responsive(24),
  },
  editInfoGradient: {
    width: '100%',
    height: '100%',
    flexDirection: 'row' as any,
    justifyContent: 'center' as any,
    alignItems: 'center' as any,
    paddingHorizontal: responsive(20),
  },
  editIconContainer: {
    width: responsive(56),
    height: responsive(56),
    borderRadius: responsive(28),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: responsive(18),
    justifyContent: 'center' as any,
    alignItems: 'center' as any,
  },
  editIconImage: {
    width: responsive(32),
    height: responsive(32),
  },
  editInfoButtonText: {
    fontSize: responsive(24),
    fontWeight: '700' as any,
    color: '#ffffff',
    lineHeight: responsive(28.8),
  },
  medicationListSection: {
    width: '100%',
    maxWidth: responsive(368),
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: responsive(20),
    fontWeight: '700' as any,
    color: '#1e2939',
    lineHeight: responsive(28),
    marginBottom: responsive(8),
  },
  medicationCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: responsive(16),
    borderWidth: responsive(1),
    borderColor: '#F3F4F6',
    paddingHorizontal: responsive(11),
    paddingVertical: responsive(11),
    marginBottom: responsive(8),
  },
  medicationCardContent: {
    flexDirection: 'row' as any,
    justifyContent: 'space-between' as any,
    alignItems: 'center' as any,
  },
  medicationInfo: {
    flex: 1,
  },
  categoryTag: {
    backgroundColor: '#FFCC02',
    borderRadius: responsive(8),
    paddingHorizontal: responsive(12),
    paddingVertical: responsive(4),
    alignSelf: 'flex-start',
    marginBottom: responsive(8),
  },
  categoryTagText: {
    fontSize: responsive(14),
    fontWeight: '700' as any,
    color: '#364153',
    lineHeight: responsive(20),
  },
  hospitalText: {
    fontSize: responsive(16),
    fontWeight: '700' as any,
    color: '#1e2939',
    lineHeight: responsive(24),
    marginBottom: responsive(4),
  },
  dateInfoText: {
    fontSize: responsive(14),
    fontWeight: '400' as any,
    color: '#99a1af',
    lineHeight: responsive(20),
  },
  arrowContainer: {
    width: responsive(24),
    height: responsive(24),
    justifyContent: 'center' as any,
    alignItems: 'center' as any,
    marginLeft: responsive(8),
  },
  arrowText: {
    fontSize: responsive(24),
    fontWeight: '400' as any,
    color: '#99a1af',
  },
  loadingContainer: {
    width: '100%',
    maxWidth: responsive(368),
    paddingVertical: responsive(60),
    alignItems: 'center' as any,
    justifyContent: 'center' as any,
  },
  loadingText: {
    marginTop: responsive(12),
    fontSize: responsive(18),
    color: '#99a1af',
  },
  emptyStateContainer: {
    width: responsive(368),
    height: responsive(297),
    justifyContent: 'center' as any,
    alignItems: 'center' as any,
    alignSelf: 'center',
    marginTop: responsive(40),
  },
  emptyIconCircle: {
    width: responsive(112),
    height: responsive(112),
    borderRadius: responsive(56),
    backgroundColor: '#f9fafb',
    marginBottom: responsive(44),
    justifyContent: 'center' as any,
    alignItems: 'center' as any,
  },
  emptyIconImage: {
    width: responsive(64),
    height: responsive(64),
  },
  emptyTextContainer: {
    alignItems: 'center' as any,
  },
  emptyTitle: {
    fontSize: responsive(20),
    fontWeight: '700' as any,
    color: '#4a5565',
    lineHeight: responsive(28),
    marginBottom: 0,
  },
  emptySubtitle: {
    fontSize: responsive(18),
    fontWeight: '400' as any,
    color: '#99a1af',
    lineHeight: responsive(28),
  },
});

