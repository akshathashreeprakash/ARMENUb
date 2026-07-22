import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { MenuItem, UIElement } from '../types/database';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, useGLTF, TransformControls, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { QRCodeSVG } from 'qrcode.react';
import { RestaurantSwitcher } from '../components/RestaurantSwitcher';
import { applyTransformToObject3D, defaultTransform, type TransformValue } from '../lib/transform';
import {
  ArrowLeft,
  Save,
  Upload,
  Image as ImageIcon,
  Box,
  Type,
  DollarSign,
  Clock,
  MousePointer2,
  Trash2,
  Copy,
  Eye,
  RotateCcw,
  GripVertical,
  Smartphone,
  Link2,
  ChevronDown,
  AlertCircle,
  Move3d,
  RotateCw,
  Maximize2,
  Sliders,
} from 'lucide-react';

function TargetImagePlane({ url }: { url: string }) {
  const texture = useTexture(url);
  useEffect(() => {
    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
  }, [texture]);

  // Render the target image lying flat in the local X-Y plane (with slightly negative Z so model sits on top)
  return (
    <mesh position={[0, 0, -0.01]} receiveShadow>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial map={texture} transparent opacity={0.85} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Model({ url, transform, onReady }: {
  url: string;
  transform: TransformValue;
  onReady: (obj: THREE.Group) => void;
}) {
  const { scene } = useGLTF(url);
  const meshRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (meshRef.current) {
      applyTransformToObject3D(meshRef.current, transform);
    }
  }, [transform]);

  useEffect(() => {
    if (meshRef.current) {
      onReady(meshRef.current);
    }
  }, [onReady]);

  return <primitive ref={meshRef} object={scene} />;
}

function TransformableScene({
  modelUrl,
  targetImageUrl,
  transform,
  setTransform,
  mode,
}: {
  modelUrl: string;
  targetImageUrl: string | null;
  transform: TransformValue;
  setTransform: (t: TransformValue) => void;
  mode: 'translate' | 'rotate' | 'scale';
}) {
  const [meshObject, setMeshObject] = useState<THREE.Group | null>(null);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
      <directionalLight position={[-5, 5, -5]} intensity={0.4} />
      {/* Group representing the MindAR Anchor (with X-Y plane rotated to lie flat on the ground X-Z) */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        {targetImageUrl && <TargetImagePlane url={targetImageUrl} />}
        <Model url={modelUrl} transform={transform} onReady={setMeshObject} />
      </group>
      {meshObject && (
        <TransformControls
          object={meshObject}
          mode={mode}
          size={0.8}
          onObjectChange={() => {
            if (!meshObject) return;
            setTransform({
              position: { x: meshObject.position.x, y: meshObject.position.y, z: meshObject.position.z },
              rotation: { x: meshObject.rotation.x, y: meshObject.rotation.y, z: meshObject.rotation.z },
              scale: meshObject.scale.x,
            });
          }}
        />
      )}
      <OrbitControls makeDefault />
      <Environment preset="studio" />
    </>
  );
}

const radToDeg = (rad: number) => {
  const deg = (rad * 180) / Math.PI;
  const normalized = ((deg + 180) % 360) - 180;
  return Math.round(normalized);
};

const degToRad = (deg: number) => (deg * Math.PI) / 180;

export function ItemEditorPage() {
  const { itemId } = useParams();
  const { selectedRestaurant: restaurant } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [, setItem] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [minWaitTime, setMinWaitTime] = useState('');

  const [targetImageUrl, setTargetImageUrl] = useState<string | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [mindFileUrl, setMindFileUrl] = useState<string | null>(null);

  const [transform, setTransform] = useState(defaultTransform);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const [posStep, setPosStep] = useState(0.01);
  const [rotStep, setRotStep] = useState(5);
  const [uiConfig, setUiConfig] = useState<UIElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  const nudgePosition = (axis: 'x' | 'y' | 'z', delta: number) => {
    setTransform((prev) => ({
      ...prev,
      position: {
        x: prev.position?.x ?? 0,
        y: prev.position?.y ?? 0,
        z: prev.position?.z ?? 0,
        [axis]: Number(((prev.position?.[axis] ?? 0) + delta).toFixed(4)),
      },
    }));
  };

  const nudgeRotation = (axis: 'x' | 'y' | 'z', deltaDeg: number) => {
    setTransform((prev) => {
      const currentRad = prev.rotation?.[axis] ?? 0;
      const currentDeg = (currentRad * 180) / Math.PI;
      const newDeg = currentDeg + deltaDeg;
      return {
        ...prev,
        rotation: {
          x: prev.rotation?.x ?? 0,
          y: prev.rotation?.y ?? 0,
          z: prev.rotation?.z ?? 0,
          [axis]: (newDeg * Math.PI) / 180,
        },
      };
    });
  };

  const [activeTab, setActiveTab] = useState<'details' | 'ar' | 'ui' | 'publish'>(
    (searchParams.get('tab') as 'details' | 'ar' | 'ui' | 'publish') || 'details'
  );
  const [uploadingTarget, setUploadingTarget] = useState(false);
  const [uploadingModel, setUploadingModel] = useState(false);
  const [compilingMind, setCompilingMind] = useState(false);
  const [mindCompileProgress, setMindCompileProgress] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  const phoneCanvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    elementId: string;
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);

  const isNewItem = itemId === 'new';

  useEffect(() => {
    if (!isNewItem && itemId) {
      fetchItem();
    } else {
      setLoading(false);
    }
  }, [itemId]);

  const fetchItem = async () => {
    const { data } = await supabase
      .from('menu_items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (data) {
      setItem(data);
      setName(data.name);
      setPrice(data.price || '');
      setDescription(data.description || '');
      setMinWaitTime(data.min_wait_time || '');
      setTargetImageUrl(data.target_image_url);
      setModelUrl(data.model_url);
      setMindFileUrl(data.mind_file_url);
      setTransform(data.transform || defaultTransform);
      setUiConfig(data.ui_config || []);
    }
    setLoading(false);
  };

  const waitForMindARCompiler = async (timeoutMs = 15000): Promise<void> => {
    const start = Date.now();
    while (!(window as any).MINDAR?.IMAGE?.Compiler) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(
          'MindAR compiler failed to load. Check your network connection and refresh the page.',
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  };

  const compileMindFile = async (
    imageUrl: string,
    restaurantId: string,
    savedItemId: string,
  ): Promise<string | null> => {
    await waitForMindARCompiler();
    const CompilerCtor = (window as any).MINDAR.IMAGE.Compiler as new () => any;
    const compiler = new CompilerCtor();
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    await img.decode();

    await compiler.compileImageTargets([img], (progress: number) => {
      setMindCompileProgress(Math.round(progress * 100));
    });

    const exportedBuffer = await compiler.exportData();
    const mindFile = new File([exportedBuffer as BlobPart], 'targets.mind', {
      type: 'application/octet-stream',
    });

    const mindPath = `${restaurantId}/${savedItemId}/targets.mind`;
    return await uploadFile(mindFile, 'mind-files', mindPath);
  };

  const handleSave = async () => {
    if (!restaurant) return;
    setSaving(true);
    setSaveError(null);

    const itemData = {
      restaurant_id: restaurant.id,
      name,
      price: price || null,
      description: description || null,
      min_wait_time: minWaitTime || null,
      target_image_url: targetImageUrl,
      model_url: modelUrl,
      mind_file_url: mindFileUrl,
      transform,
      ui_config: uiConfig,
    };

    let savedItemId = itemId;
    let hadError = false;

    if (isNewItem) {
      const result = await supabase.from('menu_items').insert(itemData).select().single();
      if (result.error) {
        setSaveError(result.error.message);
        setSaving(false);
        return;
      }
      savedItemId = result.data.id;
    } else {
      const { error: updateError } = await supabase
        .from('menu_items')
        .update(itemData)
        .eq('id', itemId);
      if (updateError) {
        setSaveError(updateError.message);
        setSaving(false);
        return;
      }
    }

    if (targetImageUrl && !mindFileUrl && savedItemId) {
      setCompilingMind(true);
      setMindCompileProgress(0);
      try {
        const mindUrl = await compileMindFile(targetImageUrl, restaurant.id, savedItemId);
        if (mindUrl) {
          setMindFileUrl(mindUrl);
          await supabase
            .from('menu_items')
            .update({ mind_file_url: mindUrl })
            .eq('id', savedItemId);
        } else {
          setSaveError('Failed to upload compiled .mind tracking file.');
          hadError = true;
        }
      } catch (err) {
        setSaveError(
          `Failed to compile .mind file: ${err instanceof Error ? err.message : 'Unknown error'}`,
        );
        hadError = true;
      }
      setCompilingMind(false);
    }

    if (!hadError) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    if (isNewItem && savedItemId) {
      navigate(`/admin/item/${savedItemId}`, { replace: true });
    }
    setSaving(false);
  };

  const uploadFile = async (file: File, bucket: string, path: string): Promise<string | null> => {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) {
      console.error('Upload error:', error);
      return null;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleTargetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !restaurant) return;
    setUploadingTarget(true);
    setSaveError(null);

    const path = `${restaurant.id}/${itemId || 'new'}/target.${file.name.split('.').pop()}`;
    const url = await uploadFile(file, 'target-images', path);
    if (url) {
      setTargetImageUrl(url);
      setMindFileUrl(null);
    } else {
      setSaveError('Failed to upload target image.');
    }
    setUploadingTarget(false);
  };

  const handleModelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !restaurant) return;
    setUploadingModel(true);

    const path = `${restaurant.id}/${itemId || 'new'}/model.${file.name.split('.').pop()}`;
    const url = await uploadFile(file, 'models', path);
    if (url) {
      setModelUrl(url);
    }
    setUploadingModel(false);
  };

  const addUIElement = (type: UIElement['type']) => {
    const contentMap: Record<UIElement['type'], string> = {
      text: 'New Text',
      price: price || '$0.00',
      'wait-time': minWaitTime || '15-20 min',
      button: 'Order Now',
      description: description || 'Description',
      image: 'Image',
    };

    const newElement: UIElement = {
      id: crypto.randomUUID(),
      type,
      content: contentMap[type],
      position: { x: 50, y: 50 },
      style: {
        fontSize: type === 'button' ? 14 : type === 'price' ? 18 : 14,
        fontWeight: type === 'price' ? '700' : type === 'button' ? '600' : '400',
        color: '#ffffff',
        textAlign: 'center',
        background: type === 'button' ? 'solid' : 'glass',
        borderRadius: type === 'button' ? 12 : 8,
        padding: type === 'button' ? 12 : 8,
        opacity: 100,
        border: false,
      },
      visible: true,
      zIndex: uiConfig.length,
    };
    setUiConfig([...uiConfig, newElement]);
    setSelectedElementId(newElement.id);
  };

  const updateUIElement = (id: string, updates: Partial<UIElement>) => {
    setUiConfig(uiConfig.map((el) => (el.id === id ? { ...el, ...updates } : el)));
  };

  const deleteUIElement = (id: string) => {
    setUiConfig(uiConfig.filter((el) => el.id !== id));
    if (selectedElementId === id) setSelectedElementId(null);
  };

  const duplicateUIElement = (id: string) => {
    const element = uiConfig.find((el) => el.id === id);
    if (!element) return;
    const newElement: UIElement = {
      ...element,
      id: crypto.randomUUID(),
      position: { x: Math.min(element.position.x + 10, 90), y: Math.min(element.position.y + 10, 90) },
      zIndex: uiConfig.length,
    };
    setUiConfig([...uiConfig, newElement]);
  };

  const handlePointerDown = (e: React.PointerEvent, elementId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const element = uiConfig.find((el) => el.id === elementId);
    if (!element || !phoneCanvasRef.current) return;

    dragRef.current = {
      elementId,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: element.position.x,
      startPosY: element.position.y,
    };

    setSelectedElementId(elementId);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !phoneCanvasRef.current) return;

    const rect = phoneCanvasRef.current.getBoundingClientRect();
    const deltaX = ((e.clientX - dragRef.current.startX) / rect.width) * 100;
    const deltaY = ((e.clientY - dragRef.current.startY) / rect.height) * 100;

    const newX = Math.max(0, Math.min(100, dragRef.current.startPosX + deltaX));
    const newY = Math.max(0, Math.min(100, dragRef.current.startPosY + deltaY));

    updateUIElement(dragRef.current.elementId, {
      position: { x: newX, y: newY },
    });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const arUrl = restaurant && itemId && itemId !== 'new'
    ? `https://aromale.netlify.app/ar/${restaurant.slug}/${itemId}`
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-100 to-neutral-200 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 border-3 border-neutral-400 border-t-neutral-900 rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-100">
      <header className="bg-white/70 backdrop-blur-2xl border-b border-neutral-200/50 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                to="/admin"
                className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back</span>
              </Link>
              <div className="h-6 w-px bg-neutral-200" />
              <RestaurantSwitcher />
              <h1 className="font-semibold text-neutral-900 text-lg">
                {isNewItem ? 'New Menu Item' : name || 'Edit Item'}
              </h1>
            </div>
            <motion.button
              onClick={handleSave}
              disabled={saving || compilingMind || !name}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all shadow-lg ${
                saved
                  ? 'bg-emerald-500 text-white shadow-emerald-500/25'
                  : 'bg-neutral-900 text-white hover:bg-neutral-800 shadow-neutral-900/25 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : compilingMind ? `Compiling ${mindCompileProgress}%` : saved ? 'Saved!' : 'Save'}
            </motion.button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex gap-2 mb-8 p-1 bg-white/50 backdrop-blur rounded-2xl inline-flex">
          {(['details', 'ar', 'ui', 'publish'] as const).map((tab) => (
            <motion.button
              key={tab}
              onClick={() => setActiveTab(tab)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                activeTab === tab
                  ? 'bg-neutral-900 text-white shadow-lg shadow-neutral-900/20'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/50'
              }`}
            >
              {tab === 'details' && 'Details'}
              {tab === 'ar' && '3D & AR'}
              {tab === 'ui' && 'UI Elements'}
              {tab === 'publish' && 'Publish'}
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'details' && (
            <motion.div
              key="details"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-neutral-200/50 border border-neutral-100 p-8 space-y-8"
            >
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Item Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all text-neutral-900"
                    placeholder="e.g., Truffle Risotto"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Price</label>
                  <input
                    type="text"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-4 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all text-neutral-900"
                    placeholder="e.g., $24.00"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all resize-none text-neutral-900"
                  placeholder="Describe the dish..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700">Estimated Wait Time</label>
                <input
                  type="text"
                  value={minWaitTime}
                  onChange={(e) => setMinWaitTime(e.target.value)}
                  className="w-full px-4 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all text-neutral-900"
                  placeholder="e.g., 15-20 min"
                />
              </div>
            </motion.div>
          )}

          {activeTab === 'ar' && (
            <motion.div
              key="ar"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-8"
            >
              {saveError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3"
                >
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-700">Error</p>
                    <p className="text-sm text-red-600 mt-1">{saveError}</p>
                  </div>
                </motion.div>
              )}
              {compilingMind && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3"
                >
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-700">
                      Compiling AR target file...
                    </p>
                    <div className="mt-2 h-1.5 bg-blue-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${mindCompileProgress}%` }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
              <div className="grid lg:grid-cols-2 gap-8 items-start">
                <div className="space-y-6">
                  {/* Target Image Card */}
                  <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-neutral-200/50 border border-neutral-100 p-6">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-br from-neutral-100 to-neutral-200 rounded-2xl flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-neutral-700" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-neutral-900">Target Image</h3>
                        <p className="text-sm text-neutral-500">The image your AR will track</p>
                      </div>
                    </div>
                    <label className="block cursor-pointer">
                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        className="relative border-2 border-dashed border-neutral-300 rounded-2xl p-8 text-center hover:border-neutral-500 transition-colors overflow-hidden"
                      >
                        {targetImageUrl ? (
                          <img
                            src={targetImageUrl}
                            alt="Target"
                            className="max-h-48 mx-auto rounded-xl shadow-lg"
                          />
                        ) : (
                          <div className="space-y-3">
                            <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto">
                              <Upload className="w-8 h-8 text-neutral-400" />
                            </div>
                            <p className="text-sm text-neutral-500 font-medium">Click to upload target image</p>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleTargetUpload}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          disabled={uploadingTarget}
                        />
                      </motion.div>
                    </label>
                    {uploadingTarget && (
                      <div className="mt-4 flex items-center gap-2 text-sm text-neutral-500">
                        <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                        <span className="font-medium">Uploading target image...</span>
                      </div>
                    )}
                    {targetImageUrl && !uploadingTarget && (
                      <div
                        className={`mt-4 flex items-center gap-2 text-sm ${mindFileUrl ? 'text-emerald-600' : 'text-amber-600'}`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${mindFileUrl ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        />
                        <span className="font-medium">
                          {mindFileUrl
                            ? 'AR target compiled — ready for AR'
                            : 'AR target not yet compiled — click Save to compile'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 3D Model Card */}
                  <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-neutral-200/50 border border-neutral-100 p-6">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-br from-neutral-100 to-neutral-200 rounded-2xl flex items-center justify-center">
                        <Box className="w-6 h-6 text-neutral-700" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-neutral-900">3D Model</h3>
                        <p className="text-sm text-neutral-500">GLB or GLTF format</p>
                      </div>
                    </div>
                    <label className="block cursor-pointer">
                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        className="relative border-2 border-dashed border-neutral-300 rounded-2xl p-8 text-center hover:border-neutral-500 transition-colors"
                      >
                        {modelUrl ? (
                          <div className="space-y-3">
                            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
                              <Box className="w-8 h-8 text-emerald-600" />
                            </div>
                            <p className="text-sm text-neutral-700 font-medium">Model uploaded successfully</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto">
                              <Upload className="w-8 h-8 text-neutral-400" />
                            </div>
                            <p className="text-sm text-neutral-500 font-medium">Click to upload 3D model</p>
                          </div>
                        )}
                        <input
                          type="file"
                          accept=".glb,.gltf"
                          onChange={handleModelUpload}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          disabled={uploadingModel}
                        />
                      </motion.div>
                    </label>
                  </div>

                  {/* 3D Transform Settings Card */}
                  {modelUrl && (
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-neutral-200/50 border border-neutral-100 p-6 space-y-5">
                      <div className="flex items-center gap-3 border-b border-neutral-100 pb-3">
                        <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center">
                          <Sliders className="w-5 h-5 text-neutral-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-neutral-900">Transform Settings</h3>
                          <p className="text-xs text-neutral-500">Fine-tune the 3D model offset</p>
                        </div>
                      </div>

                      {/* Transform mode switcher */}
                      <div className="flex gap-2">
                        {([
                          { mode: 'translate' as const, icon: Move3d, label: 'Move' },
                          { mode: 'rotate' as const, icon: RotateCw, label: 'Rotate' },
                          { mode: 'scale' as const, icon: Maximize2, label: 'Scale' },
                        ]).map(({ mode, icon: Icon, label }) => (
                          <button
                            key={mode}
                            onClick={() => setTransformMode(mode)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                              transformMode === mode
                                ? 'bg-neutral-900 text-white'
                                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            {label}
                          </button>
                        ))}
                      </div>

                      {/* Position numeric inputs */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Position (meters)</label>
                          <div className="flex gap-1 bg-white border border-neutral-200 p-0.5 rounded-lg text-[10px] font-mono">
                            {([0.001, 0.01, 0.05]).map((step) => (
                              <button
                                key={step}
                                type="button"
                                onClick={() => setPosStep(step)}
                                className={`px-1.5 py-0.5 rounded transition-colors ${
                                  posStep === step ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
                                }`}
                              >
                                {step}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {(['x', 'y', 'z'] as const).map((axis) => (
                            <div key={axis} className="flex items-center gap-0.5 bg-white border border-neutral-200 rounded-xl overflow-hidden px-1">
                              <button
                                type="button"
                                onClick={() => nudgePosition(axis, -posStep)}
                                className="w-5 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-900 font-bold hover:bg-neutral-50 rounded select-none"
                              >
                                -
                              </button>
                              <div className="relative flex-1 min-w-0">
                                <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-neutral-400 uppercase">{axis}</span>
                                <input
                                  type="number"
                                  step={posStep}
                                  value={Number((transform.position?.[axis] ?? 0).toFixed(4))}
                                  onChange={(e) =>
                                    setTransform({
                                      ...transform,
                                      position: {
                                        x: transform.position?.x ?? 0,
                                        y: transform.position?.y ?? 0,
                                        z: transform.position?.z ?? 0,
                                        [axis]: parseFloat(e.target.value) || 0,
                                      },
                                    })
                                  }
                                  className="w-full pl-4 pr-1 py-1.5 bg-transparent border-0 text-xs font-mono text-center focus:outline-none text-neutral-900"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => nudgePosition(axis, posStep)}
                                className="w-5 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-900 font-bold hover:bg-neutral-50 rounded select-none"
                              >
                                +
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Rotation numeric inputs */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Rotation (degrees)</label>
                          <div className="flex gap-1 bg-white border border-neutral-200 p-0.5 rounded-lg text-[10px] font-mono">
                            {([1, 5, 15, 45]).map((step) => (
                              <button
                                key={step}
                                type="button"
                                onClick={() => setRotStep(step)}
                                className={`px-1.5 py-0.5 rounded transition-colors ${
                                  rotStep === step ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
                                }`}
                              >
                                {step}°
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {(['x', 'y', 'z'] as const).map((axis) => (
                            <div key={axis} className="flex items-center gap-0.5 bg-white border border-neutral-200 rounded-xl overflow-hidden px-1">
                              <button
                                type="button"
                                onClick={() => nudgeRotation(axis, -rotStep)}
                                className="w-5 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-900 font-bold hover:bg-neutral-50 rounded select-none"
                              >
                                -
                              </button>
                              <div className="relative flex-1 min-w-0">
                                <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-neutral-400 uppercase">{axis}</span>
                                <input
                                  type="number"
                                  step="1"
                                  value={radToDeg(transform.rotation?.[axis] ?? 0)}
                                  onChange={(e) => {
                                    const deg = parseFloat(e.target.value) || 0;
                                    setTransform({
                                      ...transform,
                                      rotation: {
                                        x: transform.rotation?.x ?? 0,
                                        y: transform.rotation?.y ?? 0,
                                        z: transform.rotation?.z ?? 0,
                                        [axis]: degToRad(deg),
                                      },
                                    });
                                  }}
                                  className="w-full pl-4 pr-1 py-1.5 bg-transparent border-0 text-xs font-mono text-center focus:outline-none text-neutral-900"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => nudgeRotation(axis, rotStep)}
                                className="w-5 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-900 font-bold hover:bg-neutral-50 rounded select-none"
                              >
                                +
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Scale numeric input + slider */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Scale</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="0.1"
                            max="5"
                            step="0.01"
                            value={transform.scale ?? 1}
                            onChange={(e) =>
                              setTransform({ ...transform, scale: parseFloat(e.target.value) })
                            }
                            className="flex-1 accent-neutral-900"
                          />
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={transform.scale ?? 1}
                            onChange={(e) =>
                              setTransform({ ...transform, scale: parseFloat(e.target.value) || 1 })
                            }
                            className="w-20 px-3 py-2 bg-white border border-neutral-200 rounded-xl text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-neutral-900 text-neutral-900"
                          />
                        </div>
                      </div>

                      {/* Z-Height slider — explicit control for height relative to plate surface */}
                      <div className="space-y-2 pt-2 border-t border-neutral-200">
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide flex items-center gap-2">
                          <Sliders className="w-3.5 h-3.5" />
                          Z-Height (vertical offset from plate surface)
                        </label>
                        <input
                          type="range"
                          min="-2"
                          max="2"
                          step="0.01"
                          value={transform.position?.z ?? 0}
                          onChange={(e) =>
                            setTransform({
                              ...transform,
                              position: { x: transform.position?.x ?? 0, y: transform.position?.y ?? 0, z: parseFloat(e.target.value) },
                            })
                          }
                          className="w-full accent-neutral-900"
                        />
                        <div className="flex justify-between text-xs text-neutral-400 font-mono">
                          <span>-2.00 (below)</span>
                          <span className="font-semibold text-neutral-600">{(transform.position?.z ?? 0).toFixed(2)}</span>
                          <span>+2.00 (above)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3D Preview (Sticky on desktop) */}
                <div className="lg:sticky lg:top-24 bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-neutral-200/50 border border-neutral-100 overflow-hidden">
                  <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
                    <h3 className="font-semibold text-neutral-900">3D Preview</h3>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setTransform({ ...defaultTransform })}
                      className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors"
                      title="Reset to default"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </motion.button>
                  </div>
                  <div className="aspect-square bg-gradient-to-br from-neutral-100 to-neutral-200 relative">
                    {modelUrl ? (
                      <Canvas camera={{ position: [0, 1.5, 2.5], fov: 50 }} shadows>
                        <TransformableScene
                          modelUrl={modelUrl}
                          targetImageUrl={targetImageUrl}
                          transform={transform}
                          setTransform={setTransform}
                          mode={transformMode}
                        />
                      </Canvas>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-neutral-400 font-medium">Upload a model to preview</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'ui' && (
            <motion.div
              key="ui"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="grid lg:grid-cols-3 gap-8"
            >
              <div className="space-y-6">
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-neutral-200/50 border border-neutral-100 p-6">
                  <h3 className="font-semibold text-neutral-900 mb-6">Add Elements</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { type: 'text' as const, icon: Type, label: 'Text', color: 'text-blue-600', bg: 'bg-blue-50' },
                      { type: 'price' as const, icon: DollarSign, label: 'Price Tag', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                      { type: 'wait-time' as const, icon: Clock, label: 'Wait Time', color: 'text-amber-600', bg: 'bg-amber-50' },
                      { type: 'button' as const, icon: MousePointer2, label: 'Button', color: 'text-violet-600', bg: 'bg-violet-50' },
                      { type: 'description' as const, icon: ChevronDown, label: 'Description', color: 'text-slate-600', bg: 'bg-slate-50' },
                    ].map(({ type, icon: Icon, label, color, bg }) => (
                      <motion.button
                        key={type}
                        onClick={() => addUIElement(type)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex items-center gap-3 p-4 bg-neutral-50 hover:bg-neutral-100 rounded-2xl transition-all border border-transparent hover:border-neutral-200"
                      >
                        <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
                          <Icon className={`w-5 h-5 ${color}`} />
                        </div>
                        <span className="text-sm font-medium text-neutral-700">{label}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {selectedElementId && uiConfig.find(el => el.id === selectedElementId) && (() => {
                  const selectedElement = uiConfig.find(el => el.id === selectedElementId)!;
                  return (
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-neutral-100 p-6 space-y-4">
                      <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-neutral-500" />
                        Customize {selectedElement.type === 'wait-time' ? 'Wait Time' : selectedElement.type === 'button' ? 'Action Button' : 'Element'}
                      </h3>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1.5">
                            Content/Text
                          </label>
                          <input
                            type="text"
                            value={selectedElement.content}
                            onChange={(e) => updateUIElement(selectedElement.id, { content: e.target.value })}
                            className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-800 transition-all"
                          />
                        </div>

                        {(selectedElement.type === 'wait-time' || selectedElement.type === 'button') && (
                          <div>
                            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1.5">
                              Style Preset
                            </label>
                            <select
                              value={selectedElement.style?.preset || 'default'}
                              onChange={(e) => {
                                updateUIElement(selectedElement.id, {
                                  style: {
                                    ...selectedElement.style,
                                    preset: e.target.value
                                  }
                                });
                              }}
                              className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-800 transition-all"
                            >
                              {selectedElement.type === 'wait-time' ? (
                                <>
                                  <option value="default">Standard Amber Badge</option>
                                  <option value="fluid-glass">Fluid Glass Badge</option>
                                </>
                              ) : (
                                <>
                                  <option value="default">Standard Solid Button</option>
                                  <option value="border-glow">Border Glow Button</option>
                                  <option value="neon-border">Neon Border Button</option>
                                </>
                              )}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="lg:col-span-2">
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-neutral-200/50 border border-neutral-100 overflow-hidden">
                  <div className="p-5 border-b border-neutral-100 flex items-center gap-3">
                    <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-neutral-600" />
                    </div>
                    <div>
                      <span className="font-semibold text-neutral-900">Phone Preview</span>
                      <p className="text-xs text-neutral-500">Drag elements to position them</p>
                    </div>
                  </div>
                  <div className="p-8 bg-gradient-to-br from-neutral-100 to-neutral-200 flex justify-center">
                    <div
                      ref={phoneCanvasRef}
                      className="relative w-[280px] aspect-[9/16] bg-black rounded-[3rem] overflow-hidden shadow-2xl border-4 border-neutral-800"
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerLeave={handlePointerUp}
                    >
                      {targetImageUrl && (
                        <img
                          src={targetImageUrl}
                          alt="Target"
                          className="absolute inset-0 w-full h-full object-cover opacity-40"
                        />
                      )}
                      {uiConfig
                        .filter((el) => el.visible)
                        .sort((a, b) => a.zIndex - b.zIndex)
                        .map((element) => (
                          <motion.div
                            key={element.id}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className={`absolute cursor-grab active:cursor-grabbing ${
                              selectedElementId === element.id ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent' : ''
                            }`}
                            style={{
                              left: `${element.position.x}%`,
                              top: `${element.position.y}%`,
                              transform: 'translate(-50%, -50%)',
                              zIndex: element.zIndex,
                            }}
                            onPointerDown={(e) => handlePointerDown(e, element.id)}
                          >
                            {element.type === 'button' ? (
                              element.style?.preset === 'border-glow' ? (
                                <div className="border-glow-container pointer-events-none">
                                  <div className="border-glow-gradient" />
                                  <div className="border-glow-content px-5 py-2.5 rounded-[10px] font-semibold text-sm text-center">
                                    {element.content}
                                  </div>
                                </div>
                              ) : element.style?.preset === 'neon-border' ? (
                                <div className="neon-border-button px-5 py-3 rounded-xl font-semibold text-sm shadow-lg pointer-events-none text-center">
                                  {element.content}
                                </div>
                              ) : (
                                <div className="px-5 py-3 bg-white text-neutral-900 rounded-xl font-semibold text-sm shadow-lg pointer-events-none text-center">
                                  {element.content}
                                </div>
                              )
                            ) : element.type === 'price' ? (
                              <div className="px-4 py-2 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-xl shadow-lg">
                                <span className="text-white font-bold text-lg">{element.content}</span>
                              </div>
                            ) : element.type === 'wait-time' ? (
                              element.style?.preset === 'fluid-glass' ? (
                                <div className="fluid-glass-badge px-4 py-2 rounded-xl shadow-lg flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-white fluid-glass-content" />
                                  <span className="text-white font-semibold text-sm fluid-glass-content">{element.content}</span>
                                </div>
                              ) : (
                                <div className="px-4 py-2 bg-amber-500 rounded-xl shadow-lg flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-white" />
                                  <span className="text-white font-semibold text-sm">{element.content}</span>
                                </div>
                              )
                            ) : element.type === 'description' ? (
                              <div className="px-4 py-3 bg-white/20 backdrop-blur-xl rounded-xl max-w-[200px]">
                                <p className="text-white text-xs leading-relaxed">{element.content}</p>
                              </div>
                            ) : (
                              <div
                                className="px-4 py-2 rounded-xl text-sm font-medium"
                                style={{
                                  background: element.style.background === 'glass' ? 'rgba(255,255,255,0.2)' : 'transparent',
                                  backdropFilter: element.style.background === 'glass' ? 'blur(12px)' : 'none',
                                  color: element.style.color,
                                  fontSize: element.style.fontSize,
                                  fontWeight: element.style.fontWeight,
                                }}
                              >
                                {element.content}
                              </div>
                            )}
                          </motion.div>
                        ))}
                    </div>
                  </div>
                </div>

                {uiConfig.length > 0 && (
                  <div className="mt-6 bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-neutral-200/50 border border-neutral-100 p-6 space-y-3">
                    <h4 className="text-sm font-semibold text-neutral-700 mb-4">Elements</h4>
                    {uiConfig.map((element) => (
                      <motion.div
                        key={element.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex items-center gap-3 p-4 rounded-2xl transition-all ${
                          selectedElementId === element.id
                            ? 'bg-neutral-100 border-2 border-neutral-300'
                            : 'bg-neutral-50 hover:bg-neutral-100'
                        }`}
                      >
                        <GripVertical className="w-4 h-4 text-neutral-400 cursor-grab" />
                        <input
                          type="text"
                          value={element.content}
                          onChange={(e) => updateUIElement(element.id, { content: e.target.value })}
                          className="flex-1 bg-transparent text-sm font-medium text-neutral-900 focus:outline-none"
                        />
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => duplicateUIElement(element.id)}
                          className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-200 rounded-lg transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => deleteUIElement(element.id)}
                          className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </motion.button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'publish' && (
            <motion.div
              key="publish"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-md mx-auto"
            >
              <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-neutral-200/50 border border-neutral-100 p-10 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-neutral-100 to-neutral-200 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Link2 className="w-10 h-10 text-neutral-600" />
                </div>
                <h3 className="text-2xl font-semibold text-neutral-900 mb-3">
                  {isNewItem ? 'Save to generate QR code' : 'Your AR Experience'}
                </h3>
                {!isNewItem && arUrl && (
                  <>
                    <p className="text-neutral-500 mb-8 text-sm">
                      Scan this code to view the AR experience
                    </p>
                    <div className="bg-white p-6 rounded-3xl inline-block shadow-inner border border-neutral-100 mb-8">
                      <QRCodeSVG value={arUrl} size={200} />
                    </div>
                    <div className="bg-neutral-100 rounded-2xl p-4 mb-8">
                      <p className="text-xs text-neutral-500 font-mono break-all">{arUrl}</p>
                    </div>
                    <div className="flex gap-3 justify-center">
                      <Link to={`/ar/${restaurant?.slug}/${itemId}`} target="_blank">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="px-6 py-3 bg-neutral-900 text-white rounded-xl font-semibold text-sm flex items-center gap-2 hover:bg-neutral-800 transition-colors shadow-lg shadow-neutral-900/20"
                        >
                          <Eye className="w-4 h-4" />
                          Preview
                        </motion.button>
                      </Link>
                    </div>
                  </>
                )}
                {isNewItem && (
                  <p className="text-neutral-500">
                    Save your item to generate a QR code for the AR experience.
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
