import { displaySkills, splitSkills } from './skills';

describe('booking skills', () => {
  it('keeps fixed keys and treats anything else as a partner-made skill (with other)', () => {
    expect(splitSkills(['plumber', 'Aquarium cleaning', 'plumber'])).toEqual({
      fixed: ['plumber', 'other'],
      custom: ['Aquarium cleaning'],
    });
  });

  it('cleans names: no dots or colons, no duplicates, at most five', () => {
    const result = splitSkills(['A.C. gas: refill', 'a.c. GAS refill', 'one', 'two', 'three', 'four', 'five', 'six']);
    expect(result.custom).toEqual(['AC gas refill', 'one', 'two', 'three', 'four']);
  });

  it('shows the names in place of "other"', () => {
    expect(displaySkills(['plumber', 'other'], ['Aquarium cleaning'])).toEqual(['plumber', 'Aquarium cleaning']);
    expect(displaySkills(['plumber'], [])).toEqual(['plumber']);
  });
});
