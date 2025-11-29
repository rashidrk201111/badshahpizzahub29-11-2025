export interface GSTCalculation {
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  is_interstate: boolean;
}

export function calculateGST(
  subtotal: number,
  gstRate: number,
  companyStateOrIsInterstate: string | boolean,
  customerState?: string
): GSTCalculation {
  let isInterstate: boolean;

  if (typeof companyStateOrIsInterstate === 'boolean') {
    isInterstate = companyStateOrIsInterstate;
  } else {
    isInterstate = customerState
      ? companyStateOrIsInterstate.toLowerCase() !== customerState.toLowerCase()
      : false;
  }

  const gstAmount = (subtotal * gstRate) / 100;

  if (isInterstate) {
    return {
      subtotal,
      cgst: 0,
      sgst: 0,
      igst: gstAmount,
      total: subtotal + gstAmount,
      is_interstate: true,
    };
  } else {
    const halfGst = gstAmount / 2;
    return {
      subtotal,
      cgst: halfGst,
      sgst: halfGst,
      igst: 0,
      total: subtotal + gstAmount,
      is_interstate: false,
    };
  }
}

export function calculateItemGST(
  itemTotal: number,
  gstRate: number,
  isInterstate: boolean
) {
  const gstAmount = (itemTotal * gstRate) / 100;

  if (isInterstate) {
    return {
      cgst: 0,
      sgst: 0,
      igst: gstAmount,
      cgstRate: 0,
      sgstRate: 0,
      igstRate: gstRate,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: gstAmount,
    };
  } else {
    const halfGst = gstAmount / 2;
    const halfRate = gstRate / 2;
    return {
      cgst: halfGst,
      sgst: halfGst,
      igst: 0,
      cgstRate: halfRate,
      sgstRate: halfRate,
      igstRate: 0,
      cgst_amount: halfGst,
      sgst_amount: halfGst,
      igst_amount: 0,
    };
  }
}
