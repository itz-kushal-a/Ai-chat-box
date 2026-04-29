import { contextBridge } from 'electron';
import { capitalize } from 'shared';

contextBridge.exposeInMainWorld('api', {
  greet: (name: string) => capitalize(`hello ${name}`),
});
