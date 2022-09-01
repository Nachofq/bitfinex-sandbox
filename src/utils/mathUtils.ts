import Decimal from "decimal.js";

export const weightedAverage = (input: number[][]) => {
  let weightedSum = 0;
  for (let i = 0; i < input.length; i++) {
    weightedSum += input[i][1] * input[i][0];
  }
  const totalAmount = input.reduce((partialSum, a) => partialSum + a[1], 0);
  const weightedAverage = weightedSum / totalAmount;
  return weightedAverage;
};

export const weightedAverageDecimal = (input: Decimal[][]) => {
  let weightedSum = new Decimal(0);
  let totalAmount = new Decimal(0);
  for (let i = 0; i < input.length; i++) {
    weightedSum = weightedSum.add(input[i][1].times(input[i][0]));
    totalAmount = totalAmount.add(input[i][1]);
  }

  const weightedAverage = weightedSum.div(totalAmount);
  return weightedAverage;
};
