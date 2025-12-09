import notifee, { AndroidImportance, AndroidVisibility, AndroidCategory, TriggerType } from '@notifee/react-native';

/**
 * 하루치 이벤트를 받아서 알림을 예약하는 공통 함수
 * (App.tsx에서도 포그라운드 수신 시 사용하기 위해 export)
 */
export const scheduleDailyEvents = async (events: any[]) => {
  if (!events || events.length === 0) return;

  try {
    const channelId = await notifee.createChannel({
      id: 'medicine-alarm',
      name: 'Medicine Alarm',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'default',
      vibration: true,
      vibrationPattern: [1, 250, 250, 250],
    });

    const now = Date.now();
    const GRACE_PERIOD = 5 * 60 * 1000; // 5분 허용 시간 (밀리초)

    for (const event of events) {
      const triggerTime = new Date(event.time).getTime();
      
      // 알림 데이터 공통 정의 (예약용 & 즉시 실행용 둘 다 사용)
      const notificationConfig = {
        id: event.eno.toString(),
        title: `[복약 알림] ${event.name}`,
        body: `${event.category} 드실 시간입니다! 터치하여 퀴즈를 풀어주세요.`,
        android: {
          channelId,
          // 풀스크린 알림 핵심 설정
          fullScreenAction: {
            id: 'default',
            launchActivity: 'default',
          },
          category: AndroidCategory.ALARM,
          pressAction: {
            id: 'default',
            launchActivity: 'default',
          },
          importance: AndroidImportance.HIGH,
        },
        data: {
          route: 'IntakeAlarmQuizScreen',
          eno: event.eno.toString(),
          umno: event.umno.toString(),
          // 퀴즈 화면 표시에 필요한 모든 정보를 JSON 문자열로 담음
          eventDetail: JSON.stringify({
             eno: event.eno.toString(),
             umno: event.umno.toString(),
             question: event.question,
             candidate: event.candidate,
             description: event.description,
             hospital: event.hospital,
             category: event.category,
             name: event.name,
             time: event.time,
             audioUrl: event.audioUrl
          }),
          audioUrl: event.audioUrl || '',
        },
      };

      // 1. 이미 지난 시간인지 확인
      if (triggerTime <= now) {
        // 5분(Grace Period) 이내라면 "방금 도착한 00시 알림"으로 간주하고 즉시 실행
        if (now - triggerTime < GRACE_PERIOD) {
            console.log(`[Alarm] ${event.time} 알림이 조금 늦게 도착했습니다. 즉시 띄웁니다!`);
            
            // 예약(Trigger) 없이 바로 보여줌
            await notifee.displayNotification(notificationConfig);
            continue; 
        } else {
            // 5분이 넘게 지났으면 진짜 과거 알림이므로 무시
            console.log("알림 시간이 너무 많이 지나(5분 초과) 생성되지 않습니다.", event.time);
            continue;
        }
      }

      // 2. 미래 시간이면 정상적으로 스케줄링 (Trigger)
      await notifee.createTriggerNotification(
        notificationConfig,
        {
          type: TriggerType.TIMESTAMP,
          timestamp: triggerTime,
        }
      );
      console.log(`[Alarm] ${event.time} 예약 완료`);
    }
  } catch (e) {
    console.error('[Alarm] 예약 중 에러:', e);
  }
};