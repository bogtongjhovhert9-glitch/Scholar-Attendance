import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase.js';
import { Scholar, AttendanceLog } from '../types/index.js';

export function useRealtimeData() {
  const [realtimeScholars, setRealtimeScholars] = useState<Scholar[]>([]);
  const [realtimeLogs, setRealtimeLogs] = useState<AttendanceLog[]>([]);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(true);

  useEffect(() => {
    // 1. Live subscription to scholars collection across all devices
    const scholarsCol = collection(db, 'scholars');
    const unsubScholars = onSnapshot(
      scholarsCol,
      (snapshot) => {
        const map = new Map<string, Scholar>();
        snapshot.forEach((d) => {
          const item = d.data() as Scholar;
          const id = item?.id || d.id;
          if (id) {
            map.set(id, { ...item, id });
          }
        });
        const list = Array.from(map.values());
        list.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
        setRealtimeScholars(list);
        setIsCloudConnected(true);
      },
      (err) => {
        console.warn('Realtime scholars listener error:', err);
        setIsCloudConnected(false);
      }
    );

    // 2. Live subscription to attendance logs collection across all devices
    const logsCol = collection(db, 'attendance_logs');
    const unsubLogs = onSnapshot(
      logsCol,
      (snapshot) => {
        const map = new Map<string, AttendanceLog>();
        snapshot.forEach((d) => {
          const item = d.data() as AttendanceLog;
          const id = item?.id || d.id;
          if (id) {
            map.set(id, { ...item, id });
          }
        });
        const list = Array.from(map.values());
        list.sort((a, b) => {
          if (a.date !== b.date) return (b.date || '').localeCompare(a.date || '');
          return (b.time_in || '').localeCompare(a.time_in || '');
        });
        setRealtimeLogs(list);
        setIsCloudConnected(true);
      },
      (err) => {
        console.warn('Realtime attendance listener error:', err);
        setIsCloudConnected(false);
      }
    );

    return () => {
      unsubScholars();
      unsubLogs();
    };
  }, []);

  return { realtimeScholars, realtimeLogs, isCloudConnected };
}
