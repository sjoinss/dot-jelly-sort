"use client";

import { useEffect, useState } from "react";
import { DesktopFrame } from "./DesktopFrame";
import { SaveProvider, useSave } from "./SaveProvider";
import { ToastProvider } from "./ui/Toast";
import { MainScreen } from "./screens/MainScreen";
import { StageSelectScreen } from "./screens/StageSelectScreen";
import { PlayScreen } from "./screens/PlayScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { JellyEditorScreen } from "@/editor/JellyEditorScreen";
import { SkinScreen } from "@/skins/SkinScreen";
import { nextStage } from "@/lib/progress";

export type Route =
  | { name: "main" }
  | { name: "stages" }
  | { name: "play"; stage: number }
  | { name: "editor" }
  | { name: "settings"; from: Route };

export function App() {
  return (
    <ToastProvider>
      <SaveProvider>
        <DesktopFrame>
          <Router />
        </DesktopFrame>
      </SaveProvider>
    </ToastProvider>
  );
}

function Router() {
  const { save } = useSave();
  const [route, setRoute] = useState<Route>({ name: "main" });
  const mode = save.settings.mode;

  // 마크 모드는 블록 월드풍 UI 색 (점프점프의 블록 월드 테마 토큰)
  useEffect(() => {
    const root = document.documentElement;
    if (mode === "block") root.dataset.theme = "blocks";
    else delete root.dataset.theme;
  }, [mode]);

  const go = (r: Route) => setRoute(r);
  const home = () => go({ name: "main" });

  switch (route.name) {
    case "main":
      return (
        <MainScreen
          onPlay={() => go({ name: "play", stage: nextStage(save.progress) })}
          onStages={() => go({ name: "stages" })}
          onEditor={() => go({ name: "editor" })}
          onSettings={() => go({ name: "settings", from: route })}
        />
      );
    case "stages":
      return <StageSelectScreen onBack={home} onPick={(stage) => go({ name: "play", stage })} />;
    case "play":
      return (
        <PlayScreen
          key={route.stage}
          stage={route.stage}
          onExit={() => go({ name: "stages" })}
          onHome={home}
          onNext={(stage) => go({ name: "play", stage })}
        />
      );
    case "editor":
      return mode === "jelly" ? <JellyEditorScreen onBack={home} /> : <SkinScreen onBack={home} />;
    case "settings":
      return <SettingsScreen onBack={() => go(route.from)} />;
  }
}
