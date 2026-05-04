/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type IngredientType = 'bread' | 'lettuce' | 'tomato' | 'cheese' | 'bacon' | 'mayo';

export interface IngredientData {
  id: string;
  type: IngredientType;
  position: [number, number, number];
  rotation: number;
  scale: number;
  opacity: number;
}

export interface SandwichState {
  layers: IngredientData[];
}
