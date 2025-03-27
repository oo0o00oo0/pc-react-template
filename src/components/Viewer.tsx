import { useEffect, useRef, useState } from "react";

const Viewer = () => {
  const iframe = useRef<HTMLIFrameElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const [isLoadingComplete, setIsLoadingComplete] = useState(false);
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [developmentsData, setDevelopmentData] = useState<any>({
    ok: false,
    data: null,
  });

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
    };
    //   if (event.data.type === "infoPoint") {
    //     if (!developmentsData) return;
    //     const id = event.data.name.replace("info-point-", "");
    //     console.log("infoPoint", id);

    //     const devID = developmentsData[id];
    //     if (devID) {
    //       setStoreState({ activeDevelopment: devID });
    //     }
    //   }
    // };

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
          data: { developmentData: developmentsData },
        },
        "*"
      );
    }
  }, [isLoadingComplete, developmentsData, iframe]);
  return (
    <>
      <button
        onClick={() => {
          iframe.current?.contentWindow?.postMessage(
            {
              type: "set0",
              activeObjects: [
                {
                  id: Math.random(),
                  state: "on",
                },
              ],
            },
            "*"
          );
        }}
      >
        event
      </button>
      <h1
        style={{
          position: "absolute",
          top: 0,
          pointerEvents: "none",
          left: 0,
          width: "100%",
          height: "100%",
        }}
        ref={loadingRef}
      ></h1>
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
