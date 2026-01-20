import React, { createContext, useContext, useEffect, useRef, ReactNode } from 'react';
import { Platform } from 'react-native';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuth } from './authContext';
import { updatePushToken } from './cloudSync';

type PushNotificationContextType = {
  expoPushToken?: string;
};

const PushNotificationContext = createContext<PushNotificationContextType>({});

export function usePushNotificationContext() {
  return useContext(PushNotificationContext);
}

export function PushNotificationProvider({ children }: { children: ReactNode }) {
  const { expoPushToken, notification } = usePushNotifications();
  const { profile } = useAuth();
  const lastSavedToken = useRef<string | null>(null);

  useEffect(() => {
    if (!expoPushToken || !profile?.id) return;
    if (lastSavedToken.current === expoPushToken) return;
    if (Platform.OS === 'web') return;

    const saveToken = async () => {
      console.log('[PushNotification] Saving token for profile:', profile.id);
      const { error } = await updatePushToken(profile.id, expoPushToken);
      if (!error) {
        lastSavedToken.current = expoPushToken;
        console.log('[PushNotification] Token saved successfully');
      }
    };

    saveToken();
  }, [expoPushToken, profile?.id]);

  useEffect(() => {
    if (notification) {
      console.log('[PushNotification] Received:', notification.request.content);
    }
  }, [notification]);

  return (
    <PushNotificationContext.Provider value={{ expoPushToken }}>
      {children}
    </PushNotificationContext.Provider>
  );
}
