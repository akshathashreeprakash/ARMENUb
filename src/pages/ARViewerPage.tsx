import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import type { MenuItem, Restaurant } from '../types/database';
import { Camera, X, AlertCircle, Loader2, Clock } from 'lucide-react';
import { applyTransformToObject3D, defaultTransform } from '../lib/transform';

declare global {
  interface Window {
    MINDAR: {
      IMAGE: {
        MindARThree: new (options: { container: HTMLElement; imageTargetSrc: string }) => {
          renderer: any;
          scene: any;
          camera: any;
          addAnchor: (index: number) => {
            group: any;
            onTargetFound: () => void;
            onTargetLost: () => void;
          };
          start: () => Promise<void>;
          stop: () => void;
        };
      };
    };
  }
}

export function ARViewerPage() {
  const { restaurantSlug, itemId } = useParams();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [item, setItem] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [isTracking, setIsTracking] = useState(false);
  const [showSearching, setShowSearching] = useState(false);
  const [arReady, setArReady] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mindARRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const isInitializingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    fetchData();

    // Lock page scroll on mobile/phone for AR view
    document.body.classList.add('ar-viewer-body');
    document.documentElement.classList.add('ar-viewer-body');

    // Check if camera permission was already granted previously
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'camera' as PermissionName }).then((permissionStatus) => {
        if (permissionStatus.state === 'granted' && isMountedRef.current) {
          setCameraPermission('granted');
        }
      }).catch(err => {
        console.warn('Could not query camera permission status:', err);
      });
    }

    return () => {
      isMountedRef.current = false;

      // Remove scroll lock
      document.body.classList.remove('ar-viewer-body');
      document.documentElement.classList.remove('ar-viewer-body');

      if (mindARRef.current) {
        console.log('Stopping MindAR session during unmount');
        try {
          mindARRef.current.stop();
          if (mindARRef.current.renderer) {
            mindARRef.current.renderer.setAnimationLoop(null);
          }
        } catch (e) {
          console.error('Error during MindAR cleanup:', e);
        }
        mindARRef.current = null;
      }
    };
  }, [restaurantSlug, itemId]);

  useEffect(() => {
    if (cameraPermission === 'granted' && item && !mindARRef.current && !isInitializingRef.current) {
      startMindAR();
    }
  }, [cameraPermission, item]);

  const fetchData = async () => {
    if (!restaurantSlug || !itemId) {
      setError('Invalid URL');
      setLoading(false);
      return;
    }

    try {
      const { data: restaurantData, error: restaurantError } = await supabase
        .from('restaurants')
        .select('*')
        .eq('slug', restaurantSlug)
        .single();

      if (restaurantError || !restaurantData) {
        setError('Restaurant not found');
        setLoading(false);
        return;
      }

      if (isMountedRef.current) {
        setRestaurant(restaurantData);
      }

      const { data: itemData, error: itemError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('id', itemId)
        .single();

      if (itemError || !itemData) {
        setError('Menu item not found');
        setLoading(false);
        return;
      }

      if (isMountedRef.current) {
        setItem(itemData);
        setLoading(false);
      }
    } catch {
      setError('Failed to load content');
      setLoading(false);
    }
  };

  const requestCameraAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      stream.getTracks().forEach(track => track.stop());

      if (isMountedRef.current) {
        setCameraPermission('granted');
      }
    } catch (err) {
      console.error('Camera access denied:', err);
      if (isMountedRef.current) {
        setCameraPermission('denied');
      }
    }
  };

  const startMindAR = async () => {
    if (!containerRef.current || !item?.target_image_url || !item?.model_url) {
      setError('Missing required AR assets');
      return;
    }

    if (isInitializingRef.current || mindARRef.current) {
      console.log('AR already starting or started');
      return;
    }

    isInitializingRef.current = true;
    setShowSearching(true);

    const mindFileUrl = item.mind_file_url;
    if (!mindFileUrl) {
      setShowSearching(false);
      setError('AR target not compiled. Please save the item in the admin to generate the .mind file.');
      isInitializingRef.current = false;
      return;
    }

    try {
      // Import THREE and GLTFLoader from the SAME CDN that MindAR uses.
      const THREE = await import(/* @vite-ignore */ 'https://unpkg.com/three@0.160.0/build/three.module.js');
      const { GLTFLoader } = await import(/* @vite-ignore */ 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js');

      // Guard: unmounted during import
      if (!isMountedRef.current) {
        isInitializingRef.current = false;
        return;
      }

      // Clear the container to avoid any duplicate canvases/videos from previous/interrupted runs
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }

      const mindarThree = new window.MINDAR.IMAGE.MindARThree({
        container: containerRef.current,
        imageTargetSrc: mindFileUrl,
      });

      // Load the 3D model
      const loader = new GLTFLoader();
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(item.model_url!, resolve, undefined, (err) => {
          if (!isMountedRef.current) return;
          reject(err);
        });
      });

      // Guard: unmounted during model load
      if (!isMountedRef.current) {
        try {
          mindarThree.stop();
        } catch (e) {}
        isInitializingRef.current = false;
        return;
      }

      const model = gltf.scene;
      const { scene, renderer, camera } = mindarThree;

      // Add lighting using the same THREE instance
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight1.position.set(5, 5, 5);
      scene.add(directionalLight1);

      const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
      directionalLight2.position.set(-5, 5, -5);
      scene.add(directionalLight2);

      // Create anchor and attach model to it
      const anchor = mindarThree.addAnchor(0);
      anchor.group.add(model);

      // Apply the saved transform relative to the anchor
      applyTransformToObject3D(model, item.transform || defaultTransform);

      // Model is only visible when tracking
      model.visible = false;

      anchor.onTargetFound = () => {
        if (!isMountedRef.current) return;
        model.visible = true;
        setIsTracking(true);
        setShowSearching(false);
      };

      anchor.onTargetLost = () => {
        if (!isMountedRef.current) return;
        model.visible = false;
        setIsTracking(false);
      };

      await mindarThree.start();

      // Guard: unmounted during start
      if (!isMountedRef.current) {
        try {
          mindarThree.stop();
          if (renderer) {
            renderer.setAnimationLoop(null);
          }
        } catch (e) {}
        isInitializingRef.current = false;
        return;
      }

      // Start the render loop so Three.js renders the scene frame-by-frame
      renderer.setAnimationLoop(() => {
        renderer.render(scene, camera);
      });

      mindARRef.current = mindarThree;
      setArReady(true);
      isInitializingRef.current = false;
    } catch (err) {
      console.error('Failed to start MindAR:', err);
      if (isMountedRef.current) {
        setError('Failed to start AR experience. Please check your target image and model.');
        setShowSearching(false);
      }
      isInitializingRef.current = false;
    }
  };

  const accentColor = (restaurant?.theme as { accentColor?: string })?.accentColor || '#171717';

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-3 border-white border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-semibold text-white mb-3">Something went wrong</h1>
          <p className="text-neutral-400 text-sm">{error}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden ar-viewer-page">
      {/* Dedicated clean container for MindAR (no React children) */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full ar-video-container" />

      {/* React UI Overlay Layer */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <AnimatePresence>
          {cameraPermission === 'pending' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex items-center justify-center p-6 pointer-events-auto"
            >
              <div
                className="absolute inset-0"
                style={{ background: `linear-gradient(135deg, ${accentColor}dd, ${accentColor}ee)` }}
              />
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="relative bg-white/15 backdrop-blur-2xl rounded-[2rem] p-10 max-w-sm text-center shadow-2xl border border-white/20"
              >
                <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg">
                  <Camera className="w-12 h-12 text-white" />
                </div>
                <h1 className="text-3xl font-semibold text-white mb-3 tracking-tight">
                  {restaurant?.name}
                </h1>
                <p className="text-white/80 mb-8 text-base leading-relaxed">
                  Experience <span className="font-semibold">{item?.name}</span> in augmented reality. Allow camera access to begin.
                </p>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={requestCameraAccess}
                  className="w-full py-4 bg-white text-neutral-900 rounded-2xl font-semibold text-base shadow-xl hover:shadow-2xl transition-shadow"
                >
                  Allow Camera Access
                </motion.button>
                <p className="text-xs text-white/50 mt-6 leading-relaxed">
                  Your camera is only used for AR and is not uploaded or stored.
                </p>
              </motion.div>
            </motion.div>
          )}

          {cameraPermission === 'denied' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-black pointer-events-auto"
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="text-center max-w-sm"
              >
                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <X className="w-10 h-10 text-red-500" />
                </div>
                <h1 className="text-2xl font-semibold text-white mb-3">Camera Required</h1>
                <p className="text-neutral-400 mb-8 leading-relaxed">
                  Camera access is required for AR experiences. Please allow camera access in your browser settings.
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={requestCameraAccess}
                  className="px-8 py-4 bg-white text-neutral-900 rounded-2xl font-semibold"
                >
                  Try Again
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showSearching && cameraPermission === 'granted' && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-12 inset-x-0 flex justify-center z-10"
            >
              <div className="bg-black/60 backdrop-blur-xl rounded-full px-5 py-3 flex items-center gap-3 shadow-lg border border-white/10">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
                <span className="text-white text-sm font-medium">Searching for target...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!isTracking && cameraPermission === 'granted' && !showSearching && arReady && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="absolute bottom-12 inset-x-0 flex justify-center z-10 px-6"
            >
              <div className="bg-black/60 backdrop-blur-xl rounded-2xl px-8 py-5 text-center max-w-xs shadow-lg border border-white/10">
                <p className="text-white text-sm leading-relaxed">
                  Point your camera at the menu image to see the AR experience
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {cameraPermission === 'granted' && item && (
          <UIOverlay item={item} isTracking={isTracking} />
        )}
      </div>
    </div>
  );
}

function UIOverlay({ item, isTracking }: { item: MenuItem; isTracking: boolean }) {
  if (!item.ui_config || item.ui_config.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {item.ui_config
        .filter((el) => el.visible)
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((element, index) => (
          <motion.div
            key={element.id}
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{
              opacity: isTracking ? 1 : 0,
              scale: isTracking ? 1 : 0.5,
              y: isTracking ? 0 : 20,
            }}
            transition={{
              delay: index * 0.08,
              type: 'spring',
              stiffness: 300,
              damping: 25
            }}
            className="absolute pointer-events-auto"
            style={{
              left: `${element.position.x}%`,
              top: `${element.position.y}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: element.zIndex,
            }}
          >
            {element.type === 'button' ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3.5 bg-white text-neutral-900 rounded-2xl font-semibold text-sm shadow-xl"
              >
                {element.content}
              </motion.button>
            ) : element.type === 'price' ? (
              <div className="px-5 py-2.5 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-2xl shadow-xl">
                <span className="text-white font-bold text-xl">{element.content}</span>
              </div>
            ) : element.type === 'wait-time' ? (
              <div className="px-4 py-2.5 bg-amber-500 rounded-2xl shadow-xl flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-white" />
                <span className="text-white font-semibold text-sm">{element.content}</span>
              </div>
            ) : element.type === 'description' ? (
              <div className="px-5 py-4 bg-white/20 backdrop-blur-xl rounded-2xl max-w-[220px] shadow-xl border border-white/20">
                <p className="text-white text-sm leading-relaxed font-medium">{element.content}</p>
              </div>
            ) : element.type === 'text' ? (
              <div
                className="px-4 py-2.5 rounded-2xl text-sm font-medium shadow-lg"
                style={{
                  background: element.style.background === 'glass'
                    ? 'rgba(255,255,255,0.25)'
                    : element.style.background === 'solid'
                      ? 'rgba(255,255,255,0.95)'
                      : 'transparent',
                  backdropFilter: element.style.background === 'glass' ? 'blur(16px)' : 'none',
                  WebkitBackdropFilter: element.style.background === 'glass' ? 'blur(16px)' : 'none',
                  color: element.style.color,
                  fontSize: element.style.fontSize,
                  fontWeight: element.style.fontWeight,
                }}
              >
                {element.content}
              </div>
            ) : (
              <span
                style={{
                  color: element.style.color,
                  fontSize: element.style.fontSize,
                  fontWeight: element.style.fontWeight,
                }}
              >
                {element.content}
              </span>
            )}
          </motion.div>
        ))}
    </div>
  );
}
