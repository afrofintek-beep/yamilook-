import {act,renderHook,cleanup} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {useJourneyCompass} from './useJourneyCompass';
beforeEach(()=>{vi.useFakeTimers();Object.defineProperty(document,'hidden',{configurable:true,value:false})});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals()});
it('asks in the parent only after a tap and publishes real compass samples',async()=>{
 const requestPermission=vi.fn().mockResolvedValue('granted');vi.stubGlobal('DeviceOrientationEvent',{requestPermission});
 const report=vi.fn(),{result,unmount}=renderHook(()=>useJourneyCompass(report));
 expect(requestPermission).not.toHaveBeenCalled();await act(async()=>result.current.request());
 expect(requestPermission).toHaveBeenCalledWith(true);expect(result.current.active).toBe(false);
 const sample=new Event('deviceorientation');Object.assign(sample,{webkitCompassHeading:270,beta:85});
 act(()=>window.dispatchEvent(sample));expect(report).toHaveBeenCalledWith({heading:270,pitch:85});expect(result.current.active).toBe(true);
 act(()=>vi.advanceTimersByTime(3001));expect(result.current.active).toBe(false);
 unmount();report.mockClear();window.dispatchEvent(sample);expect(report).not.toHaveBeenCalled();
});
it('does not treat permission denial or relative alpha as a compass',async()=>{
 vi.stubGlobal('DeviceOrientationEvent',{requestPermission:vi.fn().mockResolvedValue('denied')});
 const report=vi.fn(),{result}=renderHook(()=>useJourneyCompass(report));await act(async()=>result.current.request());
 const sample=new Event('deviceorientation');Object.assign(sample,{alpha:90,absolute:false});
 act(()=>window.dispatchEvent(sample));expect(report).not.toHaveBeenCalled();expect(result.current.active).toBe(false);
});
