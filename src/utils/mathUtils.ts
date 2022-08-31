export const weightedAverage = (input: number[][]) => {
  let weightedSum = 0;
  for (let i = 0; i < input.length; i++) {
    weightedSum += input[i][1] * input[i][0];
  }
  const totalAmount = input.reduce((partialSum, a) => partialSum + a[1], 0);
  const weightedAverage = weightedSum / totalAmount;
  return weightedAverage;
};
