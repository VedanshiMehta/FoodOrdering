export type FoodItem = {
  $id: string;
  name: string;
  description: string;
  price: number;
  calories: number;
  protein: number;
  image_url: string;
};

let myFoodItems: FoodItem[] = [];
const subscribers = new Set<() => void>();

export const getMyFoodItems = () => myFoodItems;

export const addMyFoodItem = (item: FoodItem) => {
  myFoodItems = [item, ...myFoodItems];
  subscribers.forEach((callback) => callback());
};

export const subscribeToMenu = (callback: () => void) => {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
};

export default function MenuStateDummy() {
  return null;
}
