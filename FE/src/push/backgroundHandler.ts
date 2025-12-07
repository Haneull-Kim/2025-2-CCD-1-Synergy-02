import notifee, { AndroidImportance, AndroidVisibility, AndroidCategory, TriggerType, EventType } from '@notifee/react-native';

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

    for (const event of events) {
      const triggerTime = new Date(event.time).getTime();
      
      // 이미 지난 시간은 예약하지 않음
      if (triggerTime <= Date.now()) {
        console.log("알림 시간이 현재 시각을 지나 생성되지 않습니다. 트리거 시각 : ", triggerTime, "현재 시각", Date.now());
        continue;
      }

      await notifee.createTriggerNotification(
        {
          id: event.eno.toString(),
          title: `[복약 알림] ${event.name}`,
          body: `${event.category} 드실 시간입니다! 터치하여 퀴즈를 풀어주세요.`,
          android: {
            channelId,
            // ⭐️ 풀스크린 알림 핵심 설정
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
        },
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