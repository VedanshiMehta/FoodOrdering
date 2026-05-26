import { CartCustomization, CartItemType, CartStore } from "@/type";
import {
  FC,
  PropsWithChildren,
  createContext,
  useCallback,
  useMemo,
  useState,
} from "react";

function areCustomizationsEqual(
  a: CartCustomization[] = [],
  b: CartCustomization[] = [],
): boolean {
  if (a.length !== b.length) return false;

  const aSorted = [...a].sort((x, y) => x.id.localeCompare(y.id));
  const bSorted = [...b].sort((x, y) => x.id.localeCompare(y.id));

  return aSorted.every((item, idx) => item.id === bSorted[idx].id);
}

export const CartContext = createContext<CartStore>({
  items: [],
  addItem: () => {},
  removeItem: () => {},
  increaseQty: () => {},
  decreaseQty: () => {},
  clearCart: () => {},
  getTotalItems: () => 0,
  getTotalPrice: () => 0,
});

export const CartProvider: FC<PropsWithChildren> = ({ children }) => {
  const [items, setItems] = useState<CartItemType[]>([]);

  const addItem: CartStore["addItem"] = useCallback((item) => {
    const customizations = item.customizations ?? [];

    setItems((currentItems) => {
      const existing = currentItems.find(
        (i) =>
          i.id === item.id &&
          areCustomizationsEqual(i.customizations ?? [], customizations),
      );

      if (existing) {
        return currentItems.map((i) =>
          i.id === item.id &&
          areCustomizationsEqual(i.customizations ?? [], customizations)
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        );
      }

      return [...currentItems, { ...item, quantity: 1, customizations }];
    });
  }, []);

  const removeItem: CartStore["removeItem"] = useCallback(
    (id, customizations = []) => {
      setItems((currentItems) =>
        currentItems.filter(
          (i) =>
            !(
              i.id === id &&
              areCustomizationsEqual(i.customizations ?? [], customizations)
            ),
        ),
      );
    },
    [],
  );

  const increaseQty: CartStore["increaseQty"] = useCallback(
    (id, customizations = []) => {
      setItems((currentItems) =>
        currentItems.map((i) =>
          i.id === id &&
          areCustomizationsEqual(i.customizations ?? [], customizations)
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        ),
      );
    },
    [],
  );

  const decreaseQty: CartStore["decreaseQty"] = useCallback(
    (id, customizations = []) => {
      setItems((currentItems) =>
        currentItems
          .map((i) =>
            i.id === id &&
            areCustomizationsEqual(i.customizations ?? [], customizations)
              ? { ...i, quantity: i.quantity - 1 }
              : i,
          )
          .filter((i) => i.quantity > 0),
      );
    },
    [],
  );

  const clearCart = useCallback(() => setItems([]), []);

  const getTotalItems = useCallback(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items],
  );

  const getTotalPrice = useCallback(
    () =>
      items.reduce((total, item) => {
        const base = item.price;
        const customPrice =
          item.customizations?.reduce(
            (s: number, c: CartCustomization) => s + c.price,
            0,
          ) ?? 0;
        return total + item.quantity * (base + customPrice);
      }, 0),
    [items],
  );

  const contextValue = useMemo(() => {
    return {
      items,
      addItem,
      removeItem,
      increaseQty,
      decreaseQty,
      clearCart,
      getTotalItems,
      getTotalPrice,
    };
  }, [
    items,
    addItem,
    removeItem,
    increaseQty,
    decreaseQty,
    clearCart,
    getTotalItems,
    getTotalPrice,
  ]);

  return (
    <CartContext.Provider value={contextValue}>{children}</CartContext.Provider>
  );
};

export default CartContext;
