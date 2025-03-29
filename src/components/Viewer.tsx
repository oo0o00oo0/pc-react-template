import { useEffect, useRef, useState } from "react";

type DevelopmentData = {
  ok: boolean;
  data: string | null;
};

const Viewer = () => {
  const iframe = useRef<HTMLIFrameElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const [isLoadingComplete, setIsLoadingComplete] = useState(false);
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [developmentsData, setDevelopmentData] = useState<
    DevelopmentData | null
  >(null);
  const [activeUnit, setActiveUnit] = useState<string | null>(null);
  useEffect(() => {
    const simulateDataLoad = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setDevelopmentData({
        ok: true,
        data: null,
      });
    };
    simulateDataLoad();
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "loading") {
        if (loadingRef.current) {
          loadingRef.current.textContent = event.data.v;
        }
        // console.log("loading", event.data.v);
        // handleLoading(event.data, loadingRef);
        if (event.data.v === "100") {
          setIsLoadingComplete(true);
        }
      }
      if (event.data.type === "scene-ready") {
        setIsSceneReady(true);
      }
      if (event.data.type === "infoPoint") {
        console.log("infoPoint", event.data);
        const id = event.data.name;

        setActiveUnit(id);
        console.log("infoPoint", id);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);
  useEffect(() => {
    if (isLoadingComplete && developmentsData) {
      iframe.current?.contentWindow?.postMessage(
        {
          type: "initialize",
          data: {
            developmentData: developmentsData,
            camera: {
              position: [-200, 100, -200],
              target: [0, 0, 0],
            },
          },
        },
        "*",
      );
    }
  }, [isLoadingComplete, developmentsData, iframe]);

  const [swirl, setSwirl] = useState(0);

  const something = [0.1, 1];
  return (
    <>
      <button
        onClick={() => {
          setSwirl(swirl + 1);
          iframe.current?.contentWindow?.postMessage(
            {
              type: "animateSwirl",
              data: {
                swirl: something[swirl % 2],
              },
            },
            "*",
          );
        }}
      >
        event
      </button>
      <h4
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          pointerEvents: "none",
        }}
      >
        {activeUnit}
      </h4>
      <h4
        style={{
          position: "absolute",
          top: 20,
          pointerEvents: "none",
          left: 0,
          width: "100%",
          height: "100%",
        }}
        ref={loadingRef}
      >
      </h4>
      <h4
        style={{
          position: "absolute",
          top: 40,
          pointerEvents: "none",
          left: 0,
          width: "100%",
          height: "100%",
        }}
      >
        {developmentsData ? "data loaded" : "loading api data"}
      </h4>
      <iframe
        ref={iframe}
        style={{
          width: "100%",
          height: "100%",
          opacity: isSceneReady ? 1 : 0,

          transition: "opacity 0.2s ease-in-out",
        }}
        src="/viewer/viewer.html"
      />
    </>
  );
};

export default Viewer;
