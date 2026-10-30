import { splitShopCategories } from './categories';

describe('splitShopCategories', () => {
  it('keeps fixed kinds as keys and shop-typed names as names', () => {
    expect(splitShopCategories(['grocery', 'Fancy', 'fancy', ' Bangles.Store '])).toEqual({
      fixed: ['grocery'],
      custom: ['Fancy', 'BanglesStore'],
    });
  });

  it('asks for nothing when empty', () => {
    expect(splitShopCategories(['', ' '])).toEqual({ fixed: [], custom: [] });
  });
});
