import { AudioBridge } from '@/components/AudioBridge';
import { CheckmateCelebration } from '@/components/CheckmateCelebration';
import { ChessBoard3D } from '@/components/ChessBoard3D';
import { GameHUD } from '@/components/GameHUD';
import { LeftToolbar } from '@/components/LeftToolbar';
import { NetworkBridge } from '@/components/NetworkBridge';
import { OnlineLobby } from '@/components/OnlineLobby';
import { PromotionPicker } from '@/components/PromotionPicker';
import { SettingsMenu } from '@/components/SettingsMenu';
import { TurnVignette } from '@/components/TurnVignette';

export default function Home() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <ChessBoard3D />
      <TurnVignette />
      <GameHUD />
      <LeftToolbar />
      <PromotionPicker />
      <CheckmateCelebration />
      <SettingsMenu />
      <OnlineLobby />
      <AudioBridge />
      <NetworkBridge />
    </div>
  );
}
