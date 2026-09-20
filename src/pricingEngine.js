import { enforceSystemTypeForDc } from './systemTypeRule';
import { calculateSystemTypePricing } from './pricingRules';
import {
  requiredNumberSetting,
  requiredNestedNumberSetting,
  requiredProductNumber,
  validatePricingSettings,
} from './pricingSettings';
import { assertProductInStock } from './productAvailability';
import { resolveStorageElectricalBoardSelections } from './storageElectricalBoards';

function selectedProducts(rows, catalog, label, { required = false } = {}) {
  if (!Array.isArray(rows) || (required && rows.length === 0)) throw new Error(`No selected ${label}`);
  return (rows || []).map((selection) => {
    const product = (catalog || []).find((item) => item.id === selection.id);
    if (!product) throw new Error(`Unknown selected ${label}: ${selection.id}`);
    assertProductInStock(product, label);
    const quantity = requiredNumberSetting(selection, 'quantity');
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`Invalid ${label} quantity`);
    return { product, quantity };
  });
}

export function panelQuantityForTargetDc(targetDcKw, panelPowerWatts) {
  const target = Number(targetDcKw);
  const watts = Number(panelPowerWatts);
  if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(watts) || watts <= 0) {
    throw new Error('Target DC and panel power must be positive numbers');
  }
  return Math.max(1, Math.round((target * 1000) / watts));
}

export function deriveCanonicalDc(form, settings) {
  const panels = selectedProducts(form?.selectedPanels, settings?.panels, 'panel', { required: true });
  const watts = panels.reduce((sum, { product, quantity }) => {
    const power = requiredProductNumber(product, 'powerWatts', 'panel');
    if (power <= 0) throw new Error('Panel power must be positive to define DC power');
    return sum + quantity * power;
  }, 0);
  return Math.round(watts) / 1000;
}

export function calculateCanonicalPricing(form, settings, { acKw, hasSolarEdge = false, hasSungrow = false } = {}) {
  validatePricingSettings(settings);
  const dcKw = deriveCanonicalDc(form, settings);
  const system = enforceSystemTypeForDc({ ...form, systemSizeKw: dcKw }, dcKw);
  const panels = selectedProducts(system.selectedPanels, settings.panels, 'panel', { required: true });
  const numPanels = panels.reduce((sum, row) => sum + row.quantity, 0);
  const panelsCost = panels.reduce((sum, { product, quantity }) =>
    sum + quantity * requiredProductNumber(product, 'powerWatts', 'panel') *
      requiredProductNumber(product, 'pricePerWattUsd', 'panel') * requiredNumberSetting(settings, 'usdExchangeRate'), 0);

  const hybrid = system.inverterSystemType === 'hybrid';
  const inverters = selectedProducts(
    hybrid ? system.selectedHybridInverters : system.selectedInverters,
    hybrid ? settings.invertersHybrid : settings.inverters,
    'inverter', { required: true }
  );
  const inverterCost = inverters.reduce((sum, { product, quantity }) =>
    sum + requiredProductNumber(product, 'cost', 'inverter') * quantity, 0);
  const hasBatteries = hybrid && Boolean(system.includesBatteries);
  const batteries = hasBatteries
    ? selectedProducts(system.selectedBatteries, settings.batteries, 'battery', { required: true })
    : [];
  const batteryCost = batteries.reduce((sum, { product, quantity }) =>
    sum + requiredProductNumber(product, 'cost', 'battery') * quantity, 0);
  const storageElectricalBoards = hasBatteries
    ? resolveStorageElectricalBoardSelections(system.selectedStorageElectricalBoards, settings.storageElectricalBoards)
    : [];
  const storageElectricalBoardDetailsList = storageElectricalBoards.map((board) => {
    const product = settings.storageElectricalBoards.find((item) => item.id === board.id);
    const unitCost = requiredProductNumber(product, 'cost', 'storage electrical board');
    return { ...board, unitCost, totalCost: unitCost * board.quantity };
  });

  const includesOptimizers = Boolean(system.includesOptimizers) || hasSolarEdge;
  let optimizerKind = null;
  let optimizerDetails = { type: 'ללא', quantity: 0 };
  if (includesOptimizers) {
    if (hasSolarEdge) {
      optimizerKind = Number(acKw) >= 16 ? 'se1to2' : 'se1to1';
      optimizerDetails = {
        type: optimizerKind === 'se1to2' ? 'SolarEdge 1:2' : 'SolarEdge 1:1',
        quantity: optimizerKind === 'se1to2' ? Math.ceil(numPanels / 2) : numPanels,
      };
    } else if (hasSungrow) {
      optimizerKind = 'sungrow';
      optimizerDetails = { type: 'Sungrow (סנגרואו)', quantity: requiredNumberSetting(system, 'sungrowQuantity') };
    } else {
      optimizerKind = 'tigo';
      optimizerDetails = { type: 'Tigo (טייגו)', quantity: requiredNumberSetting(system, 'tigoQuantity') };
    }
  }
  const optimizersCost = optimizerKind
    ? optimizerDetails.quantity * requiredNestedNumberSetting(settings, 'optimizerPrices', optimizerKind)
    : 0;
  const residential = system.systemType === 'residential';
  const typePricing = calculateSystemTypePricing(system, dcKw, settings);
  const setting = (key) => requiredNumberSetting(settings, key);
  const construction = dcKw * setting(system.roofType === 'concrete' ? 'constructionConcretePerKw' : 'constructionOtherPerKw');
  const labor = typePricing.laborCost + (hasBatteries ? setting('hybridBatteryInstallCost') : 0);
  const privateCheck = setting(residential ? 'privateCheckResidential' : 'privateCheckCommercial');
  const electrician = setting(residential ? 'electricianResidential' : 'electricianCommercial');
  const cable = setting(residential ? (hybrid ? 'acCableHybridResidential' : 'acCableOnGridResidential') : 'acCableCommercial');
  const breakdown = {
    panels: panelsCost,
    construction,
    inverter: inverterCost,
    batteries: batteryCost,
    storageElectricalBoards: storageElectricalBoardDetailsList.reduce((sum, board) => sum + board.totalCost, 0),
    optimizers: optimizersCost,
    logistics: setting('logisticsCost'),
    labor,
    engineering: setting('planningCost') + setting('constructorEngineer'),
    electricianAndChecks: privateCheck + electrician,
    electricalBoxes: residential ? setting('electricalBoxResidential') : dcKw * setting('electricalBoxCommercialPerKw'),
    accessories: cable + setting('antennaCost') + setting('communicationLine'),
    washing: system.includesWashing ? setting('washingSystemBase') : 0,
    fees: system.feesPayer === 'company' ? setting('feesCost') : 0,
    productionMeter: residential && system.residentialTrack === 'production_meter' ? setting('productionMeterSurcharge') : 0,
  };
  breakdown.totalCost = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  breakdown.marginValue = typePricing.profitValue;
  breakdown.finalPrice = breakdown.totalCost + breakdown.marginValue;
  return { system, dcKw, panels, inverters, batteries, storageElectricalBoardDetailsList, numPanels, hasBatteries, includesOptimizers, optimizerKind, optimizerDetails, breakdown };
}
