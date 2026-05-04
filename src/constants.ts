/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IngredientType } from './types';

export const INGREDIENTS: Record<IngredientType, { name: string; label: string; asset: string; model: string }> = {
  bread: {
    name: 'White Bread',
    label: 'Bread',
    asset: '/src/assets/images/bread_slice_papercut.png',
    model: '/src/assets/models/bread.glb',
  },
  lettuce: {
    name: 'Lettuce',
    label: 'Lettuce',
    asset: '/src/assets/images/lettuce_leaf_papercut.png',
    model: '/src/assets/models/lettuce.glb',
  },
  tomato: {
    name: 'Tomato',
    label: 'Tomato',
    asset: '/src/assets/images/tomato_slice_papercut.png',
    model: '/src/assets/models/tomato.glb',
  },
  cheese: {
    name: 'Cheese',
    label: 'Cheese',
    asset: '/src/assets/images/cheese_slice_papercut.png',
    model: '/src/assets/models/cheese.glb',
  },
  bacon: {
    name: 'Bacon',
    label: 'Bacon strip',
    asset: '/src/assets/images/bacon_strip_papercut.png',
    model: '/src/assets/models/bacon.glb',
  },
  mayo: {
    name: 'Mayo',
    label: 'Mayo dollop',
    asset: '/src/assets/images/mayo_dollop_papercut.png',
    model: '/src/assets/models/mayo.glb',
  },
};
