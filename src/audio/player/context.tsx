import type { ReactNode } from 'react';

import type { AudioService } from './service';
import { AudioServiceContext } from './serviceContext';

export function AudioServiceProvider({
  service,
  children,
}: {
  service: AudioService;
  children: ReactNode;
}) {
  return <AudioServiceContext.Provider value={service}>{children}</AudioServiceContext.Provider>;
}
