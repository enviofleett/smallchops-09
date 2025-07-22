
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: FoodCategory;
  images: string[];
  isAvailable: boolean;
  preparationTime: number; // in minutes
  ingredients?: string[];
  addOns?: AddOn[];
  isSpicy?: boolean;
  isVegetarian?: boolean;
  calories?: number;
  createdAt: string;
  updatedAt: string;
}

export type FoodCategory = 
  | 'meat_pies'
  | 'spring_rolls'
  | 'samosas'
  | 'chicken_wings'
  | 'fish_rolls'
  | 'sausage_rolls'
  | 'chin_chin'
  | 'puff_puff'
  | 'beverages'
  | 'combo_packs';

export interface AddOn {
  id: string;
  name: string;
  price: number;
  category: 'sauce' | 'drink' | 'side' | 'extra';
}
