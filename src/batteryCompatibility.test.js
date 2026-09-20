import { productBrandFromName, compatibleBatteries, assertBatteryCompatibility } from './batteryCompatibility';

const settings = {
  invertersHybrid: [{ id: 's', name: 'SOLIS HYBRID50KW' }, { id: 'g', name: 'Growatt 20kW' }],
  batteries: [
    { id: 'bs', name: 'סוללה SOLIS 5kWh' },
    { id: 'bg', name: '5KW HV GROWATT סוללה' },
    { id: 'soldout', name: 'Solis 10kWh', inStock: false },
    { id: 'unknown', name: '5kWh battery' },
  ],
};
const form = (id) => ({ inverterSystemType: 'hybrid', includesBatteries: true, selectedHybridInverters: [{ id, quantity: 1 }] });

test.each([['SOLIS HYBRID50KW', 'solis'], ['SOLIS15 LV', 'solis'], ['GROWTT WIT25', 'growatt'], ['סוליס 20', 'solis'], ['5KW HV growatt סוללה', 'growatt'], ['גרואט 5', 'growatt'], ['unknown', null]])('brand of %s is %s', (name, brand) => {
  expect(productBrandFromName(name)).toBe(brand);
});

test('available battery list follows hybrid inverter brand and stock', () => {
  expect(compatibleBatteries(form('s'), settings).map((b) => b.id)).toEqual(['bs']);
  expect(compatibleBatteries(form('g'), settings).map((b) => b.id)).toEqual(['bg']);
  expect(compatibleBatteries(form('missing'), settings)).toEqual([]);
  expect(compatibleBatteries({ ...form('s'), inverterSystemType: 'ongrid' }, settings)).toEqual([]);
});

test('switching inverter rejects the previous battery selection', () => {
  const selectedBatteries = [{ id: 'bs', quantity: 2 }];
  expect(() => assertBatteryCompatibility({ ...form('s'), selectedBatteries }, settings)).not.toThrow();
  expect(() => assertBatteryCompatibility({ ...form('g'), selectedBatteries }, settings)).toThrow();
  expect(() => assertBatteryCompatibility({ ...form('s'), selectedBatteries: [{ id: 'bg', quantity: 1 }] }, settings)).toThrow();
});

test('multiple inverter brands allow batteries matching a selected brand only', () => {
  expect(compatibleBatteries({ ...form('s'), selectedHybridInverters: [{ id: 's', quantity: 1 }, { id: 'g', quantity: 1 }] }, settings).map((b) => b.id)).toEqual(['bs', 'bg']);
});
