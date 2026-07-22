export interface Restaurant {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  theme: {
    accentColor?: string;
  };
  created_at: string;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  price: string | null;
  description: string | null;
  min_wait_time: string | null;
  target_image_url: string | null;
  mind_file_url: string | null;
  model_url: string | null;
  transform: {
    position?: { x: number; y: number; z: number };
    rotation?: { x: number; y: number; z: number };
    scale?: number;
  };
  ui_config: UIElement[];
  created_at: string;
}

export interface UIElement {
  id: string;
  type: 'text' | 'price' | 'wait-time' | 'button' | 'description' | 'image';
  content: string;
  position: { x: number; y: number };
  style: {
    fontSize?: number;
    fontWeight?: string;
    color?: string;
    textAlign?: 'left' | 'center' | 'right';
    background?: 'solid' | 'glass' | 'transparent';
    borderRadius?: number;
    padding?: number;
    opacity?: number;
    border?: boolean;
    preset?: string;
  };
  action?: {
    type: 'link' | 'whatsapp' | 'phone';
    value: string;
  };
  visible: boolean;
  zIndex: number;
}

export interface AuthUser {
  id: string;
  email: string;
}
