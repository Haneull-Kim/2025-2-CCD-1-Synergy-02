import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, AppState, AppStateStatus } from 'react-native';
import * as SplashScreenExpo from 'expo-splash-screen';
import { Asset } from 'expo-asset';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import notifee, { EventType, AndroidImportance, AndroidCategory, AndroidVisibility } from '@notifee/react-native';
import { getUserMedications } from './src/api/userApi';
import { useAuthStore } from './src/stores/authStore';
import messaging from '@react-native-firebase/messaging';
import { scheduleDailyEvents } from './src/push/backgroundHandler';
import AsyncStorage from '@react-native-async-storage/async-storage';

// FCM 백그라운드 메시지 핸들러 등록 (앱 시작 시 자동 실행)
import './src/push/backgroundHandler';

// Import all screens
import SplashScreen from './src/screens/SplashScreen';
import { IncomingCallScreen, ActiveCallScreen } from './src/screens';
import IntakeAlarmQuizScreen from './src/screens/Intake/IntakeAlarmQuizScreen';
import IntakeAlarmQuizThreeTimesWrongActiveScreen from './src/screens/Intake/IntakeAlarmQuizThreeTimesWrongActiveScreen';
import IntakeRecordListScreen from './src/screens/Intake/IntakeRecordListScreen';
import IntakeProgressRecordScreen from './src/screens/Intake/IntakeProgressRecordScreen';
import IntakeRecordDetailsScreen from './src/screens/Intake/IntakeRecordDetailsScreen';
import IntakeSideEffectCheck from './src/screens/Intake/IntakeSideEffectCheck';
import PrescriptionCaptureScreen from './src/screens/Prescription/PrescriptionCaptureScreen';
import PrescriptionProcessingScreen from './src/screens/Prescription/PrescriptionProcessingScreen';
import MedicationEnvelopeCaptureScreen from './src/screens/Prescription/MedicationEnvelopeCaptureScreen';
import MedicationEnvelopeProcessingScreen from './src/screens/Prescription/MedicationEnvelopeProcessingScreen';
import PrescriptionIntakeTimeSelectScreen from './src/screens/Prescription/PrescriptionIntakeTimeSelectScreen';
import PrescriptionAnalysisResultScreen from './src/screens/Prescription/PrescriptionAnalysisResultScreen';
import PrescriptionDetailScreen from './src/screens/Prescription/PrescriptionDetailScreen';
import PrescriptionMorningTimeEditScreen from './src/screens/Prescription/PrescriptionMorningTimeEditScreen';
import PrescriptionLunchTimeEditScreen from './src/screens/Prescription/PrescriptionLunchTimeEditScreen';
import PrescriptionEveningTimeEditScreen from './src/screens/Prescription/PrescriptionEveningTimeEditScreen';
import PrescriptionBedTimeEditScreen from './src/screens/Prescription/PrescriptionBedTimeEditScreen';
import HomeScreen from './src/screens/Home/HomeScreen';
import HomeScreenEmpty from './src/screens/Home/HomeScreenEmpty';
import HomeScreenList from './src/screens/Home/HomeScreenList';
import OnboardingWelcomeScreen from './src/screens/onboarding/OnboardingWelcomeScreen';
import OnboardingSignUp from './src/screens/onboarding/OnboardingSignUp';
import OnboardingAlarmGuide from './src/screens/onboarding/OnboardingAlarmGuide';
import OnboardingMorningTimeSet from './src/screens/onboarding/OnboardingMorningTimeSet';
import OnboardingLunchTimeSet from './src/screens/onboarding/OnboardingLunchTimeSet';
import OnboardingEveningTimeSet from './src/screens/onboarding/OnboardingEveningTimeSet';
import OnboardingBedTimeSet from './src/screens/onboarding/OnboardingBedTimeSet';
import EditInfoSelect from './src/screens/edit/EditInfoSelect';
import UserInfoEdit from './src/screens/edit/UserInfoEdit';
import MorningTimeEditScreen from './src/screens/edit/MorningTimeEditScreen';
import LunchTimeEditScreen from './src/screens/edit/LunchTimeEditScreen';
import EveningTimeEditScreen from './src/screens/edit/EveningTimeEditScreen';
import BedTimeEditScreen from './src/screens/edit/BedTimeEditScreen';

// 스플래시 화면을 자동으로 숨기지 않도록 설정
SplashScreenExpo.preventAutoHideAsync();

// 이미지 assets를 lazy loading하기 위한 함수
// 런타임이 준비된 후에만 require()가 실행되도록 함
const getImageAssets = () => [
  require('./assets/SplashScreen.png'),
  require('./assets/images/BedTimeIcon.png'),
  require('./assets/images/caution.png'),
  require('./assets/images/ConstipationUrinationDifficulty.png'),
  require('./assets/images/Dizziness.png'),
  require('./assets/images/DrowsinessSedation.png'),
  require('./assets/images/DryMouth.png'),
  require('./assets/images/EveningIcon.png'),
  require('./assets/images/Fatigue.png'),
  require('./assets/images/HomeScreenEmptyPill.png'),
  require('./assets/images/HomeScreenMyInfo.png'),
  require('./assets/images/HomeScreenPrescriptionBag.png'),
  require('./assets/images/HomeScreenPrescriptionRegistration.png'),
  require('./assets/images/icon.png'),
  require('./assets/images/IndigestionHeartburn.png'),
  require('./assets/images/LunchIcon.png'),
  require('./assets/images/MorningIcon.png'),
  require('./assets/images/PencilIcon.png'),
  require('./assets/images/PillImage.png'),
  require('./assets/images/PillImage2.png'),
  require('./assets/images/SwellingEdema.png'),
  require('./assets/images/VoiceWaveIcon.png'),
  require('./assets/images/Home/EditInfoIcon.png'),
  require('./assets/images/Home/PillBagIcon.png'),
  require('./assets/images/Home/PillIcon.png'),
  require('./assets/images/Home/PrescriptionIcon.png'),
  require('./assets/images/OnboardingSignUpActivate/BokjaLogo2.png'),
  require('./assets/images/PrescriptionAnalysisResultScreen/CombinationWarning.png'),
  require('./assets/images/PrescriptionAnalysisResultScreen/Edit.png'),
  require('./assets/images/PrescriptionIntakeTimeSelectScreen/Morning.png'),
  require('./assets/images/PrescriptionIntakeTimeSelectScreen/Evening.png'),
  require('./assets/images/PrescriptionIntakeTimeSelectScreen/Lunch.png'),
  require('./assets/images/PrescriptionIntakeTimeSelectScreen/Bedtime.png'),
];

// 이미지 캐싱 함수
function cacheImages(images: any[]) {
  return images.map(image => {
    if (typeof image === 'string') {
      return Asset.fromURI(image).downloadAsync();
    } else {
      return Asset.fromModule(image).downloadAsync();
    }
  });
}

type ScreenName = 
  | 'SplashScreen'
  | 'Menu'
  | 'IncomingCallScreen'
  | 'ActiveCallScreen'
  | 'IntakeAlarmQuizScreen'
  | 'IntakeAlarmQuizThreeTimesWrongActive'
  | 'IntakeRecordListScreen'
  | 'IntakeProgressRecordScreen'
  | 'IntakeRecordDetailsScreen'
  | 'IntakeSideEffectCheck'
  | 'IntakeSideEffectCheckDeactive'
  | 'PrescriptionCaptureScreen'
  | 'PrescriptionProcessingScreen'
  | 'MedicationEnvelopeCaptureScreen'
  | 'MedicationEnvelopeProcessingScreen'
  | 'PrescriptionIntakeTimeSelectScreen'
  | 'PrescriptionAnalysisResultScreen'
  | 'PrescriptionDetailScreen'
  | 'Home'
  | 'HomeScreenEmpty'
  | 'HomeScreenList'
  | 'OnboardingWelcomeScreen'
  | 'OnboardingSignUp'
  | 'OnboardingAlarmGuide'
  | 'OnboardingMorningTimeSet'
  | 'OnboardingLunchTimeSet'
  | 'OnboardingEveningTimeSet'
  | 'OnboardingBedTimeSet'
  | 'EditInfoSelect'
  | 'UserInfoEdit'
  | 'MorningTimeEditScreen'
  | 'LunchTimeEditScreen'
  | 'EveningTimeEditScreen'
  | 'BedTimeEditScreen'
  | 'PrescriptionMorningTimeEditScreen'
  | 'PrescriptionLunchTimeEditScreen'
  | 'PrescriptionEveningTimeEditScreen'
  | 'PrescriptionBedTimeEditScreen';

// 처방전 데이터 타입
interface Medication {
  id: number;
  category: string;
  hospital: string;
  frequency: number;
  startDate: string;
}

type TimePeriod = 'breakfast' | 'lunch' | 'dinner' | 'bedtime';

// 복약 기록 데이터
interface RecordItem {
  id: string;
  title: string;
  dateRange: string;
}

// 샘플 복약 기록 데이터
const sampleRecords: RecordItem[] = [
  {
    id: '1',
    title: '가람병원(소화불량)',
    dateRange: '2025년 10월 14일 - 2025년 10월 25일',
  },
  {
    id: '2',
    title: '서울병원(두통)',
    dateRange: '2025년 10월 10일 - 2025년 10월 20일',
  },
  {
    id: '3',
    title: '강남병원(감기)',
    dateRange: '2025년 9월 14일 - 2025년 9월 25일',
  },
  {
    id: '4',
    title: '연세병원(고혈압)',
    dateRange: '2025년 9월 1일 - 2025년 9월 30일',
  },
  {
    id: '5',
    title: '삼성병원(당뇨)',
    dateRange: '2025년 8월 14일 - 2025년 8월 25일',
  },
  {
    id: '6',
    title: '서울대병원(알레르기)',
    dateRange: '2025년 8월 1일 - 2025년 8월 10일',
  },
  {
    id: '7',
    title: '가톨릭병원(복통)',
    dateRange: '2025년 7월 14일 - 2025년 7월 25일',
  },
  {
    id: '8',
    title: '세브란스병원(피부질환)',
    dateRange: '2025년 7월 1일 - 2025년 7월 15일',
  },
];

const PENDING_KEY = 'PENDING_ALARM_NOTIFICATION';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('SplashScreen');
  const [appIsReady, setAppIsReady] = useState(false);
  const { initializeFcmToken } = useAuthStore();
  const [captureMode, setCaptureMode] = useState<'prescription' | 'envelope'>('prescription');
  const [medications, setMedications] = useState<Medication[]>([]); // 처방전 데이터
  const [showRetakeMessage, setShowRetakeMessage] = useState(false); // 재촬영 메시지 표시 여부
  const [selectedMedicationId, setSelectedMedicationId] = useState<number | null>(null); // 선택된 약 ID
  const [selectedTimePeriods, setSelectedTimePeriods] = useState<TimePeriod[]>([]); // 선택된 복약 시간대
  const [currentTimeEditIndex, setCurrentTimeEditIndex] = useState(0); // 현재 수정 중인 시간대 인덱스
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null); // 선택된 복약 기록 ID
  const [selectedRecordRno, setSelectedRecordRno] = useState<number | null>(null); // 선택된 리포트 번호
  const [isEditingFromPrescription, setIsEditingFromPrescription] = useState(false); // 처방전 상세에서 시간 수정 중인지 여부
  const [quizWrongCount, setQuizWrongCount] = useState(0); // 퀴즈 오답 횟수 추적
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null); // 촬영된 이미지 URI
  const [prescriptionUmno, setPrescriptionUmno] = useState<number | null>(null); // 처방전/약봉투 분석 결과 umno
  const [prescriptionTaken, setPrescriptionTaken] = useState<number | undefined>(undefined); // 복약 횟수
  const [prescriptionComb, setPrescriptionComb] = useState<string | undefined>(undefined); // 복약 시간대 조합
  const [currentEventEno, setCurrentEventEno] = useState<number | null>(null); // 현재 이벤트 번호
  const [currentEventUmno, setCurrentEventUmno] = useState<number | null>(null); // 현재 이벤트의 umno
  const [currentEventDetail, setCurrentEventDetail] = useState<any>(null); // 퀴즈 상세 데이터

  useEffect(() => {
    async function loadResourcesAndDataAsync() {
      try {
        // 권한 요청
        await notifee.requestPermission();
        
        // 알림 채널 생성 (필수)
        await notifee.createChannel({
          id: 'medicine-alarm',
          name: 'Medicine Alarm',
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          sound: 'default',
          vibration: true,
          vibrationPattern: [1, 250, 250, 250],
        });

        await initializeFcmToken();
        
        const imageAssets = getImageAssets();
        const imageAssetPromises = cacheImages(imageAssets);
        await Promise.all([...imageAssetPromises]);
        
      } catch (e) {
        console.warn('Error loading assets:', e);
      } finally {
        setAppIsReady(true);
      }
    }

    loadResourcesAndDataAsync();
  }, []);

  // 4. 알림 라우팅 핸들러 (데이터 파싱 포함)
  const handleNotificationRoute = useCallback((route: string, data?: Record<string, any>) => {
    console.log('[App] 알림 클릭 - 라우팅:', route, '데이터:', data);
    
    if (route === 'IntakeAlarmQuizScreen') {
      if (data?.eno) setCurrentEventEno(Number(data.eno));
      if (data?.umno) setCurrentEventUmno(Number(data.umno));
      
      // eventDetail 파싱하여 State에 저장
      if (data?.eventDetail) {
        try {
          const detailObj = typeof data.eventDetail === 'string' 
            ? JSON.parse(data.eventDetail) 
            : data.eventDetail;
          setCurrentEventDetail(detailObj);
        } catch (e) {
          console.error('[App] eventDetail 파싱 실패:', e);
          setCurrentEventDetail(null);
        }
      } else {
        setCurrentEventDetail(null);
      }

      setQuizWrongCount(0);
      setCurrentScreen('IntakeAlarmQuizScreen');
    }
  }, []);

  // 5. 초기 실행 및 백그라운드 -> 포그라운드 전환 시 알림 체크
  useEffect(() => {
    
    const checkNotification = async () => {
      // 1) 앱이 알림 클릭으로 켜진 경우 처리
      const initialNotification = await notifee.getInitialNotification();
      if (initialNotification) {
        const data = initialNotification.notification?.data;
        if (data?.route === 'IntakeAlarmQuizScreen') {
          handleNotificationRoute('IntakeAlarmQuizScreen', data);
          await AsyncStorage.removeItem(PENDING_KEY);
          return;
        }
      }

      // 2) 백그라운드 이벤트에서 저장된 pending 알림 처리
      const pendingRaw = await AsyncStorage.getItem(PENDING_KEY);
      if (pendingRaw) {
        const pending = JSON.parse(pendingRaw);
        const data = pending.data;
        console.log('[App] Pending notification found:', pending);

        if (data?.route === 'IntakeAlarmQuizScreen') {
          handleNotificationRoute('IntakeAlarmQuizScreen', data);
        }

        await AsyncStorage.removeItem(PENDING_KEY);
      }
    };

    // 1) 앱 처음 켤 때 체크 (Cold Start)
    checkNotification();

    // 2) 앱이 백그라운드에서 깰 때 체크 (Resume)
    const subscription = AppState.addEventListener('change', (nextAppState:AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('[App] 앱이 포그라운드로 전환됨 -> 알림 체크 수행');
        checkNotification();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [handleNotificationRoute]);

  // 6. [포그라운드] 앱 사용 중 FCM 수신 처리
  useEffect(() => {
    const unsubscribe = messaging().onMessage(async remoteMessage => {
       console.log('[Foreground] FCM 수신:', remoteMessage);
       const data = remoteMessage.data;
       if (data && data.eventData) {
         try {
           const eventString = data.eventData as string;
           const eventObj = JSON.parse(eventString);
           console.log('이벤트 리스트 개수:', eventObj.events ? eventObj.events.length : '없음');
           await scheduleDailyEvents(eventObj.events);
           console.log('[Foreground] 알림 예약 갱신 완료');
         } catch (e) {
           console.error('[Foreground] 데이터 처리 실패:', e);
         }
       }
    });
    return unsubscribe;
  }, []);

  // 7. [포그라운드] 알림 클릭 처리
  useEffect(() => {
    if (!appIsReady) return;

    const unsubscribeForeground = notifee.onForegroundEvent(({ type, detail }) => {
      const route = detail.notification?.data?.route;
      const data = detail.notification?.data as Record<string, any>;

      // (1) 알림 클릭 시 이동 
      if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
        if (route && typeof route === 'string') {
          console.log('[App] 포그라운드 알림 클릭 -> 이동');
          handleNotificationRoute(route, data);
        }
      }
      
      // (2) 알림 도착 시 자동 이동
      if (type === EventType.DELIVERED) {
        if (route === 'IntakeAlarmQuizScreen') {
           console.log('[App] 포그라운드 알림 도착 -> 즉시 퀴즈 화면으로 이동');
           // 배너가 뜨자마자(또는 뜨기도 전에) 화면을 바꿔버림
           handleNotificationRoute(route, data);
        }
      }
    });

    return unsubscribeForeground;
  }, [appIsReady, handleNotificationRoute]);

  // Home 화면으로 이동할 때 복약 목록 로드
  useEffect(() => {
    if (currentScreen === 'Home') {
      const loadMedications = async () => {
        try {
          const response = await getUserMedications();
          if (response.header?.resultCode === 1000 && response.body?.medications) {
            const medicationList: Medication[] = response.body.medications.map((med) => ({
              id: med.umno,
              category: med.category,
              hospital: med.hospital,
              frequency: med.taken,
              startDate: med.startAt,
            }));
            setMedications(medicationList);
          }
        } catch (error: any) {
          console.error('복약 목록 로드 실패:', error);
          // 에러 발생 시 빈 배열로 설정
          setMedications([]);
        }
      };
      loadMedications();
    }
  }, [currentScreen]);

  // 스플래시 화면 표시 후 2초 뒤에 OnboardingWelcomeScreen으로 전환
  useEffect(() => {
    if (appIsReady && currentScreen === 'SplashScreen') {
      const timer = setTimeout(() => {
        setCurrentScreen('OnboardingWelcomeScreen');
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [appIsReady, currentScreen]);

  // 퀴즈 화면으로 처음 들어올 때 currentEventEno 초기화 (3번 틀려서 전화 화면으로 갔다가 돌아온 경우가 아닐 때)
  // useEffect(() => {
  //   if (currentScreen === 'IntakeAlarmQuizScreen' && quizWrongCount === 0) {
  //     console.log('[App] 퀴즈 화면 진입 - currentEventEno 초기화');
  //     setCurrentEventEno(null);
  //     setCurrentEventUmno(null);
  //   }
  // }, [currentScreen, quizWrongCount]);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      // 스플래시 화면 숨기기
      await SplashScreenExpo.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null; // 로딩 중에는 네이티브 스플래시 화면 표시
  }

  const screens = [
    { category: 'Splash', items: [
      { name: 'SplashScreen', label: '🎨 스플래시 화면' },
    ]},
    { category: 'Call', items: [
      { name: 'IncomingCallScreen', label: '📞 전화 수신' },
      { name: 'ActiveCallScreen', label: '📞 통화 중' },
    ]},
    { category: 'Intake', items: [
      { name: 'IntakeAlarmQuizScreen', label: '💊 복약 퀴즈' },
      { name: 'IntakeRecordListScreen', label: '📋 복약 기록 목록' },
      { name: 'IntakeProgressRecordScreen', label: '📊 복약 진행 기록' },
      { name: 'IntakeRecordDetailsScreen', label: '📋 복약 기록 상세' },
      { name: 'IntakeSideEffectCheck', label: '⚠️ 부작용 체크' },
    ]},
    { category: 'Prescription', items: [
      { name: 'PrescriptionCaptureScreen', label: '📷 처방전 촬영' },
      { name: 'PrescriptionProcessingScreen', label: '⏳ 처방전 처리중' },
      { name: 'PrescriptionIntakeTimeSelectScreen', label: '⏰ 복약 시간 선택' },
      { name: 'PrescriptionAnalysisResultScreen', label: '📄 처방전 분석 결과' },
      { name: 'PrescriptionDetailScreen', label: '📄 처방전 상세' },
      { name: 'PrescriptionMorningTimeEditScreen', label: '🌅 처방전 아침 시간 설정' },
      { name: 'PrescriptionLunchTimeEditScreen', label: '☀️ 처방전 점심 시간 설정' },
      { name: 'PrescriptionEveningTimeEditScreen', label: '🌆 처방전 저녁 시간 설정' },
      { name: 'PrescriptionBedTimeEditScreen', label: '🌙 처방전 취침 시간 설정' },
    ]},
    { category: 'Home', items: [
      { name: 'Home', label: '🏠 홈 (통합)' },
      { name: 'HomeScreenEmpty', label: '🏠 홈 (비어있음 - 레거시)' },
      { name: 'HomeScreenList', label: '🏠 홈 (목록 - 레거시)' },
    ]},
    { category: 'Onboarding', items: [
      { name: 'OnboardingWelcomeScreen', label: '👋 온보딩 시작' },
      { name: 'OnboardingSignUp', label: '✍️ 회원가입' },
      { name: 'OnboardingAlarmGuide', label: '🔔 알람 가이드' },
      { name: 'OnboardingMorningTimeSet', label: '🌅 아침 시간 설정' },
      { name: 'OnboardingLunchTimeSet', label: '☀️ 점심 시간 설정' },
      { name: 'OnboardingEveningTimeSet', label: '🌆 저녁 시간 설정' },
      { name: 'OnboardingBedTimeSet', label: '🌙 취침 시간 설정' },
    ]},
    { category: 'Edit', items: [
      { name: 'EditInfoSelect', label: '⚙️ 정보 수정 선택' },
      { name: 'UserInfoEdit', label: '👤 사용자 정보 수정' },
      { name: 'MorningTimeEditScreen', label: '🌅 아침 시간 수정' },
      { name: 'LunchTimeEditScreen', label: '☀️ 점심 시간 수정' },
      { name: 'EveningTimeEditScreen', label: '🌆 저녁 시간 수정' },
      { name: 'BedTimeEditScreen', label: '🌙 취침 시간 수정' },
    ]},
  ];

  const renderScreen = () => {
    switch (currentScreen) {
      case 'SplashScreen': return <SplashScreen />;
      case 'IncomingCallScreen': return <IncomingCallScreen 
        onAccept={() => {
          // 초록 버튼 클릭 → ActiveCallScreen으로 이동
          setCurrentScreen('ActiveCallScreen');
        }}
        onDecline={() => {
          // 빨간 버튼 클릭 → IntakeAlarmQuizThreeTimesWrongActive로 이동
          setCurrentScreen('IntakeAlarmQuizThreeTimesWrongActive');
        }}
      />;
      case 'ActiveCallScreen': return <ActiveCallScreen 
        umno={currentEventUmno || undefined}
        onCallEnd={() => {
          // TTS 재생 완료 후 IntakeAlarmQuizThreeTimesWrongActive로 이동
          setCurrentScreen('IntakeAlarmQuizThreeTimesWrongActive');
        }}
      />;
      case 'IntakeAlarmQuizThreeTimesWrongActive': return <IntakeAlarmQuizThreeTimesWrongActiveScreen 
        eno={currentEventEno || undefined}
        umno={currentEventUmno || undefined}
        eventDetail={currentEventDetail}
        onMedicationTaken={() => {
          // 약 먹었어요 버튼 클릭 → IntakeSideEffectCheckDeactive로 이동
          setCurrentScreen('IntakeSideEffectCheckDeactive');
        }}
      />;
      case 'IntakeAlarmQuizScreen': return <IntakeAlarmQuizScreen 
          eno={currentEventEno || undefined}
          eventDetail={currentEventDetail}
          onMedicationTaken={() => {
            // 약 먹었어요 → 오답 횟수 초기화 후 부작용 체크로 이동
            setQuizWrongCount(0);
            setCurrentScreen('IntakeSideEffectCheck');
          }}
          onThreeTimesWrong={(umno, eno) => {
            // 3번 오답 → 오답 횟수 저장 후 IncomingCallScreen으로 이동
            setQuizWrongCount(3);
            setCurrentEventUmno(umno || null);
            setCurrentEventEno(eno || null);
            setCurrentScreen('IncomingCallScreen');
          }}
          initialWrongCount={quizWrongCount}
        />;
      case 'IntakeRecordListScreen': return <IntakeRecordListScreen 
        onRecordPress={(recordId, rno) => {
          console.log('선택된 기록:', recordId, 'rno:', rno);
          setSelectedRecordId(recordId);
          setSelectedRecordRno(rno);
          setCurrentScreen('IntakeProgressRecordScreen');
        }}
        onExit={() => setCurrentScreen('Home')}
      />;
      case 'IntakeProgressRecordScreen': return <IntakeProgressRecordScreen 
        recordData={sampleRecords.find(r => r.id === selectedRecordId)}
        rno={selectedRecordRno || undefined}
        onExit={() => setCurrentScreen('IntakeRecordListScreen')}
        onDetailRecord={() => setCurrentScreen('IntakeRecordDetailsScreen')}
      />;
      case 'IntakeRecordDetailsScreen': return <IntakeRecordDetailsScreen 
        rno={selectedRecordRno || undefined}
        onExit={() => setCurrentScreen('IntakeProgressRecordScreen')} 
      />;
      case 'IntakeSideEffectCheck': return <IntakeSideEffectCheck 
        onComplete={() => setCurrentScreen('Home')}
      />;
      case 'IntakeSideEffectCheckDeactive': return <IntakeSideEffectCheck 
        onComplete={() => setCurrentScreen('Home')}
      />;
      case 'PrescriptionCaptureScreen': return <PrescriptionCaptureScreen 
        mode={captureMode}
        showRetakeMessage={showRetakeMessage}
        onCapture={(imageUri) => {
          // 촬영 즉시 Processing 화면으로 이동 (이미지 URI 저장)
          console.log('촬영 완료, 이미지 URI:', imageUri);
          setCapturedImageUri(imageUri);
          setShowRetakeMessage(false);
          setCurrentScreen('PrescriptionProcessingScreen');
        }}
        onBack={() => {
          // 뒤로가기 버튼 클릭 시 홈으로 이동
          setCurrentScreen('Home');
        }}
      />;
      case 'PrescriptionProcessingScreen': return <PrescriptionProcessingScreen 
        mode={captureMode}
        imageUri={capturedImageUri || undefined}
        onSuccess={(umno, taken, comb) => {
          // OCR 성공
          setCapturedImageUri(null); // 이미지 URI 초기화
          
          if (umno) {
            // umno가 있으면 복약 시간 선택 화면으로 이동
            setPrescriptionUmno(umno);
            setPrescriptionTaken(taken);
            setPrescriptionComb(comb);
            setCurrentScreen('PrescriptionIntakeTimeSelectScreen');
          } else {
            // umno가 없으면 약 데이터 추가 후 IntakeTimeSelect로 이동 (레거시)
            setMedications([
              {
                id: 1,
                category: '감기약',
                hospital: '가람병원',
                frequency: 2,
                startDate: '2025년 10월 5일',
              },
              {
                id: 2,
                category: '소화제',
                hospital: '서울병원',
                frequency: 3,
                startDate: '2025년 10월 10일',
              },
            ]);
            setCurrentScreen('PrescriptionIntakeTimeSelectScreen');
          }
        }}
        onFailure={() => {
          // OCR 실패 - Capture로 복귀 + 재촬영 메시지
          setCapturedImageUri(null); // 이미지 URI 초기화
          setShowRetakeMessage(true);
          setCurrentScreen('PrescriptionCaptureScreen');
        }}
      />;
      case 'MedicationEnvelopeCaptureScreen': return <MedicationEnvelopeCaptureScreen 
        showRetakeMessage={showRetakeMessage}
        onCapture={(imageUri) => {
          // 촬영 즉시 Processing 화면으로 이동 (이미지 URI 저장)
          console.log('약봉투 촬영 완료, 이미지 URI:', imageUri);
          setCapturedImageUri(imageUri);
          setShowRetakeMessage(false);
          setCurrentScreen('MedicationEnvelopeProcessingScreen');
        }}
        onBack={() => {
          // 뒤로가기 버튼 클릭 시 홈으로 이동
          setCurrentScreen('Home');
        }}
      />;
      case 'MedicationEnvelopeProcessingScreen': return <MedicationEnvelopeProcessingScreen 
        imageUri={capturedImageUri || undefined}
        onSuccess={(umno, taken, comb) => {
          // OCR 성공
          setCapturedImageUri(null); // 이미지 URI 초기화
          
          if (umno) {
            // umno가 있으면 복약 시간 선택 화면으로 이동
            setPrescriptionUmno(umno);
            setPrescriptionTaken(taken);
            setPrescriptionComb(comb);
            setCurrentScreen('PrescriptionIntakeTimeSelectScreen');
          }
        }}
        onFailure={() => {
          // OCR 실패 - Capture로 복귀 + 재촬영 메시지
          setCapturedImageUri(null); // 이미지 URI 초기화
          setShowRetakeMessage(true);
          setCurrentScreen('MedicationEnvelopeCaptureScreen');
        }}
      />;
      case 'PrescriptionIntakeTimeSelectScreen': return <PrescriptionIntakeTimeSelectScreen 
        umno={prescriptionUmno || 0}
        taken={prescriptionTaken}
        comb={prescriptionComb}
        source={captureMode === 'envelope' ? 'medicationEnvelope' : 'prescription'}
        onNext={(timePeriods) => {
          setSelectedTimePeriods(timePeriods);
          setCurrentScreen('PrescriptionAnalysisResultScreen');
        }} 
      />;
      case 'PrescriptionAnalysisResultScreen': return <PrescriptionAnalysisResultScreen 
        umno={prescriptionUmno || undefined}
        source={captureMode === 'envelope' ? 'medicationEnvelope' : 'prescription'}
        onGoHome={() => {
          setPrescriptionUmno(null);
          setPrescriptionTaken(undefined);
          setPrescriptionComb(undefined);
          setCurrentScreen('Home');
        }} 
      />;
      case 'PrescriptionDetailScreen': return <PrescriptionDetailScreen 
        umno={prescriptionUmno || selectedMedicationId || 0}
        onGoHome={() => setCurrentScreen('Home')}
        onEditTime={(timePeriods) => {
          // 시간 수정 시작 - 처방전 약의 복약 시간 조합에 따라 시간대 설정
          setIsEditingFromPrescription(true);
          setSelectedTimePeriods(timePeriods as TimePeriod[]);
          setCurrentTimeEditIndex(0);
          if (timePeriods.length > 0) {
            const firstPeriod = timePeriods[0];
            if (firstPeriod === 'breakfast') setCurrentScreen('PrescriptionMorningTimeEditScreen');
            else if (firstPeriod === 'lunch') setCurrentScreen('PrescriptionLunchTimeEditScreen');
            else if (firstPeriod === 'dinner') setCurrentScreen('PrescriptionEveningTimeEditScreen');
            else if (firstPeriod === 'bedtime') setCurrentScreen('PrescriptionBedTimeEditScreen');
          }
        }}
      />;
      case 'Home': return <HomeScreen 
        medications={medications}
        onPrescriptionRegister={() => {
          setCaptureMode('prescription');
          setCurrentScreen('PrescriptionCaptureScreen');
        }} 
        onPillEnvelopeRegister={() => {
          setCurrentScreen('MedicationEnvelopeCaptureScreen');
        }}
        onEditInfo={() => setCurrentScreen('EditInfoSelect')}
        onMedicationRecord={() => setCurrentScreen('IntakeRecordListScreen')}
        onMedicationPress={(id) => {
          console.log('약 상세:', id);
          setSelectedMedicationId(id);
          setCurrentScreen('PrescriptionDetailScreen');
        }}
      />;
      case 'HomeScreenEmpty': return <HomeScreenEmpty 
        onPrescriptionRegister={() => {
          setCaptureMode('prescription');
          setCurrentScreen('PrescriptionCaptureScreen');
        }} 
        onPillEnvelopeRegister={() => {
          setCurrentScreen('MedicationEnvelopeCaptureScreen');
        }}
        onEditInfo={() => setCurrentScreen('EditInfoSelect')}
      />;
      case 'HomeScreenList': return <HomeScreenList 
        onPrescriptionRegister={() => {
          setCaptureMode('prescription');
          setCurrentScreen('PrescriptionCaptureScreen');
        }}
        onPillEnvelopeRegister={() => {
          setCurrentScreen('MedicationEnvelopeCaptureScreen');
        }}
        onEditInfo={() => setCurrentScreen('EditInfoSelect')}
        onMedicationRecord={() => setCurrentScreen('IntakeRecordListScreen')}
        onMedicationPress={(id) => {
          console.log('약 상세:', id);
          setSelectedMedicationId(id);
          setCurrentScreen('PrescriptionDetailScreen');
        }}
      />;
      case 'OnboardingWelcomeScreen': return <OnboardingWelcomeScreen onStartPress={() => setCurrentScreen('OnboardingSignUp')} />;
      case 'OnboardingSignUp': return <OnboardingSignUp onSignUpComplete={(isLogin) => {
        // isLogin이 true면 로그인 성공 → 홈으로 이동
        // isLogin이 false면 회원가입 성공 → 복약 시간 설정으로 이동
        if (isLogin) {
          setCurrentScreen('Home');
        } else {
          setCurrentScreen('OnboardingAlarmGuide');
        }
      }} />;
      case 'OnboardingAlarmGuide': return <OnboardingAlarmGuide onComplete={() => setCurrentScreen('OnboardingMorningTimeSet')} />;
      case 'OnboardingMorningTimeSet': return <OnboardingMorningTimeSet onNext={() => setCurrentScreen('OnboardingLunchTimeSet')} />;
      case 'OnboardingLunchTimeSet': return <OnboardingLunchTimeSet onNext={() => setCurrentScreen('OnboardingEveningTimeSet')} />;
      case 'OnboardingEveningTimeSet': return <OnboardingEveningTimeSet onNext={() => setCurrentScreen('OnboardingBedTimeSet')} />;
      case 'OnboardingBedTimeSet': return <OnboardingBedTimeSet onComplete={() => setCurrentScreen('Home')} />;
      case 'EditInfoSelect': return <EditInfoSelect 
        onBasicInfo={() => setCurrentScreen('UserInfoEdit')}
        onMedicationTime={() => {
          // 온보딩처럼 모든 시간대 수정 (아침 → 점심 → 저녁 → 취침)
          setIsEditingFromPrescription(false);
          setSelectedTimePeriods(['breakfast', 'lunch', 'dinner', 'bedtime']);
          setCurrentTimeEditIndex(0);
          setCurrentScreen('MorningTimeEditScreen');
        }}
        onExit={() => setCurrentScreen('Home')}
      />;
      case 'UserInfoEdit': return <UserInfoEdit onComplete={() => setCurrentScreen('EditInfoSelect')} />;
      case 'MorningTimeEditScreen': return <MorningTimeEditScreen onNext={() => {
        // 다음 시간대로 이동
        const nextIndex = currentTimeEditIndex + 1;
        if (nextIndex < selectedTimePeriods.length) {
          setCurrentTimeEditIndex(nextIndex);
          const nextPeriod = selectedTimePeriods[nextIndex];
          if (nextPeriod === 'lunch') setCurrentScreen('LunchTimeEditScreen');
          else if (nextPeriod === 'dinner') setCurrentScreen('EveningTimeEditScreen');
          else if (nextPeriod === 'bedtime') setCurrentScreen('BedTimeEditScreen');
        } else {
          // 마지막 시간대
          setCurrentScreen(isEditingFromPrescription ? 'PrescriptionDetailScreen' : 'EditInfoSelect');
        }
      }} />;
      case 'LunchTimeEditScreen': return <LunchTimeEditScreen onNext={() => {
        const nextIndex = currentTimeEditIndex + 1;
        if (nextIndex < selectedTimePeriods.length) {
          setCurrentTimeEditIndex(nextIndex);
          const nextPeriod = selectedTimePeriods[nextIndex];
          if (nextPeriod === 'dinner') setCurrentScreen('EveningTimeEditScreen');
          else if (nextPeriod === 'bedtime') setCurrentScreen('BedTimeEditScreen');
        } else {
          setCurrentScreen(isEditingFromPrescription ? 'PrescriptionDetailScreen' : 'EditInfoSelect');
        }
      }} />;
      case 'EveningTimeEditScreen': return <EveningTimeEditScreen onNext={() => {
        const nextIndex = currentTimeEditIndex + 1;
        if (nextIndex < selectedTimePeriods.length) {
          setCurrentTimeEditIndex(nextIndex);
          const nextPeriod = selectedTimePeriods[nextIndex];
          if (nextPeriod === 'bedtime') setCurrentScreen('BedTimeEditScreen');
        } else {
          setCurrentScreen(isEditingFromPrescription ? 'PrescriptionDetailScreen' : 'EditInfoSelect');
        }
      }} />;
      case 'BedTimeEditScreen': return <BedTimeEditScreen onComplete={() => {
        // 마지막 시간대 - 어디서 시작했는지에 따라 복귀
        setCurrentScreen(isEditingFromPrescription ? 'PrescriptionDetailScreen' : 'EditInfoSelect');
      }} />;
      case 'PrescriptionMorningTimeEditScreen': return <PrescriptionMorningTimeEditScreen 
        umno={prescriptionUmno || selectedMedicationId || 0}
        onNext={() => {
          const nextIndex = currentTimeEditIndex + 1;
          if (nextIndex < selectedTimePeriods.length) {
            setCurrentTimeEditIndex(nextIndex);
            const nextPeriod = selectedTimePeriods[nextIndex];
            if (nextPeriod === 'lunch') setCurrentScreen('PrescriptionLunchTimeEditScreen');
            else if (nextPeriod === 'dinner') setCurrentScreen('PrescriptionEveningTimeEditScreen');
            else if (nextPeriod === 'bedtime') setCurrentScreen('PrescriptionBedTimeEditScreen');
          } else {
            setCurrentScreen('PrescriptionDetailScreen');
          }
        }} 
      />;
      case 'PrescriptionLunchTimeEditScreen': return <PrescriptionLunchTimeEditScreen 
        umno={prescriptionUmno || selectedMedicationId || 0}
        onNext={() => {
          const nextIndex = currentTimeEditIndex + 1;
          if (nextIndex < selectedTimePeriods.length) {
            setCurrentTimeEditIndex(nextIndex);
            const nextPeriod = selectedTimePeriods[nextIndex];
            if (nextPeriod === 'dinner') setCurrentScreen('PrescriptionEveningTimeEditScreen');
            else if (nextPeriod === 'bedtime') setCurrentScreen('PrescriptionBedTimeEditScreen');
          } else {
            setCurrentScreen('PrescriptionDetailScreen');
          }
        }} 
      />;
      case 'PrescriptionEveningTimeEditScreen': return <PrescriptionEveningTimeEditScreen 
        umno={prescriptionUmno || selectedMedicationId || 0}
        onNext={() => {
          const nextIndex = currentTimeEditIndex + 1;
          if (nextIndex < selectedTimePeriods.length) {
            setCurrentTimeEditIndex(nextIndex);
            const nextPeriod = selectedTimePeriods[nextIndex];
            if (nextPeriod === 'bedtime') setCurrentScreen('PrescriptionBedTimeEditScreen');
          } else {
            setCurrentScreen('PrescriptionDetailScreen');
          }
        }} 
      />;
      case 'PrescriptionBedTimeEditScreen': return <PrescriptionBedTimeEditScreen 
        umno={prescriptionUmno || selectedMedicationId || 0}
        onComplete={() => {
          setCurrentScreen('PrescriptionDetailScreen');
        }} 
      />;
      default: return null;
    }
  };

  if (currentScreen !== 'Menu') {
    return (
      <SafeAreaProvider>
      <View key={currentScreen} style={styles.container} onLayout={onLayoutRootView}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setCurrentScreen('Menu')}
        >
          <Text style={styles.backButtonText}>← 메뉴로 돌아가기</Text>
        </TouchableOpacity>
        {renderScreen()}
      </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.menuContainer} onLayout={onLayoutRootView}>
      <View style={styles.menuHeader}>
        <Text style={styles.menuTitle}>🎨 화면 선택 메뉴</Text>
        <Text style={styles.menuSubtitle}>보고 싶은 화면을 선택하세요</Text>
      </View>
      <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
        {screens.map((section) => (
          <View key={section.category} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.category}</Text>
            {section.items.map((screen) => (
              <TouchableOpacity
                key={screen.name}
                style={styles.menuButton}
                onPress={() => setCurrentScreen(screen.name as ScreenName)}
              >
                <Text style={styles.menuButtonText}>{screen.label}</Text>
            </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 10,
    zIndex: 9999,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  menuContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  menuHeader: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  menuTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  menuSubtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  menuScroll: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
  },
  menuButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  menuButtonText: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
});

