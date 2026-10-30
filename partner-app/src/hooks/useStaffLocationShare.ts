import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { deliveriesService } from '@/services/deliveriesService';
import { MapPoint } from '@/components/LiveMap';

const EVERY_MS = 15_000;

/**
 * While delivery staff have the Deliveries screen open with something on its way: reads the
 * phone's position every 15 s, shows it on their map, and sends it for each active delivery so
 * the shop owner sees where they are. Stops when the screen closes or nothing is on its way.
 */
export function useStaffLocationShare(active: boolean, deliveryIds: string[]): MapPoint | null {
  const [me, setMe] = useState<MapPoint | null>(null);
  const ids = useRef(deliveryIds);
  ids.current = deliveryIds;
  const key = deliveryIds.join(',');

  useEffect(() => {
    if (!active || key === '') return;
    let stopped = false;
    const tick = async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted) {
          const asked = await Location.requestForegroundPermissionsAsync();
          if (!asked.granted) return;
        }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (stopped) return;
        const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setMe(point);
        await Promise.allSettled(ids.current.map((id) => deliveriesService.updateLocation(id, point.latitude, point.longitude)));
      } catch {
        // A missed reading is fine; the next one comes in 15 s.
      }
    };
    tick();
    const timer = setInterval(tick, EVERY_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [active, key]);

  return me;
}
