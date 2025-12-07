// Bridgeless mode 비활성화를 위한 환경 변수 설정 (가장 먼저 실행)
if (typeof global !== 'undefined') {
  // New Architecture 비활성화
  global.__turboModuleProxy = null;
  // TurboModule interop 활성화
  if (!global.nativeModuleProxy) {
    global.nativeModuleProxy = global;
  }
}

import { registerRootComponent } from 'expo';
import App from './App';

// 백그라운드 핸들러 등록
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { scheduleDailyEvents } from './src/push/backgroundHandler';

const PENDING_KEY = 'PENDING_ALARM_NOTIFICATION'; 

// 1. FCM 백그라운드 메시지 핸들러 (앱이 꺼져있을 때 실행됨)
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('[index] FCM Background Message:', remoteMessage);
  const data = remoteMessage.data;

  if (data && data.eventData) {
    try {
      // 1. 데이터 파싱
      const eventString = data.eventData as string;
      const eventObj = JSON.parse(eventString);
      
      // 2. 알림 예약 실행 (백엔드 키 이름이 'events'인지 'event_list'인지 꼭 확인하세요!)
      // 아까 로그에서는 'events' 였습니다.
      const events = eventObj.events || eventObj.event_list; 
      
      if (events) {
        await scheduleDailyEvents(events);
      } else {
        console.log('[index] 이벤트 리스트가 없습니다.');
      }
      
    } catch (e) {
      console.error('[index] Parsing Error:', e);
    }
  }
});

notifee.onBackgroundEvent(async ({ type, detail }) => {
  try {
    const { notification, pressAction } = detail;

    // 알림이 "도착" 했을 때 (트리거 시간에 로컬 알림이 도착)
    if (type === EventType.DELIVERED) {
      const data = notification?.data;
      if (data) {
        const payload = {
          data,
          deliveredAt: Date.now(),
        };
        await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(payload));
        console.log('[BG] DELIVERED 저장 완료:', payload);
      }
    }

    // 사용자가 알림을 클릭(press) 했을 때
    if (type === EventType.PRESS) {
      // (선택) PRESS 시에도 저장해 둘 수 있음
      const data = notification?.data;
      if (data) {
        const payload = { data, pressedAt: Date.now(), pressed: true };
        await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(payload));
        console.log('[BG] PRESS 저장 완료:', payload);
      }
    }
  } catch (e) {
    console.error('[BG] onBackgroundEvent error', e);
  }
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);