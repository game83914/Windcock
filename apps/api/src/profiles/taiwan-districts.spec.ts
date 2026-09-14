import { isValidDistrict, TAIWAN_DISTRICTS } from './taiwan-districts';

describe('Taiwan districts', () => {
  it('contains all 22 Taiwan cities and counties', () => {
    expect(Object.keys(TAIWAN_DISTRICTS)).toHaveLength(22);
  });

  it('validates a district against its selected region', () => {
    expect(isValidDistrict('臺北市', '中正區')).toBe(true);
    expect(isValidDistrict('新北市', '中正區')).toBe(false);
    expect(isValidDistrict('海外', null)).toBe(true);
  });
});
