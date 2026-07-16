import Workstation from '@/components/Workstation';
import { WorkspaceProvider } from '@/components/workspace-store';

export default function Page() {
  // The provider owns the shared selection / hover / time-window that every coordinated
  // view subscribes to — it must wrap the whole workstation.
  return (
    <WorkspaceProvider>
      <Workstation />
    </WorkspaceProvider>
  );
}
