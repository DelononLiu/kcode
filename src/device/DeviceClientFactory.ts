import type { DeviceType, IDeviceClient } from '../types';
import { LocalDeviceClient } from './LocalDeviceClient';
import { DishCliDeviceClient } from './DishCliDeviceClient';

export function createDeviceClient(type: DeviceType): IDeviceClient {
    switch (type) {
        case 'local':
            return new LocalDeviceClient();
        case 'ssh':
        case 'telnet':
        case 'adb':
            return new DishCliDeviceClient();
    }
}
