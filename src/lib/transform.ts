import type * as THREE from 'three';

export interface TransformValue {
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  scale?: number;
}

export const defaultTransform: TransformValue = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: 1,
};

export function applyTransformToObject3D(obj: THREE.Object3D, transform: TransformValue | null | undefined) {
  const t = transform || defaultTransform;
  const pos = t.position || { x: 0, y: 0, z: 0 };
  const rot = t.rotation || { x: 0, y: 0, z: 0 };
  const scale = t.scale ?? 1;
  obj.position.set(pos.x, pos.y, pos.z);
  obj.rotation.set(rot.x, rot.y, rot.z);
  obj.scale.setScalar(scale);
}
